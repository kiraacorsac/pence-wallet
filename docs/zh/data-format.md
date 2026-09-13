# 資料格式

PennyWallet 將所有資料以純文字檔案存放在你的 vault 中。無專有資料庫，無二進位檔案。

---

## 檔案結構

```
<vault>/
├── .penny-wallet.json       ← 外掛設定
└── PennyWallet/             ← 每月交易檔案（資料夾名稱可設定）
    ├── 2026-04.md
    ├── 2026-03.md
    └── 2026-02.md
```

---

## 每月交易檔案

每個檔案涵蓋一個日曆月，包含兩個部分：**frontmatter 快取**和 **Markdown 表格**。

### 範例：`2026-04.md`

```markdown
---
income: 72000
expense: 18450
netAsset: 0
---

## 2026-04

| Date  | Type      | Wallet     | From    | To       | Category | Note     | Tags        | Amount | CreatedAt                |
|-------|-----------|------------|---------|----------|----------|----------|-------------|--------|---------------------------|
| 04/15 | income    | 玉山銀行   | -       | -        | salary   | 四月薪資 | salary      | 72000  | 2026-04-15T08:12:00.000Z |
| 04/12 | expense   | 玉山信用卡 | -       | -        | shopping | 生活雜貨 | home,weekly | 1200   | 2026-04-12T14:30:00.000Z |
| 04/11 | expense   | 玉山信用卡 | -       | -        | shopping | 退貨     | -           | -320   | 2026-04-11T16:20:00.000Z |
| 04/10 | expense   | 現金       | -       | -        | food     | 午餐     | work        | 280    | 2026-04-10T12:05:00.000Z |
| 04/05 | transfer  | -          | 玉山銀行 | 現金     | -        | 提款     | -           | 8000   | 2026-04-05T09:00:00.000Z |
| 04/28 | transfer  | -          | 玉山銀行 | 玉山信用卡 | 信用卡繳費 | 繳卡費 | - | 5000 | 2026-04-28T10:00:00.000Z |
```

### 欄位說明

| 欄位 | 支出 / 收入 | 移轉 |
|------|-----------|-----------|
| Date | `MM/DD` | `MM/DD` |
| Type | `expense` / `income` | `transfer` |
| Wallet | 帳戶名稱 | `-` |
| From | `-` | 來源帳戶 |
| To | `-` | 目標帳戶 |
| Category | 設定中顯示的分類名稱，或 `-` | 移轉分類名稱，或 `-` |
| Note | 選填文字 | 選填文字 |
| Tags | 逗號分隔標籤或 `-` | 逗號分隔標籤或 `-` |
| Amount | 正數；退款支出使用負數 | 正數 |
| CreatedAt | ISO 8601 UTC 時間戳記 | ISO 8601 UTC 時間戳記 |

### Frontmatter 快取

頂部的 `income`、`expense`、`netAsset` 欄位是快取，用於帳本總覽和資產檢視的快速載入。每次新增、編輯或刪除交易時會自動重新計算。

> 請勿手動編輯 frontmatter — 下次寫入交易時會被覆蓋。

---

## 設定檔：`.penny-wallet.json`

存放於 **vault 根目錄**（不在交易資料夾內）。

```json
{
  "wallets": [
    {
      "name": "現金",
      "type": "cash",
      "initialBalance": 5000,
      "status": "active",
      "includeInNetAsset": true
    },
    {
      "name": "玉山信用卡",
      "type": "bank",
      "initialBalance": 2000,
      "status": "active",
      "includeInNetAsset": true
    }
  ],
  "defaultWallet": "現金",
  "folderName": "PennyWallet",
  "decimalPlaces": 0,
  "options": {
    "categories": {
      "expense": ["飲食", "服飾", "住家", "交通", "學習", "休閒娛樂", "購物", "醫療", "現金消費", "保險", "費用／手續費", "稅金", "咖啡"],
      "income": ["薪資", "利息所得", "兼職", "獎金", "發票／彩券中獎", "租金", "優惠回饋", "股利", "投資獲利", "保險理賠", "退休金"],
      "transfer": ["帳戶互轉", "信用卡繳費", "投資買賣"]
    }
  },
  "tags": [],
  "autoValidateOnLoad": true
}
```

---

## Git 同步相容性

純 Markdown 格式與 Obsidian Git 或任何其他同步外掛完美相容：

- 每月各一個獨立檔案 → 合併衝突極少
- 設定檔僅在更新設定或帳戶時才會變動
- 無二進位檔案

---

## Dataview 相容性

由於交易以 Markdown 表格格式儲存，你可以用 [Dataview](https://github.com/blacksmithgu/obsidian-dataview) 查詢。

Dataview 可直接讀取 frontmatter 欄位，用來查詢每個檔案頂部的月度摘要值：

**範例 — 列出所有月份的收入和支出：**

```dataview
TABLE income, expense, (income - expense) AS balance
FROM "PennyWallet"
WHERE income != null
SORT file.name ASC
```

**範例 — 找出支出超過收入的月份：**

```dataview
LIST file.name
FROM "PennyWallet"
WHERE expense > income
```

> 注意：Dataview 讀取的是 **frontmatter 快取**（每月的收支總計），而非個別交易列。若需要逐筆查詢，Markdown 表格格式原生不支援 Dataview — 請使用原始檔案或自訂 DataviewJS 腳本。

---

## 手動編輯

你可以直接在 Obsidian 中編輯 Markdown 檔案。請嚴格遵循欄位格式：
- 日期必須使用 `MM/DD` 格式
- 未使用的欄位用 `-`（不可留空）
- 金額必須是純數字（無貨幣符號或千分位）
- 退款會儲存為 `expense` 且金額為負數
- `CreatedAt` 由 UI 寫入時自動填入 — 請勿手動修改，此欄位用於同日期交易的穩定排序

手動編輯後，PennyWallet 會在下次渲染檢視時重新讀取檔案。Frontmatter 快取將在下次寫入該月份交易時自動更新。
