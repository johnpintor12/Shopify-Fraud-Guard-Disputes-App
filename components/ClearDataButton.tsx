import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { clearAllImportedData } from '../services/storageService';

interface ClearDataButtonProps {
  onCleared?: () => void; // e.g. () => setOrders([])
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onCleared }) => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isClearing) return;

    const ok = window.confirm(
      'This will delete ALL imported orders, disputes, and import history for your account.\n\nYour Shopify connection and settings will be kept.\n\nDo you want to continue?'
    );
    if (!ok) return;

    setIsClearing(true);
    setError(null);

    try {
      await clearAllImportedData();
      if (onCleared) onCleared();
    } catch (err: any) {
      console.error('Failed to clear data:', err);
      setError(err?.message || 'Failed to clear data.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isClearing}
        className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
        {isClearing ? 'Clearing…' : 'Clear Imported Data'}
      </button>
      {error && (
        <p className="text-[10px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
};

export default ClearDataButton;
