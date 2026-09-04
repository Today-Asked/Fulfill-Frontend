import { db, mockUser } from "./data";

type Filter = (row: any) => boolean;

function user(id: string) {
  const found = db.users.find((row) => row.id === id);
  if (!found) return null;
  return { ...found, artist_profiles: db.artist_profiles.filter((row) => row.user_id === id).map((row) => ({ id: row.id })) };
}

function artist(id: number | null) {
  const found = db.artist_profiles.find((row) => row.id === id);
  return found ? { ...found, users: user(found.user_id) } : null;
}

function hydrate(table: string, row: any) {
  const copy = { ...row };
  if (table === "artist_profiles") copy.users = user(row.user_id);
  if (table === "artworks") {
    copy.artist_profiles = artist(row.artist_id);
    copy.artwork_tags = db.artwork_tags
      .filter((item) => item.artwork_id === row.id)
      .map((item) => ({ tags: db.tags.find((tag) => tag.id === item.tag_id) ?? null }));
  }
  if (table === "likes" || table === "saves") {
    copy.users = user(row.user_id);
    copy.artworks = db.artworks.find((item) => item.id === row.artwork_id) ?? null;
  }
  if (table === "follows") copy.users = user(row.follower_id);
  if (table === "conversations") {
    copy.usera = user(row.usera_id);
    copy.userb = user(row.userb_id);
  }
  if (table === "commission_requests") {
    copy.client = user(row.client_id);
    copy.artist = artist(row.artist_id);
  }
  return copy;
}

class MockQuery {
  private filters: Filter[] = [];
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private one: "single" | "maybe" | null = null;
  private max: number | null = null;
  private sort: { field: string; ascending: boolean } | null = null;
  private countOnly = false;

  constructor(private table: string) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) { this.countOnly = Boolean(options?.head); return this; }
  insert(payload: any) { this.action = "insert"; this.payload = payload; return this; }
  upsert(payload: any) { this.action = "upsert"; this.payload = payload; return this; }
  update(payload: any) { this.action = "update"; this.payload = payload; return this; }
  delete() { this.action = "delete"; return this; }
  eq(field: string, value: any) { this.filters.push((row) => String(row[field]) === String(value)); return this; }
  neq(field: string, value: any) { this.filters.push((row) => String(row[field]) !== String(value)); return this; }
  is(field: string, value: any) { this.filters.push((row) => row[field] === value); return this; }
  in(field: string, values: any[]) { this.filters.push((row) => values.map(String).includes(String(row[field]))); return this; }
  lt(field: string, value: any) { this.filters.push((row) => row[field] < value); return this; }
  ilike(field: string, pattern: string) { const needle = pattern.replace(/%/g, "").toLowerCase(); this.filters.push((row) => String(row[field] ?? "").toLowerCase().includes(needle)); return this; }
  contains(field: string, values: any[]) { this.filters.push((row) => values.every((value) => (row[field] ?? []).includes(value))); return this; }
  or(expression: string) {
    const terms = expression.split(",").map((term) => term.split(".eq."));
    this.filters.push((row) => terms.some(([field, value]) => String(row[field]) === String(value)));
    return this;
  }
  order(field: string, options?: { ascending?: boolean }) { this.sort = { field, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.max = value; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  private matches(row: any) { return this.filters.every((filter) => filter(row)); }

  private execute() {
    const table = db[this.table] ?? (db[this.table] = []);
    let selected = table.filter((row) => this.matches(row));

    if (this.action === "insert" || this.action === "upsert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      const created = incoming.map((value) => {
        const existing = this.action === "upsert" && table.find((row) =>
          (value.id != null && row.id === value.id) ||
          (value.commission_id != null && value.user_id != null && row.commission_id === value.commission_id && row.user_id === value.user_id),
        );
        if (existing) { Object.assign(existing, value); return existing; }
        const numericIds = table.map((row) => row.id).filter((id) => typeof id === "number");
        const row = { id: value.id ?? (numericIds.length ? Math.max(...numericIds) + 1 : 1), created_at: value.created_at ?? new Date().toISOString(), deleted_at: value.deleted_at ?? null, read_at: value.read_at ?? null, ...value };
        table.push(row);
        return row;
      });
      selected = created;
    } else if (this.action === "update") {
      if (this.table === "users" && this.payload?.username && selected[0]?.username !== this.payload.username) {
        const duplicate = table.some((row) => row.id !== selected[0]?.id && row.username === this.payload.username);
        if (duplicate) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        const lastChanged = selected[0]?.username_changed_at
          ? new Date(selected[0].username_changed_at).getTime()
          : 0;
        if (lastChanged && Date.now() - lastChanged < 14 * 24 * 60 * 60 * 1000) {
          return { data: null, error: { message: "username can only be changed once every 14 days" } };
        }
      }
      selected.forEach((row) => Object.assign(row, this.payload));
    } else if (this.action === "delete") {
      db[this.table] = table.filter((row) => !this.matches(row));
    }

    if (this.sort) {
      const { field, ascending } = this.sort;
      selected = [...selected].sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? "")) * (ascending ? 1 : -1));
    }
    if (this.max != null) selected = selected.slice(0, this.max);
    const rows = selected.map((row) => hydrate(this.table, row));
    if (this.countOnly) return { data: null, count: rows.length, error: null };
    if (this.one) {
      if (!rows[0] && this.one === "single") return { data: null, error: { message: "找不到示範資料" } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  then(resolve: (value: any) => void, reject?: (reason: any) => void) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

const channels = new Set<any>();

export const mockSupabase: any = {
  from(table: string) { return new MockQuery(table); },
  async rpc(name: string, args?: any) {
    if (name === "accept_commission") {
      const commission = db.commission_requests.find((row) => row.id === args?.p_commission_id);
      if (!commission) return { data: null, error: { message: "找不到邀請" } };
      commission.status = "accepted";
      let conversation = db.conversations.find((row) => [row.usera_id, row.userb_id].includes(commission.client_id) && [row.usera_id, row.userb_id].includes(mockUser.id));
      if (!conversation) {
        conversation = { id: Math.max(...db.conversations.map((row) => row.id)) + 1, usera_id: commission.client_id, userb_id: mockUser.id, last_message_at: new Date().toISOString() };
        db.conversations.push(conversation);
      }
      commission.chat_id = conversation.id;
      return { data: conversation.id, error: null };
    }
    return { data: null, error: null };
  },
  auth: {
    async getSession() { return { data: { session: { user: mockUser } }, error: null }; },
    onAuthStateChange() { return { data: { listener: null, subscription: { unsubscribe() {} } } }; },
    async signOut() { return { error: null }; },
    async signInWithPassword() { return { data: { user: mockUser }, error: null }; },
    async signUp() { return { data: { user: mockUser }, error: null }; },
    async signInWithOAuth() { return { data: {}, error: null }; },
    async resetPasswordForEmail() { return { data: {}, error: null }; },
    async updateUser() { return { data: { user: mockUser }, error: null }; },
  },
  channel() {
    const channel = { on() { return channel; }, subscribe() { channels.add(channel); return channel; } };
    return channel;
  },
  removeChannel(channel: any) { channels.delete(channel); },
  functions: { async invoke() { return { data: { uploadUrl: "mock://upload", publicUrl: "", key: "mock" }, error: null }; } },
};
