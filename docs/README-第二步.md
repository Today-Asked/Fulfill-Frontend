# 第二步 — 黑白設計

接在第一步（版面解鎖）之後。**先確認第一步跑起來沒問題再做這步。**

```bash
git checkout -b monochrome     # 從第一步的 branch 再開一個
# 解壓縮覆蓋檔案
node scripts/monochrome.mjs --dry
```

## 分兩段進行

### 第一段：轉換腳本

粉紫色不是集中在幾個檔案，而是**散在 19 個檔案裡的寫死色碼**（`bg-[#f9a8d4]`、`fuchsia-500`、`shadow-pink-400/25`）。手動改容易漏，也容易改錯，所以改用腳本。

```bash
node scripts/monochrome.mjs --dry   # 先預覽，不會動到檔案
node scripts/monochrome.mjs         # 確認後才實際套用
git diff                            # 逐行檢查改了什麼
git checkout -- src                 # 不滿意就全部還原
```

**在我這邊的實測結果：19 個檔案、99 行，跑完沒有殘留任何壞掉的 class。**

轉換規則：

| 原本 | 之後 |
|---|---|
| `#f9a8d4`（主要粉） | `#FFFFFF` |
| `#f472b6`、`#ec4899`（hover 粉） | `#C4C4C4` |
| `fuchsia-*`、`pink-*`、`violet-*`、`cyan-*`、`rose-*`、`purple-*` | `white` |
| `#050508`（外層底色） | `#000000` |
| `#0a0a0f`（面板底色） | `#141414` |

腳本只比對顏色字串，**不會碰到版面、邏輯或任何 Supabase 程式碼**。

### 第二段：色票與字型

| 檔案 | 動作 |
|---|---|
| `src/styles/brand.css` | **新增** — 黑白色票，並把 shadcn 的 token 對齊深色底 |
| `src/styles/index.css` | 加一行 import |
| `src/styles/fonts.css` | 加入 Inter / Poppins / Noto Sans TC / Fascinate |
| `src/app/Root.tsx` | 移除霓虹光暈，底色改純黑 |
| `src/app/components/TopNav.tsx` | 重點色改白 |
| `src/app/components/BottomNav.tsx` | 重點色改白 |

**Playfair Display 保留**，因為作品詳情頁的標題還在用它，那是有意的排版選擇，跟霓虹風格無關。

## 一個要注意的地方

`brand.css` 把 shadcn 的 `--background`、`--foreground` 等 token 從**淺色改成深色**。原本 `theme.css` 的 `:root` 是白底黑字，但你們的 App 實際上一直是深色——代表那些 token 幾乎沒被用到，或用到的地方本來就是壞的。

改完之後請特別看一下有用到 shadcn 元件的畫面（Dialog、Select、Popover、Calendar）。如果哪個地方變成白底，跟我說，那是原本就沒對齊、現在才浮出來的問題。

## 檢查清單

- [ ] 首頁瀑布流：底色純黑，沒有粉紫光暈
- [ ] 「新增作品」按鈕：白底黑字
- [ ] 底部導覽列的中央加號：白底黑字
- [ ] 未讀訊息小點：白色
- [ ] 登入頁、註冊頁：純黑底
- [ ] 作品詳情頁標題：仍是 Playfair 襯線字
- [ ] 隨便開一個下拉選單或對話框，確認不是白底

## 下一步

版面和配色都到位之後，才輪到功能：結構化合作邀請、搜尋篩選、個人頁發布門檻、檢舉、媒合結果追蹤。

那批需要動到資料庫（`commission_requests` 的欄位對不上），會需要一次 migration，所以放在最後。
