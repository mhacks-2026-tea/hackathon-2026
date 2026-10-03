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
