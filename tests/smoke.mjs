/* Goat Farm BD \u2014 headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the goat-farm-bd folder)
 * Loads index.html over file:// with ?asof=2026-11-19, drives the real UI,
 * collects console/page errors, asserts visible state at 1440px and 390px.
 * All source in this file is ASCII; Bengali is detected by Unicode
 * code-point range (U+0980-U+09FF), never by literal characters. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const BASE = 'file:///home/hatch/workspace/muse-project-factory/builds/goat-farm-bd/index.html';
const PORT = 9233;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' \u2014 ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function nav(url) {
  await send('Page.navigate', { url });
  await sleep(1200);
}
async function clickTab(name) {
  await evalJs(`document.querySelector('#tabs .tabbtn[data-tab="${name}"]').click()`);
  await sleep(300);
}
const HAS_BN = `(s) => [...String(s)].some((c) => { const n = c.codePointAt(0); return n >= 0x0980 && n <= 0x09FF; })`;
async function importJson(jsonText) {
  await evalJs(`(() => {
    const dt = new DataTransfer();
    const file = new File([\`${jsonText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`], 'backup.json', { type: 'application/json' });
    dt.items.add(file);
    const input = document.querySelector('#importFile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true; })()`);
  await sleep(500);
}
const viewText = `document.querySelector('#view').textContent`;
const statVals = `[...document.querySelectorAll('#view .stat-value')].map(e => e.textContent)`;

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ---- Pass 1: fresh load, empty state ---- */
  await nav(BASE + '?asof=2026-11-19');
  await evalJs(`localStorage.clear()`);
  await nav(BASE + '?asof=2026-11-19');
  check('title renders', (await evalJs(`document.title`)).includes('Goat Farm BD'));
  check('h1 renders', (await evalJs(`document.querySelector('h1').textContent`)).includes('Goat Farm BD'));
  check('6 tabs', await evalJs(`document.querySelectorAll('#tabs .tabbtn').length`) === 6);
  check('dash alive = 0', (await evalJs(statVals))[0] === '0');
  check('dash invested = 0', (await evalJs(statVals))[1] === '\u09f30.00');
  check('dash nothing due', await evalJs(`${viewText}.includes('Nothing due')`));

  /* ---- Pass 2: goat validation \u2014 empty tag rejected ---- */
  await clickTab('goats');
  check('goats empty message', await evalJs(`${viewText}.includes('No goats yet')`));
  await evalJs(`(() => { document.querySelector('#fTag').value = ''; document.querySelector('#fPrice').value = '8500'; return true; })()`);
  await evalJs(`document.querySelector('#goatForm button[type="submit"]').click()`);
  await sleep(300);
  check('empty tag rejected, error shown', await evalJs(`!document.querySelector('#goatMsg').hidden && document.querySelector('#goatMsg').textContent.length > 0`));
  check('still 0 goats after rejected add', await evalJs(`(JSON.parse(localStorage.getItem('goatFarmBD.v1') || '{"goats":[]}')).goats.length === 0`));

  /* ---- Pass 3: add doe BB-01 + buck BB-02 ---- */
  await evalJs(`(() => {
    document.querySelector('#fTag').value = 'BB-01';
    document.querySelector('#fName').value = 'Kali';
    document.querySelector('#fBreed').value = 'Black Bengal';
    document.querySelector('#fSex').value = 'doe';
    document.querySelector('#fDob').value = '2025-06-01';
    document.querySelector('#fAcq').value = '2025-07-01';
    document.querySelector('#fPrice').value = '8500';
    return true; })()`);
  await evalJs(`document.querySelector('#goatForm button[type="submit"]').click()`);
  await sleep(300);
  check('doe added, list shows BB-01', await evalJs(`${viewText}.includes('BB-01')`));
  check('doe age shows 1 yr 5 mo', await evalJs(`${viewText}.includes('1 yr 5 mo')`));
  await evalJs(`(() => {
    document.querySelector('#fTag').value = 'BB-02';
    document.querySelector('#fName').value = '';
    document.querySelector('#fBreed').value = 'Jamunapari';
    document.querySelector('#fSex').value = 'buck';
    document.querySelector('#fDob').value = '2025-01-15';
    document.querySelector('#fAcq').value = '2025-02-01';
    document.querySelector('#fPrice').value = '12000';
    return true; })()`);
  await evalJs(`document.querySelector('#goatForm button[type="submit"]').click()`);
  await sleep(300);
  check('buck added', await evalJs(`${viewText}.includes('BB-02')`));
  /* duplicate tag rejected */
  await evalJs(`(() => { document.querySelector('#fTag').value = 'BB-01'; return true; })()`);
  await evalJs(`document.querySelector('#goatForm button[type="submit"]').click()`);
  await sleep(300);
  check('duplicate tag rejected', await evalJs(`JSON.parse(localStorage.getItem('goatFarmBD.v1')).goats.length === 2`));

  /* ---- Pass 4: search filter ---- */
  await evalJs(`(() => { const i = document.querySelector('#qSearch'); i.value = 'kali'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await sleep(400);
  check('search kali shows BB-01 only', await evalJs(`${viewText}.includes('BB-01') && !${viewText}.includes('BB-02')`));
  await evalJs(`(() => { const i = document.querySelector('#qSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await sleep(400);

  /* ---- Pass 5: health record with next due ---- */
  await clickTab('health');
  await evalJs(`(() => {
    document.querySelector('#hDetail').value = 'PPR vaccine';
    document.querySelector('#hDate').value = '2026-11-10';
    document.querySelector('#hCost').value = '120';
    document.querySelector('#hNext').value = '2026-11-25';
    return true; })()`);
  await evalJs(`document.querySelector('#healthForm button[type="submit"]').click()`);
  await sleep(300);
  check('health added, shows PPR', await evalJs(`${viewText}.includes('PPR vaccine')`));
  check('health shows next due 2026-11-25', await evalJs(`${viewText}.includes('2026-11-25')`));

  /* ---- Pass 6: breeding \u2014 auto expected date +150 ---- */
  await clickTab('breeding');
  await evalJs(`(() => {
    document.querySelector('#bDate').value = '2026-06-22';
    document.querySelector('#bDate').dispatchEvent(new Event('change', { bubbles: true }));
    return true; })()`);
  await sleep(300);
  check('expected kidding auto 2026-11-19', await evalJs(`document.querySelector('#bExpected').value`) === '2026-11-19');
  await evalJs(`document.querySelector('#breedForm button[type="submit"]').click()`);
  await sleep(300);
  check('breeding added, shows 2026-11-19', await evalJs(`${viewText}.includes('2026-11-19')`));

  /* ---- Pass 7: expense + dashboard math ---- */
  await clickTab('money');
  await evalJs(`(() => {
    document.querySelector('#eDate').value = '2026-11-01';
    document.querySelector('#eCat').value = 'feed';
    document.querySelector('#eAmt').value = '2000';
    document.querySelector('#eNote').value = 'Grass + bran';
    return true; })()`);
  await evalJs(`document.querySelector('#expForm button[type="submit"]').click()`);
  await sleep(300);
  check('expense added', await evalJs(`${viewText}.includes('2,000.00')`));
  await clickTab('dash');
  check('dash alive = 2', (await evalJs(statVals))[0] === '2');
  check('dash invested = 22620', (await evalJs(statVals))[1] === '\u09f322,620.00');
  check('dash profit = -22620', (await evalJs(statVals))[2] === '-\u09f322,620.00');
  check('dash expecting = 1', (await evalJs(statVals))[3] === '1');
  check('dash upcoming vacc shows BB-01', await evalJs(`${viewText}.includes('BB-01') && ${viewText}.includes('2026-11-25')`));
  check('dash upcoming kidding today', await evalJs(`${viewText}.includes('2026-11-19')`));

  /* ---- Pass 8: sell the buck ---- */
  await clickTab('money');
  await evalJs(`(() => {
    const sel = document.querySelector('#sGoat');
    const opt = [...sel.options].find(o => o.textContent.startsWith('BB-02'));
    sel.value = opt.value;
    document.querySelector('#sDate').value = '2026-11-15';
    document.querySelector('#sPrice').value = '15000';
    document.querySelector('#sBuyer').value = 'Karim';
    return true; })()`);
  await evalJs(`document.querySelector('#saleForm button[type="submit"]').click()`);
  await sleep(300);
  check('sale recorded, shows Karim', await evalJs(`${viewText}.includes('Karim')`));
  await clickTab('dash');
  check('dash alive = 1 after sale', (await evalJs(statVals))[0] === '1');
  check('dash profit = -7620 after sale', (await evalJs(statVals))[2] === '-\u09f37,620.00');
  await clickTab('goats');
  check('sold buck listed as Sold', await evalJs(`${viewText}.includes('BB-02') && ${viewText}.includes('Sold')`));

  /* ---- Pass 9: BN toggle + persistence ---- */
  await evalJs(`document.querySelector('#langBtn').click()`);
  await sleep(300);
  check('BN: h1 has Bengali', await evalJs(`(${HAS_BN})(document.querySelector('h1').textContent)`));
  await clickTab('dash');
  check('BN: alive stat is Bengali digit', (await evalJs(statVals))[0] === '\u09e7');
  await nav(BASE + '?asof=2026-11-19');
  check('BN persists across reload', await evalJs(`(${HAS_BN})(document.querySelector('h1').textContent)`));
  check('data persists (alive 1)', (await evalJs(statVals))[0] === '\u09e7');
  await evalJs(`document.querySelector('#langBtn').click()`);
  await sleep(300);

  /* ---- Pass 10: data tab \u2014 bad import, good import, erase ---- */
  await clickTab('data');
  await importJson('{"version":9}');
  check('bad import rejected', await evalJs(`document.querySelector('#dataMsg').textContent.includes('failed')`));
  check('data intact after bad import', await evalJs(`JSON.parse(localStorage.getItem('goatFarmBD.v1')).goats.length === 2`));
  await importJson(JSON.stringify({ version: 1, goats: [{ id: 'x1', tag: 'IMP-1', name: '', breed: 'Beetal', sex: 'doe', dob: '2026-01-01', acquiredDate: '2026-02-01', purchasePrice: 9000, status: 'alive', notes: '' }], health: [], breeding: [], expenses: [], sales: [] }));
  check('good import accepted', await evalJs(`document.querySelector('#dataMsg').textContent.includes('Imported')`));
  await clickTab('goats');
  check('imported goat shows IMP-1', await evalJs(`${viewText}.includes('IMP-1')`));
  await clickTab('data');
  await evalJs(`(() => { document.querySelector('#eraseBtn').click(); document.querySelector('#eraseInput').value = 'DELETE'; return true; })()`);
  await sleep(200);
  await evalJs(`document.querySelector('#eraseForm button[type="submit"]').click()`);
  await sleep(300);
  check('erase message shown', await evalJs(`document.querySelector('#dataMsg').textContent.includes('erased')`));
  check('erase restores 0 goats', await evalJs(`JSON.parse(localStorage.getItem('goatFarmBD.v1')).goats.length === 0`));

  /* ---- Pass 11: 390px mobile, no horizontal overflow ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(400);
  for (const t of ['dash', 'goats', 'health', 'breeding', 'money', 'data']) {
    await clickTab(t);
    check('390px ' + t + ' no overflow', await evalJs(`document.documentElement.scrollWidth <= 390`));
  }

  /* ---- Pass 12: errors + network ---- */
  check('0 console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  const badNet = netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && u !== 'about:blank');
  check('0 non-file network requests', badNet.length === 0, badNet.join(', ').slice(0, 200));
} catch (e) {
  console.log('SMOKE ERROR: ' + (e && e.message ? e.message : e));
  fail++;
} finally {
  try { await send('Page.close'); } catch { /* already closed */ }
  chrome.kill();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail || errors.length ? 1 : 0);
