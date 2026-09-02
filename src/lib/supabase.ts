import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "../mock/supabase";

const isMock = import.meta.env.VITE_MOCK === "true" || import.meta.env.MODE === "mock";
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || (isMock ? "https://placeholder.supabase.co" : "")) as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || (isMock ? "mock-only-placeholder" : "")) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase: any = isMock
  ? mockSupabase
  : createClient(supabaseUrl, supabaseAnonKey);
