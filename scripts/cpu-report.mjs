#!/usr/bin/env node
// @ts-nocheck  (local ops script, plain JS)
// Collects the "cpu" / "boot" log lines (api/utilities/cpuTracker.ts) from Gadget production
// and summarises where CPU time goes per day.
//
//   node scripts/cpu-report.mjs            collect new lines, then print the summary for the last 3 days
//   node scripts/cpu-report.mjs --days 7   summary window
//   node scripts/cpu-report.mjs --no-collect
//
// Why collect every few hours: `ggt logs` returns only the newest 500 lines and Gadget keeps
// ~1 day of logs on the Hobby plan, so older lines can't be fetched later.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = path.join(ROOT, 'scripts', '.cpu-log.jsonl');
const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 3;

const keyOf = (f) => (f.boot ? `boot|${f.bootId}` : `cpu|${f.bootId}|${f.at}|${f.name}|${f.cpuMs}`);

function readStore() {
  if (!fs.existsSync(STORE)) return [];
  return fs.readFileSync(STORE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function collect(existing) {
  const seen = new Set(existing.map(keyOf));
  const start = new Date(Date.now() - 24 * 3600e3).toISOString();
  const out = execSync(
    `npx ggt logs --app admin-action-block --env production --json --my-logs --start ${start}`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 50e6, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const fresh = [];
  for (const line of out.split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const f = e.fields ?? {};
    if (!(f.cpu || f.boot) || !f.at) continue;
    // Gadget lifts our `name` field to the top-level logger name and stringifies numbers
    const rec = { at: f.at, boot: !!f.boot, bootId: f.bootId, name: f.boot ? f.trigger : (f.name ?? e.name),
      cpuMs: Number(f.cpuMs ?? f.bootCpuMs ?? 0), wallMs: Number(f.wallMs ?? 0),
      uptimeS: Number(f.uptimeS ?? 0), rssMb: Number(f.rssMb ?? 0) };
    if (seen.has(keyOf(rec))) continue;
    seen.add(keyOf(rec));
    fresh.push(rec);
  }
  if (fresh.length) fs.appendFileSync(STORE, fresh.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return fresh.length;
}

// Kyiv calendar day, to match how the shop thinks about "a day"
const dayOf = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
const fmt = (ms) => (ms >= 60e3 ? `${(ms / 60e3).toFixed(1)} min` : `${(ms / 1e3).toFixed(1)} s`);

function summarise(records) {
  const since = Date.now() - days * 86400e3;
  const byDay = new Map();
  for (const r of records) {
    if (Date.parse(r.at) < since) continue;
    const d = byDay.get(dayOf(r.at)) ?? { boots: 0, bootMs: 0, maxRss: 0, workMs: 0, names: new Map() };
    if (r.boot) {
      d.boots++; d.bootMs += r.cpuMs; d.maxRss = Math.max(d.maxRss, r.rssMb ?? 0);
    } else {
      d.workMs += r.cpuMs;
      const n = d.names.get(r.name) ?? { calls: 0, cpuMs: 0, wallMs: 0 };
      n.calls++; n.cpuMs += r.cpuMs; n.wallMs += r.wallMs ?? 0;
      d.names.set(r.name, n);
    }
    byDay.set(dayOf(r.at), d);
  }
  if (!byDay.size) return console.log('No cpu/boot lines yet (deployed? collected?).');
  for (const [day, d] of [...byDay].sort()) {
    console.log(`\n${day}  measured CPU ${fmt(d.bootMs + d.workMs)}  =  starts ${fmt(d.bootMs)} (${d.boots}×, avg ${fmt(d.bootMs / (d.boots || 1))}, max mem ${d.maxRss} MB)  +  work ${fmt(d.workMs)}`);
    const top = [...d.names].sort((a, b) => b[1].cpuMs - a[1].cpuMs).slice(0, 8);
    for (const [name, n] of top) {
      console.log(`  ${fmt(n.cpuMs).padStart(9)}  ${String(n.calls).padStart(4)} calls  (wall ${fmt(n.wallMs)})  ${name}`);
    }
  }
  console.log('\nCompare "measured CPU" with Ops dashboard → Active CPU time (last 24 h).');
}

let records = readStore();
if (!args.includes('--no-collect')) {
  const added = collect(records);
  console.log(`Collected ${added} new line(s) → ${path.relative(ROOT, STORE)}`);
  records = readStore();
}
summarise(records);
