// src/services/alertService.ts
import { supabase } from '../lib/supabase';
import { Alert } from '../types';

export const fetchAlerts = async (): Promise<Alert[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50); // Keep the last 50 alerts

  if (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }

  return data as Alert[];
};

export const createAlert = async (
  title: string, 
  message: string, 
  type: 'success' | 'error', 
  details?: any
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Format details safely
  let detailString = details;
  if (typeof details === 'object') {
    try {
      detailString = JSON.stringify(details, null, 2);
    } catch (e) {
      detailString = String(details);
    }
  }

  const newAlert = {
    user_id: user.id,
    title,
    message,
    type,
    details: detailString || null,
    read: false,
    created_at: new Date().toISOString(),
  };

  // Save to DB
  const { data, error } = await supabase
    .from('alerts')
    .insert(newAlert)
    .select()
    .single();

  if (error) {
    console.error('Failed to save alert:', error);
    return null;
  }

  return data as Alert;
};

export const markAlertsRead = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('alerts')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);
};

export const clearAlerts = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('alerts')
    .delete()
    .eq('user_id', user.id);
};
