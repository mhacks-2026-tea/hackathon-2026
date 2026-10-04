# hackathon-2026 — Nessie integration

Server-side TypeScript integration on `feature/nessie`. This branch only fetches and normalizes Nessie banking data. No UI, campus data, financial calculations, or AI prompts.

## Setup

Requires Node.js 22 or later.

```sh
npm install
cp .env.example .env.local
```

Set `NESSIE_API_KEY` and `NESSIE_CUSTOMER_ID` in `.env.local`. Keep this file private; it is ignored by Git. Do not use a public/browser environment variable for the key.

The default base URL is `https://api.nessieisreal.com`. Set `NESSIE_BASE_URL` only if your hackathon provides a different HTTPS endpoint. `.env.local` is loaded by the live verification script; your server framework must load it when using the service in an app.

## Teammate usage

```ts
import { getStudentFinancialData, NessieError } from './lib/nessie.js';

try {
  const data = await getStudentFinancialData(customerId);
  // data.balance, data.purchases, data.deposits, data.bills, data.loans
} catch (error) {
  if (error instanceof NessieError) {
    // Show an appropriate message or retry in the calling server route.
    console.error(error.code, error.message);
  } else {
    throw error;
  }
}
```

Import from server code only. The helper rejects browser calls and uses uncached GET requests with a 15-second timeout. It never logs request URLs or API keys.

The default selection uses the first Checking account returned by Nessie, then the first Savings account. It excludes credit cards so a credit-card balance is not presented as spendable cash. Supply a second argument to select a particular Checking or Savings account belonging to the customer:

```ts
const data = await getStudentFinancialData(customerId, accountId);
```

This aggregates **one account**, not all of a customer's accounts. Balances/amounts keep Nessie's numeric units, without rounding or calculations. Multiple same-type accounts follow API response order; use an explicit account ID when this matters.

## Normalized data

Types are in `lib/nessie.types.ts`. Individual functions return normalized objects too:

- `getCustomer(customerId)` — ID, first name, last name.
- `getAccounts(customerId)` — ID, customer ID, type, nickname, balance.
- `getPurchases(accountId)` — ID, merchant ID/name, amount, purchase date, status.
- `getDeposits(accountId)` — ID, amount, transaction date, status.
- `getBills(accountId)` — ID, payee, payment amount, upcoming payment date (then payment date), recurring day, status.
- `getLoans(accountId)` — ID, amount, type, status. Amount is the API's loan amount, not a calculated remaining balance.

Missing or invalid numeric values/dates become `null`, not fabricated zeroes or dates. Dates are validated `YYYY-MM-DD` strings. Bill creation dates are not used as due dates. Recurring days are preserved without calculating the next payment. Statuses are preserved without filtering transactions.

Purchases resolve unique merchant IDs once per call via `/merchants/{id}`. Failed or missing merchant names fall back to `Unknown merchant`; `merchantId` remains available. Missing payees use `Unknown payee`. Empty API arrays remain empty arrays. Missing record IDs, malformed JSON, unexpected list shapes, and mismatched account ownership raise `NessieError`.

## Verification

```sh
npm run typecheck
npm test
npm run check:nessie
# Or pass a customer ID explicitly:
npm run check:nessie -- YOUR_CUSTOMER_ID
```

Optionally set `NESSIE_ACCOUNT_ID` in `.env.local` for live account selection.

The live script verifies customer → accounts → purchases → deposits → bills → loans → aggregator, stops at the first failure, and prints the normalized financial object. It performs only GET requests. Keep its output private if needed.

The local script uses mocked responses, exercises each function, and checks aggregation, missing fields, invalid IDs, empty arrays, account selection, HTTP/network/configuration/JSON failures, and API-key redaction. It does not establish live API compatibility.

### Current verification status

TypeScript, local mock checks, and all live checks passed on October 3, 2026 against `https://api.nessieisreal.com`. The fictional Alex Demo customer has one Checking account, two purchases, one deposit, two bills, and one loan. Generated customer/account IDs are saved in the ignored `.env.local`.

Live compatibility notes: current Nessie records use UUIDs; validation accepts these and legacy 24-character hexadecimal IDs. The current API truncated fractional purchase amounts (42.75 to 42 and 12.50 to 12); this integration preserves the returned numbers. Use whole-dollar sample amounts for this demo. The account balance remained the seeded 1800 after creating transactions; treat it as the API snapshot rather than assuming this sandbox automatically updates balances. Sample transaction statuses are `completed`; bills are `pending`; the sample loan is `personal` and `approved`.

Reference: [Nessie JavaScript SDK](https://github.com/nessieisreal/nessie-javascript-sdk) and [Nessie Python SDK](https://github.com/nessieisreal/nessie-python-sdk) for endpoint and field mappings.

---

# UMich campus data

Offline campus data and cost helpers available on `main` and `feature/campus-data`.
Requires Python 3.10+; no third-party packages.

Run this example from the repository root:

```python
from campus.loader import (
    estimate_true_monthly_cost,
    find_neighborhoods_in_budget,
)

cost = estimate_true_monthly_cost(
    "umich", rent=2600, roommates=1,
    commute="bus", month="january", bedrooms=2,
)
for name, value in cost["items"].items():
    print(f"{name}: {value['expected']:.2f}")
print("total:", cost["total"])
print("confidence:", cost["confidence"])

print(find_neighborhoods_in_budget(
    "umich", max_rent=2800, bedrooms=2, max_commute_min=20,
))
```

Output:

```text
rent: 1300.00
utilities: 182.50
internet: 32.50
renters_insurance: 10.00
groceries: 385.50
commute: 0.00
total: {'low': 1880.5, 'expected': 1910.5, 'high': 1940.5}
confidence: generic
[]
```

Costs are per person. Each total equals the sum of its corresponding
line items. Household costs split 50/50 for two occupants; insurance
is per person. Utilities exclude internet.

Fixed averages, midpoints, and utility modeling caps are user-approved
assumptions, not guaranteed prices. The result still carries
`data_status: placeholder`.

Commute times depend on traffic and location. The filter currently has
no matches; commute minutes and rent medians are not populated. Supplied
bedroom-specific ranges are stored in the CSV, but the rent helpers
still read median columns. Car ranges and typical move-in fees/deposit
also remain incomplete.

Sources and research dates are in `data/sources.md`. Links are optional;
recorded source names do not imply independent verification.

Run tests:

```bash
python -m unittest discover -s tests -v
```

Current result: 26 tests pass. Passing tests do not mean every PRD
requirement or data field is complete.

## Movin integration and cost definitions

The Python helpers read local files in `data/`; they make no runtime network calls. `main` includes the campus code, data, source log, and campus tests.

| Cost | Input basis | Current calculation |
| --- | --- | --- |
| Rent | Whole apartment, supplied by student | Divide 50/50 for two occupants |
| Utilities | Apartment estimate by month and bedroom group; excludes internet | Divide 50/50 for two occupants |
| Internet | Household range 40–90; approved expected value 65 | Divide 50/50 for two occupants |
| Groceries | Approved fixed household budget 771 | 385.50 per person for two occupants |
| Renters insurance | Approved fixed assumption 10 per person | Not divided |
| Walk/bike | User-reported zero travel cost | Equipment/maintenance not separately established |
| Bus | Zero for eligible active U-M students with yellow MCard on TheRide fixed routes | Do not apply to ineligible riders |
| Car | Reported transportation average 345 | Helper lacks a complete car range; parking coverage is unconfirmed |
| Deposit/application fee | One-time costs | Actual amounts remain missing; legal caps are not typical costs |

Midpoints, fixed averages, and utility caps are approved modeling assumptions. The original `+` upper prices are not guaranteed limits. `confidence="generic"` describes a local estimate, not a verified listing quote; `data_status="placeholder"` means unresolved data remains. Books/supplies are for the supplied academic period, not a monthly line item.

### Available data and rent-helper gap

The CSV contains bedroom-specific total rent ranges and estimated shared per-person ranges for five priced areas; four other areas retain empty ranges. Preserve all supplied endpoints, rounding, and open-ended `+` prices. Do not invent medians or divide an already per-person shared rent a second time.

**Current limitation:** `get_rent_benchmark` and `find_neighborhoods_in_budget` still read the empty median columns, not the populated range columns. Their current empty output must not be presented as proof that no affordable neighborhood exists. Matching these helpers to the range schema is remaining integration work; this documentation update does not implement that change.

### Missing data: ask the student

Commute times depend on traffic and location. They are currently empty in the CSV. Movin should ask for the apartment location, campus destination, travel method, and expected commute time before claiming a match.

The move-in helper currently computes with zero deposit/application placeholders and labels its result as placeholder. **Do not present that total as a complete move-in estimate or those zeros as free fees.** Ask for the listing's actual deposit, application fee, and other move-in charges. The supplied deposit range, legal deposit ceiling, and application-fee cap are separate facts, not replacement typical values.

Ask for apartment rent, bedroom count (`bedrooms=0` for studio), roommate count, month, and transport method. Only two-occupant 50/50 sharing is approved; other roommate arrangements need their own shares. Catch missing-data `ValueError` exceptions and surface the missing input in Movin instead of inserting a fabricated value.

No further research is required to begin integration: use the available monthly estimate, retain assumption labels, and ask for unresolved listing-specific details. Rent-range-aware helpers and richer missing-data returns remain to be implemented.

### Verification limits

Run `python -m unittest discover -s tests -v` from the repository root. The 26 passing tests cover current behavior, supplied data, approved sharing assumptions, and itemized totals. They do not prove that range-based neighborhood filtering, complete move-in costs, car estimates, or every PRD criterion is finished.
