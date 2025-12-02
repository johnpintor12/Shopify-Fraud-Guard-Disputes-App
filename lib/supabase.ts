import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in Vite/Vercel/Browser environments
const getEnv = (key: string) => {
  // Check import.meta.env (Vite standard)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  // Check process.env (Polyfilled by vite.config.ts)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. App will run in local-only mode. Please check Vercel Environment Variables.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);