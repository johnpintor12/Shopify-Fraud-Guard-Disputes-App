import React, { useMemo, useState } from "react";
import { Order, TabType } from "../types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";

interface OrderTableProps {
  orders: Order[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onRefresh: () => void;
}

const ROWS_PER_PAGE = 50;

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  activeTab,
  onTabChange,
  onRefresh,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // --- Filtering logic -------------------------------------------------------

  const filtered = useMemo(() => {
    // NOTE: we use very defensive access because I don't want to fight TS
    // against your existing Order type. We'll just peek via `any`.
    return orders.filter((order) => {
      const o: any = order;
      const tagString: string =
        (o.tags && Array.isArray(o.tags) ? o.tags.join(",") : o.tags) || "";
      const disputeStatus = (o.dispute_status || o.disputeStatus || "").toLowerCase();
      const riskFlag = (o.risk_category || o.riskCategory || "").toLowerCase();
      const importCategory = (o.import_category || o.importCategory || "").toLowerCase();

      switch (activeTab) {
        case "RISK": {
          // High-risk & fraud view: anything explicitly marked high risk
          return (
            riskFlag.includes("high") ||
            tagString.toLowerCase().includes("high risk") ||
            tagString.toLowerCase().includes("fraud")
          );
        }
        case "DISPUTES": {
          // Open Chargebacks only
          return (
            disputeStatus.includes("open") ||
            disputeStatus.includes("pending") ||
            importCategory.includes("dispute_open")
          );
        }
        case "HISTORY": {
          // Won / Lost
          return (
            disputeStatus.includes("won") ||
            disputeStatus.includes("lost") ||
            importCategory.includes("dispute_won") ||
            importCategory.includes("dispute_lost")
          );
        }
        case "ALL":
        default:
          return true;
      }
    });
  }, [orders, activeTab]);

  // --- Pagination ------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));

  const pageSafe = Math.min(currentPage, totalPages);
  const startIndex = (pageSafe - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const pageSlice = filtered.slice(startIndex, endIndex);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Reset to page 1 when tab changes or data size shrinks
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filtered.length]);

  // --- Helpers ---------------------------------------------------------------

  const formatMoney = (order: Order) => {
    const o: any = order as any;
    const amount =
      o.total_price ||
      o.totalPrice ||
      o.current_total_price ||
      o.total ||
      0;
    const currency = o.currency || "USD";
    const n = typeof amount === "number" ? amount : parseFloat(String(amount) || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (order: Order) => {
    const o: any = order as any;
    const raw =
      o.created_at || o.createdAt || o.processed_at || o.date || null;
    if (!raw) return "—";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getOrderNumber = (order: Order) => {
    const o: any = order as any;
    return (
      o.name ||
      o.order_name ||
      o.orderNumber ||
      `#${o.id ?? ""}`.trim() ||
      "—"
    );
  };

  const getCustomer = (order: Order) => {
    const o: any = order as any;
    return (
      o.customer_name ||
      (o.customer && `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim()) ||
      o.email ||
      "Guest"
    );
  };

  const getDisputeStatus = (order: Order) => {
    const o: any = order as any;
    return o.dispute_status || o.disputeStatus || "";
  };

  const getPaymentStatus = (order: Order) => {
    const o: any = order as any;
    return (
      o.payment_status ||
      (o.financial_status && String(o.financial_status).replace("_", " ")) ||
      ""
    );
  };

  const getFulfillmentStatus = (order: Order) => {
    const o: any = order as any;
    return (
      o.fulfillment_status ||
      (o.fulfillment_status_label ?? "").replace("_", " ") ||
      ""
    );
  };

  const getChannel = (order: Order) => {
    const o: any = order as any;
    return o.channel || o.source_name || "Online Store";
  };

  const getItemsCount = (order: Order) => {
    const o: any = order as any;
    return o.items_count || o.line_items_count || o.items || "";
  };

  const getDestination = (order: Order) => {
    const o: any = order as any;
    const s = o.shipping_address || o.shippingAddress;
    if (!s) return "";
    const pieces = [s.city, s.province_code || s.province, s.country_code || s.country]
      .filter(Boolean)
      .join(", ");
    return pieces;
  };

  const getTags = (order: Order) => {
    const o: any = order as any;
    if (Array.isArray(o.tags)) return o.tags.join(", ");
    return o.tags || "";
  };

  // --- Render ----------------------------------------------------------------

  return (
    <section className="flex-1 flex flex-col bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      {/* Top banner like Shopify */}
      <div className="border-b border-zinc-200 bg-[#fff7f7] px-6 py-3 flex items-start gap-3">
        <div className="mt-0.5">
          <AlertCircle className="w-4 h-4 text-red-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">
            {filtered.length} Disputes require your attention
          </p>
          <p className="text-xs text-red-500">
            Response deadlines are approaching. Use the AI drafter to reply
            quickly.
          </p>
        </div>
        <button className="text-xs px-3 py-1.5 border border-red-200 rounded-md text-red-600 font-medium bg-white hover:bg-red-50">
          View Disputes
        </button>
      </div>

      {/* Tabs & filter bar */}
      <div className="border-b border-zinc-200 px-6 pt-3 pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: "RISK" as TabType, label: "Fraud Monitoring" },
              { id: "DISPUTES" as TabType, label: "Chargeback Monitoring" },
              { id: "HISTORY" as TabType, label: "Won/Lost" },
              { id: "ALL" as TabType, label: "All Orders" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              // badge count is filtered by tab, so we show `filtered.length`
              const count =
                activeTab === tab.id
                  ? filtered.length
                  : undefined;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md border ${
                    active
                      ? "bg-white border-zinc-300 text-zinc-900 shadow-[0_1px_0_rgba(15,23,42,0.06)]"
                      : "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof count === "number" && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] text-[10px] border ${
                        active
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-zinc-700"
            >
              <Filter className="w-3 h-3" />
              Filter orders…
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-zinc-700"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main scrollable region */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scroll container — vertical + horizontal */}
        <div className="flex-1 min-h-0 overflow-auto">
          {/* This min-width forces a horizontal scrollbar like Shopify when many columns */}
          <div className="min-w-[1400px]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-[#f9fafb] text-xs text-zinc-500 border-b border-zinc-200">
                <tr>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left w-10 border-b border-zinc-200">
                    <input type="checkbox" className="rounded border-zinc-300" />
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Order
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Channel
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Total
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Payment status
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Fulfillment status
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Items
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Date
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Customer
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Tags
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Destination
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Dispute status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((order, idx) => {
                  const disputeStatus = getDisputeStatus(order);
                  const paymentStatus = getPaymentStatus(order);
                  const fulfillmentStatus = getFulfillmentStatus(order);

                  const highlight =
                    activeTab === "DISPUTES" ||
                    disputeStatus.toLowerCase().includes("action") ||
                    disputeStatus.toLowerCase().includes("required");

                  return (
                    <tr
                      key={(order as any).id ?? idx}
                      className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/60"
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600 whitespace-nowrap">
                        {getOrderNumber(order)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                        {getChannel(order)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-900 whitespace-nowrap">
                        {formatMoney(order)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-700">
                          {paymentStatus || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-700">
                          {fulfillmentStatus || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                        {getItemsCount(order) || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                        {formatDate(order)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-700 whitespace-nowrap">
                        {getCustomer(order)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                        {getTags(order)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                        {getDestination(order)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {disputeStatus ? (
                          <button
                            className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-full text-[11px] min-w-[7rem] border ${
                              highlight
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-zinc-100 text-zinc-700 border-zinc-200"
                            }`}
                          >
                            <span className="font-medium">
                              {disputeStatus}
                            </span>
                            {highlight && (
                              <span className="text-[10px] text-rose-500 pt-0.5">
                                Review Data
                              </span>
                            )}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}

                {pageSlice.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-10 text-center text-sm text-zinc-500"
                    >
                      No orders in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination footer (like Shopify 1–50) */}
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <span>
              {filtered.length === 0
                ? "0 orders"
                : `${startIndex + 1}-${Math.min(
                    endIndex,
                    filtered.length
                  )} of ${filtered.length}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={pageSafe === 1}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-zinc-300 bg-white disabled:opacity-40 hover:bg-zinc-100"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="px-2">
              Page {pageSafe} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={pageSafe === totalPages}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-zinc-300 bg-white disabled:opacity-40 hover:bg-zinc-100"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
