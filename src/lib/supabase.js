import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "Copiez .env.example vers .env et renseignez vos identifiants Supabase."
  );
}

export const supabase = createClient(url || "", anonKey || "");
