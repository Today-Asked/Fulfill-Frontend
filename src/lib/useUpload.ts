import { useState } from "react";
import { supabase } from "./supabase";

interface UploadOptions {
  folder?: "artworks" | "avatars" | "references";
}

interface UploadResult {
  publicUrl: string;
  key: string;
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    setUploading(true);
    setProgress(0);

    try {
      // 1. 跟 Edge Function 要 Presigned URL（自動帶入 JWT）
      const { data, error } = await supabase.functions.invoke("generate-upload-url", {
        body: {
          filename: file.name,
          contentType: file.type,
          folder: options.folder ?? "references",
        },
      });

      if (error) throw new Error(error.message ?? "取得上傳網址失敗");
      if (!data?.uploadUrl) throw new Error("取得上傳網址失敗");

      setProgress(30);

      // 2. 直接 PUT 到 R2
      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("上傳到 R2 失敗");

      setProgress(100);
      return { publicUrl: data.publicUrl, key: data.key };

    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, progress };
}
