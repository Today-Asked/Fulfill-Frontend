// Single source of truth for the fixed artwork category taxonomy, shared by
// the upload flow (CreatePage) and the discovery filter (HomePage's category
// drawer). Both sides must use the same list or artworks silently stop
// showing up under any category filter.
export const ARTWORK_CATEGORIES = ["繪畫與插畫", "平面設計", "品牌設計", "攝影", "3D 創作", "動態設計"];
