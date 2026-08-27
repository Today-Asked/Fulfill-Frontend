import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ImagePlus, Type, FileText, X, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useUpload } from "../../lib/useUpload";
import { getMyArtistProfileId } from "../../lib/commissions";
import { createArtwork } from "../../lib/artworks";

export function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  // 圖片狀態
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress } = useUpload();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 本地預覽
    setPreviewUrl(URL.createObjectURL(file));
    setUploadedUrl(null);
    setUploadError(null);

    // 上傳到 R2
    try {
      const { publicUrl } = await upload(file, { folder: "artworks" });
      setUploadedUrl(publicUrl);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "上傳失敗");
      setPreviewUrl(null);
    }
  }

  function handleRemoveImage() {
    setPreviewUrl(null);
    setUploadedUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!user) return;
    if (!uploadedUrl) {
      setError("請先上傳一張作品圖片。");
      return;
    }
    if (!title.trim()) {
      setError("請填寫作品標題。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const artistId = await getMyArtistProfileId(user.id);
      if (!artistId) throw new Error("找不到你的創作者檔案，請重新整理再試一次。");
      const artworkId = await createArtwork(artistId, {
        title,
        description: desc,
        coverImageUrl: uploadedUrl,
      });
      navigate(`/artwork/${artworkId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發佈失敗，請稍後再試。");
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(uploadedUrl) && title.trim().length > 0 && !uploading && !submitting;

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#141414]">
      {/* Header */}
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs tracking-widest mb-0.5">CREATE</p>
            <h1 className="text-white text-xl font-semibold">新增作品</h1>
          </div>
          <div className="px-3 py-1.5 bg-white/15 border border-white/30 rounded-full">
            <span className="text-white text-xs font-medium">作品</span>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Image Upload Zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`w-full h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden
            ${uploading ? "cursor-wait border-white/40 bg-white/5" : "cursor-pointer hover:border-white/40 hover:bg-white/5 border-white/15"}`}
        >
          {/* 預覽圖 */}
          {previewUrl && (
            <>
              <img src={previewUrl} alt="作品預覽" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30" />

              {/* 上傳中 overlay */}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
                  <Loader2 size={24} className="text-white animate-spin" />
                  <p className="text-white text-xs">{progress}%</p>
                </div>
              )}

              {/* 上傳完成 - 移除按鈕 */}
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                >
                  <X size={14} className="text-white" />
                </button>
              )}

              {!uploading && uploadedUrl && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-full">
                  <span className="text-green-400 text-[10px]">✓ 上傳成功</span>
                </div>
              )}
            </>
          )}

          {/* 空狀態 */}
          {!previewUrl && !uploadError && (
            <>
              <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center">
                <ImagePlus size={20} className="text-gray-500" />
              </div>
              <p className="text-gray-500 text-xs">點擊上傳作品圖片</p>
              <p className="text-gray-700 text-[10px]">支援 JPG、PNG、WebP、GIF</p>
            </>
          )}

          {/* 錯誤狀態 */}
          {uploadError && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-red-400 text-xs">{uploadError}</p>
              <p className="text-gray-600 text-[10px]">點擊重試</p>
            </div>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="text-gray-400 text-xs mb-2 flex items-center gap-1.5">
            <Type size={12} />
            作品標題
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="例：城市速寫 #12"
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-white/40 focus:bg-white/8 transition-all placeholder:text-gray-600"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-gray-400 text-xs mb-2 flex items-center gap-1.5">
            <FileText size={12} />
            作品說明
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="說說這件作品的靈感、媒材或創作過程...（選填）"
            rows={4}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-white/40 focus:bg-white/8 transition-all placeholder:text-gray-600 resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-white/10 text-white font-semibold text-sm shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:shadow-[0_0_30px_rgba(255,255,255,0.18)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "發佈中…" : "發佈作品"}
        </button>
      </div>
    </div>
  );
}
