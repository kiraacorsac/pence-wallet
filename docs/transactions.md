# Transactions

PennyWallet has three transaction types. Each is designed for a specific real-world scenario.

---

## Transaction Types

### Expense

Money leaving one of your accounts for a purchase or payment.

| Field | Required | Notes |
|-------|----------|-------|
| Account | Yes | The account the money came from |
| Category | No | e.g. Food, Transport, Shopping |
| Note | No | Free-text description |
| Amount | Yes | Positive number |

**Effect on balance:**
- Cash / Bank account → balance decreases
- An account already in debt goes further negative
- Refund toggle → amount is stored as a negative expense, adding the money back to the account

**Example:** Paid NT$280 for lunch with cash
→ Account: `Cash`, Category: `Food`, Amount: `280`

**Example:** Returned a NT$320 purchase on Visa Platinum
→ Account: `Visa Platinum`, Category: `Shopping`, Amount: `320`, Refund enabled

---

### Income

Money arriving into one of your accounts. Every active account is selectable.

| Field | Required | Notes |
|-------|----------|-------|
| Account | Yes | The account receiving the money |
| Category | No | e.g. Salary, Bonus, Side Income |
| Note | No | Free-text description |
| Amount | Yes | Positive number |

**Effect on balance:**
- Any account type → balance increases

**Example:** Monthly salary deposited into HSBC
→ Account: `HSBC Savings`, Category: `Salary`, Amount: `72000`

---

### Transfer

Moving money between two of your own accounts — including paying off a credit card.

| Field | Required | Notes |
|-------|----------|-------|
| Category | Yes | e.g. Account Transfer, Credit Card Payment — a name only, it changes nothing |
| From Account | Yes | Source account |
| To Account | Yes | Destination account |
| Note | No | Free-text description |
| Amount | Yes | Positive number |

**Transfer categories and their account rules:**

| Category | From Account | To Account |
|----------|-------------|------------|
Any active account can be the source or the target, under any category. The **From**
account decreases by the amount and the **To** account increases by it — nothing else.

**Example:** Pay NT$5,200 credit card bill from savings
→ Category: `Credit Card Payment`, From: `HSBC Savings`, To: `Visa Platinum`, Amount: `5200`

> See [Tracking a Credit Card](./credit-card-workflow) for a full walkthrough.

---

## Adding a Transaction

**From Finance Overview or Transactions view:** click **+ Add Transaction**

**From the Command Palette:** run `PennyWallet: Add Transaction`

**From the ribbon icon:** click the balloon icon → then **+ Add Transaction**

**From iOS Shortcuts:** see [URI Handler & iOS Shortcuts](./uri-handler)

### Mobile entry

On phones (`body.is-phone`), the transaction form switches to a touch-friendly layout:

- **Amount** opens a calculator sheet — numpad, `00`, ⌫, and a formula bar in the sheet title. Press **Done** to commit the computed value back into the field.
- **Wallet**, **Category**, and **Tag** fields open as bottom-sheet pickers with search; tags and categories can be created inline from the picker.

<img src="/transaction-modal-mobile.png" alt="Mobile calculator sheet" width="320" />

---

## Editing and Deleting

Open the **Transactions** view, find the entry, and click the **edit (✏)** icon on the right side of the row. **Delete** lives inside the edit modal — open the entry to edit, then use the delete action (a confirmation dialog appears before deletion).

Editing supports changing the **date** (including moving the transaction to a different month), the type, account, category, note, and amount.

---

## Categories in a New Vault

### Expense
`Food` · `Clothing` · `Home` · `Transport` · `Education` · `Entertainment` · `Shopping` · `Medical` · `Cash Expense` · `Insurance` · `Fees` · `Tax`

### Income
`Salary` · `Interest` · `Side Income` · `Bonus` · `Lottery` · `Rent` · `Cashback` · `Dividend` · `Investment Profit` · `Insurance Claim` · `Pension`

### Transfer
`Account Transfer` · `Credit Card Payment` · `Investment Trade`

These are seeded when the vault is first created and are ordinary entries from then on — rename, reorder or remove any of them. None of them changes how a transaction behaves.

Refunds are no longer a transfer category. Use **Expense** with the refund toggle instead.

If a transaction has no category, it is shown as **Uncategorized**. This is a display-only label — nothing is stored.

Categories are managed in **Settings → PennyWallet → Categories**.
