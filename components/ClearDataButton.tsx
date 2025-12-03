import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ClearDataButtonProps {
  userId: string;
  onCleared?: () => void;
}

export const ClearDataButton: React.FC<ClearDataButtonProps> = ({
  userId,
  onCleared,
}) => {
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    if (!userId || isClearing) return;

    const confirmed = window.confirm(
      "This will permanently delete ALL imported orders and disputes for this account.\n\nThe tables remain, but your records will be wiped.\n\nAre you sure you want to continue?"
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      // Delete disputes first
      const { error: disputesError } = await supabase
        .from("disputes")
        .delete()
        .eq("user_id", userId);

      if (disputesError) throw disputesError;

      // Delete orders for this user
      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("user_id", userId);

      if (ordersError) throw ordersError;

      if (onCleared) onCleared();
      alert("All imported data has been cleared for this account.");
    } catch (err: any) {
      console.error("Failed to clear data", err);
      alert(
        "Failed to clear data from Supabase.\n\n" +
          (err?.message || "Unknown error.")
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-red-500">
        Danger zone
      </span>
      <button
        type="button"
        onClick={handleClear}
        disabled={isClearing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
                   border-red-300 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50
                   disabled:cursor-not-allowed"
        title="Clear all imported data for this account"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {isClearing ? "Clearing…" : "Clear imported data"}
      </button>
    </div>
  );
};
