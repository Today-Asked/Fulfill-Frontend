import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FileText, GripVertical, ImagePlus, Images, Loader2, Plus, Tags, Type, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useUpload } from "../../lib/useUpload";
import { getMyArtistProfileId } from "../../lib/commissions";
import { createArtwork } from "../../lib/artworks";
import { TagInput } from "../components/TagInput";

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface SelectedImage { id: string; file: File; previewUrl: string; }
interface DragState { id: string; startX: number; startY: number; moved: boolean; }

function imageId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

export function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<SelectedImage[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const { upload, uploading, progress } = useUpload();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const activeImage = images.find((image) => image.id === activeImageId) ?? images[0] ?? null;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;

    const invalidType = picked.find((file) => !ACCEPTED_IMAGE_TYPES.has(file.type));
    if (invalidType) { setSelectionError(`「${invalidType.name}」不是支援的圖片格式。`); return; }
    const oversized = picked.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) { setSelectionError(`「${oversized.name}」超過 15 MB。`); return; }

    const existingKeys = new Set(images.map(({ file }) => `${file.name}-${file.size}-${file.lastModified}`));
    const uniqueFiles = picked.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`));
    const available = MAX_IMAGES - images.length;
    const accepted = uniqueFiles.slice(0, available).map((file) => ({ id: imageId(file), file, previewUrl: URL.createObjectURL(file) }));
    if (!accepted.length) {
      setSelectionError(images.length >= MAX_IMAGES ? `一次最多可上傳 ${MAX_IMAGES} 張圖片。` : "這些圖片已經加入了。");
      return;
    }

    setImages((current) => [...current, ...accepted]);
    setActiveImageId((current) => current ?? accepted[0].id);
    setSelectionError(uniqueFiles.length > available ? `已加入前 ${available} 張，一次最多 ${MAX_IMAGES} 張。` : null);
    setError(null);
  }

  function removeImage(id: string) {
    const removedIndex = images.findIndex((image) => image.id === id);
    const removed = images[removedIndex];
    if (!removed) return;
    URL.revokeObjectURL(removed.previewUrl);
    const next = images.filter((image) => image.id !== id);
    setImages(next);
    if (activeImageId === id) setActiveImageId(next[Math.min(removedIndex, Math.max(0, next.length - 1))]?.id ?? null);
    setSelectionError(null);
  }

  function moveImage(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setImages((current) => {
      const from = current.findIndex((image) => image.id === sourceId);
      const to = current.findIndex((image) => image.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
    dragRef.current = { id, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveImageId(id);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.moved = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-upload-id]");
    const targetId = target?.dataset.uploadId;
    if (targetId) moveImage(drag.id, targetId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  async function handleSubmit() {
    if (!user) return;
    if (!images.length) { setError("請至少選擇一張作品圖片。"); return; }
    if (!title.trim()) { setError("請填寫作品標題。"); return; }

    setSubmitting(true);
    setUploadedCount(0);
    setError(null);
    try {
      const mediaUrls: string[] = [];
      for (let index = 0; index < images.length; index += 1) {
        const { publicUrl } = await upload(images[index].file, { folder: "artworks" });
        mediaUrls.push(publicUrl);
        setUploadedCount(index + 1);
      }
      const artistId = await getMyArtistProfileId(user.id);
      if (!artistId) throw new Error("找不到你的創作者檔案，請重新整理再試一次。");
      const artworkId = await createArtwork(artistId, { title, description: desc, coverImageUrl: mediaUrls[0], mediaUrls, tagNames: tags });
      navigate(`/artwork/${artworkId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發佈失敗，請稍後再試。");
      setSubmitting(false);
    }
  }

  const busy = uploading || submitting;
  const canSubmit = images.length > 0 && title.trim().length > 0 && !busy;

  return (
    <div className="rounded-2xl bg-[#141414] pb-10">
      <div className="px-5 pb-5 pt-6">
        <div>
          <p className="mb-0.5 text-xs tracking-widest text-gray-500">CREATE</p>
          <h1 className="text-xl font-semibold text-white">新增作品</h1>
        </div>
      </div>

      <div className="space-y-4 px-5">
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />

        {activeImage ? (
          <div className="space-y-3">
            <div className="relative h-64 overflow-hidden rounded-3xl border border-white/10 bg-black/35">
              <img src={activeImage.previewUrl} alt="作品預覽" className="h-full w-full object-contain" />
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">{images.findIndex((image) => image.id === activeImage.id) + 1} / {images.length}</span>
                {images[0]?.id === activeImage.id && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black">封面</span>}
              </div>
              {!busy && <button type="button" onClick={() => removeImage(activeImage.id)} aria-label="移除目前圖片" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black"><X size={17} /></button>}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 backdrop-blur-sm">
                  <Loader2 size={26} className="animate-spin text-white" />
                  <p className="text-sm font-medium text-white">上傳第 {Math.min(uploadedCount + 1, images.length)} / {images.length} 張</p>
                  <p className="text-xs text-white/55">{progress}%</p>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-white/55"><GripVertical size={13} />拖曳圖片調整順序</p>
                <p className="text-[11px] text-white/30">第一張是作品封面</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.map((image, index) => (
                  <button key={image.id} type="button" data-upload-id={image.id}
                    onPointerDown={(event) => handlePointerDown(event, image.id)} onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
                    className={`relative h-24 w-20 shrink-0 touch-none overflow-hidden rounded-2xl border-2 bg-black transition-colors ${activeImage.id === image.id ? "border-white" : "border-transparent"}`}
                    aria-label={`第 ${index + 1} 張圖片，拖曳可調整順序`}>
                    <img src={image.previewUrl} alt="" draggable={false} className="h-full w-full select-none object-cover" />
                    <span className="absolute left-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-black/75 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
                    {!busy && <span data-no-drag role="button" tabIndex={0} aria-label={`移除第 ${index + 1} 張圖片`}
                      onClick={(event) => { event.stopPropagation(); removeImage(image.id); }}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); removeImage(image.id); } }}
                      className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/75 text-white"><X size={11} /></span>}
                  </button>
                ))}
                {images.length < MAX_IMAGES && !busy && <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/25 text-white/45 transition-colors hover:border-white/55 hover:text-white"><Plus size={20} /><span className="text-[10px]">新增</span></button>}
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/15 transition-all hover:border-white/40 hover:bg-white/5">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/6"><Images size={23} className="text-gray-500" /></div>
            <p className="text-sm text-gray-400">選擇多張作品圖片</p>
            <p className="text-[10px] text-gray-600">一次最多 {MAX_IMAGES} 張，可預覽並拖曳排序</p>
            <span className="mt-2 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"><ImagePlus size={14} />選擇圖片</span>
          </button>
        )}

        {selectionError && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">{selectionError}</p>}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs text-gray-400"><Type size={12} />作品標題</label>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="例：城市速寫 #12" className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-white/40 focus:bg-white/8" />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs text-gray-400"><FileText size={12} />作品說明</label>
          <textarea value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="說說這件作品的靈感、媒材或創作過程...（選填）" rows={4} className="w-full resize-none rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-white/40 focus:bg-white/8" />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs text-gray-400"><Tags size={12} />作品標籤</label>
          <TagInput value={tags} onChange={setTags} placeholder="輸入標籤後按空白鍵分隔（選填）" />
        </div>
        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="w-full rounded-2xl bg-white/10 py-4 text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,255,255,0.12)] transition-shadow hover:shadow-[0_0_30px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? `正在發佈 ${uploadedCount}/${images.length}` : `發佈作品${images.length > 1 ? `（${images.length} 張）` : ""}`}
        </button>
      </div>
    </div>
  );
}
