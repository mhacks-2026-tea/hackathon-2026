import {
  getCustomer, getAccounts, getPurchases, getDeposits, getBills, getLoans,
  getStudentFinancialData, selectStudentAccount, NessieError,
} from '../lib/nessie.js';

async function main() {
  const customerId = process.argv[2] || process.env.NESSIE_CUSTOMER_ID;
  if (!customerId) throw new NessieError('Set NESSIE_CUSTOMER_ID in .env.local or pass it after --.', 'MISSING_CUSTOMER_ID');
  // Verify in order and stop on the first error. Only GET requests are used.
  const customer = await getCustomer(customerId);
  console.log('PASS customer:', customer.id);
  const accounts = await getAccounts(customerId);
  console.log('PASS accounts:', accounts.length);
  const account = selectStudentAccount(accounts, process.env.NESSIE_ACCOUNT_ID);
  console.log('Selected account:', account.id, account.type);
  console.log('PASS purchases:', (await getPurchases(account.id)).length);
  console.log('PASS deposits:', (await getDeposits(account.id)).length);
  console.log('PASS bills:', (await getBills(account.id)).length);
  console.log('PASS loans:', (await getLoans(account.id)).length);
  const data = await getStudentFinancialData(customerId, account.id);
  console.log('PASS aggregated student financial data:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof NessieError ? `${error.code}: ${error.message}` : 'Unexpected verification failure.');
  process.exitCode = 1;
});
