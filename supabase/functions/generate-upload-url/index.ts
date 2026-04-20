import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // ── 1. 驗證登入狀態 ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // ── 2. 讀取請求參數 ────────────────────────────────────────────────
    const { filename, contentType, folder = "artworks" } = await req.json();

    if (!filename || !contentType) {
      return json({ error: "filename and contentType are required" }, 400);
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return json({ error: `不支援的檔案格式，允許：${ALLOWED_TYPES.join(", ")}` }, 400);
    }

    // ── 3. 產生唯一的 R2 key ──────────────────────────────────────────
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `${folder}/${user.id}/${crypto.randomUUID()}.${ext}`;

    // ── 4. 用 AWS Signature V4 簽出 Presigned PUT URL ─────────────────
    const aws = new AwsClient({
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
      service: "s3",
      region: "auto",
    });

    const accountId  = Deno.env.get("R2_ACCOUNT_ID")!;
    const bucketName = Deno.env.get("R2_BUCKET_NAME")!;
    const endpoint   = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

    const signed = await aws.sign(
      new Request(endpoint, {
        method: "PUT",
        headers: { "Content-Type": contentType },
      }),
      { aws: { signQuery: true, expiresIn: 900 } } // 15 分鐘有效
    );

    const publicUrl = `${Deno.env.get("R2_PUBLIC_URL")}/${key}`;

    return json({ uploadUrl: signed.url, publicUrl, key });

  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
