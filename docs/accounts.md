# Accounts

PennyWallet supports three account types: cash, bank, and investment. Cash and bank accounts hold one currency; an investment account also holds shares.

---

## Account Types

### Cash

Represents physical cash you hold.

- Expenses **decrease** the balance
- Income **increases** the balance
- Included in net asset as a positive value

**Example:** Wallet with NT$5,000 cash → balance shows `5,000`

---

### Bank

Represents a bank account, savings account, or e-wallet.

- Expenses **decrease** the balance
- Income **increases** the balance
- Transfers in/out adjust the balance accordingly
- Included in net asset as a positive value

**Example:** Savings account with NT$120,000 → balance shows `120,000`

---

### Investment

Represents a brokerage account: a cash balance in one currency, plus shares in any
number of tickers.

- Deposits and withdrawals are ordinary **transfers**; dividends and fees are ordinary
  income and expense — all in the month files
- Buying, selling and share adjustments are **trades**, kept in the account's own
  ledger file and managed from the **Investments** view
- Included in net asset at its total worth: cash plus shares × price, converted to your
  base currency

**Example:** a US broker in USD with $200 cash, 10 NVDA at $186 and 2 SPY at $735 is worth
`$3,530`, and that is what it contributes to net asset.

See [Investments](/investments) for trades, prices, and the price download.

---

### Accounts You Owe Money On

There is no separate credit card type. A credit card is an ordinary account whose
balance is **negative** — the amount you owe. Give it a negative Initial Balance,
then:

- Expenses on the card push the balance further down
- A transfer into the card brings it back towards zero
- Net asset adds every balance together, so a negative one subtracts automatically

**Example:** a card with NT$4,500 outstanding has a balance of `−4,500`, and that is
what it contributes to net asset.

---

## Managing Accounts

### Add an account

**Settings → PennyWallet → Add Account**

Fill in the name, type, currency, and initial balance, then click **Add Account** (or press Enter).

For an **Investment** account the currency field reads **Cash currency** — what its cash
and trades settle in — and the initial balance is the cash already in it. Its shares are
added as trades afterwards. An account whose name would share a ledger file name with
another investment account is refused.

The **currency** defaults to your base currency. Set it to whatever the account is
actually denominated in — every amount you record against the account is then in
that currency, and its balance is shown with that currency's symbol and precision.

### Edit an account

Click **Edit** next to any active account to change its name, currency, or initial balance.

> Changing the **initial balance** recalculates all historical balances retroactively, since balances are always computed from inception.

> Changing the **currency** of an account that already has transactions only changes how its stored amounts are *read* — it does not convert them. PennyWallet asks you to confirm, and no month file is rewritten. If you meant to convert, change the amounts yourself.

### Archive an account

If an account has existing transactions, it can be **Archived** instead of deleted. Archived accounts:

- No longer appear in the Add Transaction form
- Still appear in **Settings → Archived Accounts** with a toggle for **Include in Net Assets**
- Historical transactions remain intact

### Unarchive an account

To restore an archived account, go to **Settings → PennyWallet → Archived Accounts** and click the **Unarchive** button next to it. The account moves back to Active Accounts and reappears in the Add Transaction form.

### Delete an account

If an account has **no transactions**, it can be deleted permanently. For an investment
account, trades count as history too: one with trades is archived instead.

---

## Net Asset Calculation

Net Asset = sum of every included account balance, each converted to your **base
currency** first (negative balances subtract). An investment account contributes its cash
plus its holdings at the month's prices.

Archived accounts are included if **Include in Net Assets** is toggled on.

When your accounts span more than one currency, a breakdown line under the total
shows what is held in each, so the single figure can be checked against the parts.

Conversion uses the rate in force for the month being viewed, from
**Settings → Exchange Rates**. A currency you have not given a rate is counted at
1:1, which is almost never what you want — Settings flags any currency in use with
no rate set.
