import React, { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useUpload } from "../../lib/useUpload";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface AvatarUploadProps {
  currentUrl: string | null;
  name?: string;                        // 沒有頭像時顯示名字第一字
  size?: "sm" | "md" | "lg";
  onUploaded?: (url: string) => void;   // 上傳完成後的 callback
}

const sizeMap = {
  sm: "w-12 h-12 text-base",
  md: "w-16 h-16 text-xl",
  lg: "w-20 h-20 text-2xl",
};

export function AvatarUpload({ currentUrl, name, size = "lg", onUploaded }: AvatarUploadProps) {
  const { user } = useAuth();
  const { upload, uploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const { publicUrl } = await upload(file, { folder: "avatars" });

      // 存到 DB
      await supabase
        .from("users")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      onUploaded?.(publicUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`${sizeMap[size]} rounded-full relative shrink-0 group`}
      >
        {/* 頭像 / 佔位 */}
        <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/20 bg-purple-900 flex items-center justify-center">
          {currentUrl ? (
            <img src={currentUrl} alt={name ?? "avatar"} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-white/60">
              {name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 size={16} className="text-fuchsia-400 animate-spin" />
          </div>
        )}

        {/* Hover overlay */}
        {!uploading && (
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <Camera size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </button>
    </>
  );
}
