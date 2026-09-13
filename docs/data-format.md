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
income: 72000
expense: 18450
netAsset: 0
---

## 2026-04

| Date  | Type      | Wallet        | From         | To            | Category | Note      | Tags        | Amount | CreatedAt                |
|-------|-----------|---------------|--------------|---------------|----------|-----------|-------------|--------|---------------------------|
| 04/15 | income    | HSBC Savings  | -            | -             | salary   | April pay | salary      | 72000  | 2026-04-15T08:12:00.000Z |
| 04/12 | expense   | Visa Platinum | -            | -             | shopping | Groceries | home,weekly | 1200   | 2026-04-12T14:30:00.000Z |
| 04/11 | expense   | Visa Platinum | -            | -             | shopping | Return    | -           | -320   | 2026-04-11T16:20:00.000Z |
| 04/10 | expense   | Cash          | -            | -             | food     | Lunch     | work        | 280    | 2026-04-10T12:05:00.000Z |
| 04/05 | transfer  | -             | HSBC Savings | Cash          | -        | ATM       | -           | 8000   | 2026-04-05T09:00:00.000Z |
| 04/28 | transfer  | -             | HSBC Savings | Visa Platinum | Credit Card Payment | Card bill | - | 5000 | 2026-04-28T10:00:00.000Z |
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
| Amount | positive number; refund expenses use a negative number | positive number |
| CreatedAt | ISO 8601 UTC timestamp | ISO 8601 UTC timestamp |

### Frontmatter Cache

The `income`, `expense`, and `netAsset` fields at the top are a cache used for fast loading in the Finance Overview and Assets views. They are recomputed automatically whenever a transaction is added, edited, or deleted.

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
    }
  ],
  "defaultWallet": "Cash",
  "folderName": "PennyWallet",
  "decimalPlaces": 0,
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

PennyWallet reads the current format only — ten columns per row, and category lists as
plain arrays. It never rewrites your files to upgrade them. A vault written by a much
older version may need its `data.json` and month files adjusted by hand; they
are plain text, so any editor will do.

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

**Example — list monthly income and expense across all months:**

```dataview
TABLE income, expense, (income - expense) AS balance
FROM "PennyWallet"
WHERE income != null
SORT file.name ASC
```

**Example — find months where expenses exceeded income:**

```dataview
LIST file.name
FROM "PennyWallet"
WHERE expense > income
```

> Note: Dataview reads the **frontmatter cache** (income/expense totals per month), not individual transaction rows. For per-transaction queries, the Markdown table format is not natively supported by Dataview — use the raw file or a custom DataviewJS script.

---

## Manual Editing

You can edit the Markdown files directly in Obsidian. Follow the column format exactly:
- Dates must be `MM/DD`
- Use `-` for unused columns (not empty)
- Amount must be a plain number (no currency symbols or commas)
- Refunds are stored as `expense` rows with a negative amount
- `CreatedAt` is auto-assigned when writing through the UI — do not edit it manually, as it is used for stable same-date ordering

After manual edits, PennyWallet will re-read the file on the next view render. The frontmatter cache will be updated automatically on the next transaction write to that month.
