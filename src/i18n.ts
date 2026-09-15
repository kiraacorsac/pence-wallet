import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_TRANSFER_CATEGORIES,
  type PennyWalletOptions,
} from './types'

type Locale = 'zh-TW' | 'en'

const translations = {
  'zh-TW': {
    // Transaction types
    'label.type.expense': '支出',
    'label.type.income': '收入',
    'label.type.transfer': '移轉',

    // Wallet types
    'label.walletType.cash': '現金',
    'label.walletType.bank': '銀行帳戶',

    // Default expense categories
    'label.cat.food': '飲食',
    'label.cat.clothing': '服飾',
    'label.cat.housing': '住家',
    'label.cat.transport': '交通',
    'label.cat.education': '學習',
    'label.cat.entertainment': '休閒娛樂',
    'label.cat.shopping': '購物',
    'label.cat.medical': '醫療',
    'label.cat.cash_expense': '現金消費',
    'label.cat.insurance': '保險',
    'label.cat.fees': '費用／手續費',
    'label.cat.tax': '稅金',

    // Default income categories
    'label.cat.salary': '薪資',
    'label.cat.interest': '利息所得',
    'label.cat.side_income': '兼職',
    'label.cat.bonus': '獎金',
    'label.cat.lottery': '發票／彩券中獎',
    'label.cat.rent': '租金',
    'label.cat.cashback': '優惠回饋',
    'label.cat.dividend': '股利',
    'label.cat.investment_profit': '投資獲利',
    'label.cat.insurance_income': '保險理賠',
    'label.cat.pension': '退休金',

    // Default transfer categories
    'label.cat.account_transfer': '帳戶互轉',
    'label.cat.credit_card_payment': '信用卡繳費',
    'label.cat.investment_trade': '投資買賣',

    // Fallback
    'label.cat.uncategorized': '未分類',

    // UI labels
    'ui.addTransaction': '新增交易',
    'ui.detail': '明細',
    'ui.confirm': '確認',
    'ui.cancel': '取消',
    'ui.delete': '刪除',
    'ui.edit': '編輯',
    'ui.archive': '封存',
    'ui.save': '儲存',
    'ui.search': '搜尋',
    'ui.noMatches': '沒有符合的選項',

    // Dashboard
    'dashboard.title': '帳本總覽',
    'dash.income': '收入',
    'dash.expense': '支出',
    'dash.balance': '結餘',
    'dash.netAsset': '淨資產',
    'dash.walletBalances': '帳戶餘額',
    'dash.assetAllocation': '資金占比',
    'dash.expenseByCategory': '支出分類',
    'dash.incomeByCategory': '收入分類',
    'dash.noData': '本月無資料',

    // Detail view
    'detail.title': '收支明細',
    'detail.filterAll': '全部',
    'detail.filterExpense': '支出',
    'detail.filterIncome': '收入',
    'detail.filterTransfer': '轉帳',
    'detail.subtotalIncome': '收入小計',
    'detail.subtotalExpense': '支出小計',
    'detail.noTransactions': '無符合條件的交易',
    'detail.searchPlaceholder': '搜尋備註/標籤...',
    'detail.filterCategory': '分類',
    'detail.filterButton': '篩選',
    'detail.filterTitle': '篩選',
    'detail.filterType': '類型',
    'detail.filterAccount': '帳戶',
    'detail.filterAllAccounts': '全部帳戶',
    'detail.filterDateRange': '日期範圍',
    'detail.filterClearAll': '清除全部',
    'detail.filterDone': '完成',

    // Trend view
    'trend.3m': '3 個月',
    'trend.6m': '6 個月',
    'trend.12m': '12 個月',
    'trend.monthlyIncomeExpense': '每月收支',

    // Date formatting
    'date.yearMonthNumeric': '{year} 年 {month} 月',
    'date.yearMonthShort': '{year} 年 {month} 月',
    'date.monthLabel': '{month}月',

    // Transaction modal
    'modal.addTitle': '新增交易',
    'modal.editTitle': '編輯交易',
    'modal.date': '日期',
    'modal.wallet': '帳戶',
    'modal.fromWallet': '轉出帳戶',
    'modal.toWallet': '轉入帳戶',
    'modal.category': '分類',
    'modal.note': '備註',
    'modal.tags': '標籤',
    'modal.tagsPlaceholder': '輸入標籤後按 Enter',
    'modal.done': '完成',
    'tagPicker.title': '選擇標籤',
    'tagPicker.search': '搜尋或輸入新標籤',
    'tagPicker.addTag': '+ 新增標籤',
    'tagPicker.addNamed': '+ 新增「{name}」',
    'tagPicker.noResults': '沒有包含「{searchTerm}」的標籤',
    'tagPicker.tagLimit': '已達標籤上限',
    'tagPicker.tooLong': '長度超過上限（{max} 字）無法新增',
    'tagPicker.rowPlaceholder': '選擇標籤',
    'modal.amount': '金額',
    'modal.sentAmount': '轉出金額',
    'modal.receivedAmount': '轉入金額',
    'modal.exchangeRate': '匯率',
    'modal.isRefund': '這是退款',
    'modal.isRefund.hint': '金額會記為負支出（用於退貨、退款場景）',

    // Validation errors
    'err.amountRequired': '請輸入金額',
    'err.amountPositive': '金額必須大於 0',
    'err.amountInteger': '目前設定不允許小數，請輸入整數金額',
    'err.receivedAmountRequired': '請輸入轉入金額',
    'err.receivedAmountPositive': '轉入金額必須大於 0',
    'err.receivedAmountInteger': '此幣別不允許小數，請輸入整數金額',
    'err.walletRequired': '請選擇帳戶',
    'err.fromWalletRequired': '請選擇轉出帳戶',
    'err.toWalletRequired': '請選擇轉入帳戶',
    'err.sameWallet': '來源與目標錢包不能相同',
    'err.walletNameEmpty': '錢包名稱不能為空',
    'err.walletNameDuplicate': '錢包名稱已存在',
    'calculator.err.pendingExpression': '請先按 = 完成計算',
    'calculator.err.negativeResult': '計算結果不可為負數',
    'calculator.err.divideByZero': '不可除以 0',
    'calculator.done': '完成',

    // Settings
    'settings.general': '一般設定',
    'settings.folderName': '資料夾名稱',
    'settings.folderNameDesc': '存放記帳檔案的資料夾（相對於 Vault 根目錄）',
    'settings.defaultWallet': '預設帳戶',
    'settings.defaultWalletDesc': '新增交易時預設選取的帳戶',
    'settings.decimalPlaces': '金額小數位數',
    'settings.decimalPlacesDesc': '記帳金額允許的小數位數',
    'settings.dp0': '整數（0 位）',
    'settings.dpAuto': '自動（依幣別）',
    'settings.baseCurrency': '主要幣別',
    'settings.baseCurrencyDesc': '淨資產與各項總計換算後顯示的幣別',
    'settings.walletCurrency': '幣別',
    'settings.exchangeRates': '匯率',
    'settings.exchangeRatesDesc': '每個幣別可設定多個生效月份；每個月會採用當時生效的匯率',
    'settings.rateEffectiveFrom': '生效月份',
    'settings.rateValue': '匯率',
    'settings.addRate': '新增匯率',
    'settings.noRates': '尚未設定匯率，總計將以原始金額相加',
    'settings.rateHint': '1 {code} = ? {base}',
    'settings.autoFetchRates': '自動下載匯率',
    'settings.autoFetchRatesDesc': '每天向 open.er-api.com 取得一次匯率，更新本月份的數值。只會送出主要幣別代碼，不含任何帳務資料；手動輸入的匯率永遠不會被覆蓋。',
    'settings.fetchRatesNow': '立即更新',
    'settings.fetchingRates': '更新中…',
    'settings.ratesLastUpdated': '上次更新：{when}',
    'settings.ratesNeverFetched': '尚未自動更新過',
    'settings.rateAuto': '自動',
    'settings.dp2': '2 位小數',
    'settings.activeWallets': '使用中帳戶',
    'settings.archivedWallets': '已封存帳戶',
    'settings.addWallet': '新增帳戶',
    'settings.walletName': '名稱',
    'settings.walletType': '類型',
    'settings.initialBalance': '初始餘額',
    'settings.includeInNetAssetOn': '目前：納入淨資產',
    'settings.includeInNetAssetOff': '目前：不納入淨資產',
    'settings.customCategories': '分類',
    'settings.expenseCategories': '支出',
    'settings.incomeCategories': '收入',
    'settings.transferCategories': '移轉',
    'settings.addCategory': '新增分類',
    'settings.categoryPlaceholder': '輸入分類名稱',

    // Validation
    'validation.modalTitle': '資料驗算報告',
    'validation.fixAll': '全部修復',
    'validation.fix': '修復',
    'validation.remapTo': '改指向',
    'validation.frontmatterSection': 'Frontmatter 快取不一致',
    'validation.frontmatterDesc': '{month}：收入應為 {actualIncome}（現為 {storedIncome}），支出應為 {actualExpense}（現為 {storedExpense}）',
    'validation.orphanSection': '孤兒帳戶引用',
    'validation.orphanDesc': '帳戶「{wallet}」不存在於設定中，共 {count} 筆交易引用（{months}）',
    'validation.repaired': '已修復 {count} 個問題',
    'settings.autoValidate': '啟動時自動驗算',
    'settings.autoValidateDesc': '開啟 Obsidian 時自動掃描所有資料，偵測 frontmatter 快取不一致與孤兒帳戶',
    'notice.validationClean': '驗算完成，資料無誤。',

    // Confirm dialogs
    'confirm.deleteTransaction': '確定要刪除這筆交易？此操作無法復原。',
    'confirm.changeCurrency': '此帳戶已有交易紀錄。變更幣別只會改變既有金額的解讀方式，不會換算金額。確定要繼續？',
    'confirm.archiveWallet': '確定要封存此錢包？封存後無法復原，該錢包將不再出現在交易入口中。',
    'confirm.deleteWallet': '確定要刪除此錢包？',
    'confirm.unarchiveWallet': '確定要取消封存此錢包？',

    // Onboarding
    'onboard.welcome': '歡迎使用 PennyWallet！建議先新增您的銀行帳戶與信用卡錢包。',

    // Settings — extra
    'settings.noActiveWallets': '無使用中錢包',
    'settings.balanceHint': '填入目前實際餘額。欠款帳戶（如信用卡）請填負數，例：欠 3,000 → 填 -3000',

    // Notices
    'notice.walletAdded': '✓ 帳戶「{name}」已新增',
    'notice.walletReordered': '✓ 帳戶順序已儲存',
    'notice.transactionDeleted': '✓ 交易已刪除',
    'notice.transactionAdded': '✓ 交易已新增',
    'notice.transactionUpdated': '✓ 交易已更新',
    'notice.loadFailed': 'PennyWallet 載入失敗，請檢查插件設定。',
    'notice.ratesUpdated': '✓ 已更新 {count} 筆匯率',
    'notice.ratesUnchanged': '匯率已是最新',
    'notice.ratesFetchFailed': '匯率更新失敗，請稍後再試。',
    'notice.ratesBaseUnsupported': '匯率來源不支援主要幣別 {base}，請手動輸入匯率。',

    // Errors — extra
    'err.categoryExists': '分類已存在',
    'err.categoryExistsInOtherList': '此分類名稱已存在於另一個清單中',
    'err.invalidDate': '日期格式無效',

    'ui.unarchive': '取消封存',

    // Asset view
    'asset.title': '資產',
    'ui.asset': '資產',
    'ui.overview': '總覽',
    'asset.netAssetTrend': '淨資產趨勢',
  },
  'en': {
    'label.type.expense': 'Expense',
    'label.type.income': 'Income',
    'label.type.transfer': 'Transfer',

    'label.walletType.cash': 'Cash',
    'label.walletType.bank': 'Bank Account',

    'label.cat.food': 'Food',
    'label.cat.clothing': 'Clothing',
    'label.cat.housing': 'Home',
    'label.cat.transport': 'Transport',
    'label.cat.education': 'Education',
    'label.cat.entertainment': 'Entertainment',
    'label.cat.shopping': 'Shopping',
    'label.cat.medical': 'Medical',
    'label.cat.cash_expense': 'Cash Expense',
    'label.cat.insurance': 'Insurance',
    'label.cat.fees': 'Fees',
    'label.cat.tax': 'Tax',

    'label.cat.salary': 'Salary',
    'label.cat.interest': 'Interest',
    'label.cat.side_income': 'Side Income',
    'label.cat.bonus': 'Bonus',
    'label.cat.lottery': 'Lottery',
    'label.cat.rent': 'Rent',
    'label.cat.cashback': 'Cashback',
    'label.cat.dividend': 'Dividend',
    'label.cat.investment_profit': 'Investment Profit',
    'label.cat.insurance_income': 'Insurance Claim',
    'label.cat.pension': 'Pension',

    'label.cat.account_transfer': 'Account Transfer',
    'label.cat.credit_card_payment': 'Credit Card Payment',
    'label.cat.investment_trade': 'Investment Trade',

    'label.cat.uncategorized': 'Uncategorized',

    'ui.addTransaction': 'Add transaction',
    'ui.detail': 'Transactions',
    'ui.confirm': 'Confirm',
    'ui.cancel': 'Cancel',
    'ui.delete': 'Delete',
    'ui.edit': 'Edit',
    'ui.archive': 'Archive',
    'ui.save': 'Save',
    'ui.search': 'Search',
    'ui.noMatches': 'No matches',

    'dashboard.title': 'Finance overview',
    'dash.income': 'Income',
    'dash.expense': 'Expense',
    'dash.balance': 'Balance',
    'dash.netAsset': 'Net assets',
    'dash.walletBalances': 'Account balances',
    'dash.assetAllocation': 'Asset allocation',
    'dash.expenseByCategory': 'Expense by category',
    'dash.incomeByCategory': 'Income by category',
    'dash.noData': 'No data this month',

    'detail.title': 'Transactions',
    'detail.filterAll': 'All',
    'detail.filterExpense': 'Expense',
    'detail.filterIncome': 'Income',
    'detail.filterTransfer': 'Transfer',
    'detail.subtotalIncome': 'Income subtotal',
    'detail.subtotalExpense': 'Expense subtotal',
    'detail.noTransactions': 'No matching transactions',
    'detail.searchPlaceholder': 'Search notes/tags...',
    'detail.filterCategory': 'Category',
    'detail.filterButton': 'Filter',
    'detail.filterTitle': 'Filter',
    'detail.filterType': 'Type',
    'detail.filterAccount': 'Account',
    'detail.filterAllAccounts': 'All accounts',
    'detail.filterDateRange': 'Date range',
    'detail.filterClearAll': 'Clear all',
    'detail.filterDone': 'Done',

    'trend.3m': '3 Months',
    'trend.6m': '6 Months',
    'trend.12m': '12 Months',
    'trend.monthlyIncomeExpense': 'Monthly income & expense',

    'date.yearMonthNumeric': '{month}/{year}',
    'date.yearMonthShort': '{monthName} {year}',
    'date.monthLabel': '{monthName}',

    'modal.addTitle': 'Add transaction',
    'modal.editTitle': 'Edit transaction',
    'modal.date': 'Date',
    'modal.wallet': 'Account',
    'modal.fromWallet': 'From account',
    'modal.toWallet': 'To account',
    'modal.category': 'Category',
    'modal.note': 'Note',
    'modal.tags': 'Tags',
    'modal.tagsPlaceholder': 'Type and press Enter',
    'modal.done': 'Done',
    'tagPicker.title': 'Select tags',
    'tagPicker.search': 'Search or type a new tag',
    'tagPicker.addTag': '+ Add tag',
    'tagPicker.addNamed': '+ Add "{name}"',
    'tagPicker.noResults': 'No tags containing "{searchTerm}"',
    'tagPicker.tagLimit': 'Tag limit reached',
    'tagPicker.tooLong': 'Too long to add (max {max} chars)',
    'tagPicker.rowPlaceholder': 'Select tags',
    'modal.amount': 'Amount',
    'modal.sentAmount': 'Sent',
    'modal.receivedAmount': 'Received',
    'modal.exchangeRate': 'Rate',
    'modal.isRefund': 'This is a refund',
    'modal.isRefund.hint': 'Stored as a negative expense (for refunds and returns)',

    'err.amountRequired': 'Amount is required',
    'err.amountPositive': 'Amount must be greater than 0',
    'err.amountInteger': 'Decimal amounts are not allowed. Please enter a whole number.',
    'err.receivedAmountRequired': 'Enter the amount received',
    'err.receivedAmountPositive': 'Received amount must be greater than 0',
    'err.receivedAmountInteger': 'This currency does not allow decimals. Please enter a whole number.',
    'err.walletRequired': 'Please select an account',
    'err.fromWalletRequired': 'Please select source account',
    'err.toWalletRequired': 'Please select target account',
    'err.sameWallet': 'Source and target accounts cannot be the same',
    'err.walletNameEmpty': 'Account name cannot be empty',
    'err.walletNameDuplicate': 'Account name already exists',
    'calculator.err.pendingExpression': 'Press = to finish the calculation',
    'calculator.err.negativeResult': 'Calculation result cannot be negative',
    'calculator.err.divideByZero': 'Cannot divide by 0',
    'calculator.done': 'Done',

    'settings.general': 'General',
    'settings.folderName': 'Folder name',
    'settings.folderNameDesc': 'Folder to store penny-wallet files (relative to vault root)',
    'settings.defaultWallet': 'Default account',
    'settings.defaultWalletDesc': 'Default account selected when adding a transaction',
    'settings.decimalPlaces': 'Decimal places',
    'settings.decimalPlacesDesc': 'Number of decimal places allowed for amounts',
    'settings.dp0': 'Integer (0 decimals)',
    'settings.dpAuto': 'Automatic (per currency)',
    'settings.baseCurrency': 'Base currency',
    'settings.baseCurrencyDesc': 'Currency that net assets and combined totals are converted to',
    'settings.walletCurrency': 'Currency',
    'settings.exchangeRates': 'Exchange rates',
    'settings.exchangeRatesDesc': 'Each currency can have several effective months; every month uses the rate in force at the time',
    'settings.rateEffectiveFrom': 'Effective from',
    'settings.rateValue': 'Rate',
    'settings.addRate': 'Add rate',
    'settings.noRates': 'No rates set, so totals add the raw amounts together',
    'settings.rateHint': '1 {code} = ? {base}',
    'settings.autoFetchRates': 'Download rates automatically',
    'settings.autoFetchRatesDesc': 'Fetch rates once a day from open.er-api.com and update the figures for the current month. Only the base currency code is sent, never your accounts or amounts, and a rate you entered by hand is never overwritten.',
    'settings.fetchRatesNow': 'Update now',
    'settings.fetchingRates': 'Updating…',
    'settings.ratesLastUpdated': 'Last updated {when}',
    'settings.ratesNeverFetched': 'Never updated automatically',
    'settings.rateAuto': 'Auto',
    'settings.dp2': '2 decimal places',
    'settings.activeWallets': 'Active accounts',
    'settings.archivedWallets': 'Archived accounts',
    'settings.addWallet': 'Add account',
    'settings.walletName': 'Name',
    'settings.walletType': 'Type',
    'settings.initialBalance': 'Initial balance',
    'settings.includeInNetAssetOn': 'Current: included in net assets',
    'settings.includeInNetAssetOff': 'Current: excluded from net assets',
    'settings.customCategories': 'Categories',
    'settings.expenseCategories': 'Expense',
    'settings.incomeCategories': 'Income',
    'settings.transferCategories': 'Transfer',
    'settings.addCategory': 'Add category',
    'settings.categoryPlaceholder': 'Enter category name',

    // Validation
    'validation.modalTitle': 'Data validation report',
    'validation.fixAll': 'Fix all',
    'validation.fix': 'Fix',
    'validation.remapTo': 'Remap to',
    'validation.frontmatterSection': 'Frontmatter cache mismatch',
    'validation.frontmatterDesc': '{month}: income should be {actualIncome} (stored: {storedIncome}), expense should be {actualExpense} (stored: {storedExpense})',
    'validation.orphanSection': 'Orphaned wallet references',
    'validation.orphanDesc': 'Wallet "{wallet}" not found in config — {count} transaction(s) affected ({months})',
    'validation.repaired': 'Fixed {count} issue(s)',
    'settings.autoValidate': 'Validate data on startup',
    'settings.autoValidateDesc': 'Scan all data when Obsidian loads to detect frontmatter mismatches and orphaned wallet references',
    'notice.validationClean': 'Validation complete — data looks good.',

    'confirm.deleteTransaction': 'Delete this transaction? This cannot be undone.',
    'confirm.changeCurrency': 'This account already has transactions. Changing its currency only changes how the existing amounts are read, it does not convert them. Continue?',
    'confirm.archiveWallet': 'Archive this wallet? This cannot be undone. The wallet will no longer appear in transaction forms.',
    'confirm.deleteWallet': 'Delete this wallet?',
    'confirm.unarchiveWallet': 'Unarchive this wallet?',

    'onboard.welcome': 'Welcome to PennyWallet! We recommend adding your bank accounts and credit cards.',

    'settings.noActiveWallets': 'No active wallets',
    'settings.balanceHint': 'Enter the current actual balance. Use a negative number for money owed, e.g. owe 3,000 → enter -3000',

    'notice.walletAdded': '✓ Account "{name}" added',
    'notice.walletReordered': '✓ Wallet order saved',
    'notice.transactionDeleted': '✓ Transaction deleted',
    'notice.transactionAdded': '✓ Transaction added',
    'notice.transactionUpdated': '✓ Transaction updated',
    'notice.loadFailed': 'PennyWallet failed to load. Please check plugin settings.',
    'notice.ratesUpdated': '✓ {count} rates updated',
    'notice.ratesUnchanged': 'Rates are already up to date',
    'notice.ratesFetchFailed': 'Could not update rates. Please try again later.',
    'notice.ratesBaseUnsupported': 'The rate source does not support {base}, so rates must be entered by hand.',

    'err.categoryExists': 'Category already exists',
    'err.categoryExistsInOtherList': 'This category already exists in the other list',
    'err.invalidDate': 'Invalid date',

    'ui.unarchive': 'Unarchive',

    // Asset view
    'asset.title': 'Assets',
    'ui.asset': 'Assets',
    'ui.overview': 'Overview',
    'asset.netAssetTrend': 'Net asset trend',
  },
} as const

type TranslationKey = keyof typeof translations['en']

let currentLocale: Locale = 'zh-TW'

const LOCALE_TAGS: Record<Locale, string> = {
  'zh-TW': 'zh-TW',
  en: 'en-US',
}

export function detectLocale(): Locale {
  try {
    // Obsidian exposes moment with locale set
    const lang = (window as Window & { moment?: { locale?: () => string } }).moment?.locale?.() ?? ''
    if (lang.startsWith('zh')) return 'zh-TW'
  } catch {
    // ignore
  }
  return 'en'
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function t(key: TranslationKey): string {
  const dict = translations[currentLocale] as Record<string, string>
  return dict[key] ?? (translations['en'] as Record<string, string>)[key] ?? key
}

/** t() with variable substitution. e.g. tn('notice.walletAdded', { name: '現金' }) */
export function tn(key: TranslationKey, vars: Record<string, string>): string {
  let str = t(key)
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v)
  }
  return str
}

function parseYearMonth(yearMonth: string): { year: string; month: string; monthPadded: string; date: Date } | null {
  const match = yearMonth.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const [, year, monthPadded] = match
  const monthNumber = Number(monthPadded)
  if (monthNumber < 1 || monthNumber > 12) return null

  return {
    year,
    month: String(monthNumber),
    monthPadded,
    date: new Date(Number(year), monthNumber - 1, 1),
  }
}

function getShortMonthName(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[currentLocale], { month: 'short' }).format(date)
}

export function formatYearMonth(yearMonth: string, style: 'numeric' | 'short' = 'numeric'): string {
  const parsed = parseYearMonth(yearMonth)
  if (!parsed) return yearMonth

  const vars = {
    year: parsed.year,
    month: parsed.month,
    monthPadded: parsed.monthPadded,
    monthName: getShortMonthName(parsed.date),
  }

  return style === 'short'
    ? tn('date.yearMonthShort', vars)
    : tn('date.yearMonthNumeric', vars)
}

export function formatMonthLabel(yearMonth: string): string {
  const parsed = parseYearMonth(yearMonth)
  if (!parsed) return yearMonth

  return tn('date.monthLabel', {
    year: parsed.year,
    month: parsed.month,
    monthPadded: parsed.monthPadded,
    monthName: getShortMonthName(parsed.date),
  })
}

/** Display label for a stored category value. Categories are plain user strings. */
export function translateCategory(value: string): string {
  if (!value || value === '-') return t('label.cat.uncategorized')
  return value
}

/** Localized name for one of the seed category keys. */
function seedCategoryLabel(key: string): string {
  const dict = translations[currentLocale] as Record<string, string>
  return dict[`label.cat.${key}`] ?? key
}

/**
 * Category lists for a newly created config: the seed keys resolved to
 * localized labels. From here on they are ordinary user-editable strings.
 */
export function seedDefaultCategories(): PennyWalletOptions['categories'] {
  return {
    expense:  DEFAULT_EXPENSE_CATEGORIES.map(seedCategoryLabel),
    income:   DEFAULT_INCOME_CATEGORIES.map(seedCategoryLabel),
    transfer: DEFAULT_TRANSFER_CATEGORIES.map(seedCategoryLabel),
  }
}

export function initI18n(): void {
  currentLocale = detectLocale()
}
