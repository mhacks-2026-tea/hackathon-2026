# hackathon-2026

# Movin 🏠

An AI financial copilot that helps college students understand how housing choices could affect their finances throughout the school year.

Built at MHacks 2026, Movin calculates monthly housing costs, move-in expenses, and projected balances. Students can explore scenarios through chat, compare living alone with sharing an apartment, and identify potential cash shortages.

The hackathon demo uses fictional financial inputs and campus cost estimates.

## Explore Movin

- [Try the live demo](https://hackathon-2026-eight-ruby.vercel.app/)
- [Read our Devpost story](https://devpost.com/software/movin)

## Tech stack

Next.js, React, TypeScript, Tailwind CSS, and Python, with Capital One’s Nessie sandbox API and Fetch.ai’s ASI API. Designed in Figma and deployed on Vercel.

## Prediction and machine learning

Movin forecasts balances using spending history, housing costs, and explicitly scheduled cash flows. A weekday spending model is selected when sufficient history is available and historical evaluation shows it outperforms a simple average.

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

Offline data and TypeScript helpers for Movin. Runs on Node.js 22+ with the existing project dependencies; no Python runtime is needed.

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

```ts
import {
  getCampusProfile, getRentBenchmark,
  findNeighborhoodsInBudget, estimateTrueMonthlyCost,
} from './campus/loader.ts';

console.log(getCampusProfile('umich'));
console.log(getRentBenchmark('umich', 1));
// { low: 825, high: 2550 }
console.log(findNeighborhoodsInBudget('umich', 1000, 1).map(row => row.neighborhood));
// ['Oxbridge'] -- potential range overlap, not a confirmed listing
console.log(estimateTrueMonthlyCost({
  campusId: 'umich', rent: 2600, roommates: 1,
  commute: 'bus', month: 'january', bedrooms: 2,
}).total);
// { low: 1880.5, expected: 1910.5, high: 1940.5 }
```

## Contract and assumptions

`CampusProfile` contains `id`, `name`, `city`, `state`, `term_start_dates`, and `student_fare_notes`.

`Neighborhood` contains `neighborhood`, `notes`, `source`, and `rent_ranges`. Range keys are `1`, `2`, `3_plus`, `shared_1`, `shared_2`, and `shared_3_plus`. Each has `low`, `high`, and `high_lower_bound`. An explicitly open price such as `4500+` retains `high=null` and `high_lower_bound=4500`; no finite maximum is invented. This is a supplied open range, not an empty data placeholder.

`getRentBenchmark` returns low/high across the available neighborhood ranges. It no longer returns a fabricated or empty median. An open upper range propagates as `high=null`.

`findNeighborhoodsInBudget` accepts campus ID, maximum rent, bedroom count, and optional fourth argument `true` for shared prices. A match means the supplied range starts within budget; a particular available listing may cost more. Shared prices are already per person and are not divided again. No travel time claim is made. Studio rent ranges are not supplied, so the rent helpers require at least one bedroom.

`estimateTrueMonthlyCost` takes an input object containing whole-apartment rent. Its itemized output is per person. Equal sharing is approved only for two occupants; insurance is per person. Fixed groceries are a household modeling assumption. When integrating with transaction forecasts, avoid adding these groceries on top of predicted grocery spending.

`estimateCommuteCost` supports only walk, bike, and bus. Walking/biking zero costs represent the supplied direct-travel assumptions, not equipment or maintenance budgets. Free bus fares apply only to eligible active U-M students with yellow MCard on TheRide fixed routes. The caller must check that eligibility before selecting bus.

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
npm run test:campus
npm run test:all
```

237 frozen reference cases from the previous Python implementation verify numeric and structural parity across all months, sharing, utility bedroom groups, and rent searches. TypeScript tests also cover CSV parsing, validation, missing fields, open utility bounds, and source provenance. Tests do not verify source prices against live listings. The Python implementation and tests have been replaced; the reference fixture requires no Python to run.

## Campus + finance + Nessie integration

`src/lib/finance/connect-campus.ts` calls the TypeScript campus helpers directly in the Node server. There is no subprocess or Python installation. Ship `data/` beside the `campus/` module: the loader reads the unchanged JSON and CSV files relative to its module location, not the working directory. A bundled deployment must include these files and preserve that relative layout; this filesystem-based loader requires a Node runtime, not an Edge-only runtime.

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
- The integration leaves one-time costs to caller inputs and uses the existing engine's full-month billing, lease-end exclusivity, and 366-day horizon rules.

Tests: `npm run test:campus-finance` exercises the TypeScript campus helpers with sharing, cent conversion, seasonal schedules, missing costs, unsupported inputs, and the combined finance entry point. Run `npm run test:all` for typechecking and every Nessie, finance, campus, and integration check.

For the existing fictional Alex Demo account, set `FINANCE_HISTORY_START=2026-10-01` in private `.env.local`, then run `npm run demo:campus-nessie`. This read-only example uses live Nessie data, campus estimates, and explicitly hypothetical rent/move-in inputs. It prints summary results only and is not an actual apartment quote.

### TypeScript migration

All active campus helper functions now use camelCase exports from `campus/loader.ts`: `getCampusProfile`, `listNeighborhoods`, `getRentBenchmark`, `findNeighborhoodsInBudget`, `estimateUtilities`, `estimateCommuteCost`, and `estimateTrueMonthlyCost`. JSON/CSV field names and returned cost shapes are preserved. `estimateTrueMonthlyCost` accepts the object shown above. The public `evaluateCampusNessieAffordability` call is unchanged. Remove any old `CAMPUS_PYTHON` setting; it is no longer read.


## Learned spending and finance agent

`src/lib/finance/spending-model.ts` adds regularized weekday regression using up to 84 complete observed days. It implements the existing `SpendingForecast` contract and excludes income and scheduled expenses. Under 28 days it falls back to the baseline. Bounds describe training residual variation, not calibrated probabilities.

`evaluateSpendingModel(profile)` compares baseline and learned forecasts using expanding chronological training windows and disjoint 14-day holdouts. It reports daily MAE/RMSE in cents, improvement percentage, and a recommended method. `selectSpendingForecast(profile, days)` uses ML only when its historical MAE beats the baseline; ties or insufficient evaluation history retain the baseline. At least 42 days are needed for one evaluation fold. Model selection on these same folds is not an independent final test.

`runFinanceAgent` supports spending forecasts, historical summaries, and housing affordability. It requests missing profile/listing fields before calculation, accepts explicit zero costs, and calls the existing engine with the selected forecast. Keep `previousIntent` when responding to clarification, and merge the supplied structured details into the next request. Invalid inputs and model/API errors propagate to the calling route. That route must authorize access to the supplied financial profile.

```ts
import { runFinanceAgent, createModelInterpreter } from './src/lib/finance/agent.ts';

// Provide your server-side AI provider's text completion function.
// No provider SDK or API key is bundled or configured by this module.
const interpret = createModelInterpreter(async prompt => yourModel.complete(prompt));
const response = await runFinanceAgent({
  question: 'How much will I spend over the next 14 days?',
  profile, // Existing FinancialProfile, with amounts in integer cents.
}, interpret);
// response.message, missingFields, toolCalls, result, assumptions
```

Only the question goes to the model; the interpreter classifies intent and horizon. Financial numbers are supplied as structured context and calculated by the engine. Explanations use actual tool outputs, including warnings and assumptions. Without an injected interpreter, a documented keyword parser supports offline demos; that fallback is not an LLM. This is a server-side library entry point, not a deployed chat UI or API route. Amounts in conversational follow-ups must be confirmed and converted into structured cent fields by the caller.

Verification: `npm run test:spending-agent` (included in `test:all`). Synthetic 84-day weekday data yielded baseline MAE $16.00/day versus learned MAE $3.80/day (76.25% reduction) across 56 held-out days; constant spending tied at zero error and retained baseline. These are synthetic behavior checks, not measured performance on student banking history. Live model-provider behavior has not been verified; tests use a mock completion.


## Local Fetch bridge backend (first integration step)

`npm run serve:finance` runs a loopback-only Node service at port 3101.
Set `MOVIN_BRIDGE_TOKEN` to a random secret of at least 32 characters in private
`.env.local`, along with the existing Nessie settings, `FINANCE_HISTORY_START`,
and `FINANCE_AS_OF_DATE`. The existing demo snapshot date is 2026-10-03.
Keep this token server-side; it belongs to the ACP bridge, not browser code.

`POST /api/demo/affordability` requires `Authorization: Bearer <MOVIN_BRIDGE_TOKEN>`
and JSON `{ "housing": CampusHousingRequest, "safetyBufferCents": number,
"excludedBillIds": string[] }`. The exclusions are optional and must explicitly
identify existing bills replaced by the proposal. A body cannot select a customer
or account: this service uses only the configured fictional sandbox account.

The response contains `affordability`, `predictionMethod`, `evaluation`,
`dataWarnings`, `toolCalls`, and a sandbox label. It uses campus estimates and the
selected spending predictor. It does not infer future paychecks. Return warnings
and assumptions to users; short history makes forecasts provisional.
Missing fields return 422 with `missingFields`; unavailable banking returns 502.
Use `npm run test:finance-server` for HTTP tests with synthetic banking data.

The endpoint accepts structured inputs from `agents/fetch/bridge.py`. That bridge
implements ACP, uses ASI to extract stated apartment details, and collects missing
fields across messages. See `agents/fetch/README.md` for startup instructions.
Local tests and the live ASI:One-to-Nessie evaluation passed. Agentverse lists
`@movin-housing` as Active and ASI Available; its ACP manifest is published.
The live link is in `agents/fetch/README.md`. This is a fictional demo account,
not a personal-bank login or a public multi-user banking endpoint.
# Movin frontend demo

`feature/frontend` combines the original university-themed Movin UI with main's finance, Nessie, campus, and agent modules. Run `npm install`, `npm run build`, and `npm start` (or `npm run dev`). Overview, Housing, Ask Movin, and Neighborhoods retain the horizontal navigation and original school backgrounds/marks. The selected apartment is kept across pages for follow-up questions.

The Next server endpoint `/api/movin` reuses the finance engine; React only gathers inputs and renders results. GET loads a university's dashboard. POST accepts `{ campus, query: { monthlyRent, roommates, utilities?, parking?, leaseStart? } }`; add `action: "ask"` and `question` for the finance agent. Financial profiles, account IDs, and credentials stay on the server.

Default `MOVIN_DATA_MODE=alex-demo` uses explicit fictional Alex inputs in `lib/server/demo-profile.ts`, with a summer income gap. All displayed financial outputs are calculated, never preset replies. Set `MOVIN_DATA_MODE=nessie` and configure `.env.local` using `.env.example` to load the fixed Nessie sandbox customer. Configured Nessie failures are displayed rather than replaced by demo data. Set explicit future cash flows using `MOVIN_CASH_FLOWS_FILE` and exclude bills replaced by the proposed lease using `FINANCE_EXCLUDED_BILL_IDS`; historical income is never silently treated as a guaranteed future paycheck.

Michigan uses the supplied campus dataset (which itself labels costs as placeholders). Other campuses use clearly disclosed sample costs. Properties, photos, and university-housing prices are representative samples. Monthly rent and utilities represent the whole apartment, divided among occupants; parking is the student's own cost. Move-in defaults are one rent-share deposit, $50 application fee, and $150 moving cost. The lease defaults to the day after the financial snapshot, ending 365 days after that snapshot; custom dates must fit the backend's 366-day forecast limit. The chart plots each month's lowest daily balance so paydays do not conceal risk. Historical monthly averages can differ from modeled future income.

Ask Movin uses the Fetch conversation extraction protocol, implemented in TypeScript, when `ASI1_API_KEY` is configured on the server. ASI extracts explicitly stated apartment facts; the finance engine performs the calculations. Missing dates, bedroom count, commuting choice, parking, upfront fees, and safety balance are requested before evaluation. Specify $0 for costs that do not apply. Follow-up messages can correct earlier facts. `details` shows assumptions and `reset` clears the conversation. Verified campus calculations currently support Michigan and zero or one other roommate.

Conversation state is encrypted in an HttpOnly cookie and expires after 10 minutes of inactivity. It survives separate Vercel instances without process memory. Optionally configure a stable `MOVIN_CHAT_SECRET`; otherwise the ASI key supplies the encryption secret. No banking history or balances are sent to ASI, only the question and known apartment facts. ASI authentication failures are reported; temporary failures and malformed output get one retry. Without an ASI key, the website explicitly uses its offline keyword interpreter.

Set `ASI1_API_KEY` in `.env.local` for local use, or in Vercel environment variables and redeploy. Run `npm run test:chat` for mocked model responses through the actual finance engine and HTTP route, and `npm run test:all` for the full suite. These automated tests use mocked ASI responses. `npm run check:chat` separately tests a live ASI key with a two-message conversation and fictional financial data; it makes paid provider requests. The web path directly calls ASI and does not send ACP messages to the registered Fetch agent. Demo login serves a fixed demo account and does not authenticate personal banking access.

Validation: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:all`; with the app running, `node scripts/test-movin.ts` exercises the full server flow. On hosts that block subprocesses, backend `.ts` checks without parameter properties can run directly with Node 24; the remaining checks can be transpiled with TypeScript before running. Next is configured to use build worker threads for that environment.

ASI now writes conversational replies from the finance tool results, with the last eight chat turns for follow-ups. Greetings and general questions get natural replies; missing apartment inputs still require clarification. Raw banking transactions and identifiers remain on the server.
