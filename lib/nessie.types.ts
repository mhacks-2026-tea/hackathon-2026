export type Customer = { id: string; firstName: string; lastName: string };
export type Account = {
  id: string;
  customerId: string;
  type: string;
  nickname: string;
  balance: number | null;
};
export type Purchase = {
  id: string;
  merchantId: string | null;
  merchant: string;
  amount: number | null;
  date: string | null;
  status: string | null;
};
export type Deposit = {
  id: string;
  amount: number | null;
  date: string | null;
  status: string | null;
};
export type Bill = {
  id: string;
  payee: string;
  amount: number | null;
  date: string | null;
  recurringDay: number | null;
  status: string | null;
};
export type Loan = {
  id: string;
  amount: number | null;
  type: string | null;
  status: string | null;
};
export type StudentFinancialData = {
  customerId: string;
  accountId: string;
  accountType: string;
  balance: number | null;
  purchases: Purchase[];
  deposits: Deposit[];
  bills: Bill[];
  loans: Loan[];
};
