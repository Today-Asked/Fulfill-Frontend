import React, { useState, useRef } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { useUpload } from "../../lib/useUpload";
import { supabase } from "../../lib/supabase";

interface ArtworkUploadSheetProps {
  artistProfileId: number;
  onClose: () => void;
  onUploaded: (artwork: { id: number; title: string; cover_image_url: string }) => void;
}

export function ArtworkUploadSheet({ artistProfileId, onClose, onUploaded }: ArtworkUploadSheetProps) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading } = useUpload();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setCoverUrl(null);
    setError(null);
    try {
      const { publicUrl } = await upload(file, { folder: "artworks" });
      setCoverUrl(publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "圖片上傳失敗");
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coverUrl) { setError("請先上傳封面圖"); return; }
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("artworks")
      .insert({
        artist_id: artistProfileId,
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: coverUrl,
        status: "published",
      })
      .select("id, title, cover_image_url")
      .single();

    setSaving(false);

    if (insertError) { setError(insertError.message); return; }
    if (data) onUploaded(data);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full bg-[#111116] border-t border-white/10 rounded-t-3xl px-5 pt-5 pb-28 flex flex-col gap-4 max-h-[90%] overflow-y-auto">
        {/* Handle + header */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">上傳作品</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 封面圖 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-all
              ${uploading ? "cursor-wait border-fuchsia-500/40" : "cursor-pointer hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 border-white/15"}`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30" />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 size={24} className="text-fuchsia-400 animate-spin" />
                  </div>
                )}
                {!uploading && coverUrl && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-full">
                    <span className="text-green-400 text-[10px]">✓ 已上傳</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <ImagePlus size={24} className="text-gray-600" />
                <p className="text-gray-500 text-xs">點擊上傳封面圖（必填）</p>
              </>
            )}
          </div>

          {/* 標題 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
              標題 <span className="text-fuchsia-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作品名稱"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 transition-all"
            />
          </div>

          {/* 描述 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
              描述
              <span className="text-gray-600 normal-case font-normal ml-1">（選填）</span>
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="介紹這件作品…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || saving || !coverUrl}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" />儲存中…</> : "發佈作品"}
          </button>
        </form>
      </div>
    </div>
  );
}
