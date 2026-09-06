# Fulfill

Fulfill 為連結**創作者**與**委託者**的媒合平台：創作者發布作品並開放接案，委託者瀏覽作品、發送結構化委託邀請，並透過聊天室與創作者溝通細節。前端採 mobile-first 的 PWA 架構，資料層由 Supabase 提供，圖片儲存於 Cloudflare R2，靜態站台部署於 Cloudflare Pages。

## Quick Start

```bash
npm install
npx supabase link --project-ref <your-project-ref> && npx supabase db push
npm run dev
```

Full AI search requires a separate [GMI Cloud](https://www.gmicloud.ai/) API key — see [執行方式](#執行方式) below for complete setup. Without one, AI search still runs end-to-end on a local fallback ranking (see the [容錯機制](#特色功能ai-創作者搜尋) note).

## 目錄

- [系統架構](#系統架構)
- [特色功能：AI 創作者搜尋](#特色功能ai-創作者搜尋)
- [其他核心功能](#其他核心功能)
- [執行方式](#執行方式)
- [專案結構](#專案結構)
- [第三方來源與授權](#第三方來源與授權)

## 系統架構

```
┌──────────────────────────┐
│   React 18 + Vite PWA    │  Cloudflare Pages（靜態站台）
│  React Router 7 · Tailwind CSS 4 · Radix UI (shadcn/ui)
└──────────────┬────────────┘
               │ supabase-js
               ▼
┌──────────────────────────┐        ┌───────────────────────────┐
│         Supabase          │        │      Cloudflare R2         │
│  Postgres + RLS           │        │  作品圖片 / 頭像 / 聊天附件   │
│  Auth（email/密碼）        │◀──────▶│  透過 Edge Function 簽發     │
│  Realtime（聊天室訊息）    │  presigned URL │ presigned PUT URL       │
│  Storage（頭像）           │        └───────────────────────────┘
└──────────────┬────────────┘
               │ supabase.functions.invoke
               ▼
┌──────────────────────────────────────────────────────────┐
│              Supabase Edge Functions（Deno）                │
│  generate-upload-url  → 簽發 R2 的 presigned PUT URL         │
│  generate-tags        → 呼叫 MiniMax，自然語言萃取風格關鍵字   │
│  match-creators       → 呼叫 MiniMax，對候選創作者池排序、         │
│                          給予相符度分級與判斷理由                │
└──────────────────────────┬───────────────────────────────┘
                            │ HTTPS
                            ▼
                 ┌────────────────────────┐
                 │   GMI Cloud Serving     │
                 │   MiniMax-M3（文字推理）  │
                 └────────────────────────┘
```

**前端**：React 18、React Router 7、Tailwind CSS 4、Radix UI（shadcn/ui 風格元件）。單一路由入口 `Root.tsx` 負責身分驗證、訪客瀏覽權限與 onboarding 導向；依桌面／平板／手機三種寬度提供對應的導覽介面（左側 Sidebar／頂部搜尋列，或底部 BottomNav），詳見 [`src/app/Root.tsx`](src/app/Root.tsx)。

**資料層**：資料庫存取邏輯直接置於頁面元件或 `src/lib/*.ts` 中，未另建 API 伺服器，統一透過共用的 `supabase` client（[`src/lib/supabase.ts`](src/lib/supabase.ts)）呼叫 Supabase。存取權限由 Postgres Row Level Security（RLS）於資料庫層強制執行，而非僅依賴前端邏輯限制——例如檢舉資料表僅設有 insert 政策、未設 select 政策，任何人（含檢舉者本人）皆無法讀取檢舉紀錄，藉此避免被檢舉者反查身分。

**媒體儲存**：圖片上傳不經由 Supabase Storage，而是由 Edge Function `generate-upload-url` 驗證使用者身分後，以 AWS Signature V4 簽發一組 15 分鐘有效的 Cloudflare R2 presigned PUT URL，前端直接以該 URL 上傳，資料庫僅保存最終的公開網址。

**AI 推理層**：兩支 Deno Edge Function（`generate-tags`、`match-creators`）作為前端與 GMI Cloud MiniMax API 之間的代理層，API 金鑰僅存放於 Edge Function 的環境變數中，不會出現於前端程式碼或瀏覽器網路請求內容中。詳細設計見下一節。

## 特色功能：AI 創作者搜尋

**問題定義**：委託者經常能描述所需的「感覺」，卻難以歸納出精確的搜尋詞——例如想要「夢幻、帶有復古膠片感」的插畫，卻無法判斷應搜尋「插畫」「復古」或「底片感」等分類。既有的關鍵字／分類篩選（見 `/search`）難以處理此類需求。

**設計方式**：`/search/ai` 頁面讓委託者以自然語言描述需求，由 AI 轉譯為結構化關鍵字，再依創作者的**實際作品內容**（而非自我介紹）計算相符程度並排序。

1. **關鍵字萃取**（`generate-tags`）
   將使用者輸入的自然語言送交 MiniMax-M3，取得一組風格關鍵字（例如「想要一種很夢幻、帶點復古膠片感的插畫」會回傳 `dreamy`、`vintage film aesthetic`、`retro film grain`、`soft focus`、`pastel tones`）。使用者亦可手動增減這些關鍵字後重新搜尋。

2. **候選池組成**：候選創作者為「至少發布一件公開作品」與「已公開接案資料」兩者的聯集，刻意不侷限於「開放接案」此一狹義門檻，因 AI 配對的判斷依據為作品本身，而非創作者目前的接案狀態。

3. **排序與判斷理由**（`match-creators`）
   將委託者的需求描述、萃取出的關鍵字，連同**每位候選創作者近期公開作品的標題與標籤**（即創作者上傳作品時自行標記的標籤）一併送交 MiniMax，要求其針對每位候選人給出：
   - 五級相符度：極度相符／高度相符／中度相符／略為相符／低度相符
   - 一句繁體中文判斷理由，並要求「以作品內容為主要判斷依據，簡介僅作輔助參考」——即使創作者的自我介紹未提及特定風格，只要作品標籤或標題與需求相符，仍可判定為高度相符；資訊不足時亦要求模型如實反映，不得臆測或杜撰。

4. **一次性排序，分頁不重複呼叫 API**：排序於使用者送出搜尋當下，對整個候選池執行一次性排序；點選「更多創作者推薦」僅將前端已排序完成的清單向下展示更多筆數，並額外查詢該批創作者的作品縮圖（屬低成本的資料庫查詢），不會重新呼叫 AI。此設計確保同一次查詢的相符度結果前後一致，並將每次搜尋的 AI 呼叫次數固定為兩次（關鍵字萃取與排序各一次），不隨使用者分頁次數線性增加。

5. **容錯機制**：`generate-tags` 與 `match-creators` 皆設有本地端 fallback：若 Edge Function 或 MiniMax API 呼叫失敗（逾時、額度用罄等情況），前端將自動退回本地規則（簡易斷詞，或依候選池原始順序給予預設分級），確保搜尋功能仍可運作，僅配對精確度降低。

6. **純文字推理，未採用影像模型**：所有判斷依據皆為文字資訊（標題、標籤、簡介、服務項目），並未將圖片送交模型進行視覺分析。此為刻意的技術取捨，藉以降低成本與延遲，代價是配對品質取決於創作者是否完整標記作品標籤。基於此，作品上傳頁（`/create`）內建標籤輸入元件（[`src/app/components/TagInput.tsx`](src/app/components/TagInput.tsx)）供使用者手動輸入，標籤標記越完整，AI 搜尋的準確度越高。

相關實作見 [`src/lib/aiSearch.ts`](src/lib/aiSearch.ts)、[`src/app/pages/AISearchPage.tsx`](src/app/pages/AISearchPage.tsx)、[`supabase/functions/generate-tags/`](supabase/functions/generate-tags/index.ts)、[`supabase/functions/match-creators/`](supabase/functions/match-creators/index.ts)。

## 其他核心功能

- **訪客瀏覽**：未登入使用者亦可瀏覽首頁、作品詳情、創作者主頁與開放委託；僅有需登入的操作（按讚、收藏、發送邀請）會觸發登入提示，不影響整體瀏覽（[`src/app/components/LoginGate.tsx`](src/app/components/LoginGate.tsx)）。
- **結構化委託邀請**：委託者填寫服務項目、預算、時程與需求描述後送出邀請；創作者接受後，由資料庫函式 `accept_commission()` 以原子操作開啟（或重用既有）聊天室並發送首則訊息，避免出現「已接受但無對話」的中間狀態。
- **即時聊天**：支援文字、圖片與貼圖訊息，透過 Supabase Realtime 訂閱 `postgres_changes` 即時接收新訊息。
- **響應式版面**：手機維持單欄版面與底部導覽列；平板與桌面改為左側固定側邊欄（依寬度切換 icon-only 或完整標籤顯示）搭配頂部搜尋列，作品牆欄數由手機的 2 欄漸進至桌面的 6 欄。

## 執行方式

### 環境需求

- Node.js 18 以上版本與 npm
- 一個 Supabase 專案（免費方案即可）
- 如需使用 AI 搜尋功能：一組 [GMI Cloud](https://www.gmicloud.ai/) API Key（呼叫 `MiniMaxAI/MiniMax-M3`）
- 如需使用圖片上傳功能：一個 Cloudflare R2 bucket

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

於專案根目錄建立 `.env`（`npm run dev` 固定以 `fulfill` mode 啟動，但目前僅有 `.env` 一份環境設定檔，Vite 在任何 mode 下都會載入它，`--mode` 名稱本身暫無區分環境的實際作用）：

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. 建立資料庫 schema

使用 Supabase CLI 將 `supabase/migrations/` 底下所有 migration 依序套用至目標專案（包含 RLS 政策、資料表結構與種子資料）：

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 4. 部署 Edge Functions（AI 搜尋與圖片上傳功能所需，可選）

```bash
npx supabase functions deploy generate-upload-url --project-ref <your-project-ref>
npx supabase functions deploy generate-tags        --project-ref <your-project-ref>
npx supabase functions deploy match-creators       --project-ref <your-project-ref>
```

於 Supabase Dashboard → Edge Functions → Secrets 設定下列環境變數：

```
GMI_API_KEY              # generate-tags、match-creators 所需
R2_ACCESS_KEY_ID         # generate-upload-url 所需
R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_PUBLIC_URL
```

若未設定 `GMI_API_KEY`，AI 搜尋功能仍可執行：系統將自動退回本地端 fallback 邏輯（詳見上節「容錯機制」），僅無法取得真實的 AI 判斷結果。

### 5. 啟動開發伺服器

```bash
npm run dev
```

### 6. 建置與部署（Cloudflare Pages）

```bash
npm run build        # 輸出至 dist/
npx wrangler deploy  # 依 wrangler.jsonc 設定部署至 Cloudflare Pages
```

> 本專案未安裝 TypeScript 編譯器：Vite 僅使用 esbuild 進行轉譯，型別錯誤不會於建置階段被攔截。`.ts`／`.tsx` 中的型別標註主要作為文件用途，並非強制檢查機制。

## 專案結構

```
src/
├── app/
│   ├── Root.tsx              # 唯一的路由外層：身分驗證、響應式版面
│   ├── routes.ts             # 路由表
│   ├── components/           # Sidebar、TopSearchBar、BottomNav、TagInput、LoginGate 等
│   └── pages/                # 各路由對應之頁面，資料庫查詢邏輯直接置於頁面內
├── contexts/
│   └── AuthContext.tsx       # 目前登入使用者狀態的唯一來源
└── lib/
    ├── supabase.ts           # 共用的 Supabase client
    ├── aiSearch.ts           # AI 搜尋之資料存取與流程編排邏輯
    ├── tags.ts                # 標籤搜尋與建立
    ├── creators.ts / commissions.ts / chat.ts / artworks.ts

supabase/
├── migrations/                # 16 個 SQL migration：schema、RLS、索引、種子資料
└── functions/
    ├── generate-upload-url/   # 簽發 R2 presigned URL
    ├── generate-tags/         # MiniMax：自然語言萃取風格關鍵字
    └── match-creators/        # MiniMax：候選創作者排序、相符度與判斷理由
```

## 第三方來源與授權

**原始介面設計**：本專案初始 UI 版型匯出自 Figma 設計稿（[Fulfill mobile app home screen](https://www.figma.com/design/mQTzuyxPCF8tCbF4kJnhvA/Fulfill-mobile-app-home-screen)），後續經團隊大幅重構（響應式改版、後端整合、AI 功能開發），與原始匯出版本已有顯著差異。

**AI 服務**：

| 服務 | 用途 | 備註 |
|---|---|---|
| [GMI Cloud](https://www.gmicloud.ai/) — MiniMax-M3 | 關鍵字萃取、創作者排序與配對理由生成 | 純文字推理 API，透過 `GMI_API_KEY` 呼叫，金鑰僅存放於 Edge Function 環境變數 |

**平台服務**：

| 服務 | 用途 |
|---|---|
| [Supabase](https://supabase.com/) | Postgres 資料庫、Auth、Realtime、Edge Functions（Deno runtime） |
| [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/) | 作品圖片、頭像、聊天附件之物件儲存 |
| [Cloudflare Pages](https://pages.cloudflare.com/) | 靜態站台部署與 CDN |

**主要開源套件**（完整清單見 `package.json`；除另有標示外，均為 MIT 授權）：

| 套件 | 用途 | 授權 |
|---|---|---|
| [React](https://react.dev/) 18 | UI framework | MIT |
| [Vite](https://vitejs.dev/) | 開發伺服器與建置工具 | MIT |
| [React Router](https://reactrouter.com/) 7 | 路由 | MIT |
| [Tailwind CSS](https://tailwindcss.com/) 4 | CSS 樣式框架 | MIT |
| [Radix UI](https://www.radix-ui.com/) | 無樣式可組合互動元件（shadcn/ui 底層） | MIT |
| [lucide-react](https://lucide.dev/) | Icon 套件 | ISC |
| [@supabase/supabase-js](https://github.com/supabase/supabase-js) | Supabase client SDK | MIT |
| [Deno 標準函式庫](https://deno.land/std)（`http/server.ts`） | Edge Function 之 HTTP server | MIT |
| [aws4fetch](https://github.com/mhart/aws4fetch) | R2 presigned URL 簽章（AWS Signature V4） | MIT |

本專案（`Fulfill-Frontend` 程式碼本身）採用 [MIT License](LICENSE)；上述第三方套件與服務均依循其原始授權條款與服務條款。

## 開發歷程

`docs/` 目錄保留數份早期分階段開發之交接文件（響應式版面改版、配色系統轉換、後端 schema 整合），相關內容已全數套用於目前的 codebase，僅供追溯設計決策脈絡之用。
