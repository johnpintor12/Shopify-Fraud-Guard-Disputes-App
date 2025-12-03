import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClearDataButtonProps {
  onCleared: () => void;
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onCleared }) => {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    const ok = window.confirm(
      'This will delete ALL imported orders from the database. Continue?'
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Delete rows from orders
      const { error } = await supabase.from('orders').delete().eq('user_id', user.id);
      if (error) throw error;
      
      // 2. Delete rows from disputes
      await supabase.from('disputes').delete().eq('user_id', user.id);

      onCleared();
    } catch (err) {
      console.error(err);
      alert('Failed to clear data.');
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
      <Trash2 className="w-3 h-3" />
      {loading ? 'Clearing…' : 'Purge All Data'}
    </button>
  );
};

export default ClearDataButton;
