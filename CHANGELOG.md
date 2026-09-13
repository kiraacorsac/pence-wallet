# Changelog

All notable changes to PennyWallet will be documented in this file.

## [0.0.18] - 2026-09-13

### Added
- exchange rates can be downloaded automatically, off by default, from **Settings → Exchange Rates → Download rates automatically**. It fetches once a day and refreshes the current month's rate for each currency you hold; an **Update now** button fetches on demand
- downloaded rates are marked **Auto**. A rate you entered by hand is never overwritten, even for the current month, and editing an auto rate by hand claims it permanently
- the daily marker is stored in your settings, which sync, so a second device that syncs after another has already fetched stays quiet instead of asking again

### Changed
- PennyWallet now makes one network request when — and only when — you turn rate downloads on: an HTTPS GET carrying your base currency code and nothing else. With the setting off it makes none at all

### Internal
- the demo vault check asserts the dated-rate mechanism against the seeded rates only, so a local vault that has downloaded rates no longer fails it

## [0.0.17] - 2026-09-13

### Breaking
- month files gained an 11th `AmountTo` column and per-currency frontmatter totals (`income.GBP: 3100`). Ten-column rows and bare `income:`/`expense:` keys still parse, but any month you edit is rewritten in the new format

### Added
- accounts have a currency, chosen from a built-in ISO 4217 list; a base currency and a dated exchange-rate table convert every combined figure (net assets, monthly metrics, subtotals, pies) at the rate in force for the month being viewed
- transfers between accounts of different currencies take separate sent and received amounts, showing the rate they imply; both are stored, so neither balance depends on a rate you later change
- decimal places can follow each currency's own convention (`Automatic`), instead of one global setting

### Changed
- balances and transaction rows read in their account's own currency; net assets shows a per-currency breakdown underneath
- changing an account's currency asks for confirmation and reinterprets its amounts rather than converting them

## [0.0.16] - 2026-09-13

### Breaking
- categories are now a plain `string[]` with no built-ins and no `creditCard` account type; all migration code and `migrate-*.mjs` scripts are gone. Old vaults are not upgraded — flatten the config's category lists, switch `"creditCard"` accounts to `"bank"` with a negated balance, and pad month rows to ten columns
- config moved from `.penny-wallet.json` to the plugin's `data.json` via `loadData`/`saveData` — copy the file to `.obsidian/plugins/penny-wallet/data.json` by hand, same JSON shape

### Changed
- pie charts show every category slice; the sub-1% "Other" bucket (which navigated with no category filter) is gone, and only zero-value entries are dropped
- pie slice colors are hashed from the category name instead of segment position, so a category keeps its color across charts and months; slices and legend are sorted by share, largest first
- pie palette widened to three shades per base color (24 slots), cutting same-color collisions in the default expense set to a single pair
- balance engine simplified: expense subtracts, income adds, transfer moves — a credit card is just an account with a negative balance

### Docs
- removed the Traditional Chinese documentation (`docs/zh/`, the zh VitePress locale, and the README links); the in-app Chinese UI is unaffected

## [0.0.15] - 2026-05-24

### Fixed
- TagPicker search input no longer interrupts IME composition (iOS Bopomofo / desktop IME), preventing dropped characters when typing tags

## [0.0.14] - 2026-05-17

### Changed
- ribbon / view icon switched to built-in lucide `wallet` (removed custom SVG registration)

### Internal
- scope month-file listing to plugin folder — replace `vault.getMarkdownFiles()` with `getFolderByPath().children` to remove the "Vault Enumeration" disclosure from Obsidian plugin reviewer
- pin vite to `^8` in devDependencies — prevents accidental downgrade (stylelint install silently regressed vite to 6.x, breaking obsidian package resolution in tests)

## [0.0.13] - 2026-05-17

### Changed
- replace CSS `:has()` keyboard rules with JS class toggles for iOS keyboard compensation
- remove all `!important` declarations (79 → 0) by bumping selector specificity (doubled/tripled `.pw-transaction-modal-container` / `.pw-bottom-sheet` / etc.) to beat Obsidian's mobile modal rules
- unify done-button class name: `pw-bottom-sheet-btn-primary` → `pw-bottom-sheet-btn--done` so filter sheet's Done button is bold + right-aligned
- fix CSS lint warnings: duplicate selectors, hex color format, asset wallet row class rename
- rename i18n keys `cat.*` / `walletType.*` / `type.*` → `label.cat.*` / `label.walletType.*` / `label.type.*` so key namespace encodes UI role
- rewrite 19 en UI strings to sentence case per Obsidian style guideline (e.g., "Add Transaction" → "Add transaction", "Net Assets" → "Net assets")

### Fixed
- filter sheet backdrop now covers Obsidian's bottom toolbar on mobile (`openFilterSheet` extracted from shared shell; backdrop attached to `document.body` to escape leaf transformed-ancestor containing block)
- bottom sheet picker search input not typeable on iOS (backdrop attached to containerEl)
- bottom sheet search placeholder and no-match text not i18n'd
- refund checkbox too close to label (added gap)

### Internal
- add stylelint with minimal rules (`declaration-no-important`, `selector-disallowed-list` for `:has()`, `no-duplicate-selectors`, `declaration-block-no-duplicate-properties`, `color-hex-length`) — run via `npm run lint:css`
- add i18n sentence-case linter (`scripts/lint-i18n.mjs`) that skips `label.*` namespace — run via `npm run lint:i18n`

## [0.0.12] - 2026-05-16

### Added
- add mobile calculator state
- add mobile calculator pad component
- wire mobile calculator modal flow
- refine mobile calculator sheet
- add ⌫ backspace and 00 keys to mobile calculator
- add Done key to mobile calculator (resolves pending expression then closes pad)

### Changed
- update mobile calculator layout
- move calculator formula to sheet title bar
- rework mobile calculator layout (all operators on top row; =/C/⌫/Done in right column)
- improve mobile calculator pressed-state visual feedback and unify sheet background

## [0.0.11] - 2026-05-09

### Added
- **Wallet filter multi-select** — both the mobile filter sheet and the desktop dropdown now accept multiple wallets

### Changed
- **Filter pill colorway** — type / category / wallet pills get a tinted active state (same-color border, same-color text, translucent same-color fill); neutral pill uses `--interactive-accent`; base size bumped to 14px to match the tag picker chip
- **Pill family** — tag picker chips consolidate into the `.pw-pill` family; category pill active drops the trailing ✓ marker

### Fixed
- Dark theme filter pill active fill not rendering — `:root` declarations referencing `--interactive-accent` failed to resolve (Obsidian declares the token on `body`); moved the affected vars to `body`

### Internal
- Filled variant preserved as git tag `pill-style-filled` (commit `cda9093`) for one-shot switching

## [0.0.10] - 2026-05-06

### Added
- **Refund as negative expense** — new「這是退款」toggle in the expense form saves the transaction with a negative amount; refunds render as a lighter green `+amount` in the list, distinguishable from regular income at a glance; migration script `scripts/migrate-refund.mjs` converts legacy `transfer credit_card_refund` records to the new format
- **Income wallet selector** — credit card accounts are now excluded from the income wallet picker

### Changed
- **Transaction modal redesign** — single accent colour (only Confirm is blue; title / type tabs / Cancel all neutral grey); refund toggle + inline hint grouped in a bordered sub-option block under the type tabs, with a desktop hover tooltip / mobile inline hint explaining that refunds are stored as negative expenses (`modal.isRefund.hint`); editing a refund (or toggling it on with an amount entered) shows a `+` prefix beside the amount — input prefix on desktop, hero prefix on mobile; mobile amount hero enlarged to 48 px / weight 500 with thousand-separated numbers (muted when empty, full-contrast when typed) and no `NT$` symbol; mobile top buttons shrunk to 32 × 32 visible / 44 pt touch; tag chip × hit area enlarged via padding without changing visible size; plain and wrapper-based field inputs (tag / amount wrappers) unified to one height with a single focus ring (nested input shadow suppressed)
- **Edit-mode cues, required markers, date affordance, transfer category reset** — edit modal title gains a pencil icon prefix and a subtitle「編輯 MM/DD 的交易」/「Editing transaction from MM/DD」using the source transaction's date; required fields (wallet, category, fromWallet, toWallet) now show a `*` after the label; the date input is cursor-pointer with an accent hover border on desktop and a `▾` caret beside the value on mobile; switching transaction type now clears `category` only when the current value isn't valid for the new type (amount, date, note, tags are still preserved across type switches)
- **Mobile tag picker** — replaces the mobile inline tag input with a bottom-sheet multi-select picker; chips render in alphabetical order with a unified oval style, tapping toggles selection (3-tag cap with disabled affordance on over-cap unselected chips); the picker's search input doubles as a new-tag entry — an inline「+ 新增「name」」 button appears between search and the chip list when typing so it stays reachable above the keyboard, and a bottom「+ 新增標籤」row prompts when search is empty; new tags persist via the new `WalletFile.addTag` helper (trim, strip leading `#`, dedupe, alphabetical insert, save). The mobile modal's tag row is now display-only chips (matching the picker's selected style) plus a muted「選擇標籤」placeholder; tapping anywhere on the row opens the picker. Desktop tag row is unchanged
- **Charts** — migrated to Chart.js for more stable rendering and a smaller bundle; pie chart merges small categories into "Others" with tap-to-drill-down; tooltip now shows amount and percentage
- **Transaction list** — action buttons reveal on hover (desktop) / stay visible (mobile) for a cleaner default layout
- **Shared styling** — unified CSS colour tokens; refactored shared `Card` and `Metric` components

### Fixed
- **Modal polish** — removed stray outer border inherited from Obsidian theme; restored checkbox appearance so it renders correctly across themes; added consistent separator lines between field rows; suppressed Obsidian's purple focus outline on type tabs

### Removed
- **Legacy refund category** — `credit_card_refund` transfer category removed (replaced by the negative-expense format above)

### Internal
- **Modal architecture refactor** — extracted 6 pure helpers (`parseAmountForEdit`, `validateTransactionForm`, `buildTransactionPayload`, `addTagToList`, `getCategoryOptions`, `getTransferWalletCandidates`) from `TransactionModal` into a dedicated `src/modal/transactionState.ts` module with 46 unit tests; deduplicated `MobileTransactionModal` against `TransactionModal` by lifting 4 stateful operations (`getActiveWallets`, `normalizeWalletForCategory`, `resetStateForType`, `getFormState`) to protected base-class methods; 10 verbatim duplicate sites collapsed; no user-visible behavior change

## [0.0.9] - 2026-04-17

### Added
- Data validation: detects malformed transaction rows and surfaces errors in the UI

### Fixed
- Mobile tag dropdown on iOS no longer triggers the system keyboard; uses native tap-to-select flow instead

## [0.0.8] - 2026-04-16

### Added
- Tags field on each transaction for flexible labeling and filtering

## [0.0.7] - 2026-04-14

### Changed
- Merged `repayment` transaction type into `transfer` — existing repayments are read as `transfer` with category `credit_card_payment`
- Renamed transfer type label from 「轉帳」to 「移轉」(zh) / "Transfer" (en)
- `translateCategory`: empty, `-`, and `other` values now display as 「未分類」/ "Uncategorized" instead of a dash
- Category defaults are now always normalized on config load (`normalizeOptions`), ignoring stale stored defaults

### Added
- Expanded default expense categories: `clothing`, `education`, `cash_expense`, `insurance`, `fees`, `tax`
- Expanded default income categories: `interest`, `lottery`, `rent`, `cashback`, `dividend`, `investment_profit`, `insurance_income`, `pension`
- Default transfer categories: `account_transfer`, `credit_card_payment`, `credit_card_refund`, `investment_trade`
- Custom transfer categories section in Settings
- `scripts/migrate-categories.mjs` — migrates old ledger rows (`repayment`→`transfer`, `other`→`-`) and `.penny-wallet.json` config to the new schema

### Fixed
- `credit_card_refund` balance calculation now correctly adjusts only the single credit card wallet (not double-counted)
- `credit_card_payment` balance calculation now decreases both bank (from) and credit card debt (to)

## [0.0.6] - 2026-04-11

### Changed
- Dashboard and Asset views now use a 2-column grid layout for better use of screen space.

## [0.0.5] - 2026-04-10

### Added
- Add click-through from income and expense pie charts to the Transactions view with related filters.
- Add drag-and-drop wallet reordering in Settings (SortableJS) and improve settings/detail UX.

### Fixed
- Wallet balance ordering now follows the configured wallet order.
- Fix mobile numpad tap feedback on iOS

## [0.0.4] - 2026-04-09

### Changed
- Replace Finance Trends view with the new Asset view.
- Update related dashboard/chart rendering and styling for the new view flow.

### Fixed
- Stabilize UI tests for the updated view behavior.

## [0.0.3] - 2026-04-08

### Fixed
- Prevent iOS dashboard navigation buttons from wrapping in longer locales.
- Improve archived wallet settings UX.

## [0.0.2] - 2026-04-08

### Added
- `createdAt` field on each transaction for stable same-date ordering
- Transactions on the same date now sort by creation time (newest first)

### Fixed
- iOS touch event handling and lint issues
- Mobile detail view now shows correct wallet name

## [0.0.1] - 2026-04-06

### Added
- Initial release
- Finance Overview with monthly income / expense summary, account balances, net asset, asset allocation pie chart, and category pie charts (legends show name, amount, and percentage)
- Transactions view with multi-select type filter, category checklist dropdown, keyword search on notes, sticky subtotals, inline edit and delete
- Finance Trends view with 3 / 6 / 12-month income/expense bar chart, category trend line chart, net asset line chart, and per-account balance trend
- Multiple account types: cash, bank, credit card (with debt tracking)
- Custom expense and income categories
- Credit card repayment workflow with automatic debt calculation
- iOS Shortcuts support via `obsidian://penny-wallet` URI handler
- Bilingual support: English and Traditional Chinese
- Plain Markdown storage — one file per month, compatible with Git sync and Dataview
- Config stored as `.penny-wallet.json` at vault root
