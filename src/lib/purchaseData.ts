export type PurchaseStatus = 'Paid' | 'Pending' | 'Partial';
export type DebitNoteStatus = 'Pending' | 'Approved' | 'Rejected';
export type PaymentStatus = 'Paid' | 'Pending';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
export type ExpenseCategory =
  | 'Transport'
  | 'Electricity'
  | 'Salary'
  | 'Office Expense'
  | 'Maintenance'
  | 'Miscellaneous';

export type PurchaseItem = {
  product: string;
  quantity: number;
  rate: number;
  tax: number;
  total: number;
};

export type Purchase = {
  id: string;
  purchaseNo: string;
  date: string;
  vendor: string;
  invoiceNo: string;
  product: string;
  quantity: number;
  purchaseAmount: number;
  paidAmount: number;
  balance: number;
  status: PurchaseStatus;
  items: PurchaseItem[];
};

export type DebitNote = {
  id: string;
  debitNoteNo: string;
  date: string;
  vendor: string;
  purchaseRef: string;
  product: string;
  quantity: number;
  returnAmount: number;
  reason: 'Damaged Product' | 'Wrong Quantity' | 'Expired Product' | 'Rate Difference';
  status: DebitNoteStatus;
};

export type Payment = {
  id: string;
  paymentNo: string;
  date: string;
  vendor: string;
  invoiceRef: string;
  method: PaymentMethod;
  amount: number;
  balance: number;
  status: PaymentStatus;
};

export type Expense = {
  id: string;
  expenseNo: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  method: PaymentMethod;
  enteredBy: string;
};

export const purchases: Purchase[] = [];
export const debitNotes: DebitNote[] = [];
export const payments: Payment[] = [];
export const expenses: Expense[] = [];

export const expenseCategories: ExpenseCategory[] = [
  'Transport',
  'Electricity',
  'Salary',
  'Office Expense',
  'Maintenance',
  'Miscellaneous',
];

export const paymentMethods: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
