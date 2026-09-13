export type TransactionType = 'expense' | 'income' | 'transfer'
export type WalletType = 'cash' | 'bank'

export interface Transaction {
  date: string        // MM/DD format as stored in markdown (e.g. "04/03")
  type: TransactionType
  wallet?: string     // expense / income
  fromWallet?: string // transfer / repayment
  toWallet?: string   // transfer / repayment
  category?: string   // plain category name, exactly as it appears in Settings
  note: string
  tags?: string[]
  amount: number
  createdAt?: string  // ISO 8601 timestamp; absent in data written before this field was added
}

export interface Wallet {
  name: string
  type: WalletType
  initialBalance: number  // may be negative (e.g. a credit card's outstanding debt)
  status: 'active' | 'archived'
  includeInNetAsset: boolean  // active wallets always true; archived wallets can be toggled
}

export interface MonthSummary {
  income: number
  expense: number
  netAsset: number
}

export interface WalletBalance {
  wallet: Wallet
  balance: number   // may be negative
}

export interface PennyWalletOptions {
  categories: {
    expense: string[]
    income: string[]
    transfer: string[]
  }
}

export interface PennyWalletConfig {
  wallets: Wallet[]
  defaultWallet: string
  folderName: string
  decimalPlaces: 0 | 2
  options: PennyWalletOptions
  tags: string[]
  autoValidateOnLoad: boolean
}

export interface TransactionModalParams {
  type?: TransactionType
  amount?: number
  note?: string
  tags?: string[]
  category?: string
  wallet?: string
  fromWallet?: string
  toWallet?: string
  date?: string  // yyyy-mm-dd
}

// Category keys seeded into a new config. They are i18n keys resolved to
// localized labels at config-creation time - not a runtime "built-in" set.
export const DEFAULT_EXPENSE_CATEGORIES = [
  'food', 'clothing', 'housing', 'transport', 'education',
  'entertainment', 'shopping', 'medical', 'cash_expense',
  'insurance', 'fees', 'tax',
] as const

export const DEFAULT_INCOME_CATEGORIES = [
  'salary', 'interest', 'side_income', 'bonus', 'lottery',
  'rent', 'cashback', 'dividend', 'investment_profit',
  'insurance_income', 'pension',
] as const

export const DEFAULT_TRANSFER_CATEGORIES = [
  'account_transfer', 'credit_card_payment',
  'investment_trade',
] as const

export const DEFAULT_CONFIG: PennyWalletConfig = {
  wallets: [
    {
      name: 'Default Wallet',
      type: 'cash',
      initialBalance: 0,
      status: 'active',
      includeInNetAsset: true,
    }
  ],
  defaultWallet: 'Default Wallet',
  folderName: 'PennyWallet',
  decimalPlaces: 0,
  // Seeded with localized labels by WalletFile at config-creation time
  options: {
    categories: {
      expense: [],
      income: [],
      transfer: [],
    },
  },
  tags: [],
  autoValidateOnLoad: true,
}

export interface FrontmatterIssue {
  type: 'frontmatter'
  yearMonth: string
  storedIncome: number
  storedExpense: number
  actualIncome: number
  actualExpense: number
}

export interface OrphanedWalletIssue {
  type: 'orphanedWallet'
  walletName: string
  transactionCount: number
  yearMonths: string[]
}

export type ValidationIssue = FrontmatterIssue | OrphanedWalletIssue
