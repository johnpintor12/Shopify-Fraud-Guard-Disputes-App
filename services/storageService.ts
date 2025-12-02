import { supabase } from '../lib/supabase';
import { Order } from '../types';

export const saveOrdersToDb = async (orders: Order[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || orders.length === 0) return;

  // Prepare data for upsert
  const rows = orders.map(order => ({
    user_id: user.id,
    id: order.id,
    data: order, // Store full object as JSONB
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('orders')
    .upsert(rows, { onConflict: 'user_id,id' });

  if (error) {
    console.error("Failed to save orders to DB:", error);
    throw error;
  }
};

export const loadOrdersFromDb = async (): Promise<Order[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('data')
    .eq('user_id', user.id);

  if (error) {
    console.error("Failed to load orders from DB:", error);
    return [];
  }

  // Extract the 'data' column which contains the Order object
  return data.map((row: any) => row.data as Order);
};
