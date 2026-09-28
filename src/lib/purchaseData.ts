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

const vendors = ['Nature Biotic', 'Green Agro Suppliers', 'Sri Lakshmi Traders'];
const productNames = ['Electra', 'Aalga', 'Astra', 'Alpha', 'Nuetra', 'Ultra', 'Electra Plus'];
const handlers = ['Ramesh Kumar', 'Priya S', 'Mohan L', 'Karthik N'];

function dateAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export const purchases: Purchase[] = Array.from({ length: 14 }, (_, i) => {
  const vendor = vendors[i % vendors.length];
  const product = productNames[i % productNames.length];
  const qty = 10 + (i % 6) * 5;
  const rate = 300 + (i % 5) * 80;
  const tax = Math.round(qty * rate * 0.05);
  const amount = qty * rate + tax;
  const paid = i % 3 === 0 ? amount : i % 3 === 1 ? Math.round(amount * 0.5) : 0;
  const balance = amount - paid;
  const status: PurchaseStatus = balance === 0 ? 'Paid' : paid === 0 ? 'Pending' : 'Partial';
  const items: PurchaseItem[] = [
    { product, quantity: qty, rate, tax, total: amount },
    {
      product: productNames[(i + 1) % productNames.length],
      quantity: 4 + (i % 3),
      rate: 250 + (i % 4) * 50,
      tax: 0,
      total: (4 + (i % 3)) * (250 + (i % 4) * 50),
    },
  ];
  return {
    id: `pur${i}`,
    purchaseNo: `PO-${String(1001 + i)}`,
    date: dateAgo(i * 2 + 1),
    vendor,
    invoiceNo: `INV-${String(5001 + i)}`,
    product,
    quantity: qty,
    purchaseAmount: amount,
    paidAmount: paid,
    balance,
    status,
    items,
  };
});

export const debitNotes: DebitNote[] = Array.from({ length: 9 }, (_, i) => {
  const reasons: DebitNote['reason'][] = ['Damaged Product', 'Wrong Quantity', 'Expired Product', 'Rate Difference'];
  const statuses: DebitNoteStatus[] = ['Pending', 'Approved', 'Rejected'];
  const qty = 2 + (i % 5);
  const rate = 300 + (i % 4) * 90;
  return {
    id: `dn${i}`,
    debitNoteNo: `DN-${String(201 + i)}`,
    date: dateAgo(i * 3 + 2),
    vendor: vendors[i % vendors.length],
    purchaseRef: `PO-${String(1001 + (i % purchases.length))}`,
    product: productNames[i % productNames.length],
    quantity: qty,
    returnAmount: qty * rate,
    reason: reasons[i % reasons.length],
    status: statuses[i % statuses.length],
  };
});

export const payments: Payment[] = Array.from({ length: 12 }, (_, i) => {
  const methods: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
  const amount = 2000 + (i % 7) * 1500;
  const balance = i % 2 === 0 ? 0 : 1500 + (i % 4) * 800;
  return {
    id: `pay${i}`,
    paymentNo: `PAY-${String(301 + i)}`,
    date: dateAgo(i),
    vendor: vendors[i % vendors.length],
    invoiceRef: `INV-${String(5001 + (i % purchases.length))}`,
    method: methods[i % methods.length],
    amount,
    balance,
    status: balance === 0 ? 'Paid' : 'Pending',
  };
});

export const expenses: Expense[] = Array.from({ length: 13 }, (_, i) => {
  const categories: ExpenseCategory[] = ['Transport', 'Electricity', 'Salary', 'Office Expense', 'Maintenance', 'Miscellaneous'];
  const methods: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer'];
  const descriptions: Record<ExpenseCategory, string> = {
    Transport: 'Goods delivery to store',
    Electricity: 'Store electricity bill',
    Salary: 'Staff salary payment',
    'Office Expense': 'Stationery and printing',
    Maintenance: 'Store interior repair',
    Miscellaneous: 'Misc store supplies',
  };
  const cat = categories[i % categories.length];
  return {
    id: `exp${i}`,
    expenseNo: `EXP-${String(401 + i)}`,
    date: dateAgo(i),
    category: cat,
    description: descriptions[cat],
    amount: 500 + (i % 6) * 1200,
    method: methods[i % methods.length],
    enteredBy: handlers[i % handlers.length],
  };
});

export const expenseCategories: ExpenseCategory[] = [
  'Transport',
  'Electricity',
  'Salary',
  'Office Expense',
  'Maintenance',
  'Miscellaneous',
];

export const paymentMethods: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
