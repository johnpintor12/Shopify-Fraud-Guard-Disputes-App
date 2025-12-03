// src/services/storageService.ts
import { supabase } from '../lib/supabase';
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

  const ids = orders.map((o) => o.id);

  // 1) Load existing rows to merge
  const { data: existingRows, error: loadError } = await supabase
    .from('orders')
    .select('id, latest_dispute_status, latest_risk_label, sources')
    .eq('user_id', user.id)
    .in('id', ids);

  if (loadError) throw loadError;

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
      sources: newSources,
      data: order,
      updated_at: new Date().toISOString(),
    };
  });

  // 3) Upsert
  const { error: upsertError } = await supabase
    .from('orders')
    .upsert(upsertRows, { onConflict: 'user_id,id' });

  if (upsertError) throw upsertError;
};

export const loadOrdersFromDb = async (): Promise<Order[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Storage] Failed to load orders:', error);
    return [];
  }

  return (data || []).map((row: any) => row.data as Order);
};

export const clearAllImportedData = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  // 1) Clear disputes
  await supabase.from('disputes').delete().eq('user_id', user.id);
  
  // 2) Clear orders
  await supabase.from('orders').delete().eq('user_id', user.id);
};
