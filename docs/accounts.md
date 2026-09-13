# Accounts

PennyWallet supports three account types. Each type behaves differently in balance calculations and net asset tracking.

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

Fill in the name, type, and initial balance, then click **Add Account** (or press Enter).

### Edit an account

Click **Edit** next to any active account to change its name or initial balance.

> Changing the **initial balance** recalculates all historical balances retroactively, since balances are always computed from inception.

### Archive an account

If an account has existing transactions, it can be **Archived** instead of deleted. Archived accounts:

- No longer appear in the Add Transaction form
- Still appear in **Settings → Archived Accounts** with a toggle for **Include in Net Assets**
- Historical transactions remain intact

### Unarchive an account

To restore an archived account, go to **Settings → PennyWallet → Archived Accounts** and click the **Unarchive** button next to it. The account moves back to Active Accounts and reappears in the Add Transaction form.

### Delete an account

If an account has **no transactions**, it can be deleted permanently.

---

## Net Asset Calculation

Net Asset = sum of every included account balance (negative balances subtract)

Archived accounts are included if **Include in Net Assets** is toggled on.
