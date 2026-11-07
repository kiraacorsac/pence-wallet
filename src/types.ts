export type TransactionType = 'expense' | 'income' | 'transfer'
export type WalletType = 'cash' | 'bank' | 'investment'

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
  amountTo?: number    // cross-currency transfer: amount received, in the toWallet currency
  createdAt?: string  // ISO 8601 timestamp; absent in data written before this field was added
}

export interface Wallet {
  name: string
  type: WalletType
  initialBalance: number  // may be negative (e.g. a credit card's outstanding debt)
  status: 'active' | 'archived'
  includeInNetAsset: boolean  // active wallets always true; archived wallets can be toggled
  currency?: string       // ISO 4217 code; absent means the config's base currency.
                          // For an investment account, the currency its cash and trades settle in.
}

/**
 * What happens inside an investment account, stored in that account's own
 * ledger file. Money moving in or out of the account is not a trade: it is an
 * ordinary transfer, income or expense in the month files.
 *
 * - buy / sell exchange the account's cash for shares at the stated amount
 * - adjust changes a share count without touching cash: a split, or shares
 *   moved in from (positive) or out to (negative) another broker
 */
export type TradeAction = 'buy' | 'sell' | 'adjust'

export interface Trade {
  date: string        // 'YYYY-MM-DD'; a ledger spans many months, so the year is kept
  action: TradeAction
  symbol: string      // ticker, upper-cased, e.g. 'NVDA'
  quantity: number    // shares; always positive for buy / sell, signed for adjust
  amount?: number     // buy / sell: gross cash value, in the account's currency.
                      // adjust: the cost basis it adds (absent for a split)
  fee?: number        // buy / sell only, in the account's currency
  note: string
  createdAt?: string  // ISO 8601 timestamp
}

/** One holding: shares held and what they cost, in the account's currency. */
export interface Position {
  quantity: number
  cost: number
}

/**
 * Monthly totals, split by currency so the cache stays exact and independent of
 * whatever exchange rates happen to be configured. Keys are ISO codes.
 */
export interface MonthSummary {
  income: Map<string, number>
  expense: Map<string, number>
  netAsset: number
}

export interface WalletBalance {
  wallet: Wallet
  balance: number   // may be negative; in `currency`, not the base currency. Cash only, for an investment account
  currency: string
  holdings?: Map<string, Position>  // investment accounts only: symbol → position
}

export interface PennyWalletOptions {
  categories: {
    expense: string[]
    income: string[]
    transfer: string[]
  }
}

/** The slice of Obsidian's Plugin API that config persistence needs. */
export interface SettingsStore {
  loadData(): Promise<unknown>
  saveData(data: unknown): Promise<void>
}

/**
 * One leg of the dated exchange-rate table: from `effectiveFrom` onwards,
 * 1 unit of `code` is worth `rate` units of the config's base currency.
 */
export interface RatePoint {
  code: string           // ISO 4217 code being priced
  effectiveFrom: string  // 'YYYY-MM'; applies to that month and every later one
  rate: number
  source?: 'auto'        // written by the downloader; absent means entered by hand
}

/**
 * One dated price for a security: from `effectiveFrom` onwards, one share of
 * `symbol` is worth `price` units of `currency` - the currency it trades in,
 * which the exchange-rate table then converts like any other.
 */
export interface PricePoint {
  symbol: string
  effectiveFrom: string  // 'YYYY-MM'; applies to that month and every later one
  price: number
  currency: string       // ISO 4217 code the security is quoted in
  source?: 'auto'        // written by the downloader; absent means entered by hand
}

/** 'auto' derives decimals from each currency; 0 | 2 force one setting globally. */
export type DecimalPlaces = 0 | 2 | 'auto'

export interface PennyWalletConfig {
  wallets: Wallet[]
  defaultWallet: string
  folderName: string
  decimalPlaces: DecimalPlaces
  baseCurrency: string
  rates: RatePoint[]
  prices: PricePoint[]
  options: PennyWalletOptions
  tags: string[]
  autoValidateOnLoad: boolean
  autoFetchRates: boolean
  lastRateFetch?: string  // ISO 8601 of the last successful rate download
  autoFetchPrices: boolean
  lastPriceFetch?: string     // ISO 8601 of the last completed price download
  priceApiKeySecret?: string  // id of the keychain entry holding the API key - never the key itself
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
  baseCurrency: 'USD',
  rates: [],
  prices: [],
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
  // Off until asked for: these are the only features that leave the vault.
  autoFetchRates: false,
  autoFetchPrices: false,
}

export interface FrontmatterIssue {
  type: 'frontmatter'
  yearMonth: string
  storedIncome: Map<string, number>
  storedExpense: Map<string, number>
  actualIncome: Map<string, number>
  actualExpense: Map<string, number>
}

export interface OrphanedWalletIssue {
  type: 'orphanedWallet'
  walletName: string
  transactionCount: number
  yearMonths: string[]
}

/** A ledger in the Investments folder that no investment account owns. */
export interface OrphanedLedgerIssue {
  type: 'orphanedLedger'
  path: string
  accountName: string | null  // from the ledger's frontmatter, when it has one
  tradeCount: number
}

/** A ledger whose rows sell or move out more shares than were held at the time. */
export interface NegativeHoldingIssue {
  type: 'negativeHolding'
  walletName: string
  symbol: string
  date: string      // 'YYYY-MM-DD' of the first trade that took it below zero
  quantity: number  // the holding right after that trade
}

export type ValidationIssue = FrontmatterIssue | OrphanedWalletIssue | OrphanedLedgerIssue | NegativeHoldingIssue
