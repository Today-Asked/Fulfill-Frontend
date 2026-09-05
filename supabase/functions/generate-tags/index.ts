// supabase/functions/generate-tags/index.ts
import { serve } from "https://deno.land/std/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // CORS preflight — without this the browser's preflight OPTIONS request
  // fails before the actual POST is ever sent.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  const { userInput } = await req.json()

  const response = await fetch("https://api.gmi-serving.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("GMI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "MiniMaxAI/MiniMax-M3",
      messages: [
        { role: "user", content: `Return a JSON array of style tags for: ${userInput}` }
      ]
    })
  })

  const data = await response.json()

  // The model answers with prose-wrapped markdown (a ```json fence around the
  // array) rather than a bare JSON body, so the array has to be pulled out of
  // the chat-completion envelope before this function can return it directly.
  const content: string = data.choices?.[0]?.message?.content ?? "[]"
  const jsonText = content.replace(/```json\s*|```/g, "").trim()

  let tags: string[] = []
  try {
    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed)) tags = parsed
  } catch {
    tags = []
  }

  return new Response(JSON.stringify(tags), {
    headers: { ...cors, "Content-Type": "application/json" }
  })
})
