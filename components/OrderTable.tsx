// Inside src/components/OrderTable.tsx -> getDisputeBadge function

  const getDisputeBadge = (order: Order) => {
    if (order.import_category === 'INVALID') {
        // Pretty formatting for the category name
        const displayCategory = order.original_category 
            ? order.original_category.replace('DISPUTE_', '').replace('_', ' ') 
            : 'Unknown';

        return (
            <div className="flex flex-col items-start gap-1 whitespace-normal max-w-[220px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Invalid Data
                </span>
                {order.import_error && (
                    <span className="text-[10px] text-red-600 leading-tight break-words">
                        {order.import_error}
                    </span>
                )}
                {/* NEW: SHOW ORIGINAL TYPE */}
                {order.original_category && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100 mt-0.5">
                        Type: {displayCategory}
                    </span>
                )}
            </div>
        );
    }
    // ... rest of function
