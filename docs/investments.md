# Investments

An **investment** account holds shares — NVDA, SPY, QQQ, PFE, as many tickers as
you like — alongside a cash balance. PennyWallet values the shares at a dated
price, converts that to your base currency, and counts the result in net assets
like any other account.

If you never add an investment account, nothing on this page applies and nothing
changes.

---

## How it fits together

An investment account keeps its records in **two places**, each holding what it
is good at:

| What | Where | Recorded as |
|------|-------|-------------|
| Money in and out — deposits, withdrawals | Month files | Ordinary transfers |
| Dividends, interest, account fees | Month files | Ordinary income and expense |
| Shares bought, sold, split or moved | The account's own ledger, `PennyWallet/Investments/<account>.md` | Trades |

So a deposit from your bank is just a transfer into the investment account, shown
in the Transactions view and the Finance Overview exactly as before. What you do
with that cash *inside* the account — buy 5 NVDA, sell 2 SPY — is a trade, and
trades live in the account's ledger, managed from the **Investments** view.

The account's worth is:

```
cash (from the month files and its trades)  +  Σ shares × price
```

---

## Setting it up

1. **Add the account.** Settings → PennyWallet → Add Account, type
   **Investment**. Its **Cash currency** is what the account settles trades in —
   USD for a typical US broker. **Initial balance** is the cash already there.
2. **Fund it.** Record a transfer from your bank, as you would between any two
   accounts. A transfer from a TWD bank into a USD broker takes both amounts,
   sent and received, like any cross-currency transfer.
3. **Record trades.** Open **Investments** (a new tab in the view header, or
   **PennyWallet: Open investments**) and use **+ Add trade**, or run
   **PennyWallet: Add trade**.
4. **Price it.** Enter prices by hand in Settings → Prices, or turn on the daily
   download (below).

---

## Trades

| Action | Shares | Amount | Cash |
|--------|--------|--------|------|
| **Buy** | positive | the total paid, before the fee | falls by amount + fee |
| **Sell** | positive | the total received, before the fee | rises by amount − fee |
| **Adjust** | positive moves shares in, negative moves them out | the cost basis it adds (optional) | unchanged |

**Adjust** covers everything that changes a share count without moving cash:

- **Shares moved in** from another broker — enter the count, and what they
  originally cost as the amount, so gains stay meaningful.
- **Shares moved out** — enter a negative count. They take their share of the
  cost basis with them.
- **A stock split** — enter the *extra* shares (90 for a 10-for-1 split of 10
  shares) and leave the amount blank. Total cost is unchanged; cost per share
  falls.

The form shows the price per share the amount implies, and for a sell or adjust,
how many shares you held on that date. A sell that would take a holding below
zero — on that date or because of a later trade — is refused.

Symbols are stored upper-cased, exactly as you type them, and are what the price
download asks for. Non-US listings use the provider's `SYMBOL:EXCHANGE` form,
e.g. `VUSA:LSE`.

### Crypto

Crypto is entered as a **pair**: `BTC/USD`, `ETH/EUR`. The pair is priced in its
second currency, so `BTC/EUR` needs no conversion in a EUR account and `BTC/USD`
is converted through the exchange rates. The symbol field suggests the most common
coins (BTC, ETH, SOL, XRP, ADA, DOGE) against USD and EUR, and quantities keep up
to eight decimals.

Use the pair, not the coin on its own: `BTC` alone is a stock-exchange ticker
(the Grayscale Bitcoin Mini Trust ETF), and is priced as that.

---

## Valuation

Each holding is worth **shares × the price in force that month**, in the currency
the security trades in, then converted to your base currency with the
[exchange-rate table](/currencies). A GBP vault holding NVDA therefore needs a USD
rate — the Exchange Rates section asks for one as soon as a USD price exists, even
if no account holds dollars.

A security with **no price at all** is valued at **what it cost**. Buying shares
therefore never looks like losing the money while you wait for a first price.

Cost basis is the **average cost**: buying adds to it, selling removes it in
proportion to the shares sold. The Investments view shows, per holding, the price
and the month it is from, the value, the average cost, and the unrealized gain.

Prices are dated by month, like rates. Every month in the net-asset trend is
valued with the shares held at that month's end and the price in force then, so
the chart moves with the market as well as with your trades.

---

## Downloading prices

Prices are entered by hand unless you ask otherwise. **Settings → Prices →
Download prices automatically** fetches them once a day from
[Twelve Data](https://twelvedata.com), and **Update now** fetches on demand.

It follows the same rules as [rate downloads](/currencies#downloading-rates):

| | |
|-|-|
| Touches | the price for the **current month** only |
| Leaves alone | every earlier month, and anything you typed yourself |
| Sends | the ticker symbols you hold, and your API key |

Each day's download overwrites that month's **Auto** price, so it tracks the
market; when the month turns, the value freezes as that month's close and a fresh
row starts. A price you entered by hand always wins, and editing an auto price
claims it as yours. If a downloaded price is in a currency nothing else uses and
rate downloads are on, its exchange rate is fetched straight away.

### The API key

Twelve Data needs a key, which is free: sign up at
[twelvedata.com](https://twelvedata.com/pricing). In Settings → Prices, choose or
create the keychain entry that holds it.

The key lives in **Obsidian's keychain**, never in PennyWallet's settings file —
that file syncs with `.obsidian/`, and some people commit it to git. The settings
only record *which* keychain entry to read. A device that cannot find the key
simply never downloads, and since the day's marker syncs, one device fetching is
enough for all of them.

The keychain needs **Obsidian 1.11.4 or later**. On an older version the download
controls are replaced by a note, and prices can still be entered by hand.

### What the free plan covers

The free plan prices US-listed stocks and ETFs, with 800 requests a day and 8 a
minute. PennyWallet asks for at most 8 symbols a minute, so a long list simply
takes a little longer. A symbol the plan does not cover, or the provider does not
know, is skipped and named in the notice; give it a price by hand instead.

### What leaves your vault

One HTTPS GET to `https://api.twelvedata.com/quote`, at most once a day, carrying
the symbols you hold and your key — the key in a request header, not the URL. No
quantities, no accounts, no amounts. If the request fails it is retried a few
times and then left until later; nothing is written unless a download succeeds.

---

## On disk

Each investment account's ledger is one Markdown file for its whole history:

```markdown
---
account: "IBKR"
currency: USD
holdings.NVDA: 8
holdings.SPY: 3.5
---

## IBKR

| Date | Action | Symbol | Quantity | Amount | Fee | Note | CreatedAt |
|------|--------|--------|----------|--------|-----|------|-----------|
| 2026-10-02 | buy    | NVDA | 10  | 1812.40 | 1 | -             | 2026-10-02T14:31:00.000Z |
| 2026-10-15 | adjust | SPY  | 3.5 | 2100    | - | from Vanguard | 2026-10-15T09:00:00.000Z |
| 2026-11-03 | sell   | NVDA | 2   | 401.10  | 1 | trim          | 2026-11-03T15:02:00.000Z |
```

The `holdings.*` keys are written for [Dataview](/data-format#dataview-compatibility)
and for anyone reading the file; PennyWallet never reads them back, it replays the
rows. See [Data Format](/data-format#investment-ledgers) for the column reference.
