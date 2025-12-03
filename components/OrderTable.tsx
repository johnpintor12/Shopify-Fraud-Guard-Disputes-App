// src/components/OrderTable.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { Order, TabType, DisputeStatus } from '../types';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  activeTab,
  onTabChange,
  onRefresh,
}) => {
  const [page, setPage] = useState(1);

  // Reset to first page when tab or data changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, orders]);

  // Categorise orders for counts
  const {
    riskCount,
    openDisputesCount,
    historyCount,
    filteredOrders,
  } = useMemo(() => {
    let risk = 0;
    let open = 0;
    let history = 0;

    const inRisk = (o: Order) =>
      o.isHighRisk ||
      (o.tags && o.tags.some((t) => t.toLowerCase().includes('fraud')));

    const inOpenDisputes = (o: Order) =>
      o.disputeStatus === DisputeStatus.NEEDS_RESPONSE ||
      o.disputeStatus === DisputeStatus.UNDER_REVIEW;

    const inHistory = (o: Order) =>
      o.disputeStatus === DisputeStatus.WON ||
      o.disputeStatus === DisputeStatus.LOST;

    orders.forEach((o) => {
      if (inRisk(o)) risk++;
      if (inOpenDisputes(o)) open++;
      if (inHistory(o)) history++;
    });

    let filtered: Order[] = orders;
    switch (activeTab) {
      case 'RISK':
        filtered = orders.filter(inRisk);
        break;
      case 'DISPUTES':
        filtered = orders.filter(inOpenDisputes);
        break;
      case 'HISTORY':
        filtered = orders.filter(inHistory);
        break;
      case 'ALL':
      default:
        filtered = orders;
        break;
    }

    return {
      riskCount: risk,
      openDisputesCount: open,
      historyCount: history,
      filteredOrders: filtered,
    };
  }, [orders, activeTab]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PAGE_SIZE) || 1
  );
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleOrders = filteredOrders.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const handlePrev = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNext = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-tabs (like Shopify Fraud & Disputes) */}
      <div className="flex items-center gap-4 mb-3 border-b border-zinc-200 bg-white px-4 pt-2 pb-0 rounded-t-lg">
        <button
          type="button"
          onClick={() => onTabChange('RISK')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
            activeTab === 'RISK'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Fraud Monitoring
          {riskCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
              {riskCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('DISPUTES')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
            activeTab === 'DISPUTES'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Chargeback Monitoring
          {openDisputesCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
              {openDisputesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('HISTORY')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
            activeTab === 'HISTORY'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Won / Lost
          {historyCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('ALL')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
            activeTab === 'ALL'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          All Orders
          {orders.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
              {orders.length}
            </span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-3 pr-1">
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-zinc-500 hover:text-zinc-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table container with horizontal & vertical scroll */}
      <div className="flex-1 min-h-0 bg-white border border-zinc-200 rounded-b-lg rounded-t-none flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
              <tr className="text-xs text-zinc-500">
                <th className="w-10 px-4 py-2 text-left">
                  <input type="checkbox" disabled className="opacity-40" />
                </th>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">
                  Dispute Status
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Payment Status
                </th>
                <th className="px-4 py-2 text-left font-medium">Tags</th>
                <th className="px-4 py-2 text-left font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-zinc-400" />
                      <span>No orders in this view yet.</span>
                    </div>
                  </td>
                </tr>
              )}

              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50/60"
                >
                  <td className="px-4 py-3 align-middle">
                    <input type="checkbox" className="rounded border-zinc-300" />
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    <span className="font-medium text-zinc-900">
                      {order.name || order.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-zinc-500">
                    {order.createdAtFormatted || order.createdAt || '-'}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-zinc-700">
                    {order.customerName || order.customer_email || 'Guest'}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-right">
                    <span className="font-medium text-zinc-900">
                      {order.currency || '$'}
                      {Number(order.totalPrice || order.total_price || 0).toFixed(
                        2
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {order.disputeStatus === DisputeStatus.NEEDS_RESPONSE && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
                        Action Required
                      </span>
                    )}
                    {order.disputeStatus === DisputeStatus.UNDER_REVIEW && (
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-200">
                        Under Review
                      </span>
                    )}
                    {order.disputeStatus === DisputeStatus.WON && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                        Won
                      </span>
                    )}
                    {order.disputeStatus === DisputeStatus.LOST && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 border border-zinc-200">
                        Lost
                      </span>
                    )}
                    {order.disputeStatus === DisputeStatus.NONE && (
                      <span className="text-xs text-zinc-400">No dispute</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-zinc-600">
                    {order.financialStatus || order.financial_status || 'Paid'}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-zinc-500 max-w-xs">
                    {order.tags && order.tags.length > 0
                      ? order.tags.join(', ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {order.isHighRisk ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                        High Risk
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 text-xs text-zinc-600">
          <div>
            Showing{' '}
            <span className="font-semibold">
              {filteredOrders.length === 0
                ? 0
                : startIndex + 1}{' '}
              –
              {' '}
              {Math.min(startIndex + PAGE_SIZE, filteredOrders.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold">
              {filteredOrders.length}
            </span>{' '}
            orders
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3 h-3" />
              Prev
            </button>
            <span className="text-[11px] text-zinc-500">
              Page{' '}
              <span className="font-semibold">{currentPage}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { OrderTable };
