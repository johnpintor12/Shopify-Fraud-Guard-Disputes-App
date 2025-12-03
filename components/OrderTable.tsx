// src/components/OrderTable.tsx
import React, { useMemo, useState, useEffect } from "react";
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

  // ---------- FILTERING (Tab logic) ----------
  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const o: any = order;
      const tagString: string =
        (o.tags && Array.isArray(o.tags) ? o.tags.join(",") : o.tags) || "";
      const lowerTags = tagString.toLowerCase();

      const disputeStatus = (
        o.dispute_status ||
        o.disputeStatus ||
        ""
      ).toLowerCase();
      const riskFlag = (o.risk_category || o.riskCategory || "").toLowerCase();
      const importCategory = (
        o.import_category ||
        o.importCategory ||
        ""
      ).toLowerCase();

      switch (activeTab) {
        case "RISK": {
          // High-risk / Fraud
          return (
            riskFlag.includes("high") ||
            lowerTags.includes("high risk") ||
            lowerTags.includes("fraud") ||
            importCategory.includes("risk") ||
            importCategory.includes("fraud")
          );
        }
        case "DISPUTES": {
          // Open / pending chargebacks
          return (
            disputeStatus.includes("open") ||
            disputeStatus.includes("pending") ||
            disputeStatus.includes("action required") ||
            importCategory.includes("dispute_open")
          );
        }
        case "HISTORY": {
          // Won / lost disputes
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

  // ---------- PAGINATION ----------
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

  const safePage = Math.min(currentPage, totalPages);
  const sliceStart = (safePage - 1) * ROWS_PER_PAGE;
  const sliceEnd = sliceStart + ROWS_PER_PAGE;
  const pageOrders = filtered.slice(sliceStart, sliceEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, total]);

  const handlePrev = () =>
    setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () =>
    setCurrentPage((p) => Math.min(totalPages, p + 1));

  const displayStart = total === 0 ? 0 : sliceStart + 1;
  const displayEnd =
    total === 0 ? 0 : Math.min(sliceEnd, total);

  // ---------- Helpers ----------
  const formatMoney = (order: Order) => {
    const o: any = order as any;
    const amount =
      o.total_price ||
      o.totalPrice ||
      o.current_total_price ||
      o.total ||
      0;
    const currency = o.currency || "USD";
    const n =
      typeof amount === "number"
        ? amount
        : parseFloat(String(amount) || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const getOrderName = (order: Order) => {
    const o: any = order;
    return (
      o.name ||
      o.order_name ||
      (o.order_number ? `#${o.order_number}` : null) ||
      (o.id ? `#${o.id}` : "—")
    );
  };

  const getCreatedAt = (order: Order) => {
    const o: any = order;
    const raw =
      o.created_at ||
      o.createdAt ||
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

  const getDisputeBadge = (order: Order) => {
    const o: any = order;
    const disputeStatus = (
      o.dispute_status ||
      o.disputeStatus ||
      ""
    ).toLowerCase();
    const importCategory = (
      o.import_category ||
      o.importCategory ||
      ""
    ).toLowerCase();

    // Won
    if (
      disputeStatus.includes("won") ||
      importCategory.includes("dispute_won")
    ) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          Won
        </span>
      );
    }

    // Lost
    if (
      disputeStatus.includes("lost") ||
      importCategory.includes("dispute_lost")
    ) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
          Lost
        </span>
      );
    }

    // Open / pending
    if (
      disputeStatus.includes("open") ||
      disputeStatus.includes("pending") ||
      disputeStatus.includes("action required") ||
      importCategory.includes("dispute_open")
    ) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Action required
        </span>
      );
    }

    // High-risk only
    const riskFlag = (o.risk_category || o.riskCategory || "").toLowerCase();
    const tags = (o.tags || "").toString().toLowerCase();
    if (
      riskFlag.includes("high") ||
      tags.includes("fraud") ||
      tags.includes("high risk")
    ) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
          High risk
        </span>
      );
    }

    return <span className="text-xs text-zinc-400">No dispute</span>;
  };

  const getTags = (order: Order) => {
    const o: any = order;
    if (Array.isArray(o.tags)) return o.tags.join(", ");
    return o.tags || "—";
  };

  const getChannel = (order: Order) => {
    const o: any = order;
    return (
      o.source_name ||
      o.source ||
      o.channel ||
      o.order_source ||
      "Online Store"
    );
  };

  const getPayment = (order: Order) => {
    const o: any = order;
    const gateway =
      o.gateway ||
      o.payment_gateway_names ||
      (o.payment &&
        (o.payment.gateway || o.payment.payment_gateway_names));
    const method = Array.isArray(gateway)
      ? gateway.join(", ")
      : gateway || "—";
    const risk = (o.risk_category || o.riskCategory || "").toString();
    if (risk && risk.toLowerCase().includes("high")) {
      return `${method} · High risk`;
    }
    return method;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-zinc-200 flex flex-col h-full overflow-hidden relative">
      {/* Top info bar (Shopify vibes) */}
      <div className="px-6 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>
            {total > 0 ? (
              <>
                <strong>{total}</strong> orders in this view. Use tags &
                dispute status to narrow down.
              </>
            ) : (
              <>No orders match this view yet.</>
            )}
          </span>
        </div>
      </div>

      {/* Tabs & actions */}
      <div className="border-b border-zinc-200 px-6 pt-3 pb-2 bg-white/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: "RISK" as TabType, label: "Fraud Monitoring" },
              { id: "DISPUTES" as TabType, label: "Chargeback Monitoring" },
              { id: "HISTORY" as TabType, label: "Won / Lost" },
              { id: "ALL" as TabType, label: "All Orders" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const count =
                isActive
                  ? filtered.length
                  : undefined;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md border ${
                    isActive
                      ? "bg-white border-zinc-300 text-zinc-900 shadow-[0_1px_0_rgba(15,23,42,0.06)]"
                      : "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof count === "number" && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] text-[10px] border ${
                        isActive
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
        {/* SCROLL CONTAINER (vertical + horizontal) */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-w-[1400px]">
            <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
              <thead className="bg-[#f9fafb] text-xs text-zinc-500 border-b border-zinc-200">
                <tr>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left w-10 border-b border-zinc-200">
                    <input type="checkbox" className="rounded border-zinc-300" />
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Order
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Date
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Customer
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Channel
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Total
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Dispute / Risk
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Payment
                  </th>
                  <th className="sticky top-0 z-10 bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {pageOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-zinc-500 border-t border-zinc-100"
                    >
                      No orders in this view.
                    </td>
                  </tr>
                ) : (
                  pageOrders.map((order) => {
                    const o: any = order;
                    return (
                      <tr
                        key={order.id || o.name || Math.random().toString(36)}
                        className="border-b border-zinc-100 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-2 align-middle">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300"
                          />
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-900">
                          <div className="font-medium">
                            {getOrderName(order)}
                          </div>
                          {o.email && (
                            <div className="text-[11px] text-zinc-500">
                              {o.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">
                          {getCreatedAt(order)}
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">
                          {getCustomer(order)}
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">
                          {getChannel(order)}
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-900">
                          {formatMoney(order)}
                        </td>
                        <td className="px-4 py-2 align-middle">
                          {getDisputeBadge(order)}
                        </td>
                        <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">
                          {getPayment(order)}
                        </td>
                        <td className="px-4 py-2 align-middle text-[12px] text-zinc-600 max-w-xs truncate">
                          {getTags(order)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer (ALWAYS visible inside card, not inside scroll) */}
        <div className="border-t border-zinc-200 bg-white px-4 py-2 flex items-center justify-between text-xs text-zinc-600 shrink-0">
          <div>
            Showing{" "}
            <span className="font-medium">
              {displayStart}–{displayEnd}
            </span>{" "}
            of <span className="font-medium">{total}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={safePage === 1}
              className={`inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs ${
                safePage === 1
                  ? "border-zinc-200 text-zinc-400 cursor-not-allowed bg-zinc-50"
                  : "border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50"
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </button>
            <span className="text-[11px] text-zinc-500">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={safePage === totalPages}
              className={`inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs ${
                safePage === totalPages
                  ? "border-zinc-200 text-zinc-400 cursor-not-allowed bg-zinc-50"
                  : "border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50"
              }`}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
