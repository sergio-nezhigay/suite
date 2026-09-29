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
 *        ENDPOINT = (optional) defaults to the production route below
 *   3. Run testParse() once (check the log), then run install() once to create the 15-minute trigger.
 *
 * Threads get label "ttn-done" when every TTN was applied (or was already there),
 * or "ttn-check" when something needs a human look (no order number, unmatched counts, not found, error).
 */

var SUPPLIER = 'asd1134@ukr.net';
var DEFAULT_ENDPOINT = 'https://admin-action-block.gadget.app/declaration/from-email';
var LABEL_DONE = 'ttn-done';
var LABEL_CHECK = 'ttn-check';

var TTN_RE = /(?:^|\D)((?:20|59)\d{12})(?!\d)/g;
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
 * Pairs each TTN with a customer row (a line starting with the order number, e.g. "№15791 +380...").
 * Handles both reply styles seen from the supplier:
 *   - TTN on top, then the quoted row(s)           → TTNs go to the following rows in order
 *   - quoted row, then its TTN on the next line    → TTN goes to the row just above it
 * Replies without order numbers (or with unequal counts) return ok:false → label ttn-check.
 */
function parse(body) {
  var rows = [];
  var pending = [];

  body.split(/\r?\n/).forEach(function (line) {
    var orderMatch = line.match(ORDER_RE);
    if (orderMatch) {
      rows.push({
        orderName: '№' + orderMatch[1],
        ttn: pending.length ? pending.shift() : undefined,
      });
    }

    var m;
    TTN_RE.lastIndex = 0;
    while ((m = TTN_RE.exec(line)) !== null) {
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
    items: ok ? withTtn.map(function (r) { return { orderName: r.orderName, ttn: r.ttn }; }) : [],
  };
}

function testParse() {
  // Real reply, single order: TTN on top
  var single =
    '20451548109010\n' +
    '29 сентября 2026, 14:02:14, От info@informatica.com.ua:\n' +
    'Order Phone First Name Last Name City Address Product Barcode Qty Price Cost Delta Payment\n' +
    '№15791 +380934708808 Олександр Михальчук Харків НП 1 Kingston 8 GB (2x4GB) DDR3 1333 MHz Hype KHX1333C9D3B1K2/8G 1 946 700 246 Накладений платіж';
  // Multi order: TTN under each row; "відділення №123" in an address must not count as an order
  var multi =
    'Order Phone First Name Last Name City Address Product Barcode Qty Price Cost Delta Payment\n' +
    '№15801 +380685390270 Сергій Зелінський Нетішин 2 Samsung 4 GB SODIMM 1 1172 850 322 Накладений платіж\n' +
    '20451547447210\n' +
    '№15802 +380987400318 Роман Гречаный Ізюм 3 SODIMM DDR4 8Gb 1 2395 2000 395 Накладений платіж\n' +
    '20451547450421\n' +
    '№15803 +380507057153 Ірина Смалева Київ Нова Пошта відділення №123 SO-DIMM 1 2596 2200 396 Накладений платіж\n' +
    '20451547451638';
  // Old format without order numbers → ttn-check
  var noOrder =
    '20451547485093\n' +
    '+380509764286 Павло Пронякін Київ 138 SODIMM 1 920 800 120 Накладений платіж';
  // Two orders, one TTN → ttn-check
  var mismatch =
    '№15801 +380685390270 Сергій ...\n20451547447210\n№15802 +380987400318 Роман ...';

  console.log(JSON.stringify(parse(single)));   // ok, 1 item
  console.log(JSON.stringify(parse(multi)));    // ok, 3 items
  console.log(JSON.stringify(parse(noOrder)));  // ok:false
  console.log(JSON.stringify(parse(mismatch))); // ok:false
}

// Allow running testParse() with Node for local checks
if (typeof module !== 'undefined') module.exports = { parse: parse, testParse: testParse };
