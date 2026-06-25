import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://epkxjnfqdjtphqluahaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwa3hqbmZxZGp0cGhxbHVhaGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDEzNjQsImV4cCI6MjA5NDA3NzM2NH0.1ZYXE0Ll7SsN_fpOKZbxJsxHuxNG4pd4kN9tvKzVxzk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

