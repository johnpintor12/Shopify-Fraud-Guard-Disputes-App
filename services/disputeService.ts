import { supabase } from '../lib/supabase';
import { SavedDispute } from '../types';

export const saveDisputeDraft = async (orderId: string, text: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if draft exists
  const { data: existing } = await supabase
    .from('disputes')
    .select('id')
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // Update
    return await supabase
      .from('disputes')
      .update({ rebuttal_text: text, status: 'Draft', updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    // Insert
    return await supabase
      .from('disputes')
      .insert({
        user_id: user.id,
        order_id: orderId,
        rebuttal_text: text,
        status: 'Draft'
      });
  }
};

export const fetchSavedDisputes = async (): Promise<SavedDispute[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error("Error fetching disputes:", error);
    return [];
  }

  return data as SavedDispute[];
};

export const saveUserProfile = async (domain: string, token: string, apiKey: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert profile
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      shopify_domain: domain,
      shopify_access_token: token,
      gemini_api_key: apiKey,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
};

export const fetchUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return data;
};