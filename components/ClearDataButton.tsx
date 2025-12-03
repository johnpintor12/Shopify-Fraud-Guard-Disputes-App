// src/components/ClearDataButton.tsx
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
      'This will delete ALL imported orders from the database (but keep the table). Continue?'
    );
    if (!ok) return;

    setLoading(true);
    try {
      // delete all rows from orders table
      const { error } = await supabase.from('orders').delete().neq('id', '');
      if (error) {
        console.error(error);
        alert('Failed to clear data. Check console for details.');
        return;
      }
      onCleared();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClear}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60"
    >
      <Trash2 className="w-3 h-3" />
      {loading ? 'Clearing…' : 'Clear imported data'}
    </button>
  );
};

export default ClearDataButton;
