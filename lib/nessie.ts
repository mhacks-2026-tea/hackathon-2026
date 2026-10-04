// Server-side only: never import this module into a browser component.
import type { Customer, Account, Purchase, Deposit, Bill, Loan, StudentFinancialData } from './nessie.types.js';
export type * from './nessie.types.js';

export class NessieError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) {
    super(message);
    this.name = 'NessieError';
  }
}

export const NESSIE_DEFAULT_BASE_URL = 'https://api.nessieisreal.com';
type RecordData = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown, resource: string): RecordData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NessieError(`Nessie returned an invalid ${resource} object.`, 'INVALID_RESPONSE');
  }
  return value as RecordData;
}

function idOf(value: RecordData): string {
  const id = text(value._id);
  if (!id) throw new NessieError('Nessie returned a record without an ID.', 'INVALID_RESPONSE');
  return id;
}

function validateId(id: string, label: string): string {
  if (typeof id !== 'string' || !/^(?:[a-f\d]{24}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(id)) {
    throw new NessieError(`${label} must be a valid Nessie UUID or legacy 24-character ID.`, 'INVALID_ID');
  }
  return id;
}

async function request(path: string): Promise<unknown> {
  if (typeof window !== 'undefined') {
    throw new NessieError('Nessie must be called on the server.', 'SERVER_ONLY');
  }
  const key = process.env.NESSIE_API_KEY?.trim();
  if (!key) throw new NessieError('Set NESSIE_API_KEY in .env.local before calling Nessie.', 'MISSING_API_KEY');
  const base = process.env.NESSIE_BASE_URL?.trim() || NESSIE_DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(`${base.replace(/\/$/, '')}${path}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
  } catch {
    throw new NessieError('NESSIE_BASE_URL must be a valid HTTPS URL.', 'INVALID_CONFIG');
  }
  url.searchParams.set('key', key);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Do not include fetch errors or URLs: Nessie puts the API key in the query.
    throw new NessieError(`Could not reach Nessie for ${path}; check connectivity and the API host.`, 'NETWORK_ERROR');
  }
  if (!response.ok) {
    throw new NessieError(`Nessie request ${path} failed (HTTP ${response.status}). Check the ID and API key.`, 'API_ERROR', response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new NessieError(`Nessie returned invalid JSON for ${path}.`, 'INVALID_RESPONSE');
  }
}

export async function getCustomer(customerId: string): Promise<Customer> {
  validateId(customerId, 'Customer ID');
  const raw = record(await request(`/customers/${customerId}`), 'customer');
  return { id: idOf(raw), firstName: text(raw.first_name) ?? '', lastName: text(raw.last_name) ?? '' };
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function list(path: string): Promise<RecordData[]> {
  const raw = await request(path);
  if (!Array.isArray(raw)) {
    throw new NessieError(`Nessie returned an invalid list for ${path}.`, 'INVALID_RESPONSE');
  }
  return raw.map((item) => record(item, path));
}

export async function getAccounts(customerId: string): Promise<Account[]> {
  validateId(customerId, 'Customer ID');
  const accounts = await list(`/customers/${customerId}/accounts`);
  return accounts.map((raw) => {
    if (text(raw.customer_id) !== customerId) {
      throw new NessieError('Nessie returned an account for a different customer.', 'INVALID_RESPONSE');
    }
    return {
      id: idOf(raw), customerId, type: text(raw.type) ?? 'Unknown',
      nickname: text(raw.nickname) ?? '', balance: number(raw.balance),
    };
  });
}

function date(value: unknown): string | null {
  const input = text(value);
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const parsed = new Date(`${input}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input ? input : null;
}

export async function getPurchases(accountId: string): Promise<Purchase[]> {
  validateId(accountId, 'Account ID');
  const purchases = await list(`/accounts/${accountId}/purchases`);
  const merchantNames = new Map<string, string>();
  for (const raw of purchases) {
    const merchantId = text(raw.merchant_id);
    if (!merchantId || merchantNames.has(merchantId)) continue;
    let name = 'Unknown merchant';
    try {
      validateId(merchantId, 'Merchant ID');
      const merchant = record(await request(`/merchants/${merchantId}`), 'merchant');
      name = text(merchant.name) ?? name;
    } catch (error) {
      // Merchant enrichment is optional; the purchase itself is still useful.
      if (!(error instanceof NessieError)) throw error;
    }
    merchantNames.set(merchantId, name);
  }
  return purchases.map((raw) => {
    const merchantId = text(raw.merchant_id);
    return {
      id: idOf(raw), merchantId,
      merchant: merchantId ? merchantNames.get(merchantId) ?? 'Unknown merchant' : 'Unknown merchant',
      amount: number(raw.amount), date: date(raw.purchase_date), status: text(raw.status),
    };
  });
}

export async function getDeposits(accountId: string): Promise<Deposit[]> {
  validateId(accountId, 'Account ID');
  const deposits = await list(`/accounts/${accountId}/deposits`);
  return deposits.map((raw) => ({
    id: idOf(raw), amount: number(raw.amount),
    date: date(raw.transaction_date), status: text(raw.status),
  }));
}

export async function getBills(accountId: string): Promise<Bill[]> {
  validateId(accountId, 'Account ID');
  const bills = await list(`/accounts/${accountId}/bills`);
  return bills.map((raw) => {
    const day = number(raw.recurring_date);
    return {
      id: idOf(raw), payee: text(raw.payee) ?? 'Unknown payee',
      amount: number(raw.payment_amount),
      date: date(raw.upcoming_payment_date) ?? date(raw.payment_date),
      recurringDay: day !== null && Number.isInteger(day) && day >= 1 && day <= 31 ? day : null,
      status: text(raw.status),
    };
  });
}

export async function getLoans(accountId: string): Promise<Loan[]> {
  validateId(accountId, 'Account ID');
  const loans = await list(`/accounts/${accountId}/loans`);
  return loans.map((raw) => ({
    id: idOf(raw), amount: number(raw.amount),
    type: text(raw.type), status: text(raw.status),
  }));
}

/** Prefer Checking, then Savings. Supply accountId to select a specific deposit account. */
export function selectStudentAccount(accounts: Account[], accountId?: string): Account {
  if (accounts.length === 0) {
    throw new NessieError('No Nessie accounts were found for this customer.', 'NO_ACCOUNTS');
  }
  if (accountId !== undefined) validateId(accountId, 'Account ID');
  const account = accountId !== undefined
    ? accounts.find((item) => item.id === accountId)
    : accounts.find((item) => item.type === 'Checking') ?? accounts.find((item) => item.type === 'Savings');
  if (!account || !['Checking', 'Savings'].includes(account.type)) {
    throw new NessieError('Select a Checking or Savings account belonging to this customer.', 'NO_RELEVANT_ACCOUNT');
  }
  return account;
}

export async function getStudentFinancialData(customerId: string, accountId?: string): Promise<StudentFinancialData> {
  const account = selectStudentAccount(await getAccounts(customerId), accountId);
  // Keep failures visible: a failed endpoint must not look like an empty transaction list.
  const purchases = await getPurchases(account.id);
  const deposits = await getDeposits(account.id);
  const bills = await getBills(account.id);
  const loans = await getLoans(account.id);
  return {
    customerId, accountId: account.id, accountType: account.type,
    balance: account.balance, purchases, deposits, bills, loans,
  };
}
