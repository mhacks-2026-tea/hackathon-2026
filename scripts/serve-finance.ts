import { getStudentFinancialData } from "../lib/nessie.js";
import { createFinanceServer } from "../src/lib/finance/http-server.ts";

/** Local backend for the ACP bridge. Keep tokens and Nessie credentials in .env.local. */
const server = createFinanceServer({
  token: process.env.MOVIN_BRIDGE_TOKEN ?? "",
  customerId: process.env.NESSIE_CUSTOMER_ID ?? "",
  accountId: process.env.NESSIE_ACCOUNT_ID,
  historyStartDate: process.env.FINANCE_HISTORY_START ?? "",
  asOfDate: process.env.FINANCE_AS_OF_DATE ?? "",
}, getStudentFinancialData);
const port = Number(process.env.MOVIN_PORT ?? 3101);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid MOVIN_PORT.");
// Loopback is intentional: the future local Fetch bridge can call this service.
server.listen(port, "127.0.0.1", () => console.log(`Movin sandbox backend: http://127.0.0.1:${port}`));
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
