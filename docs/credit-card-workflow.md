# Tracking a Credit Card

PennyWallet has no credit card account type. A credit card is an ordinary account whose balance is **negative** — the amount you currently owe. Every account works this way, so there is nothing special to learn.

---

## The One Rule

| Transaction | Effect |
|-------------|--------|
| **Expense** on an account | Balance decreases |
| **Income** into an account | Balance increases |
| **Transfer** | From account decreases, To account increases |

That is the whole model. It applies to every account and every category. A card's debt grows when you spend on it and shrinks when you transfer money into it, because those are the same two rules as everywhere else.

The balance shown in Finance Overview is whatever the number actually is, negative included, and net asset simply adds every included account together — so a negative balance subtracts.

::: tip The category is only a label
`Credit Card Payment` is a category name seeded into new vaults for convenience. It carries no behaviour: renaming it, deleting it, or using a different category changes nothing about how the money moves.
:::

---

## Step-by-Step Example

### Setup

You have two accounts:

- `HSBC Savings` (Bank) — NT$50,000
- `Visa Platinum` (Bank) — you currently owe NT$2,000

In Settings, set Visa Platinum's **Initial Balance** to `-2000`.

---

### 1. Spend on the card

You buy groceries for NT$1,200 with the card.

> **Type:** Expense
> **Account:** Visa Platinum
> **Category:** Shopping
> **Amount:** 1200

After this transaction:

- Visa Platinum: **−3,200** (−2,000 − 1,200)
- Net asset decreases by 1,200

---

### 2. More spending throughout the month

You spend NT$850 on transport and NT$3,400 dining out, both on the card.

After all spending:

- Visa Platinum: **−7,450**

---

### 3. Pay the bill

You pay NT$7,450 from your HSBC Savings account to clear it.

> **Type:** Transfer
> **Category:** Credit Card Payment
> **From Account:** HSBC Savings
> **To Account:** Visa Platinum
> **Amount:** 7450

After this transaction:

- HSBC Savings: decreases by 7,450
- Visa Platinum: **0**
- Net asset is unchanged — money moved between two of your own accounts

---

## Partial Payments

Pay off only part of the balance and the remainder simply stays negative. If the balance is −7,450 and you transfer 5,000:

> **Type:** Transfer
> **From Account:** HSBC Savings
> **To Account:** Visa Platinum
> **Amount:** 5000

Visa Platinum is left at **−2,450**, which carries into the next month automatically.

---

## Refunds and Returns

For a returned purchase, create an **Expense** on the same account and enable **This is a refund**. PennyWallet stores it as a negative expense, displays it as a positive expense reversal, and adds the money back to the account.

> **Type:** Expense
> **Account:** Visa Platinum
> **Category:** Shopping
> **Amount:** 1200
> **Refund:** Enabled

---

## Other Things You Can Now Do

Because nothing is special-cased, combinations that used to be blocked all work:

- Pay one card from another card
- Transfer money *out of* a card (a cash advance) — the card goes further negative, the receiving account goes up
- Record income directly into a card account
- Let any cash or bank account go negative, for an overdraft or a loan

---

## Net Asset

Net Asset = the sum of every account included in net asset.

If you have NT$100,000 in savings and a card sitting at −5,000:
→ Net Asset = 100,000 + (−5,000) = **95,000**

Archived accounts can be included or excluded via the toggle in Settings.
