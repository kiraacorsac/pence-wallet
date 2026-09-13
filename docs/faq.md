# FAQ

---

### My account balance looks wrong. What happened?

PennyWallet calculates all balances by replaying every transaction from inception, starting from the **Initial Balance** you set when creating the account.

Common causes:
- **Wrong initial balance** — edit the account in Settings and correct it
- **Missing transactions** — check if some entries were accidentally deleted
- **Renamed account** — if you renamed an account, old transactions still reference the old name and won't be counted. Avoid renaming accounts with existing transactions.

---

### Can I change an account's name?

Yes, but with a caveat: the account name is stored as plain text inside each transaction row in the Markdown files. Renaming via Settings updates the config, but **existing `.md` files are not updated**. Old transactions will reference the old name, causing balance discrepancies.

If you need to rename, also do a find-and-replace in your vault's Markdown files for the old account name.

---

### What happens if I delete a transaction?

The transaction is removed from the monthly `.md` file and the frontmatter cache (income/expense totals) is recalculated immediately. Wallet balances in the Finance Overview update on the next render.

---

### Can I have multiple credit cards?

Yes. Add each card as its own account with a negative initial balance. Each tracks its own debt independently.

---

### How do I record a cash withdrawal from an ATM?

Use a **Transfer**:
- From: your bank account
- To: your cash account
- Amount: the withdrawal amount

---

### How do I record paying a credit card bill?

Use a **Transfer** into the card's account:
- From: the bank / cash account you paid from
- To: the card account you're paying off
- Amount: the payment amount

The category you pick is just a label — the money moves because of the accounts you chose. See [Tracking a Credit Card](./credit-card-workflow) for a full walkthrough.

---

### How do I record a credit card refund?

Use an **Expense** on the same account and enable **This is a refund**. It is stored as a negative expense and adds the money back.

---

### Can I use decimal amounts?

Yes. Go to **Settings → PennyWallet → General → Decimal Places** and switch to **2 decimal places**. New transactions will accept `.00` amounts. Existing integer transactions are unaffected.

If you hold several currencies, choose **Automatic (per currency)** instead — each currency then uses its own convention, so yen stay whole and dollars take cents.

---

### Can I track accounts in more than one currency?

Yes. Each account has a **currency** in Settings, and every amount you record against it is in that currency.

Set a **base currency** and, under **Settings → Exchange Rates**, a rate for each other currency you use. Individual accounts and transaction rows stay in their own currency; anything that combines accounts — net assets, monthly totals, the category pies — is converted to the base currency for you.

Rates carry an **effective from** month, so past months keep the rate they were priced at instead of being restated whenever you add a new one. You enter rates yourself; PennyWallet never fetches them from anywhere.

---

### How do I record moving money between two currencies?

Make a transfer as usual. When the two accounts use different currencies, a second amount field appears: enter what left the source account and what actually arrived in the destination.

Both numbers are stored, so neither balance depends on an exchange rate you might change later, and the rate the two imply is shown as you type. This is also the honest way to capture a bank's spread and fees — the difference is simply part of what arrived.

---

### Where is my data stored? Is it synced?

All data is in your Obsidian vault as plain `.md` and `.json` files — wherever your vault lives (local folder, iCloud, Obsidian Sync, Dropbox, etc.). PennyWallet does not send any data anywhere.

---

### I accidentally changed the folder name in Settings. Now my transactions aren't showing.

Change the folder name back to the original value in **Settings → PennyWallet → Folder Name**. The plugin reads from whichever folder name is currently set — it does not move files automatically.

---

### Can I use PennyWallet on mobile (iOS / Android)?

Yes. All features work on mobile, including the transaction form and all three views. For quick mobile entry without opening Obsidian manually, see [URI Handler & iOS Shortcuts](./uri-handler).

---

### Something broke after I manually edited a `.md` file.

Check that:
1. The date column uses `MM/DD` format (not `YYYY-MM-DD`)
2. Empty columns use `-` not an empty string
3. The table separator row (`|---|---|...`) is present and has the correct number of columns (10)
4. The amount is a plain number without commas, currency symbols, or spaces

---

### How do I restore an archived account?

Go to **Settings → PennyWallet → Archived Accounts** and click the **Unarchive** button next to the account. It will move back to Active Accounts and reappear in the Add Transaction form.

---

### The interface is in the wrong language. How do I change it?

PennyWallet automatically matches Obsidian's language setting — it displays in **Traditional Chinese** if Obsidian is set to Chinese, and **English** otherwise. To change the language, update your Obsidian interface language in **Settings → General → Language**, then restart Obsidian.

---

### How do I report a bug or request a feature?

Open an issue on [GitHub](https://github.com/twrusstw/penny-wallet/issues).
