import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error('Invalid supabaseUrl: set VITE_SUPABASE_URL to https://<project>.supabase.co');
}
if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);