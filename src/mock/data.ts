const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

export const mockUser = {
  id: "preview-user",
  aud: "authenticated",
  role: "authenticated",
  email: "mira@example.com",
  app_metadata: {},
  user_metadata: { username: "mira.chen", full_name: "陳米拉" },
  created_at: ago(24 * 180),
};

export const db: Record<string, any[]> = {
  users: [
    { id: "preview-user", username: "mira.chen", name: "陳米拉", bio: "視覺設計與插畫工作者，喜歡把日常變成有溫度的畫面。", expertise: ["視覺設計", "插畫", "品牌設計"], username_changed_at: null, avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop", school_verified_at: ago(500), created_at: ago(4300), deleted_at: null },
    { id: "user-lin", username: "linyu.draws", name: "林雨", bio: "角色設計・繪本・溫柔的色彩練習。", expertise: ["角色設計", "繪本"], username_changed_at: null, avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop", school_verified_at: ago(800), created_at: ago(3600), deleted_at: null },
    { id: "user-kai", username: "kaistudio", name: "凱恩工作室", bio: "品牌識別、包裝與動態視覺。", expertise: ["品牌識別", "動態視覺"], username_changed_at: null, avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop", school_verified_at: null, created_at: ago(3000), deleted_at: null },
    { id: "user-an", username: "an.photo", name: "安然", bio: "攝影與生活風格企劃。", expertise: ["攝影", "生活風格"], username_changed_at: null, avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop", school_verified_at: ago(1200), created_at: ago(2500), deleted_at: null },
  ],
  artist_profiles: [
    { id: 1, user_id: "preview-user", availability: "open", services: ["插畫", "品牌設計"], budget_mode: "range", budget_from: 8000, budget_to: 30000, available_from: null, turnaround_days: 14, work_mode: "both", school: "國立臺灣藝術大學", cover_image_url: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=1200&auto=format&fit=crop", is_published: true, is_verified: true, created_at: ago(4200) },
    { id: 2, user_id: "user-lin", availability: "open", services: ["角色設計", "插畫"], budget_mode: "from", budget_from: 5000, budget_to: null, available_from: null, turnaround_days: 10, work_mode: "remote", school: "實踐大學", cover_image_url: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=1200&auto=format&fit=crop", is_published: true, is_verified: true, created_at: ago(3500) },
    { id: 3, user_id: "user-kai", availability: "limited", services: ["品牌設計", "動態設計"], budget_mode: "range", budget_from: 18000, budget_to: 60000, available_from: null, turnaround_days: 21, work_mode: "both", school: "臺北科技大學", cover_image_url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&auto=format&fit=crop", is_published: true, is_verified: false, created_at: ago(2900) },
    { id: 4, user_id: "user-an", availability: "open", services: ["攝影", "企劃"], budget_mode: "ask", budget_from: null, budget_to: null, available_from: null, turnaround_days: 7, work_mode: "in_person", school: "世新大學", cover_image_url: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format&fit=crop", is_published: true, is_verified: true, created_at: ago(2400) },
  ],
  artworks: [
    { id: 101, artist_id: 1, title: "午後的窗邊", description: "以午後斜射進工作室的光為靈感，記錄一段安靜的創作時間。", cover_image_url: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=900&auto=format&fit=crop", status: "published", created_at: ago(300), deleted_at: null },
    { id: 102, artist_id: 1, title: "城市散步", description: "城市街角與人物速寫系列。", cover_image_url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=900&auto=format&fit=crop", status: "published", created_at: ago(500), deleted_at: null },
    { id: 103, artist_id: 1, title: "夏日果實", description: "水果包裝與圖像識別練習。", cover_image_url: "https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=900&auto=format&fit=crop", status: "hidden", created_at: ago(700), deleted_at: null },
    { id: 104, artist_id: 2, title: "月光旅人", description: "為奇幻短篇繪製的角色設定與場景概念。", cover_image_url: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=900&auto=format&fit=crop", status: "published", created_at: ago(22), deleted_at: null },
    { id: 105, artist_id: 2, title: "森林郵差", description: "繪本角色與世界觀設計。", cover_image_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=900&auto=format&fit=crop", status: "published", created_at: ago(40), deleted_at: null },
    { id: 106, artist_id: 3, title: "NOVA 品牌識別", description: "新創生活品牌的識別系統與包裝延伸。", cover_image_url: "https://images.unsplash.com/photo-1561070791-36c11767b26a?w=900&auto=format&fit=crop", status: "published", created_at: ago(60), deleted_at: null },
    { id: 107, artist_id: 3, title: "潮汐咖啡包裝", description: "以海岸線為概念的系列包裝。", cover_image_url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=900&auto=format&fit=crop", status: "published", created_at: ago(80), deleted_at: null },
    { id: 108, artist_id: 4, title: "島嶼日常", description: "一組關於光、風與生活的影像紀錄。", cover_image_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&auto=format&fit=crop", status: "published", created_at: ago(100), deleted_at: null },
    { id: 109, artist_id: 4, title: "海邊午後", description: "夏季形象攝影企劃。", cover_image_url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&auto=format&fit=crop", status: "published", created_at: ago(120), deleted_at: null },
  ],
  tags: [
    { id: 1, name: "繪畫與插畫" },
    { id: 2, name: "平面設計" },
    { id: 3, name: "品牌設計" },
    { id: 4, name: "攝影" },
    { id: 5, name: "3D 創作" },
    { id: 6, name: "動態設計" },
  ],
  artwork_tags: [
    { artwork_id: 101, tag_id: 1 }, { artwork_id: 101, tag_id: 2 },
    { artwork_id: 102, tag_id: 1 },
    { artwork_id: 103, tag_id: 3 },
    { artwork_id: 104, tag_id: 1 },
    { artwork_id: 105, tag_id: 1 }, { artwork_id: 105, tag_id: 2 },
    { artwork_id: 106, tag_id: 3 }, { artwork_id: 106, tag_id: 6 },
    { artwork_id: 107, tag_id: 2 }, { artwork_id: 107, tag_id: 3 },
    { artwork_id: 108, tag_id: 4 },
    { artwork_id: 109, tag_id: 4 },
  ],
  artwork_media: [
    { id: 1001, artwork_id: 101, media_url: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=900&auto=format&fit=crop", media_type: "image", sort_order: 0 },
    { id: 1002, artwork_id: 101, media_url: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=900&auto=format&fit=crop", media_type: "image", sort_order: 1 },
    { id: 1003, artwork_id: 101, media_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=900&auto=format&fit=crop", media_type: "image", sort_order: 2 },
    { id: 1004, artwork_id: 102, media_url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=900&auto=format&fit=crop", media_type: "image", sort_order: 0 },
    { id: 1005, artwork_id: 102, media_url: "https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=900&auto=format&fit=crop", media_type: "image", sort_order: 1 },
  ],
  likes: [
    { user_id: "preview-user", artwork_id: 104, created_at: ago(8) },
    { user_id: "preview-user", artwork_id: 106, created_at: ago(20) },
    { user_id: "user-lin", artwork_id: 101, created_at: ago(2) },
    { user_id: "user-an", artwork_id: 102, created_at: ago(6) },
  ],
  saves: [
    { user_id: "preview-user", artwork_id: 105, created_at: ago(5) },
    { user_id: "preview-user", artwork_id: 107, created_at: ago(16) },
  ],
  follows: [
    { follower_id: "user-lin", following_id: "preview-user", created_at: ago(3) },
    { follower_id: "user-an", following_id: "preview-user", created_at: ago(18) },
    { follower_id: "preview-user", following_id: "user-kai", created_at: ago(36) },
  ],
  creator_saves: [{ user_id: "preview-user", artist_id: 3, created_at: ago(12) }],
  conversations: [
    { id: 201, usera_id: "preview-user", userb_id: "user-lin", last_message_at: ago(1) },
    { id: 202, usera_id: "preview-user", userb_id: "user-kai", last_message_at: ago(15) },
  ],
  messages: [
    { id: 301, chat_id: 201, sender_id: "user-lin", type: "text", content: { text: "嗨！我很喜歡你的城市散步系列。" }, created_at: ago(5), read_at: ago(4), deleted_at: null },
    { id: 302, chat_id: 201, sender_id: "preview-user", type: "text", content: { text: "謝謝你！那組是我很喜歡的一次練習。" }, created_at: ago(4), read_at: ago(3), deleted_at: null },
    { id: 303, chat_id: 201, sender_id: "user-lin", type: "text", content: { text: "之後有機會想一起合作看看 ✨" }, created_at: ago(1), read_at: null, deleted_at: null },
    { id: 304, chat_id: 202, sender_id: "user-kai", type: "text", content: { text: "品牌提案我整理好了，晚點傳給你。" }, created_at: ago(15), read_at: null, deleted_at: null },
  ],
  commission_requests: [
    { id: 401, chat_id: null, client_id: "user-an", artist_id: null, title: "夏季市集主視覺", org_name: "海風生活節", services: ["插畫", "品牌設計"], budget_min: 18000, budget_max: 32000, draft_due_date: "2026-09-12", final_due_date: "2026-09-28", description: "需要一套清爽、有手感的市集主視覺，延伸海報與社群素材。", contact: "hello@seabreeze.tw", has_assets: true, reference_urls: [], status: "pending", decline_reason: null, reply_note: null, viewed_at: null, created_at: ago(10) },
    { id: 402, chat_id: 201, client_id: "user-lin", artist_id: 1, title: "角色聯名插畫", org_name: "小島出版", services: ["插畫"], budget_min: 12000, budget_max: 20000, draft_due_date: "2026-09-08", final_due_date: "2026-09-20", description: "新書上市需要三張角色聯名插畫。", contact: "editor@islandbooks.tw", has_assets: true, reference_urls: [], status: "in_progress", decline_reason: null, reply_note: null, viewed_at: null, created_at: ago(30) },
    { id: 403, chat_id: 202, client_id: "preview-user", artist_id: 3, title: "FULFILL 活動識別", org_name: "FULFILL", services: ["品牌設計"], budget_min: 25000, budget_max: 45000, draft_due_date: "2026-09-15", final_due_date: "2026-10-01", description: "為創作者交流活動建立主視覺與社群延伸模板。", contact: "mira@example.com", has_assets: false, reference_urls: [], status: "accepted", decline_reason: null, reply_note: "期待合作！", viewed_at: ago(20), created_at: ago(50) },
  ],
  blocks: [], reports: [], match_outcomes: [],
};
