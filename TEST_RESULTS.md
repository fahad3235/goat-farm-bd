# Goat Farm BD — test results (run #387, 2026-11-19)
# Reproduce: node tests/test.js ; node tests/smoke.mjs

## Unit tests (tests/test.js) — 67/67 PASS
- Dates: parse rejects 2026-02-30 / garbage; leap day accepted; daysBetween +/-; addDays +150 -> 2027-04-18
- Gestation: expectedKiddingDate('2026-11-19') = '2027-04-18'
- Age: 2025-12-20 -> 10 months on 2026-11-19; '1 yr 5 mo' (en) / Bengali digits (bn)
- Formatting: formatMoney(6550,'en') = ৳6,550.00; formatMoney bn uses Bengali digits; round2(0.1+0.2)=0.3
- Lists: 6 breeds (incl. Black Bengal), 4 health kinds, 5 expense categories, 9 common medicines
- Validation: goat (missing/dup tag, bad breed/sex/date/price/status) — all rejected; health (unknown goat, missing detail, bad kind); breeding (kids alive > born, bad doe, kidsBorn > 6); expense (zero amount, bad category); sale (sold goat, zero price)
- Dashboard (fixture: 2 alive + 1 sold goat, ৳2,000 feed, ৳120 PPR, ৳9,000 sale, 2 kids born):
  alive 2, does 1, bucks 1, kids 0, sold 1, invested ৳22,620, sales ৳9,000, profit -৳13,620, kidsBorn 2
  upcomingHealth 1 (6 days left), upcomingKidding 0 -> 1 after adding expecting doe
- Import/export: round-trip ok; rejects garbage JSON, wrong version, duplicate tag, bad sale

## Smoke tests (tests/smoke.mjs, headless_shell, file://?asof=2026-11-19) — 47/47 PASS
- Fresh load: title/h1 render, 6 tabs, alive 0, invested ৳0.00, 'Nothing due'
- Validation: empty tag rejected with visible error; 0 goats stored
- Add doe BB-01 (Kali, Black Bengal, ৳8,500, age '1 yr 5 mo') + buck BB-02 (Jamunapari, ৳12,000); duplicate tag BB-01 rejected (still 2 goats)
- Search 'kali' shows BB-01 only
- Health: PPR vaccine 2026-11-10, ৳120, next due 2026-11-25 — shown in list
- Breeding: 2026-06-22 auto-fills expected kidding 2026-11-19; record saved
- Expense: feed ৳2,000 'Grass + bran' saved
- Dashboard: alive 2, invested ৳22,620.00, profit -৳22,620.00, expecting 1, upcoming vacc BB-01 2026-11-25, kidding due today
- Sale: buck BB-02 sold 2026-11-15 for ৳15,000 to Karim; alive 1, profit -৳7,620.00, BB-02 listed Sold
- Bangla: h1 in Bengali, alive stat '১', persists across reload with data intact; back to English
- Data: bad import (version 9) rejected, data intact (2 goats); good import accepted (IMP-1 Beetal doe shown); typed-DELETE erase restores 0 goats
- Mobile 390px: no horizontal overflow on any of the 6 tabs
- 0 console/page errors; 0 non-file network requests

## Repairs during this run
1. Real bug: import validator rejected a sale for a goat already marked 'sold' (the sale is what sold it) — fixed parseImport to treat sold goats as sellable on import; live-sale form still requires Alive.
2. Test-side fixes: ageMonths expectation (10, not 11 — Dec 20 -> Nov 19 is 10 full months); formatNum bn expectation (grouped '১২,৩৪৫' by design); smoke null-guard on empty localStorage key; localStorage.clear moved after first navigation (about:blank denies it); sale test now selects the buck explicitly.
3. Removed HTML5 `required` attributes so JS validation (not the browser bubble) handles all errors consistently.
