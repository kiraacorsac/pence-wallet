# Views

PennyWallet has three views, and a fourth — **Investments** — once you add an investment account. The **Finance Overview** can be opened from the ribbon icon; the other two views are accessible from the header buttons inside Finance Overview, or via the Command Palette.

---

## Finance Overview

The main dashboard. Open it by clicking the **PennyWallet icon** in the left ribbon, or run **PennyWallet: Open Finance Overview** from the Command Palette.

![Finance overview](/finance-overview.png)

The header also contains two navigation buttons:
- **Transactions** — switch to the Transactions list view
- **Assets** — switch to the assets view
- **+ Add Transaction** — open the transaction form

### Month Navigation

Use `‹` / `›` to move between months. Future months are disabled.

### Summary Metrics

| Metric | Description |
|--------|-------------|
| Income | Total income recorded this month |
| Expense | Total expenses recorded this month |
| Balance | Income minus Expense for this month |

### Account Balances

Shows the **current running balance** of every active account, calculated from all transactions since the initial balance was set — not just the current month.

An account you owe money on shows as a negative value.

**Net Assets** at the bottom is the sum of every included account balance, each converted to your base currency first. When more than one currency is held, a breakdown line underneath shows how much is in each.

### Asset Allocation Pie

Appears when you have two or more active cash/bank accounts with positive balances. Shows how your liquid assets are distributed across accounts. Each legend entry shows the account name, balance amount, and percentage.

### Category Pie Charts

Two pie charts appear if there is data:
- **Expense by Category** — breakdown of this month's spending
- **Income by Category** — breakdown of this month's income

Each legend entry shows the category name, amount, and percentage. Small categories are grouped into **Others**; select that slice to drill into the grouped items. Hover over a slice or legend item to highlight it.

---

## Transactions

A full list of all transactions within the selected date range, with filters and subtotals.

![Transactions view](/transactions-view.png)

### Date Range

The list shows every transaction between the **from** and **to** dates, newest first. The range defaults to the **last 90 days** and can span any number of months; **Clear all** returns to the default. Selecting a category slice in the Finance Overview opens this view with the range set to that month.

### Filters

- **Type pills** — multi-select: All / Expense / Income / Transfer (tap multiple to combine)
- **Wallet pills** — multi-select; pills are tinted per account so the active filter is visible at a glance
- **Category dropdown** — checklist of categories present in the filtered results; select any combination to narrow further
- **Keyword search** — filters transactions whose note contains the search text
- **Filter sheet (mobile)** — a Filter button opens a sheet for picking type, category, account and date range; on mobile, the sheet backdrop covers the Obsidian toolbar so the sheet owns the screen

### Transaction Rows

Each row shows: date, type badge, category, note, account (or From → To for transfers), and amount.

On desktop, hover a row to reveal the **✏** edit action. On mobile, the edit affordance stays visible. Delete now lives inside the edit modal (a confirmation dialog appears before deletion). Refund expenses appear as positive expense reversals, visually distinct from income.

### Subtotals

A fixed bar at the bottom always shows **Expense Subtotal** and **Income Subtotal** for the currently filtered transactions. The list scrolls independently without affecting the header or subtotals.

---

## Assets

An assets-focused view for medium-term financial tracking. Open it from the **Assets** button in the Finance Overview header, or run **PennyWallet: Open assets** from the Command Palette.

![Assets view](/asset-view.png)

### Range Selector

Choose **3 months**, **6 months**, or **12 months**.

### Account Balances

Shows the current running balance for each active account. An account in debt shows as a negative value.

**Net Assets** at the bottom is the sum of every included account balance, each converted to your base currency first. When more than one currency is held, a breakdown line underneath shows how much is in each.

### Cashflow Metrics

| Metric | Description |
|--------|-------------|
| Income | Total income within the selected range |
| Expense | Total expense within the selected range |
| Balance | Income minus Expense within the selected range |
| Savings Rate | `Balance / Income` (shown as 0% when income is 0) |

### Net Asset Trend Chart

A line chart showing your net asset over the selected range. Hover near a data point to see the value. Missing months (no data) create a gap in the line.

### Asset Allocation Pie

Appears when you have two or more active cash/bank accounts with positive balances. Shows the distribution of liquid assets across those accounts.

An investment account is listed at its total worth — cash plus holdings — and selecting
it opens the Investments view. It counts toward the allocation pie at that worth too.

---

## Investments

Appears in the view header once you have an investment account. Open it from the
**Investments** tab, or run **PennyWallet: Open investments** from the Command Palette.
The header's add button reads **+ Add trade** here.

For each active investment account:

| Section | Shows |
|---------|-------|
| Summary | Total value, cash, holdings value, and unrealized gain, in the account's currency |
| Holdings | Per symbol: shares, price and the month it is from, value, average cost, gain and its percentage |
| Trades | Every trade, newest first; select one to edit or delete it |

A holding with no price yet shows `—` for its price and gain, and is valued at cost.
On a narrow screen the cost column is hidden. See [Investments](/investments) for how
trades and prices work.
