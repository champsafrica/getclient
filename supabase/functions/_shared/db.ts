import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Service-role client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
// to every edge function by Supabase automatically.
export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
