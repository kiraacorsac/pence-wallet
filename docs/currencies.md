# Multiple Currencies

PennyWallet can track accounts denominated in different currencies. Each account
holds one currency; anything that combines accounts is reported in a single
**base currency** of your choosing.

If every account you have uses the same currency, none of this needs setting up —
the defaults keep the plugin behaving exactly as it did before.

---

## How it fits together

| Piece | Where it lives | What it does |
|-------|----------------|--------------|
| Base currency | Settings → General | The currency all combined figures are reported in |
| Account currency | Settings → Add / Edit Account | What that account is denominated in |
| Exchange rates | Settings → Exchange Rates | Converts other currencies into the base, per month |

An amount is never labelled with a currency of its own. It is denominated by the
account it belongs to. That is why changing an account's currency reinterprets
its history rather than converting it.

---

## Setting it up

1. **Pick a base currency.** Settings → PennyWallet → General → Base Currency.
   Choose the currency you think in — usually the one you are paid in.
2. **Give each account its currency.** Use the Currency field when adding an
   account, or **Edit** on an existing one. Accounts created before this feature
   existed are treated as holding the base currency.
3. **Add a rate for every other currency.** A new **Exchange Rates** section
   appears as soon as an account uses something other than the base. A currency
   in use with no rate is counted at 1:1 and flagged there.

Set **Decimal Places** to **Automatic (per currency)** at the same time, so each
currency uses its own convention rather than one global setting.

---

## Dated rates

Every rate has an **effective from** month, and each month is converted using the
latest rate effective on or before it. Adding a rate for this month therefore
does not restate last year's figures.

```
Settings → Exchange Rates → USD
  effective from 2025-10    31.5
  effective from 2026-04    32.4
```

With a TWD base, the above reads *one US dollar is worth 31.5 NT dollars from
October 2025, and 32.4 from April 2026*. A month earlier than your first rate
uses that first rate.

Rates are entered by hand — PennyWallet never contacts a network service. They
affect reporting only: no stored amount is ever rewritten by a rate change.

---

## Transfers between currencies

Pick two accounts with different currencies in the transaction form and a second
amount field appears.

| Field | Currency |
|-------|----------|
| Sent | the **From** account's |
| Received | the **To** account's |

Enter both. The source account falls by what was sent, the destination rises by
what arrived, and the rate the two imply is shown as you type.

Recording both sides is what keeps the balances honest. It also captures the
bank's spread and any fee for free — the difference between the two amounts
simply *is* what the transfer cost you, with no separate fee row to remember.

A transfer between two accounts of the same currency is unchanged: one amount,
one number moving.

---

## What gets converted

| Shown in its own currency | Shown in the base currency |
|---------------------------|----------------------------|
| Account balances | Net assets (with a per-currency breakdown underneath) |
| Individual transaction rows | Monthly income, expense and balance metrics |
| Both legs of a cross-currency transfer | Transaction list subtotals |
| | Category and asset-allocation pies |

Conversion always uses the rate for the month being viewed, so stepping back
through the months prices each one as it stood.

---

## Changing an account's currency

Changing the currency of an account that already has transactions does **not**
convert its stored amounts — it changes how they are read. An account holding
`1200` reads as £1,200 or ¥1,200 depending on the setting, and PennyWallet asks
you to confirm before switching.

If you genuinely need to convert history, edit the amounts yourself, or archive
the account and create a new one in the right currency.

---

## On disk

Per-currency totals are cached in each month file's frontmatter, and a
cross-currency transfer stores both amounts in an `AmountTo` column:

```
---
income.TWD: 72000
expense.USD: 96.40
netAsset: 0
---

| ... | Amount | AmountTo | CreatedAt                |
| ... | 16200  | 500      | 2026-04-20T09:00:00.000Z |
```

Totals are split by currency rather than summed, so the cache stays exact and
never goes stale when you edit a rate. See [Data Format](/data-format) for the
full schema, including how files written before multi-currency support are read.
