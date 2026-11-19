/* Goat Farm BD \u2014 node unit tests. Run: node tests/test.js */
'use strict';
const L = require('../js/logic.js');
const DATA = require('../js/data.js');
const I18N = require('../js/i18n.js');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' \u2014 ' + extra : '')); }
}
function eq(name, a, b) { check(name, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

const ASOF = '2026-11-19';

/* ---- dates ---- */
check('parse rejects 2026-02-30', L.parseISODate('2026-02-30') === null);
check('parse rejects garbage', L.parseISODate('tomorrow') === null);
check('parse accepts leap day', L.parseISODate('2028-02-29') !== null);
eq('daysBetween 6', L.daysBetween('2026-11-19', '2026-11-25'), 6);
eq('daysBetween negative', L.daysBetween('2026-11-25', '2026-11-19'), -6);
eq('addDays +150', L.addDays('2026-11-19', 150), '2027-04-18');
eq('expectedKidding +150', L.expectedKiddingDate('2026-11-19'), '2027-04-18');
eq('ageMonths 10', L.ageMonths('2025-12-20', ASOF), 10);
eq('ageMonths 13', L.ageMonths('2025-10-19', ASOF), 13);
eq('ageMonths 0', L.ageMonths('2026-11-19', ASOF), 0);
eq('ageLabel en months', L.ageLabel('2026-06-19', ASOF, 'en'), '5 months');
eq('ageLabel en years', L.ageLabel('2024-11-19', ASOF, 'en'), '2 yrs');
check('ageLabel bn has Bengali digits', /[\u0980-\u09FF]/.test(L.ageLabel('2024-11-19', ASOF, 'bn')));

/* ---- formatting ---- */
eq('formatNum bn', L.formatNum(12345, 'bn'), '\u09e7\u09e8,\u09e9\u09ea\u09eb');
eq('formatNum en grouped', L.formatNum(12345, 'en'), '12,345');
eq('formatMoney en', L.formatMoney(6550, 'en'), '\u09f36,550.00');
eq('formatMoney bn', L.formatMoney(6550, 'bn'), '\u09f3\u09ec,\u09eb\u09eb\u09e6.\u09e6\u09e6');
eq('formatMoney zero', L.formatMoney(0, 'en'), '\u09f30.00');
eq('round2', L.round2(0.1 + 0.2), 0.3);

/* ---- option lists ---- */
eq('6 breeds', DATA.BREEDS.length, 6);
check('breeds include Black Bengal', DATA.BREEDS.includes('Black Bengal'));
eq('4 health kinds', DATA.HEALTH_KINDS.length, 4);
eq('5 expense categories', DATA.EXPENSE_CATEGORIES.length, 5);
check('9 common medicines', DATA.COMMON_MEDICINES.length === 9);
check('i18n has bn appTitle', /[\u0980-\u09FF]/.test(I18N.t('appTitle', 'bn')));
eq('i18n en appTitle', I18N.t('appTitle', 'en'), 'Goat Farm BD');

/* ---- validateGoat ---- */
function goodGoat(over) {
  return Object.assign({
    id: 'g1', tag: 'BB-01', name: 'Kali', breed: 'Black Bengal', sex: 'doe',
    dob: '2025-06-01', acquiredDate: '2025-07-01', purchasePrice: 8500, status: 'alive', notes: '',
  }, over || {});
}
eq('good goat valid', L.validateGoat(goodGoat(), []).length, 0);
check('goat missing tag', L.validateGoat(goodGoat({ tag: '' }), []).length > 0);
check('goat dup tag', L.validateGoat(goodGoat(), ['BB-01']).length > 0);
check('goat bad breed', L.validateGoat(goodGoat({ breed: 'Alpine' }), []).length > 0);
check('goat bad sex', L.validateGoat(goodGoat({ sex: 'wether' }), []).length > 0);
check('goat bad dob', L.validateGoat(goodGoat({ dob: '2026-02-30' }), []).length > 0);
check('goat negative price', L.validateGoat(goodGoat({ purchasePrice: -5 }), []).length > 0);
check('goat bad status', L.validateGoat(goodGoat({ status: 'lost' }), []).length > 0);

/* ---- validateHealth / breeding / expense / sale ---- */
const goatIds = ['g1', 'g2'];
eq('good health valid', L.validateHealth({ goatId: 'g1', kind: 'vaccination', detail: 'PPR vaccine', date: '2026-11-10', cost: 120, nextDue: '2027-11-10' }, goatIds).length, 0);
check('health unknown goat', L.validateHealth({ goatId: 'g9', kind: 'vaccination', detail: 'PPR', date: '2026-11-10' }, goatIds).length > 0);
check('health missing detail', L.validateHealth({ goatId: 'g1', kind: 'vaccination', detail: '', date: '2026-11-10' }, goatIds).length > 0);
check('health bad kind', L.validateHealth({ goatId: 'g1', kind: 'surgery', detail: 'x', date: '2026-11-10' }, goatIds).length > 0);
eq('good breeding valid', L.validateBreeding({ doeId: 'g1', breedingDate: '2026-11-19', expectedDate: '2027-04-18', kidsBorn: 2, kidsAlive: 2, status: 'kidded' }, ['g1']).length, 0);
check('breeding alive > born', L.validateBreeding({ doeId: 'g1', breedingDate: '2026-11-19', kidsBorn: 1, kidsAlive: 2, status: 'kidded' }, ['g1']).length > 0);
check('breeding bad doe', L.validateBreeding({ doeId: 'g2', breedingDate: '2026-11-19', status: 'expecting' }, ['g1']).length > 0);
check('breeding kidsBorn > 6', L.validateBreeding({ doeId: 'g1', breedingDate: '2026-11-19', kidsBorn: 7, status: 'kidded' }, ['g1']).length > 0);
eq('good expense valid', L.validateExpense({ date: '2026-11-19', category: 'feed', amount: 1500 }).length, 0);
check('expense zero amount', L.validateExpense({ date: '2026-11-19', category: 'feed', amount: 0 }).length > 0);
check('expense bad category', L.validateExpense({ date: '2026-11-19', category: 'vet', amount: 100 }).length > 0);
eq('good sale valid', L.validateSale({ goatId: 'g1', date: '2026-11-19', price: 12000 }, { g1: { status: 'alive' } }).length, 0);
check('sale of sold goat', L.validateSale({ goatId: 'g1', date: '2026-11-19', price: 12000 }, { g1: { status: 'sold' } }).length > 0);
check('sale zero price', L.validateSale({ goatId: 'g1', date: '2026-11-19', price: 0 }, { g1: { status: 'alive' } }).length > 0);

/* ---- dashboard ---- */
const st = L.emptyState();
st.goats = [
  goodGoat({ id: 'g1', tag: 'BB-01', purchasePrice: 8500 }),
  goodGoat({ id: 'g2', tag: 'BB-02', name: '', sex: 'buck', breed: 'Jamunapari', purchasePrice: 12000 }),
  goodGoat({ id: 'g3', tag: 'BB-03', name: '', sex: 'kid', purchasePrice: 0, status: 'sold' }),
];
st.expenses = [{ id: 'e1', date: '2026-11-01', category: 'feed', amount: 2000, note: '' }];
st.health = [{ id: 'h1', goatId: 'g1', kind: 'vaccination', detail: 'PPR vaccine', date: '2026-11-10', cost: 120, nextDue: '2026-11-25' }];
st.sales = [{ id: 's1', goatId: 'g3', date: '2026-11-15', price: 9000, buyer: '' }];
st.breeding = [{ id: 'b1', doeId: 'g1', breedingDate: '2026-10-01', expectedDate: '2027-02-28', kidsBorn: 2, kidsAlive: 2, status: 'kidded' }];
const d = L.computeDashboard(st, ASOF);
eq('dash alive 2', d.alive, 2);
eq('dash does 1', d.does, 1);
eq('dash bucks 1', d.bucks, 1);
eq('dash kids 0', d.kids, 0);
eq('dash sold 1', d.sold, 1);
eq('dash invested', d.invested, 8500 + 12000 + 0 + 2000 + 120);
eq('dash sales', d.salesTotal, 9000);
eq('dash profit', d.profit, 9000 - (8500 + 12000 + 2000 + 120));
eq('dash kidsBorn 2', d.kidsBorn, 2);
eq('dash kidsAlive 2', d.kidsAlive, 2);
eq('upcomingHealth 1', L.upcomingHealth(st, ASOF, 30).length, 1);
eq('upcomingHealth daysLeft 6', L.upcomingHealth(st, ASOF, 30)[0].daysLeft, 6);
eq('upcomingKidding 0', L.upcomingKidding(st, ASOF, 30).length, 0);
st.breeding.push({ id: 'b2', doeId: 'g1', breedingDate: '2026-11-19', expectedDate: '2026-11-29', status: 'expecting' });
eq('upcomingKidding 1', L.upcomingKidding(st, ASOF, 30).length, 1);

/* ---- import/export ---- */
const exported = L.exportJSON(st);
const parsed = L.parseImport(exported);
check('export/import round-trip ok', parsed.ok === true);
check('import rejects garbage', L.parseImport('not json').ok === false);
check('import rejects wrong version', L.parseImport(JSON.stringify({ version: 2, goats: [], health: [], breeding: [], expenses: [], sales: [] })).ok === false);
check('import rejects dup tag', L.parseImport(JSON.stringify({ version: 1, goats: [goodGoat(), goodGoat({ id: 'g2' })], health: [], breeding: [], expenses: [], sales: [] })).ok === false);
check('import rejects bad sale', L.parseImport(JSON.stringify({ version: 1, goats: [goodGoat()], health: [], breeding: [], expenses: [], sales: [{ goatId: 'g1', date: '2026-11-19', price: -5 }] })).ok === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
