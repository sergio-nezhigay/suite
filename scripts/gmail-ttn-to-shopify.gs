/**
 * Gmail → Shopify: Nova Poshta TTNs from supplier replies.
 *
 * Runs in Google Apps Script (script.google.com) under nezhihai@gmail.com, NOT in Gadget,
 * so polling the mailbox costs no Gadget CPU. Gadget is called only when TTNs are found.
 *
 * Setup:
 *   1. New Apps Script project → paste this file.
 *   2. Project Settings → Script Properties:
 *        SECRET   = same value as Gadget env var DECLARATION_EMAIL_SECRET
 *        ENDPOINT = (optional) defaults to production route below;
 *                   for testing use https://admin-action-block--development.gadget.app/declaration/from-email
 *   3. Run testParse() once (check the log), then run install() once to create the 15-minute trigger.
 *
 * Threads get label "ttn-done" when every TTN was applied (or was already there),
 * or "ttn-check" when something needs a human look (unmatched counts, not found, ambiguous, error).
 */

var SUPPLIER = 'asd1134@ukr.net';
var DEFAULT_ENDPOINT = 'https://admin-action-block.gadget.app/declaration/from-email';
var LABEL_DONE = 'ttn-done';
var LABEL_CHECK = 'ttn-check';

var TTN_RE = /(?:^|\D)((?:20|59)\d{12})(?!\d)/g;
var PHONE_RE = /\+?(380\d{9})(?!\d)/;
// Order № is the first column; a № later in the line is an address ("відділення №372")
var ORDER_RE = /^[\s>|*]*№\s?(\d{3,})/;

function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(15).create();
}

function run() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  var endpoint = props.getProperty('ENDPOINT') || DEFAULT_ENDPOINT;
  if (!secret) throw new Error('Script property SECRET is not set');

  var done = GmailApp.getUserLabelByName(LABEL_DONE) || GmailApp.createLabel(LABEL_DONE);
  var check = GmailApp.getUserLabelByName(LABEL_CHECK) || GmailApp.createLabel(LABEL_CHECK);

  var query = 'from:' + SUPPLIER + ' subject:Замовлення newer_than:7d -label:' + LABEL_DONE + ' -label:' + LABEL_CHECK;
  var threads = GmailApp.search(query, 0, 30);

  threads.forEach(function (thread) {
    var items = [];
    var countsOk = true;

    thread.getMessages().forEach(function (msg) {
      if (msg.getFrom().indexOf(SUPPLIER) === -1) return;
      var parsed = parse(msg.getPlainBody());
      if (!parsed.ok) countsOk = false;
      items = items.concat(parsed.items);
    });

    // Supplier message without any TTN yet (e.g. a question) — leave it for the next run
    if (items.length === 0 && countsOk) return;

    if (!countsOk) {
      thread.addLabel(check);
      console.log('ttn-check (count mismatch): ' + thread.getFirstMessageSubject() + ' ' + thread.getId());
      return;
    }

    var response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ secret: secret, items: items }),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      // Transient/server problem: no label, so the next run retries
      console.error('HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
      return;
    }

    var results = JSON.parse(response.getContentText()).results || [];
    var allGood = results.length > 0 && results.every(function (r) {
      return r.status === 'fulfilled' || r.status === 'already';
    });
    thread.addLabel(allGood ? done : check);
    console.log((allGood ? 'ttn-done: ' : 'ttn-check: ') + JSON.stringify(results));
  });
}

/**
 * Pairs each TTN with a customer row (a line containing a phone).
 * Handles both reply styles seen from the supplier:
 *   - TTN on top, then the quoted row(s)           → TTNs go to the following rows in order
 *   - quoted row, then its TTN on the next line    → TTN goes to the row just above it
 */
function parse(body) {
  var rows = [];
  var pending = [];

  body.split(/\r?\n/).forEach(function (line) {
    var phoneMatch = line.match(PHONE_RE);
    if (phoneMatch) {
      var orderMatch = line.match(ORDER_RE);
      rows.push({
        phone: '+' + phoneMatch[1],
        orderName: orderMatch ? '№' + orderMatch[1] : undefined,
        ttn: pending.length ? pending.shift() : undefined,
      });
    }

    var lineWithoutPhone = phoneMatch ? line.replace(phoneMatch[0], ' ') : line;
    var m;
    TTN_RE.lastIndex = 0;
    while ((m = TTN_RE.exec(lineWithoutPhone)) !== null) {
      var ttn = m[1];
      var target = null;
      for (var i = rows.length - 1; i >= 0; i--) {
        if (!rows[i].ttn) { target = rows[i]; break; }
      }
      if (target) target.ttn = ttn;
      else pending.push(ttn);
    }
  });

  var withTtn = rows.filter(function (r) { return r.ttn; });
  var ok = pending.length === 0 && withTtn.length === rows.length;

  return {
    ok: ok || (withTtn.length === 0 && pending.length === 0), // no TTNs at all is not an error, just nothing to do
    items: ok ? withTtn.map(function (r) {
      var item = { ttn: r.ttn, phone: r.phone };
      if (r.orderName) item.orderName = r.orderName;
      return item;
    }) : [],
  };
}

function testParse() {
  var single =
    '20451547485093\n\n' +
    '28 сентября 2026, 17:51:03, От info@informatica.com.ua:\n' +
    'Phone First Name Last Name City Address Product Barcode Qty Price Cost Delta Payment\n' +
    '+380509764286 Павло Пронякін Київ 138 SODIMM DDR4 4GB 2133 MHz Hynix HMA451S6AFR8N-TF 1 920 800 120 Накладений платіж';
  var multi =
    '28 сентября 2026, 11:43:40, От info@informatica.com.ua:\n' +
    'Phone First Name Last Name City Address Product Barcode Qty Price Cost Delta Payment\n' +
    '+380685390270 Сергій Зелінський Нетішин 2 Samsung 4 GB SODIMM DDR4 2400MHz PC-1920 M471A5244BB0-CRC 1 1172 850 322 Накладений платіж\n' +
    '20451547447210\n' +
    '+380987400318 Роман Гречаный Ізюм харківська область 3 SODIMM DDR4 8Gb 2400 MHz MICRON () CT8G4SFS824A 1 2395 2000 395 Накладений платіж\n' +
    '20451547450421\n' +
    '+380507057153 Ірина Смалева Київ Нова Пошта відділення 123 SO-DIMM DDR4 8GB 3200MHz Samsung M471A1K43DB1-CWE 1 2596 2200 396 Накладений платіж\n' +
    '20451547451638';
  var withOrder =
    '20451547485093\n' +
    'Order Phone First Name ...\n' +
    '№15795 +380509764286 Павло Пронякін Київ 138 SODIMM 1 920 800 120 Накладений платіж';
  var addressNo =
    '20451544410033\n' +
    '+380674456969 Владислав Кіньов Київ відділення №372: вул. Вишняківська, 1 SODIMM 1 1880 1700 180 Накладений платіж';
  var mismatch =
    '+380685390270 Сергій ...\n20451547447210\n+380987400318 Роман ...';

  console.log(JSON.stringify(parse(single)));
  console.log(JSON.stringify(parse(multi)));
  console.log(JSON.stringify(parse(withOrder)));
  console.log(JSON.stringify(parse(addressNo)));
  console.log(JSON.stringify(parse(mismatch)));
}

// Allow running testParse() with Node for local checks
if (typeof module !== 'undefined') module.exports = { parse: parse, testParse: testParse };
