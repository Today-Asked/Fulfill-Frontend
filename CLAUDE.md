# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Switching Supabase Projects

We push schema changes with the Supabase CLI now, not by hand-pasting SQL into the Dashboard SQL Editor. Hand-pasting builds the tables fine but never writes to the project's `supabase_migrations.schema_migrations` tracking table, so a later `db push` can't tell those migrations already ran and tries to replay all of them from `create table` — that's exactly what happened switching this repo over. Keep everything going through the CLI from here on so the tracking table and `supabase/migrations/` never drift apart again.

When pointing to a new Supabase project, do these steps in order:

**1. Link the CLI to the new project** (this also writes `supabase/.temp/project-ref`, so there's no separate manual step for that anymore):
```bash
npx supabase link --project-ref <new-project-ref>
```

**2. Push all migrations**:
```bash
npx supabase db push
```
This runs everything in `supabase/migrations/` in order, on a brand-new project. If you're ever re-pointing the CLI at a project whose schema was *already* built by hand (or by an older push), run `npx supabase migration list` first to see what the CLI thinks is applied, and `npx supabase migration repair --status applied <version>` for anything that's actually already there — don't add `if not exists` to old migration files to route around it.

**3. Update env file** (`.env.mytest` for local dev):
```
VITE_SUPABASE_URL=https://<new-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<new-anon-key>
```

**4. Deploy edge function**:
```bash
supabase functions deploy generate-upload-url --project-ref <new-project-ref>
```
Then in the new project dashboard → Edge Functions → `generate-upload-url` → Secrets, set:
```
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_PUBLIC_URL
```

### Adding a new migration

```bash
npx supabase migration new <name>   # creates a timestamped file in supabase/migrations/
# edit the file — guard every statement (if not exists / do $$ ... exception when duplicate_object) so it's safe to re-run
npx supabase db push                # applies it and records it as applied
```

---

## Commands

```bash
npm run dev        # dev server (uses .env.mytest via --mode mytest)
npm run build      # production build
```

There is **no TypeScript compiler installed**. Vite uses esbuild for transpilation only — type errors won't surface at build time. Treat `.tsx`/`.ts` types as documentation, not enforcement.

Environment files: `.env.mytest` (dev/test), `.env.test`, `.env.official`. The dev script hardcodes `--mode mytest`, so `.env.mytest` is always active locally.

## Architecture

### Stack
- React 18 + React Router 7 + Tailwind CSS 4 + Radix UI (shadcn/ui components in `src/app/components/ui/`)
- Supabase JS v2 for everything backend: Auth, Postgres, Storage, Realtime
- PWA (not React Native) — mobile-first, rendered in a 390×844px container centered on desktop

### App shell (`Root.tsx`)
`Root` is the single route wrapper. It handles the full auth guard waterfall:
1. Loading session → spinner
2. `PASSWORD_RECOVERY` event → force `/reset-password`
3. No user → `/welcome`
4. User + auth page → `/`
5. User + no `username` set → `/onboarding`

`BottomNav` is only rendered on authenticated, non-auth, non-onboarding routes.

### Auth (`src/contexts/AuthContext.tsx`)
`AuthContext` / `useAuth()` is the single source of truth for the current user. It exposes `user`, `loading`, `needsOnboarding`, `isPasswordRecovery`, `refreshProfile`, and `signOut`. Every page that needs the current user imports `useAuth()`.

### Supabase client (`src/lib/supabase.ts`)
Single shared client imported everywhere as `import { supabase } from "../../lib/supabase"`. All DB queries are written inline in page components — there is no separate API or service layer.

### Database schema (key tables)
- `users` — mirrors `auth.users` (UUID pk), created automatically via trigger on signup
- `artist_profiles` — one row per user, created automatically by the `handle_new_user()` trigger on signup (as of `commission_v2`; used to be an opt-in toggle in onboarding). Every account can post artworks and receive commission invitations; `is_published` (default `false`) gates whether a profile shows up in creator search, independent of whether the row exists
- `artworks` + `artwork_media` — artworks belong to `artist_profiles`, not directly to `users`
- `conversations` — two-party chat; **enforces `usera_id < userb_id`** (app must sort UUIDs before insert)
- `messages` — `content` is jsonb; text messages use `{ text: "..." }`; `type` enum: `text | image | file | commission | sticker`
- `commission_requests` — the structured invitation flow (`src/lib/commissions.ts`, `OrdersPage.tsx`); accepting one runs through the `accept_commission()` db function, which opens/reuses a `conversations` row and posts the opening message atomically

All tables have RLS. Migrations live in `supabase/migrations/`.

### Chat architecture (`src/lib/chat.ts`)
- `getOrCreateConversation(myId, otherId)` — finds or creates a `conversations` row, respecting the `usera_id < userb_id` ordering rule
- `formatChatTime(timestamp)` — formats timestamps to `"12:34"` / `"昨天"` / `"週一"` / `"3/2"`
- `getLastMessageText(content, type)` — extracts preview text from message jsonb

`ChatRoomPage` subscribes to `postgres_changes` INSERT on `messages` filtered by `chat_id`. This requires `messages` to be in the Supabase Realtime publication — see migration `20260528000000_chat_realtime_read.sql`.

### Entering a chat room
When `ChatRoomPage` mounts, it:
1. Loads the conversation to get the other user's profile
2. Fetches the last 100 messages
3. Marks all unread messages from the other party as read (`update read_at`)
4. Opens a Realtime channel for new messages

`ChatListPage` re-mounts (and re-fetches) every time the user navigates back to `/chat` because it's a separate route from `/chat/:id`.

### Navigation entry point for chat
From `HomePage` and `CreatorProfilePage`, the "聊聊" button calls `getOrCreateConversation` and navigates directly to `/chat/:conversationId`.

### BottomNav unread indicator
`BottomNav` queries `messages` for unread count (sender ≠ me, `read_at IS NULL`) on mount and whenever `location.pathname` changes. Shows a fuchsia dot on the Chat icon only when not already on a `/chat` route.
