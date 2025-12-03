import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClearDataButtonProps {
  onCleared: () => void;
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onCleared }) => {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    const ok = window.confirm(
      'Are you sure? This will permanently delete ALL imported orders and disputes from the database.'
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        alert("Error: You must be logged in to delete data.");
        return;
      }

      console.log("Attempting purge for user:", user.id);

      // 1. Delete Disputes
      const { error: disputeError, count: disputeCount } = await supabase
        .from('disputes')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (disputeError) {
        console.error("Dispute delete error:", disputeError);
        throw new Error(`Failed to delete disputes: ${disputeError.message}`);
      }

      // 2. Delete Orders
      const { error: orderError, count: orderCount } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (orderError) {
        console.error("Order delete error:", orderError);
        throw new Error(`Failed to delete orders: ${orderError.message}`);
      }

      const totalDeleted = (disputeCount || 0) + (orderCount || 0);
      console.log(`Purge complete. Deleted ${totalDeleted} items.`);
      
      // Update UI
      onCleared();
      
      // Optional: Give feedback if it seemed to do nothing
      if (totalDeleted === 0) {
         alert("Database was already empty (0 items deleted).");
      }

    } catch (err: any) {
      console.error("Purge failed:", err);
      alert(`Error clearing data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClear}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 transition-colors"
    >
      {loading ? (
        <span>Processing...</span>
      ) : (
        <>
          <Trash2 className="w-3 h-3" />
          Purge All Data
        </>
      )}
    </button>
  );
};

export default ClearDataButton;
