# 第三步 — 後端整合

改資料庫 + 資料存取層。接在第一、二步之後。

```bash
git checkout -b commission-v2
# 解壓縮覆蓋檔案
```

## 一、跑 migration

```bash
npx supabase db push
```

沒裝 CLI 的話，到 Supabase Dashboard → SQL Editor → 貼上
`supabase/migrations/20260808000000_commission_v2.sql` 的內容 → Run。

**這支 migration 可以重複執行。** 每個語句都有存在性檢查，跑第二次不會報錯。

**沒有任何 drop 或 rename。** `commission_requests` 原本的 `budget`、`deadline` 欄位保留，寫入時我也一併填值，所以現有的資料和舊畫面都不會壞。

### 改了什麼

| 對象 | 動作 |
|---|---|
| `artist_profiles` | 加 11 個欄位：接案狀態、可承接項目、預算方式與級距、可開始時間、交件天數、合作方式、學校、封面圖、是否發布 |
| `users` | 加 `school_email`、`school_verified_at` |
| `artworks` | 加專案資訊 7 欄：合作對象、使用情境、年份、工具、負責部分、團隊與否、製作天數 |
| `commission_requests` | 加 11 個欄位：社團名稱、服務項目、預算上下限、初稿與交件日期、聯絡方式、素材狀態、婉拒原因、備註、已讀時間。`chat_id` 改為可空 |
| `creator_saves` | **新表** — 收藏創作者（原本的 `saves` 只能收藏作品） |
| `match_outcomes` | **新表** — 媒合結果追蹤 |
| `reports` | **新表** — 檢舉 |
| `blocks` | **新表** — 封鎖 |

也加了三個索引和兩個 CHECK 約束（預算下限不得大於上限、初稿日不得晚於交件日），資料層面就擋掉不合理的值。

### 兩個 RLS 的重點

**檢舉是唯寫的。** `reports` 只有 insert policy，沒有 select policy——**任何人都讀不到檢舉紀錄，包括檢舉者本人**。這樣被檢舉的人不可能反查是誰檢舉他。審查請在 Supabase Dashboard 進行。

**`artist_profiles` 的公開讀取被收緊了。** 原本的 policy 是所有人都能讀所有 profile：

```sql
create policy "artist_profiles: public read" ... using (true);
```

改成只有 `is_published = true` 的才公開，自己的永遠讀得到。這是「未完成的頁面不該公開」的資料庫層保證，不只是前端隱藏。

> **注意**：新欄位 `is_published` 預設是 `false`，所以 **migration 跑完之後，現有的創作者頁面會全部從搜尋消失**，直到他們自己按發布。如果你希望現有帳號維持公開，跑完後補一句：
> ```sql
> update public.artist_profiles set is_published = true;
> ```

## 二、資料存取層

| 檔案 | 內容 |
|---|---|
| `src/lib/commissions.ts` | 建立／查詢／接受／婉拒邀請、媒合結果 |
| `src/lib/creators.ts` | 創作者搜尋與篩選、合作資訊編輯、發布門檻計算、收藏創作者、檢舉、封鎖、成大信箱 |

寫法完全照 `chat.ts` 的風格：純 async 函式，回傳頁面要的形狀，Supabase 的細節不外流到元件。

幾個實作上的決定：

- **接受邀請會自動開對話**，並發一則 `type: "commission"` 的訊息，所以對話不會是空的。用的是你們現有的 `getOrCreateConversation`，`usera_id < userb_id` 的規則由它保證。
- **創作者名稱的關鍵字比對放在前端**。名字存在 join 進來的 `users` 上，PostgREST 沒辦法在巢狀 select 裡篩選。資料量到幾百人以上時要改成資料庫的 view 或 RPC。
- **成大驗證目前只存信箱，不發驗證碼**，所以 `school_verified_at` 還是 null，徽章不會亮。要真的寄信需要一支 Edge Function，跟你們現有的 `generate-upload-url` 同一個位置。

## 檢查清單

跑完 migration 後在 Supabase Dashboard 確認：

- [ ] Table Editor 看得到 `creator_saves`、`match_outcomes`、`reports`、`blocks`
- [ ] `artist_profiles` 多了 `availability`、`services`、`is_published`
- [ ] `commission_requests` 多了 `org_name`、`budget_min`、`budget_max`
- [ ] 決定要不要把現有 profile 設成 `is_published = true`
- [ ] 前端 `npm run dev` 仍然正常（這步沒動任何頁面）

## 下一步

資料庫和存取層都好了，剩下把畫面接上去：邀請表單、邀請管理、收藏創作者、個人頁編輯與發布、搜尋篩選、檢舉對話框。

那些是純前端，接到上面這兩個檔案就好，不會再動資料庫。
