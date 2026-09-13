# Data Format

PennyWallet stores all data as plain text files in your vault. No proprietary database, no binary files.

---

## File Structure

```
<vault>/
├── .obsidian/plugins/penny-wallet/data.json   ← plugin config
└── PennyWallet/             ← monthly transaction files (folder name configurable)
    ├── 2026-04.md
    ├── 2026-03.md
    └── 2026-02.md
```

---

## Monthly Transaction Files

Each file covers one calendar month and contains two parts: a **frontmatter cache** and a **Markdown table**.

### Example: `2026-04.md`

```markdown
---
income.TWD: 72000
expense.TWD: 18450
expense.USD: 96.40
netAsset: 0
---

## 2026-04

| Date  | Type      | Wallet        | From         | To            | Category | Note      | Tags        | Amount | AmountTo | CreatedAt                |
|-------|-----------|---------------|--------------|---------------|----------|-----------|-------------|--------|----------|---------------------------|
| 04/15 | income    | HSBC Savings  | -            | -             | salary   | April pay | salary      | 72000  | -        | 2026-04-15T08:12:00.000Z |
| 04/12 | expense   | Visa Platinum | -            | -             | shopping | Groceries | home,weekly | 1200   | -        | 2026-04-12T14:30:00.000Z |
| 04/11 | expense   | Visa Platinum | -            | -             | shopping | Return    | -           | -320   | -        | 2026-04-11T16:20:00.000Z |
| 04/10 | expense   | Cash          | -            | -             | food     | Lunch     | work        | 280    | -        | 2026-04-10T12:05:00.000Z |
| 04/05 | transfer  | -             | HSBC Savings | Cash          | -        | ATM       | -           | 8000   | -        | 2026-04-05T09:00:00.000Z |
| 04/20 | transfer  | -             | HSBC Savings | Chase USD     | Account Transfer | FX purchase | - | 16200 | 500 | 2026-04-20T09:00:00.000Z |
| 04/28 | transfer  | -             | HSBC Savings | Visa Platinum | Credit Card Payment | Card bill | - | 5000 | - | 2026-04-28T10:00:00.000Z |
```

### Column Reference

| Column | expense / income | transfer |
|--------|-----------------|----------------------|
| Date | `MM/DD` | `MM/DD` |
| Type | `expense` / `income` | `transfer` |
| Wallet | account name | `-` |
| From | `-` | source account |
| To | `-` | destination account |
| Category | category name as shown in Settings, or `-` | transfer category name, or `-` |
| Note | optional text | optional text |
| Tags | comma-separated tags or `-` | comma-separated tags or `-` |
| Amount | positive number; refund expenses use a negative number | positive number, in the **From** account's currency |
| AmountTo | `-` | amount received, in the **To** account's currency; `-` when both accounts share a currency |
| CreatedAt | ISO 8601 UTC timestamp | ISO 8601 UTC timestamp |

Amounts carry no currency of their own — an amount is denominated by the account
it belongs to, and an account's currency is set in Settings.

### Frontmatter Cache

The `income.<CODE>`, `expense.<CODE>`, and `netAsset` fields at the top are a cache used for fast loading in the Finance Overview and Assets views. They are recomputed automatically whenever a transaction is added, edited, or deleted.

Totals are stored one key per currency rather than as a single number, so the
cache stays exact and does not go stale when you change an exchange rate. A
currency with a zero total is simply left out. Files written before
multi-currency support use bare `income:` and `expense:` keys; those are read as
the base currency and rewritten in the new form the next time that month
changes.

> Do not edit the frontmatter manually — it will be overwritten on the next transaction write.

---

## Config File: `data.json`

Stored where Obsidian keeps every plugin's settings —
`.obsidian/plugins/penny-wallet/data.json` — not inside the transactions folder.

```json
{
  "wallets": [
    {
      "name": "Cash",
      "type": "cash",
      "initialBalance": 5000,
      "status": "active",
      "includeInNetAsset": true
    },
    {
      "name": "Visa Platinum",
      "type": "bank",
      "initialBalance": -2000,
      "status": "active",
      "includeInNetAsset": true
    },
    {
      "name": "Chase USD",
      "type": "bank",
      "initialBalance": 1500,
      "status": "active",
      "includeInNetAsset": true,
      "currency": "USD"
    }
  ],
  "defaultWallet": "Cash",
  "folderName": "PennyWallet",
  "decimalPlaces": "auto",
  "baseCurrency": "TWD",
  "rates": [
    { "code": "USD", "effectiveFrom": "2025-10", "rate": 31.5 },
    { "code": "USD", "effectiveFrom": "2026-04", "rate": 32.4 }
  ],
  "options": {
    "categories": {
      "expense": ["Food", "Clothing", "Housing", "Transport", "Education", "Entertainment", "Shopping", "Medical", "Cash Expense", "Insurance", "Fees", "Tax", "Coffee"],
      "income": ["Salary", "Interest", "Side Income", "Bonus", "Lottery", "Rent", "Cashback", "Dividend", "Investment Profit", "Insurance Payout", "Pension"],
      "transfer": ["Account Transfer", "Credit Card Payment", "Investment Trade"]
    }
  },
  "tags": [],
  "autoValidateOnLoad": true
}
```

---

## Format Compatibility

PennyWallet reads eleven columns per row, and also accepts the ten-column rows
written before the `AmountTo` column existed — in a ten-column row the last cell
is read as `CreatedAt`. It does not rewrite files just to upgrade them, but any
month you add to, edit, or delete from is rewritten in the current format, which
adds the column and converts that month's frontmatter to per-currency keys.

Category lists are plain arrays. A vault written by a much older version may need
its `data.json` and month files adjusted by hand; they are plain text, so any
editor will do.

An account with no `currency` is treated as holding the base currency, so a vault
that predates multi-currency support keeps working untouched.

Versions up to 0.0.15 kept the config in `.penny-wallet.json` at the vault root. There is
no automatic migration: copy that file's contents into
`.obsidian/plugins/penny-wallet/data.json` (creating it if needed), restart Obsidian, and
delete the old dotfile. The JSON shape is unchanged.

---

## Git Sync Compatibility

The plain Markdown format works seamlessly with Obsidian Git or any other sync plugin:

- Each month is a separate file → minimal merge conflicts
- Binary files: none

Your config now lives under `.obsidian/`, so it syncs with Obsidian's plugin settings
rather than with the vault's Markdown. Sync setups that exclude `.obsidian/` will carry
your transactions but not your accounts, categories, or tags.

---

## Dataview Compatibility

Since transactions are stored as Markdown tables, you can query them with [Dataview](https://github.com/blacksmithgu/obsidian-dataview).

Dataview reads frontmatter fields directly. You can use it to query the monthly summary values stored at the top of each file:

Totals are keyed by currency, so query the specific currency you want. Replace
`TWD` with whichever code your accounts use.

**Example — list monthly income and expense across all months:**

```dataview
TABLE income.TWD AS income, expense.TWD AS expense, (income.TWD - expense.TWD) AS balance
FROM "PennyWallet"
WHERE income.TWD != null
SORT file.name ASC
```

**Example — find months where expenses exceeded income:**

```dataview
LIST file.name
FROM "PennyWallet"
WHERE expense.TWD > income.TWD
```

> Note: Dataview reads the **frontmatter cache** (per-currency income/expense totals per month), not individual transaction rows. It does not apply exchange rates, so a query cannot combine currencies — total each one separately. For per-transaction queries, the Markdown table format is not natively supported by Dataview — use the raw file or a custom DataviewJS script.

---

## Manual Editing

You can edit the Markdown files directly in Obsidian. Follow the column format exactly:
- Dates must be `MM/DD`
- Use `-` for unused columns (not empty)
- Amount must be a plain number (no currency symbols or commas). It is denominated by the account on that row, not by anything written in the cell
- `AmountTo` is `-` on every row except a transfer between accounts of different currencies, where it holds the amount that arrived
- Refunds are stored as `expense` rows with a negative amount
- `CreatedAt` is auto-assigned when writing through the UI — do not edit it manually, as it is used for stable same-date ordering

After manual edits, PennyWallet will re-read the file on the next view render. The frontmatter cache will be updated automatically on the next transaction write to that month.
