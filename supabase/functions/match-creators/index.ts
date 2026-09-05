// supabase/functions/match-creators/index.ts
import { serve } from "https://deno.land/std/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const VALID_TIERS = new Set(["very_high", "high", "medium", "low", "very_low"])

interface Candidate {
  artistId: number
  name: string
  bio: string | null
  services: string[]
  recentWorks: string[]
}

function buildPrompt(query: string, keywords: string[], candidates: Candidate[]): string {
  const candidateList = candidates
    .map((c) => {
      const works = c.recentWorks.length ? c.recentWorks.join("、") : "尚無公開作品"
      return `- artistId ${c.artistId}: ${c.name}｜近期作品: ${works}｜服務項目: ${c.services.join("、") || "未填寫"}｜簡介: ${c.bio?.trim() || "未填寫"}`
    })
    .join("\n")

  return `你是一個委託媒合平台的助理。委託者的需求描述是：「${query}」，從中抽取出的風格關鍵字是：${keywords.join(", ") || "（無）"}。

以下是候選創作者名單：
${candidateList}

請針對「每一位」候選創作者，判斷他們跟委託者需求的相符程度，並將全部候選人依相符度由高到低排序（每個 artistId 都要出現，且只能出現一次，不能省略任何人）。

判斷時請以「近期作品」的標題與標籤作為主要依據——這代表這位創作者實際做過什麼；簡介與服務項目只是輔助參考，簡介沒提到某個風格不代表創作者不會，只要作品標題或標籤明確符合關鍵字，就應該給予中度以上的相符度，即使簡介完全沒提到。

matchTier 只能是以下五種之一：very_high, high, medium, low, very_low。
reason 請用一句繁體中文簡短說明為什麼相符或不相符，盡量具體引用作品標題、標籤或委託者的關鍵字；如果作品與簡介都不足以判斷，就誠實反映（例如「資料不足，僅能依服務項目粗略判斷」），不要編造沒有根據的細節。

只回傳 JSON 陣列，不要有其他文字或說明，格式如下：
[{"artistId": 1, "matchTier": "very_high", "reason": "..."}]`
}

serve(async (req) => {
  // CORS preflight — without this the browser's preflight OPTIONS request
  // fails before the actual POST is ever sent.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  const { query, keywords = [], candidates = [] } = await req.json()

  const response = await fetch("https://api.gmi-serving.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("GMI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "MiniMaxAI/MiniMax-M3",
      messages: [
        { role: "user", content: buildPrompt(query, keywords, candidates) }
      ]
    })
  })

  const data = await response.json()

  // The model answers with prose-wrapped markdown (a ```json fence around the
  // array) rather than a bare JSON body, so the array has to be pulled out of
  // the chat-completion envelope before this function can return it directly.
  const content: string = data.choices?.[0]?.message?.content ?? "[]"
  const jsonText = content.replace(/```json\s*|```/g, "").trim()

  let results: { artistId: number; matchTier: string; reason: string }[] = []
  try {
    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed)) {
      results = parsed.filter(
        (item) => item && typeof item.artistId === "number" && VALID_TIERS.has(item.matchTier) && typeof item.reason === "string"
      )
    }
  } catch {
    results = []
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...cors, "Content-Type": "application/json" }
  })
})
