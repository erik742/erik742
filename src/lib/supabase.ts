import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  bracelet_type: 'fish_tail' | 'french_braid';
  color: string;
  secondary_color: string | null;
  size: string;
  comment: string | null;
  status: string;
  created_at: string;
};

export type OrderInsert = Omit<Order, 'id' | 'status' | 'created_at'>;
