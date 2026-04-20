import React, { useState, useRef } from "react";
import { ImagePlus, Type, FileText, DollarSign, Calendar, ChevronRight, X, Loader2 } from "lucide-react";
import { useUpload } from "../../lib/useUpload";

const steps = [
  { num: "01", icon: ImagePlus,    title: "選照片 / 參考圖", desc: "上傳你的靈感或參考圖" },
  { num: "02", icon: FileText,     title: "填寫委託條件",   desc: "描述作品需求、預算與期限" },
  { num: "03", icon: ChevronRight, title: "進入聊天與訂單", desc: "發佈後自動建立委託聊天室" },
];

export function CreatePage() {
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [budget, setBudget]     = useState("");
  const [deadline, setDeadline] = useState("");

  // 圖片狀態
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl]   = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress } = useUpload();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 本地預覽
    setPreviewUrl(URL.createObjectURL(file));
    setUploadedUrl(null);
    setUploadError(null);

    // 上傳到 R2
    try {
      const { publicUrl } = await upload(file, { folder: "references" });
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

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs tracking-widest mb-0.5">CREATE</p>
            <h1 className="text-white text-xl font-semibold">新增委託需求</h1>
          </div>
          <div className="px-3 py-1.5 bg-fuchsia-500/15 border border-fuchsia-500/30 rounded-full">
            <span className="text-fuchsia-300 text-xs font-medium">委託單</span>
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
          className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden
            ${uploading ? "cursor-wait border-fuchsia-500/40 bg-fuchsia-500/5" : "cursor-pointer hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 border-white/15"}`}
        >
          {/* 預覽圖 */}
          {previewUrl && (
            <>
              <img src={previewUrl} alt="reference" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30" />

              {/* 上傳中 overlay */}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
                  <Loader2 size={24} className="text-fuchsia-400 animate-spin" />
                  <p className="text-white text-xs">{progress}%</p>
                </div>
              )}

              {/* 上傳完成 - 移除按鈕 */}
              {!uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
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
              <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center group-hover:bg-fuchsia-500/15 transition-colors">
                <ImagePlus size={20} className="text-gray-500" />
              </div>
              <p className="text-gray-500 text-xs">點擊上傳參考圖</p>
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
            委託標題
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：A4 社團活動海報設計"
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-fuchsia-500/40 focus:bg-white/8 transition-all placeholder:text-gray-600"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-gray-400 text-xs mb-2 flex items-center gap-1.5">
            <FileText size={12} />
            需求描述
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="描述你的作品需求、風格偏好、色彩方向等..."
            rows={4}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-fuchsia-500/40 focus:bg-white/8 transition-all placeholder:text-gray-600 resize-none"
          />
        </div>

        {/* Budget & Deadline */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-2 flex items-center gap-1.5">
              <DollarSign size={12} />
              預算 (NT$)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="1000"
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-fuchsia-500/40 focus:bg-white/8 transition-all placeholder:text-gray-600"
            />
          </div>
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-2 flex items-center gap-1.5">
              <Calendar size={12} />
              交付日期
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-fuchsia-500/40 focus:bg-white/8 transition-all [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Step Cards */}
        <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-3 tracking-wide">委託流程說明</p>
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-fuchsia-300 text-[9px] font-bold">{step.num}</span>
                </div>
                <div>
                  <p className="text-gray-200 text-xs font-medium">{step.title}</p>
                  <p className="text-gray-500 text-[10px]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          disabled={uploading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.4)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          發佈委託需求
        </button>
      </div>
    </div>
  );
}
