import React, { useMemo, useState, useEffect } from "react";
import { Order, TabType } from "../types";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface OrderTableProps {
  orders: Order[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

// Classification helpers – we rely on flexible fields so it works
// for both Shopify API and CSV imports.
const isRiskOrder = (order: Order) => {
  const o: any = order;
  const cat = (o.import_category || "").toString().toUpperCase();
  const risk = (o.risk_level || o.riskCategory || "").toString().toUpperCase();
  const tags = (
    Array.isArray(o.tags)
      ? o.tags.join(",")
      : (o.tags || "").toString()
  ).toUpperCase();

  if (cat === "RISK" || cat === "FRAUD") return true;
  if (risk.includes("HIGH") || risk.includes("FRAUD")) return true;
  if (tags.includes("FRAUD") || tags.includes("HIGH RISK")) return true;
  return false;
};

const isOpenDispute = (order: Order) => {
  const o: any = order;
  const cat = (o.import_category || "").toString().toUpperCase();
  const status = (o.dispute_status || "").toString().toUpperCase();
  return (
    cat === "DISPUTE_OPEN" ||
    status.includes("OPEN") ||
    status.includes("PENDING") ||
    status.includes("ACTION REQUIRED")
  );
};

const isHistoryDispute = (order: Order) => {
  const o: any = order;
  const cat = (o.import_category || "").toString().toUpperCase();
  const status = (o.dispute_status || "").toString().toUpperCase();
  return (
    cat === "DISPUTE_WON" ||
    cat === "DISPUTE_LOST" ||
    status.includes("WON") ||
    status.includes("LOST")
  );
};

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  activeTab,
  onTabChange,
  onRefresh,
}) => {
  const [page, setPage] = useState(1);

  // Counts for badges
  const riskCount = useMemo(
    () => orders.filter(isRiskOrder).length,
    [orders]
  );
  const openCount = useMemo(
    () => orders.filter(isOpenDispute).length,
    [orders]
  );
  const historyCount = useMemo(
    () => orders.filter(isHistoryDispute).length,
    [orders]
  );

  const allCount = orders.length;

  // Filter for active tab
  const filtered = useMemo(() => {
    switch (activeTab) {
      case "RISK":
        return orders.filter(isRiskOrder);
      case "DISPUTES":
        return orders.filter(isOpenDispute);
      case "HISTORY":
        return orders.filter(isHistoryDispute);
      case "ALL":
      default:
        return orders;
    }
  }, [orders, activeTab]);

  // Reset to first page when tab/data changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, filtered.length]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const startIndex = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = total === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, total);

  const pageOrders = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * PAGE_SIZE,
        (currentPage - 1) * PAGE_SIZE + PAGE_SIZE
      ),
    [filtered, currentPage]
  );

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  // Helpers for display (defensive, works with many shapes)
  const getOrderName = (order: Order) => {
    const o: any = order;
    return (
      o.name ||
      o.order_name ||
      (o.order_number ? `#${o.order_number}` : null) ||
      (o.id ? `#${o.id}` : "—")
    );
  };

  const getCreated = (order: Order) => {
    const o: any = order;
    const raw =
      o.createdAt ||
      o.created_at ||
      o.processed_at ||
      o.order_created_at ||
      o.date ||
      null;
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCustomer = (order: Order) => {
    const o: any = order;
    if (o.customer_name) return o.customer_name;
    if (o.customerName) return o.customerName;
    if (o.customer && (o.customer.first_name || o.customer.last_name)) {
      return `${o.customer.first_name || ""} ${
        o.customer.last_name || ""
      }`.trim();
    }
    if (o.email) return o.email;
    return "Guest";
  };

  const getTotalFormatted = (order: Order) => {
    const o: any = order;
    const currency = o.currency || "USD";
    const raw =
      o.total_price ||
      o.total ||
      o.current_total_price ||
      o.subtotal_price ||
      0;
    const num = typeof raw === "number" ? raw : parseFloat(String(raw) || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getDisputeStatus = (order: Order) => {
    const o: any = order;
    return o.dispute_status || "";
  };

  const getPaymentStatus = (order: Order) => {
    const o: any = order;
    return (
      o.payment_status ||
      (o.financial_status && String(o.financial_status).replace("_", " ")) ||
      ""
    );
  };

  const getFulfillmentStatus = (order: Order) => {
    const o: any = order;
    return (
      o.fulfillment_status ||
      (o.fulfillment_status_label &&
        String(o.fulfillment_status_label).replace("_", " ")) ||
      ""
    );
  };

  const getTags = (order: Order) => {
    const o: any = order;
    if (Array.isArray(o.tags)) return o.tags as string[];
    if (typeof o.tags === "string") {
      return o.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    }
    return [] as string[];
  };

  const isCsvImport = (order: Order) => {
    const o: any = order;
    return !!o.csv_source || !!o.is_csv;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Card wrapper */}
      <div className="flex-1 min-h-0 bg-white border border-zinc-200 rounded-lg flex flex-col overflow-hidden">
        {/* Tabs row */}
        <div className="border-b border-zinc-200 bg-[#fafafb] px-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm font-medium">
              <button
                type="button"
                onClick={() => onTabChange("RISK")}
                className={`pb-2 border-b-2 ${
                  activeTab === "RISK"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Fraud Monitoring
                <span className="ml-2 inline-flex h-5 min-w-[24px] items-center justify-center rounded-full bg-zinc-200 text-[11px]">
                  {riskCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange("DISPUTES")}
                className={`pb-2 border-b-2 ${
                  activeTab === "DISPUTES"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Chargeback Monitoring
                <span className="ml-2 inline-flex h-5 min-w-[24px] items-center justify-center rounded-full bg-zinc-200 text-[11px]">
                  {openCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange("HISTORY")}
                className={`pb-2 border-b-2 ${
                  activeTab === "HISTORY"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Won/Lost
                <span className="ml-2 inline-flex h-5 min-w-[24px] items-center justify-center rounded-full bg-zinc-200 text-[11px]">
                  {historyCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange("ALL")}
                className={`pb-2 border-b-2 ${
                  activeTab === "ALL"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                All Orders
                <span className="ml-2 inline-flex h-5 min-w-[24px] items-center justify-center rounded-full bg-zinc-200 text-[11px]">
                  {allCount}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="text-xs text-zinc-500 hover:text-zinc-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filter bar (UI only for now) */}
        <div className="border-b border-zinc-200 px-4 py-3 bg-[#fafafb]">
          <input
            className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            placeholder="Filter orders…"
            disabled
          />
        </div>

        {/* Scrollable table area */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-w-[1200px]">
            {total === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-500">
                <div className="mb-3 rounded-full bg-zinc-100 p-3">
                  <AlertCircle className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="font-medium mb-1">
                  No orders found in this view
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange("ALL")}
                  className="mt-3 inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  View All Orders
                </button>
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-[#f7f7f8] text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left w-[40px]">
                      {/* checkbox header */}
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Order
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Date
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Customer
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-right">
                      Total
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Dispute Status
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Payment
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Fulfillment
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-left">
                      Tags
                    </th>
                    <th className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pageOrders.map((order, idx) => {
                    const o: any = order;
                    const disputeStatus = getDisputeStatus(order);
                    const tags = getTags(order);
                    const highlight =
                      isOpenDispute(order) || disputeStatus.toUpperCase().includes("ACTION");

                    return (
                      <tr
                        key={o.id || o.order_id || getOrderName(order) || idx}
                        className="hover:bg-[#fafafa]"
                      >
                        <td className="px-4 py-3 border-b border-zinc-200 w-[40px]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm font-medium text-blue-600">
                          {getOrderName(order)}
                          {isCsvImport(order) && (
                            <span className="ml-2 inline-flex items-center rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                              CSV
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm text-zinc-600">
                          {getCreated(order)}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm text-zinc-700">
                          {getCustomer(order)}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm text-zinc-700 text-right">
                          {getTotalFormatted(order)}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap">
                          {disputeStatus ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${
                                highlight
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-200"
                              }`}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              {disputeStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm text-zinc-600">
                          {getPaymentStatus(order) || "-"}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm text-zinc-600">
                          {getFulfillmentStatus(order) || "-"}
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-sm">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 border-b border-zinc-200 whitespace-nowrap text-right text-xs text-blue-600">
                          Review Data
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer: pagination summary */}
        <div className="h-10 border-t border-zinc-200 bg-white px-4 flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing {startIndex} – {endIndex} of {total} orders
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentPage === totalPages || total === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
