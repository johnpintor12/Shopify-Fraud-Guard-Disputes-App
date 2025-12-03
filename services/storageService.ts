import { supabase } from '../lib/supabase';
import { Order } from '../types';

/**
 * SINGLE DB STRATEGY:
 * * We use a "Dump and Load" approach to avoid "Bad Request" schema errors.
 * * 1. The 'Identifier' you asked for is the 'import_category' field inside the Order object.
 * 2. We save the ENTIRE Order object into the 'data' JSONB column.
 * 3. We do NOT try to write to individual columns like 'latest_dispute_status' anymore.
 * This ensures that even if your DB lacks those columns, the import works perfectly.
 */

export const saveOrdersToDb = async (orders: Order[]) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('[Storage] No authenticated user – cannot save orders.');
    throw new Error('Not authenticated. Please sign in again before importing.');
  }

  if (!orders || orders.length === 0) return;

  // We map the orders to strictly match the 'orders' table structure:
  // - user_id: The owner
  // - id: The unique Order ID (e.g. #1001)
  // - data: The CONTAINER for everything else (Identifier, Tags, Amounts, etc.)
  const upsertRows = orders.map((order) => {
    return {
      user_id: user.id,
      id: order.id,
      data: order, // <--- The Identifier (import_category) is saved inside here
      updated_at: new Date().toISOString(),
    };
  });

  // Perform the Upsert
  const { error: upsertError } = await supabase
    .from('orders')
    .upsert(upsertRows, { onConflict: 'user_id,id' });

  if (upsertError) {
    console.error("Supabase Upsert Error:", upsertError); 
    // Return a clear error message to the UI
    throw new Error(`Database Error: ${upsertError.message}`);
  }
};

export const loadOrdersFromDb = async (): Promise<Order[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // We just fetch the 'data' column
  const { data, error } = await supabase
    .from('orders')
    .select('data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Storage] Failed to load orders:', error);
    return [];
  }

  // And unwrap it so the UI gets the full Order object with Identifiers
  return (data || []).map((row: any) => row.data as Order);
};

export const clearAllImportedData = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  await supabase.from('disputes').delete().eq('user_id', user.id);
  await supabase.from('orders').delete().eq('user_id', user.id);
};
