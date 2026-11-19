/* Goat Farm BD \u2014 pure logic (Node-testable, no DOM).
 * Works in the browser (window.GoatFarmLogic) and in Node (module.exports).
 * All dates are ISO YYYY-MM-DD strings. Money is in Taka (BDT). */
(function (root) {
  'use strict';

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  function parseISODate(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function isValidDate(s) { return parseISODate(s) !== null; }

  function daysBetween(a, b) {
    var da = parseISODate(a), db = parseISODate(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  }

  function addDays(s, n) {
    var d = parseISODate(s);
    if (!d) return null;
    var out = new Date(d.getTime() + n * 86400000);
    return out.toISOString().slice(0, 10);
  }

  function todayISO() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function round2(n) { return Math.round((+n + Number.EPSILON) * 100) / 100; }

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (ch) { return BN_DIGITS[+ch]; });
  }

  function groupThousands(intPart) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatNum(n, lang) {
    if (typeof n !== 'number' || isNaN(n)) return lang === 'bn' ? '\u09e6' : '0';
    var s = String(Math.trunc(n));
    var neg = s[0] === '-';
    if (neg) s = s.slice(1);
    s = groupThousands(s);
    if (neg) s = '-' + s;
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  function formatMoney(n, lang) {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    var fixed = (Math.round(n * 100) / 100).toFixed(2);
    var parts = fixed.split('.');
    var intPart = groupThousands(parts[0].replace('-', ''));
    var out = (n < 0 ? '-' : '') + '\u09f3' + intPart + '.' + parts[1];
    return lang === 'bn' ? toBnDigits(out) : out;
  }

  /* Gestation for goats is about 150 days (range 145-155). We use 150. */
  var GESTATION_DAYS = 150;

  function expectedKiddingDate(breedingDate) {
    return addDays(breedingDate, GESTATION_DAYS);
  }

  function ageMonths(dob, asof) {
    var d = parseISODate(dob), a = parseISODate(asof);
    if (!d || !a) return null;
    var months = (a.getUTCFullYear() - d.getUTCFullYear()) * 12 + (a.getUTCMonth() - d.getUTCMonth());
    if (a.getUTCDate() < d.getUTCDate()) months -= 1;
    return months < 0 ? 0 : months;
  }

  function ageLabel(dob, asof, lang) {
    var m = ageMonths(dob, asof);
    if (m === null) return '';
    if (m < 12) {
      return lang === 'bn' ? formatNum(m, 'bn') + ' \u09ae\u09be\u09b8' : m + (m === 1 ? ' month' : ' months');
    }
    var y = Math.floor(m / 12), rem = m % 12;
    if (lang === 'bn') {
      return formatNum(y, 'bn') + ' \u09ac\u099b\u09b0' + (rem ? ' ' + formatNum(rem, 'bn') + ' \u09ae\u09be\u09b8' : '');
    }
    return y + (y === 1 ? ' yr' : ' yrs') + (rem ? ' ' + rem + ' mo' : '');
  }

  /* ---------- validation ---------- */

  function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }

  function validateGoat(g, existingTags) {
    var errors = [];
    if (!g || typeof g !== 'object') return ['Invalid goat record'];
    if (!g.tag || typeof g.tag !== 'string' || !g.tag.trim()) errors.push('Tag is required');
    else if (existingTags && existingTags.indexOf(g.tag.trim()) !== -1) errors.push('Tag already exists');
    if (g.name && g.name.length > 40) errors.push('Name is too long (max 40)');
    if (['Black Bengal', 'Jamunapari', 'Beetal', 'Boer', 'Cross', 'Other'].indexOf(g.breed) === -1) errors.push('Unknown breed');
    if (['buck', 'doe', 'kid'].indexOf(g.sex) === -1) errors.push('Unknown sex');
    if (g.dob && !isValidDate(g.dob)) errors.push('Birth date is invalid');
    if (g.acquiredDate && !isValidDate(g.acquiredDate)) errors.push('Acquired date is invalid');
    if (g.purchasePrice !== undefined && g.purchasePrice !== '' && (!isFiniteNum(g.purchasePrice) || g.purchasePrice < 0)) errors.push('Purchase price must be 0 or more');
    if (['alive', 'sold', 'dead'].indexOf(g.status) === -1) errors.push('Unknown status');
    return errors;
  }

  function validateHealth(h, goatIds) {
    var errors = [];
    if (!h || typeof h !== 'object') return ['Invalid health record'];
    if (!h.goatId || goatIds.indexOf(h.goatId) === -1) errors.push('Goat is required');
    if (['vaccination', 'deworming', 'treatment', 'checkup'].indexOf(h.kind) === -1) errors.push('Unknown event type');
    if (!isValidDate(h.date)) errors.push('Date is invalid');
    if (!h.detail || !String(h.detail).trim()) errors.push('Medicine / detail is required');
    if (h.cost !== undefined && h.cost !== '' && (!isFiniteNum(h.cost) || h.cost < 0)) errors.push('Cost must be 0 or more');
    if (h.nextDue && !isValidDate(h.nextDue)) errors.push('Next due date is invalid');
    return errors;
  }

  function validateBreeding(b, doeIds) {
    var errors = [];
    if (!b || typeof b !== 'object') return ['Invalid breeding record'];
    if (!b.doeId || doeIds.indexOf(b.doeId) === -1) errors.push('Doe is required');
    if (!isValidDate(b.breedingDate)) errors.push('Breeding date is invalid');
    if (b.expectedDate && !isValidDate(b.expectedDate)) errors.push('Expected date is invalid');
    if (b.actualDate && !isValidDate(b.actualDate)) errors.push('Kidding date is invalid');
    if (b.kidsBorn !== undefined && b.kidsBorn !== '' && (!Number.isInteger(b.kidsBorn) || b.kidsBorn < 0 || b.kidsBorn > 6)) errors.push('Kids born must be 0-6');
    if (b.kidsAlive !== undefined && b.kidsAlive !== '' && (!Number.isInteger(b.kidsAlive) || b.kidsAlive < 0 || b.kidsAlive > 6)) errors.push('Kids alive must be 0-6');
    if (Number.isInteger(b.kidsBorn) && Number.isInteger(b.kidsAlive) && b.kidsAlive > b.kidsBorn) errors.push('Kids alive cannot exceed kids born');
    if (['expecting', 'kidded', 'failed'].indexOf(b.status) === -1) errors.push('Unknown status');
    return errors;
  }

  function validateExpense(e) {
    var errors = [];
    if (!e || typeof e !== 'object') return ['Invalid expense record'];
    if (!isValidDate(e.date)) errors.push('Date is invalid');
    if (['feed', 'medicine', 'transport', 'shelter', 'other'].indexOf(e.category) === -1) errors.push('Unknown category');
    if (!isFiniteNum(e.amount) || e.amount <= 0) errors.push('Amount must be more than 0');
    return errors;
  }

  function validateSale(s, goatMap) {
    var errors = [];
    if (!s || typeof s !== 'object') return ['Invalid sale record'];
    if (!s.goatId || !goatMap[s.goatId]) errors.push('Goat is required');
    else if (goatMap[s.goatId].status !== 'alive') errors.push('Only a live goat can be sold');
    if (!isValidDate(s.date)) errors.push('Date is invalid');
    if (!isFiniteNum(s.price) || s.price <= 0) errors.push('Price must be more than 0');
    return errors;
  }

  /* ---------- dashboard ---------- */

  function emptyState() {
    return { version: 1, goats: [], health: [], breeding: [], expenses: [], sales: [] };
  }

  function computeDashboard(state, asof) {
    var alive = state.goats.filter(function (g) { return g.status === 'alive'; });
    var does = alive.filter(function (g) { return g.sex === 'doe'; }).length;
    var bucks = alive.filter(function (g) { return g.sex === 'buck'; }).length;
    var kids = alive.filter(function (g) { return g.sex === 'kid'; }).length;
    var purchaseTotal = 0;
    state.goats.forEach(function (g) { purchaseTotal += (g.purchasePrice || 0); });
    var expenseTotal = 0;
    state.expenses.forEach(function (e) { expenseTotal += e.amount; });
    var healthCost = 0;
    state.health.forEach(function (h) { healthCost += (h.cost || 0); });
    var salesTotal = 0;
    state.sales.forEach(function (s) { salesTotal += s.price; });
    var kidsBorn = 0, kidsAlive = 0;
    state.breeding.forEach(function (b) {
      if (b.status === 'kidded') { kidsBorn += (b.kidsBorn || 0); kidsAlive += (b.kidsAlive || 0); }
    });
    var expecting = state.breeding.filter(function (b) { return b.status === 'expecting'; }).length;
    var invested = round2(purchaseTotal + expenseTotal + healthCost);
    var profit = round2(salesTotal - invested);
    return {
      alive: alive.length, does: does, bucks: bucks, kids: kids,
      sold: state.goats.filter(function (g) { return g.status === 'sold'; }).length,
      dead: state.goats.filter(function (g) { return g.status === 'dead'; }).length,
      purchaseTotal: round2(purchaseTotal), expenseTotal: round2(expenseTotal),
      healthCost: round2(healthCost), salesTotal: round2(salesTotal),
      invested: invested, profit: profit,
      kidsBorn: kidsBorn, kidsAlive: kidsAlive, expecting: expecting,
    };
  }

  function upcomingHealth(state, asof, withinDays) {
    withinDays = withinDays === undefined ? 30 : withinDays;
    var out = [];
    state.health.forEach(function (h) {
      if (!h.nextDue) return;
      var d = daysBetween(asof, h.nextDue);
      if (d !== null && d >= 0 && d <= withinDays) out.push({ record: h, daysLeft: d });
    });
    out.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    return out;
  }

  function upcomingKidding(state, asof, withinDays) {
    withinDays = withinDays === undefined ? 30 : withinDays;
    var out = [];
    state.breeding.forEach(function (b) {
      if (b.status !== 'expecting' || !b.expectedDate) return;
      var d = daysBetween(asof, b.expectedDate);
      if (d !== null && d >= 0 && d <= withinDays) out.push({ record: b, daysLeft: d });
    });
    out.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    return out;
  }

  /* ---------- import / export ---------- */

  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  function parseImport(text) {
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return { ok: false, error: 'Not valid JSON' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'Top level must be an object' };
    if (data.version !== 1) return { ok: false, error: 'Unsupported version (expected 1)' };
    var keys = ['goats', 'health', 'breeding', 'expenses', 'sales'];
    for (var i = 0; i < keys.length; i++) {
      if (!Array.isArray(data[keys[i]])) return { ok: false, error: 'Missing array: ' + keys[i] };
    }
    var tags = [];
    var goatIds = {};
    for (var gi = 0; gi < data.goats.length; gi++) {
      var errs = validateGoat(data.goats[gi], tags);
      if (errs.length) return { ok: false, error: 'Goat #' + (gi + 1) + ': ' + errs[0] };
      tags.push(data.goats[gi].tag.trim());
      goatIds[data.goats[gi].id] = true;
    }
    var allIds = Object.keys(goatIds);
    for (var hi = 0; hi < data.health.length; hi++) {
      var herrs = validateHealth(data.health[hi], allIds);
      if (herrs.length) return { ok: false, error: 'Health #' + (hi + 1) + ': ' + herrs[0] };
    }
    var doeIds = data.goats.filter(function (g) { return g.sex === 'doe'; }).map(function (g) { return g.id; });
    for (var bi = 0; bi < data.breeding.length; bi++) {
      var berrs = validateBreeding(data.breeding[bi], doeIds);
      if (berrs.length) return { ok: false, error: 'Breeding #' + (bi + 1) + ': ' + berrs[0] };
    }
    for (var ei = 0; ei < data.expenses.length; ei++) {
      var eerrs = validateExpense(data.expenses[ei]);
      if (eerrs.length) return { ok: false, error: 'Expense #' + (ei + 1) + ': ' + eerrs[0] };
    }
    var goatMap = {};
    data.goats.forEach(function (g) { goatMap[g.id] = g; });
    /* A sale is what marks a goat sold, so an imported sale may reference a
     * goat already marked 'sold'. Treat sold goats as sellable for import
     * validation; dead goats stay unsellable. */
    var saleGoatMap = {};
    data.goats.forEach(function (g) {
      saleGoatMap[g.id] = g.status === 'sold' ? { status: 'alive' } : g;
    });
    for (var si = 0; si < data.sales.length; si++) {
      var serrs = validateSale(data.sales[si], saleGoatMap);
      if (serrs.length) return { ok: false, error: 'Sale #' + (si + 1) + ': ' + serrs[0] };
    }
    return { ok: true, data: data };
  }

  var api = {
    parseISODate: parseISODate, isValidDate: isValidDate, daysBetween: daysBetween,
    addDays: addDays, todayISO: todayISO, round2: round2,
    formatNum: formatNum, formatMoney: formatMoney,
    GESTATION_DAYS: GESTATION_DAYS, expectedKiddingDate: expectedKiddingDate,
    ageMonths: ageMonths, ageLabel: ageLabel,
    validateGoat: validateGoat, validateHealth: validateHealth,
    validateBreeding: validateBreeding, validateExpense: validateExpense,
    validateSale: validateSale, emptyState: emptyState,
    computeDashboard: computeDashboard, upcomingHealth: upcomingHealth,
    upcomingKidding: upcomingKidding, exportJSON: exportJSON, parseImport: parseImport,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GoatFarmLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
