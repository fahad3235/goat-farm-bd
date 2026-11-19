# Goat Farm BD

Offline bilingual (English / বাংলা) goat farm tracker for small Bangladeshi farmers. Record the herd, track health and breeding, log expenses and sales, and see profit at a glance — with no account, no server, and no data leaving the device.

## Problem

Small goat farmers in Bangladesh (notably Black Bengal goat rearers) usually keep herd, vaccination, breeding, and money records on paper or in their heads. Paper gets lost, vaccination dates are missed, and nobody knows whether the farm actually made a profit. Goat Farm BD puts the whole ledger in one offline page that works on a cheap phone.

## Features

- **Dashboard** — live herd count (does / bucks / kids), total invested, total sales, profit/loss, expecting does, kids born; vaccinations and kidding due in the next 30 days.
- **Goats** — add / edit / delete goats: tag/ID, name, breed (Black Bengal, Jamunapari, Beetal, Boer, Cross, Other), sex, birth and acquired dates, purchase price, status (Alive / Sold / Died), notes. Search by tag or name; filter by status and sex. Duplicate tags rejected.
- **Health** — vaccination, deworming, treatment, and checkup records per goat, with medicine/vaccine name (9 common quick-picks, e.g. PPR vaccine, Albendazole), cost, and next-due date.
- **Breeding** — breeding records per doe; expected kidding date is auto-filled as breeding date + 150 days (the typical goat gestation; range 145–155 days). Record actual kidding date and kids born / alive.
- **Money** — expense log (feed, medicine, transport, shelter, other) and sales log. Recording a sale marks that goat as Sold; deleting a sale restores it to Alive.
- **Data** — JSON export (download a backup), strict JSON import (replaces all data only if the file fully validates), and typed-`DELETE` erase-all.
- **Bilingual** — full English / বাংলা toggle, persisted across reloads, with Bengali digits in Bangla mode.
- **Offline & private** — zero network requests; everything lives in `localStorage`. Responsive down to 390px.

## Stack

Vanilla HTML / CSS / JavaScript (no dependencies, no build step). Pure logic in `js/logic.js` (shared by the app and the Node tests). Bengali strings are stored as `\uXXXX` escapes so the sources stay pure ASCII.

## Prerequisites

Any modern browser. For the test suites: Node.js 18+ and the cached headless Chromium shell used by `tests/smoke.mjs`.

## Install & run

```sh
# Just open it — no install, no server needed:
open index.html
# or serve locally:
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Dev commands

```sh
node tests/test.js    # unit tests (logic, validation, import/export)
node tests/smoke.mjs  # headless-Chrome UI smoke test (file://, ?asof=2026-11-19)
python3 tools/escape_ascii.py  # re-escape any non-ASCII chars in js/ + tests/ to \uXXXX
```

## Environment

None. No API keys, no backend, no environment variables.

## Testing

- **Unit:** 67 checks in `tests/test.js` — dates, gestation math, formatting, every validator, dashboard totals, import/export round-trip and rejection cases. Result: **67/67 pass**.
- **Smoke:** 47 checks in `tests/smoke.mjs` — real headless-Chrome run at 1440px and 390px: empty state, validation rejection, add/search/edit flows, auto kidding date, dashboard money math (invested ৳22,620.00, profit −৳7,620.00 after a ৳15,000 sale), Bangla toggle + persistence, bad/good import, erase, 0 console errors, 0 non-file network requests. Result: **47/47 pass**.
- Hand-verified examples: breeding 2026-06-22 → expected kidding 2026-11-19 (150 days); doe born 2025-06-01 is "1 yr 5 mo" old on 2026-11-19.

See [TEST_RESULTS.md](TEST_RESULTS.md) for the full record.

## Deployment

GitHub Pages (main branch, root). Open `index.html` — the app is a static site.

## Limitations

- Data lives in one browser's `localStorage` — no sync across devices; export JSON regularly as a backup.
- Gestation is shown as a fixed 150 days; real kidding varies (145–155 days) and the app is not veterinary advice.
- No preset prices, breeds beyond the six listed, or vaccination schedules — all figures are entered by the farmer.
- Deleting a goat also deletes its health, breeding, and sale records.

## Status

Complete MVP — built, tested, and published by the Muse Project Factory (run #387, 2026-11-19). Ships with **no preset data**: the farmer enters their own goats, prices, and dates.
