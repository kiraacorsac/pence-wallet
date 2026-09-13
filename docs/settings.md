# Settings

Open via **Settings → PennyWallet** in Obsidian.

---

## General

### Folder Name

The vault folder where monthly transaction files are stored. Default: `PennyWallet`

The path is relative to the vault root. Change this if you want transactions stored in a subfolder, e.g. `Finance/Ledger`.

> **Note:** Changing this setting does not move existing files. Move them manually and update the setting to match.

### Default Account

The account pre-selected when opening the Add Transaction form. Choose any active account from the dropdown.

### Base Currency

The currency every combined figure is reported in — net assets, the monthly
metrics, the transaction subtotals, and both category pies. Individual accounts
and transaction rows stay in their own currency.

### Decimal Places

Controls how amounts are stored and displayed.

| Option | Use case |
|--------|----------|
| Automatic (per currency) | Each currency uses its own convention: 0 for JPY and KRW, 2 for USD and EUR, 3 for the Gulf dinars |
| Integer (0 decimals) | Force whole numbers everywhere |
| 2 decimal places | Force two decimals everywhere |

The two fixed options override every currency, which is what a single-currency
vault usually wants. Pick **Automatic** once you hold more than one currency.

> Changing this setting affects new transactions. Existing transactions stored as integers will display without decimals regardless.

---

## Exchange Rates

Appears once any account uses a currency other than your base currency.

Each currency gets its own list of rates, and each rate has an **effective from**
month. A given month is converted using the latest rate effective on or before
it, so past months keep the rate they were priced at rather than being restated
every time you add a new one. A month earlier than your first rate uses that
first rate.

A rate is *how many units of the base currency one unit of that currency is
worth* — with a TWD base, `USD 31.5` means one dollar is 31.5 dollars' worth of
NT dollars.

A currency in use with no rate at all is counted at 1:1 and called out in this
section.

### Download Rates Automatically

Off by default — with it off, PennyWallet makes no network request at all.

Turned on, it fetches rates once a day from
[open.er-api.com](https://open.er-api.com) and updates the **current month's**
rate for each currency you hold. Only your base currency code is sent; no
account, amount or note ever leaves the vault. Turning the toggle on fetches
immediately.

The **Update now** button beside it fetches on demand, whether or not the daily
download is enabled, and reports how many rates changed.

Downloaded rates are marked **Auto**. A rate you typed yourself is never
overwritten, and editing an auto rate by hand converts it to a manual one. See
[Multiple Currencies](/currencies#downloading-rates) for the full behaviour.

> Rates affect reporting only. They never change a stored amount, and a
> cross-currency transfer always keeps the two amounts you actually entered.

---

## Active Accounts

Lists all accounts with status `active`.

Each row shows:
- **Account name** and type
- **Initial balance** and **current calculated balance**
- **Edit** button — change name or initial balance
- **Archive** button (if the account has transactions) or **Delete** button (if no transactions exist)

### Edit an Account

You can change:
- **Name** — updates all display labels (does not rename transaction records in `.md` files)
- **Initial Balance** — retroactively recalculates all balances from inception

> Renaming an account does **not** update the account name stored inside historical transaction files. Old transactions will reference the old name, which may cause balance discrepancies. Avoid renaming accounts that already have transactions.

---

## Archived Accounts

Lists archived accounts. Each row has:

**Include in Net Assets** toggle — whether this account's balance counts toward net asset calculation. Useful for closed accounts you want to keep in history but exclude from your current net asset total.

**Unarchive** button — restores the account to Active Accounts status. It will reappear in the Add Transaction form and be fully usable again.

---

## Add Account

Fields:
- **Name** — unique, cannot be empty
- **Type** — Cash / Bank
- **Currency** — what the account is denominated in; defaults to your base currency
- **Initial Balance** — current balance, in that account's currency. Use a negative number for an account you owe money on, such as a credit card

Click **Add Account** or press **Enter** in any field to confirm.

---

## Categories

Manage your expense, income, and transfer categories.

Three sections are available: **Expense**, **Income**, and **Transfer**. A new vault starts with a ready-made set of categories, but none of them are special — every entry can be removed, and new ones are added the same way. Categories appear in the Add Transaction form in the order listed here.

Click **×** on a tag to remove a category. This does not affect existing transactions that already used it — they will continue to display the category name as a raw string.

> A category name cannot duplicate another category in either list.
