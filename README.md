# hackathon-2026

## Nessie integration

The server-side TypeScript integration fetches and normalizes Nessie banking data for the finance agent.

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

# UMich campus estimates

Offline data and Python helpers for Movin. Requires Python 3.10+ and no third-party packages.

## Supported scope

- Five areas with supplied rent ranges: Kerrytown, Burns Park, Oxbridge, Glazier Way / North Side, and Downtown/Campus.
- Whole-apartment and shared per-person ranges for one, two, and three-plus bedrooms.
- Seasonal apartment utility estimates excluding internet, with studio using the one-bedroom utility group.
- Internet, renters insurance, and groceries under the recorded modeling assumptions.
- Walking/biking cost assumptions and bus fares for eligible U-M students.
- Populated campus identity and supplied academic dates.

Commute times and commute filtering have been removed. Areas without rent data and empty median columns are removed. Campus defaults for deposits, application fees, parking, driving costs, lease-start windows, county, and summer income gaps are removed. Generic rent averages with unspecified sharing basis and overlapping utility averages are also removed.

Listing-specific move-in costs belong in the finance engine using actual user inputs. Removing campus estimates does not mean those expenses are zero. Monthly totals below cover only the returned items; they are not a complete housing affordability forecast.

## Examples

```python
from campus.loader import (
    get_campus_profile, get_rent_benchmark,
    find_neighborhoods_in_budget, estimate_true_monthly_cost,
)

print(get_campus_profile("umich"))
print(get_rent_benchmark("umich", bedrooms=1))
# {'low': 825.0, 'high': 2550.0}

matches = find_neighborhoods_in_budget("umich", max_rent=1000, bedrooms=1)
print([row.neighborhood for row in matches])
# ['Oxbridge'] -- potential range overlap, not a confirmed listing

cost = estimate_true_monthly_cost(
    "umich", rent=2600, roommates=1,
    commute="bus", month="january", bedrooms=2,
)
print(cost["total"])
# {'low': 1880.5, 'expected': 1910.5, 'high': 1940.5}
```

## Contract and assumptions

`CampusProfile` contains `id`, `name`, `city`, `state`, `term_start_dates`, and `student_fare_notes`.

`Neighborhood` contains `neighborhood`, `notes`, `source`, and `rent_ranges`. Range keys are `1`, `2`, `3_plus`, `shared_1`, `shared_2`, and `shared_3_plus`. Each has `low`, `high`, and `high_lower_bound`. An explicitly open price such as `4500+` retains `high=None` and `high_lower_bound=4500`; no finite maximum is invented. This is a supplied open range, not an empty data placeholder.

`get_rent_benchmark` returns low/high across the available neighborhood ranges. It no longer returns a fabricated or empty median. An open upper range propagates as `high=None`.

`find_neighborhoods_in_budget` accepts campus ID, maximum rent, bedroom count, and optional `shared=True`. A match means the supplied range starts within budget; a particular available listing may cost more. Shared prices are already per person and are not divided again. No travel time claim is made. Studio rent ranges are not supplied, so the rent helpers require at least one bedroom.

`estimate_true_monthly_cost` takes whole-apartment rent. Its itemized output is per person. Equal sharing is approved only for two occupants; insurance is per person. Fixed groceries are a household modeling assumption. When integrating with transaction forecasts, avoid adding these groceries on top of predicted grocery spending.

`estimate_commute_cost` supports only walk, bike, and bus. Walking/biking zero costs represent the supplied direct-travel assumptions, not equipment or maintenance budgets. Free bus fares apply only to eligible active U-M students with yellow MCard on TheRide fixed routes. The caller must check that eligibility before selecting bus.

Costs are estimates, not guaranteed quotes. Utility modeling caps, fixed averages, and midpoint assumptions retain their labels. The existing generic confidence/placeholder status remains conservative; it is not independent verification of listing prices. Source notes and research dates are in `data/sources.md`.

## API changes from the earlier draft

- Removed `max_commute_min`, `commute_method`, and `commute_minutes` from neighborhood search.
- Removed `estimate_move_in_cost` and campus deposit/fee defaults.
- Removed car and supplied car-budget overrides from the campus helper.
- Removed empty legacy profile and neighborhood fields.
- Preserved existing supplied rent endpoints and supported cost assumptions.

Earlier requirements in `data/docs/PRD-campus-data.md` are background; this README describes the current reduced scope.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

27 tests cover the current scope, supplied rent endpoints, cost sums, sharing rules, validation, and removal of unsupported features. Tests do not verify source prices against live listings.

## Campus + finance + Nessie integration

`src/lib/finance/connect-campus.ts` connects the existing Python campus helpers to the TypeScript finance engine. Run it on a Node server with Python 3.10+ installed (`CAMPUS_PYTHON` optionally selects the executable). Ship the `campus/` and `data/` directories alongside `src/`; the bridge resolves the repository relative to the source module. A bundled/serverless deployment must preserve this layout and provide Python; the bridge is not compatible with an Edge-only runtime.

```ts
import { getStudentFinancialData } from './lib/nessie.js';
import { evaluateCampusNessieAffordability } from './src/lib/finance/connect-campus.ts';

const result = await evaluateCampusNessieAffordability(getStudentFinancialData, {
  customerId,
  financialContext: {
    asOfDate: '2026-10-03', historyStartDate: '2026-10-01',
    safetyBufferCents: 50000,
    excludedBillIds: replacedRentBillIds, // Explicitly identify costs replaced by this proposal.
  },
  housing: {
    campusId: 'umich', name: 'Example shared apartment',
    leaseStart: '2026-10-04', leaseEnd: '2027-02-04',
    monthlyApartmentRentDollars: 2600, bedrooms: 2, roommates: 1,
    commute: 'bus', eligibleForStudentBusFare: true,
    // Example inputs only: obtain the actual student's share for each listing.
    monthlyParkingCents: 0, securityDepositCents: 130000,
    applicationFeesCents: 5000, movingCostsCents: 15000,
  },
});
```

The calling route must authorize the supplied customer/account IDs. Surface thrown input/API/process errors and the returned `dataWarnings` rather than replacing missing costs with zero.

- Whole-apartment rent is in dollars; the helper applies approved household sharing. Parking and move-in values are required student-share integer cents. An explicit zero is valid; missing values fail.
- Bus requires explicit eligible-student fare confirmation. Driving is not supported by campus estimates.
- `housing` contains the normalized scenario; `campusEstimates` retains all twelve months of low/expected/high ranges, confidence, data status, and source assumptions. The forecast uses expected estimates, not probability bounds.
- Utility payments vary by calendar month on each lease anniversary. `monthlyHousingCostCents` summarizes the lease-start month; consult `dailyBalances` for the seasonal forecast.
- Campus groceries are not added to housing: the finance spending forecast owns everyday spending. Sparse history can understate spending and must be reviewed. The wrapper does not infer which rent or utility bills to exclude; pass explicit exclusions for obligations replaced by the proposal.
- The bridge leaves one-time costs to caller inputs and uses the existing engine's full-month billing, lease-end exclusivity, and 366-day horizon rules.

Tests: `npm run test:campus-finance` runs the real Python bridge and exercises sharing, cent conversion, seasonal schedules, missing costs, unsupported inputs, process failure, and the combined finance entry point. Existing `npm run test:finance`, `npm test`, `npm run typecheck`, and Python campus tests still apply.

For the existing fictional Alex Demo account, set `FINANCE_HISTORY_START=2026-10-01` in private `.env.local`, then run `npm run demo:campus-nessie`. This read-only example uses live Nessie data, campus estimates, and explicitly hypothetical rent/move-in inputs. It prints summary results only and is not an actual apartment quote.
