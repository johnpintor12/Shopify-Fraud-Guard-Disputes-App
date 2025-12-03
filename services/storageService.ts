// src/services/storageService.ts
import { supabase } from '../supabase';
import { Order, DisputeStatus } from '../types';

// Rank for dispute statuses so we can pick the "strongest"
const statusRank: Record<string, number> = {
  none: 0,
  open: 1,
  submitted: 2,
  won: 3,
  lost: 3,
  protected: 2,
};

// Map your app's DisputeStatus enum to a compact string we store in Supabase
const mapDisputeStatus = (status?: DisputeStatus): string => {
  switch (status) {
    case DisputeStatus.NEEDS_RESPONSE:
      return 'open';
    case DisputeStatus.UNDER_REVIEW:
      return 'submitted';
    case DisputeStatus.WON:
      return 'won';
    case DisputeStatus.LOST:
      return 'lost';
    default:
      return 'none';
  }
};

// Infer the import source from the order's current state
type ImportSource =
  | 'fraud'
  | 'dispute_open'
  | 'dispute_submitted'
  | 'dispute_won'
  | 'dispute_lost'
  | 'orders';

const inferImportSource = (order: Order): ImportSource => {
  switch (order.disputeStatus) {
    case DisputeStatus.NEEDS_RESPONSE:
      return 'dispute_open';
    case DisputeStatus.UNDER_REVIEW:
      return 'dispute_submitted';
    case DisputeStatus.WON:
      return 'dispute_won';
    case DisputeStatus.LOST:
      return 'dispute_lost';
    default:
      return order.isHighRisk ? 'fraud' : 'orders';
  }
};

/**
 * Save / merge orders into Supabase.
 *
 * - One row per (user_id, id) in public.orders.
 * - New imports *enrich* existing rows instead of overwriting:
 *   - dispute status escalates (none → open → submitted → won/lost)
 *   - risk stays high once set
 *   - sources JSON accumulates { fraud: true, dispute_open: true, ... }
 */
export const saveOrdersToDb = async (orders: Order[]) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[Storage] Error getting Supabase user:', userError);
    throw userError;
  }

  if (!user) {
    console.error('[Storage] No authenticated user – cannot save orders.');
    throw new Error('Not authenticated. Please sign in again before importing.');
  }

  if (!orders || orders.length === 0) {
    return;
  }

  console.log(
    `[Storage] Saving ${orders.length} orders for user ${user.id.slice(0, 8)}...`
  );

  const ids = orders.map((o) => o.id);

  // 1) Load existing rows for these orders so we can merge instead of overwrite.
  const { data: existingRows, error: loadError } = await supabase
    .from('orders')
    .select('id, latest_dispute_status, latest_risk_label, sources')
    .eq('user_id', user.id)
    .in('id', ids);

  if (loadError) {
    console.error('[Storage] Failed to load existing orders:', loadError);
    throw loadError;
  }

  const existingById = new Map<string, any>(
    (existingRows || []).map((row: any) => [row.id, row])
  );

  // 2) Build merged rows
  const upsertRows = orders.map((order) => {
    const existing = existingById.get(order.id);

    const prevStatus: string = existing?.latest_dispute_status || 'none';
    const newStatus: string = mapDisputeStatus(order.disputeStatus);
    const latestStatus =
      statusRank[newStatus] >= statusRank[prevStatus] ? newStatus : prevStatus;

    const prevRisk: string | null = existing?.latest_risk_label || null;
    const newRisk = order.isHighRisk ? 'high' : null;
    const latestRisk = newRisk || prevRisk;

    const prevSources = (existing?.sources as Record<string, boolean>) || {};
    const inferredSource = inferImportSource(order);
    const newSources: Record<string, boolean> = {
      ...prevSources,
      [inferredSource]: true,
    };

    return {
      user_id: user.id,
      id: order.id,
      latest_dispute_status: latestStatus,
      latest_risk_label: latestRisk,
      latest_dispute_amount: (order as any).disputedAmount ?? null,
      latest_dispute_currency: (order as any).currency ?? null,
      latest_dispute_deadline: (order as any).disputeDeadline ?? null,
      sources: newSources,
      data: order, // full JSON blob the app uses
      updated_at: new Date().toISOString(),
    };
  });

  // 3) Upsert: one row per (user_id, id) – this is what prevents duplicates
  const { error: upsertError } = await supabase
    .from('orders')
    .upsert(upsertRows, { onConflict: 'user_id,id' });

  if (upsertError) {
    console.error('[Storage] Failed to save orders to DB:', upsertError);
    throw upsertError;
  }

  console.log('[Storage] Successfully saved orders.');
};

/**
 * Load all orders for the current user from Supabase.
 * This matches your previous behaviour: returns the stored Order JSON.
 */
export const loadOrdersFromDb = async (): Promise<Order[]> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[Storage] Error getting Supabase user:', userError);
    throw userError;
  }

  if (!user) {
    console.warn('[Storage] No user when loading orders – returning empty list.');
    return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select('data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Storage] Failed to load orders from DB:', error);
    return [];
  }

  return (data || []).map((row: any) => row.data as Order);
};

/**
 * Clear ALL imported data for the current user.
 *
 * - Deletes rows from: disputes, order_imports, orders
 * - Does NOT drop tables or touch profiles (Shopify credentials).
 */
export const clearAllImportedData = async (): Promise<void> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[Storage] Error getting Supabase user:', userError);
    throw userError;
  }

  if (!user) {
    console.error('[Storage] No authenticated user – cannot clear data.');
    throw new Error('Not authenticated. Please sign in again.');
  }

  console.log(
    `[Storage] Clearing all imported data for user ${user.id.slice(0, 8)}...`
  );

  // 1) Clear disputes
  const { error: disputesError } = await supabase
    .from('disputes')
    .delete()
    .eq('user_id', user.id);

  if (disputesError) {
    console.error('[Storage] Failed to clear disputes:', disputesError);
    throw disputesError;
  }

  // 2) Clear order_imports (if you are using this table)
  const { error: importsError } = await supabase
    .from('order_imports')
    .delete()
    .eq('user_id', user.id);

  if (importsError) {
    console.error('[Storage] Failed to clear order_imports:', importsError);
    throw importsError;
  }

  // 3) Clear orders
  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .eq('user_id', user.id);

  if (ordersError) {
    console.error('[Storage] Failed to clear orders:', ordersError);
    throw ordersError;
  }

  console.log('[Storage] All imported data cleared for this user.');
};
