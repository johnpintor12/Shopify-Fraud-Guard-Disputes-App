import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClearDataButtonProps {
  onCleared: () => void;
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onCleared }) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
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

      if (disputeError) throw new Error(disputeError.message);

      // 2. Delete Orders
      const { error: orderError, count: orderCount } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (orderError) throw new Error(orderError.message);

      const totalDeleted = (disputeCount || 0) + (orderCount || 0);
      console.log(`Purge complete. Deleted ${totalDeleted} items.`);
      
      // Update UI
      setShowModal(false);
      onCleared();

    } catch (err: any) {
      console.error("Purge failed:", err);
      alert(`Error clearing data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Purge All Data
      </button>

      {/* CONFIRMATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
              <div className="bg-white p-2 rounded-full shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-900">Delete all data?</h3>
                <p className="text-xs text-red-700 opacity-80">This action cannot be undone.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                disabled={loading}
                className="ml-auto text-red-400 hover:text-red-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-zinc-600 leading-relaxed">
                You are about to permanently remove <strong>all imported orders</strong> and <strong>dispute drafts</strong> from your database.
              </p>
              <div className="mt-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-500">
                Your Shopify Store connection and API keys will <strong>not</strong> be deleted.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-100 transition-colors shadow-sm text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>Yes, Delete Everything</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClearDataButton;
