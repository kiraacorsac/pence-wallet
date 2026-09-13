# 快速開始

## 安裝方式

### 從社群外掛安裝

PennyWallet 尚未上架至 Obsidian 社群外掛。請改用以下 BRAT 或手動安裝。

### BRAT（beta）

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 可以直接從 GitHub 安裝 beta 版外掛並自動更新。

1. 在 **設定 → 社群外掛 → 瀏覽** 搜尋並安裝 **BRAT** 並啟用
2. 從指令面板執行 **BRAT: Add a beta plugin for testing**
3. 輸入 repository：`twrusstw/penny-wallet`
4. 在 **設定 → 社群外掛** 啟用 **PennyWallet**

### 手動安裝

1. 從 [最新版本](https://github.com/twrusstw/penny-wallet/releases/latest) 下載 `main.js`、`manifest.json` 和 `styles.css`
2. 在 vault 中建立資料夾 `<your-vault>/.obsidian/plugins/penny-wallet/`
3. 將三個檔案複製到該資料夾
4. 開啟 Obsidian → **設定 → 社群外掛** → 啟用 **PennyWallet**

---

## 初始設定

### 步驟一 — 新增帳戶

前往 **設定 → PennyWallet → 使用中帳戶**，點擊 **新增帳戶**。

為每個帳戶填入：

- **名稱** — 任意標籤（例如 `現金`、`玉山銀行`、`信用卡`）
- **類型** — `現金` 或 `銀行`
- **初始餘額** — 目前的餘額。有欠款請填負數，例如信用卡欠 3,000 就填 `-3000`

> **提示：** 建議在記錄任何交易前先新增所有帳戶，這樣餘額計算從一開始就正確。

![設定中的新增帳戶](/settings-add-account.png)

### 步驟二 — 設定預設帳戶

在 **設定 → PennyWallet → 一般**，選擇開啟新增交易表單時預設選取的帳戶。

### 步驟三 — 記錄第一筆交易

點擊左側面板的 **PennyWallet 圖示** 開啟帳本總覽，然後按下 **+ 新增交易**。也可以從指令面板（`Cmd+P`）執行 `PennyWallet: Add transaction`。

填寫欄位：
- **類型** — 支出、收入或移轉
- **日期** — 預設為今天
- **帳戶** — 選擇記錄的帳戶
- **分類** — 從清單中選擇或留空
- **備註** — 選填說明
- **標籤** — 選填標籤；mobile 上點擊標籤列會開啟 picker
- **金額** — mobile 上點擊欄位會開啟計算機 sheet，內含 numpad、`00`、⌫，title bar 顯示算式；按 **完成** 寫回金額

按下 **確認** 儲存。

<img src="/transaction-modal.png" alt="新增交易表單" width="560" />

> 在手機上使用 PennyWallet？請見 [Mobile 操作](./transactions#mobile-操作) 了解 bottom sheet picker 與計算機 sheet。

---

## 指令面板

所有指令可透過 `Cmd+P`（Windows / Linux 為 `Ctrl+P`）開啟：

| 指令 | 動作 |
|------|------|
| `PennyWallet: Open finance overview` | 開啟帳本總覽 |
| `PennyWallet: Open transactions` | 開啟收支明細 |
| `PennyWallet: Open assets` | 開啟資產檢視 |
| `PennyWallet: Add transaction` | 直接開啟交易表單 |
| `PennyWallet: Refresh views` | 重新整理所有已開啟的 PennyWallet 檢視 |
| `PennyWallet: Validate data` | 掃描所有帳本檔，檢查 frontmatter / 失聯錢包 |
| `PennyWallet: Open settings` | 直接開啟 Obsidian 設定的 PennyWallet 分頁 |

---

## 資料存放位置

PennyWallet 會建立：

```
<vault>/
├── .penny-wallet.json     ← 設定檔（帳戶、分類、設定）
└── PennyWallet/           ← 每月一個 .md 檔案
    ├── 2026-04.md
    └── 2026-03.md
```

資料夾名稱（預設為 `PennyWallet`）可在設定中更改。詳見 [資料格式](./data-format)。
