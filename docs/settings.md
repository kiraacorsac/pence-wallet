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

### Decimal Places

Controls how amounts are stored and displayed.

| Option | Use case |
|--------|----------|
| Integer (0 decimals) | Most currencies, NT dollars |
| 2 decimal places | USD, EUR, or when cents matter |

> Changing this setting affects new transactions. Existing transactions stored as integers will display without decimals regardless.

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
- **Initial Balance** — current balance. Use a negative number for an account you owe money on, such as a credit card

Click **Add Account** or press **Enter** in any field to confirm.

---

## Categories

Manage your expense, income, and transfer categories.

Three sections are available: **Expense**, **Income**, and **Transfer**. A new vault starts with a ready-made set of categories, but none of them are special — every entry can be removed, and new ones are added the same way. Categories appear in the Add Transaction form in the order listed here.

Click **×** on a tag to remove a category. This does not affect existing transactions that already used it — they will continue to display the category name as a raw string.

> A category name cannot duplicate another category in either list.
