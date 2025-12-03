// src/components/OrderTable.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Order, TabType, DisputeStatus } from "../types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  X,
  Copy,
  Check
} from "lucide-react";
import { generateChargebackResponse } from "../services/geminiService";

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
  
  // AI Modal State
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // ---------- AI ACTIONS ----------
  const handleGenerate = async (order: Order) => {
    setGeneratingId(order.id);
    try {
      const response = await generateChargebackResponse(order);
      setGeneratedLetter(response);
      setShowModal(true);
    } catch (error) {
      console.error(error);
      alert("Failed to generate response. Check your Gemini API Key.");
    } finally {
      setGeneratingId(null);
    }
  };

  const copyToClipboard = () => {
    if (generatedLetter) {
      navigator.clipboard.writeText(generatedLetter);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // ---------- FILTERING (Tab logic) ----------
  const filtered = useMemo(() => {
    return orders.filter((order) => {
      // STRICT TYPING: Access properties directly from Order interface
      const tagString = Array.isArray(order.tags) ? order.tags.join(",") : "";
      const lowerTags = tagString.toLowerCase();
      
      const disputeStatus = (order.disputeStatus || "").toLowerCase();
      const riskFlag = (order.risk_category || "").toLowerCase();
      const importCategory = (order.import_category || "").toLowerCase();

      switch (activeTab) {
        case "RISK":
          return (
            order.isHighRisk ||
            riskFlag.includes("high") ||
            lowerTags.includes("fraud") ||
            importCategory.includes("risk")
          );
        case "DISPUTES":
          return (
            disputeStatus === 'needs response' ||
            disputeStatus === 'under review' ||
            importCategory.includes("dispute_open")
          );
        case "HISTORY":
          return (
            disputeStatus === 'won' ||
            disputeStatus === 'lost' ||
            importCategory.includes("dispute_won") ||
            importCategory.includes("dispute_lost")
          );
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

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const displayStart = total === 0 ? 0 : sliceStart + 1;
  const displayEnd = total === 0 ? 0 : Math.min(sliceEnd, total);

  // ---------- Helpers ----------
  const formatMoney = (order: Order) => {
    const amount = order.total || 0;
    const currency = order.currency || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getDisputeBadge = (order: Order) => {
    const status = order.disputeStatus;

    if (status === DisputeStatus.WON) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Won</span>;
    }
    if (status === DisputeStatus.LOST) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">Lost</span>;
    }
    if (status === DisputeStatus.NEEDS_RESPONSE || status === DisputeStatus.UNDER_REVIEW) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Action required</span>;
    }
    if (order.isHighRisk) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">High risk</span>;
    }
    return <span className="text-xs text-zinc-400">No dispute</span>;
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      
      {/* --- AI GENERATION MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-zinc-900 font-bold text-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3>AI Rebuttal Draft</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50">
               <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm text-sm font-mono whitespace-pre-wrap leading-relaxed">
                 {generatedLetter}
               </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-white flex justify-end gap-3 rounded-b-xl">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-zinc-700 font-medium hover:bg-zinc-50 rounded-lg border border-zinc-300"
              >
                Close
              </button>
              <button 
                onClick={copyToClipboard}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copySuccess ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex-none border-b border-zinc-200 bg-zinc-50 px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>
             {total > 0 ? (
              <><strong>{total}</strong> orders in this view.</>
            ) : (
              <>No orders match this view yet.</>
            )}
          </span>
        </div>
      </div>

      <div className="flex-none border-b border-zinc-200 px-6 pt-3 pb-2 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: "RISK" as TabType, label: "Fraud Monitoring" },
              { id: "DISPUTES" as TabType, label: "Chargeback Monitoring" },
              { id: "HISTORY" as TabType, label: "Won / Lost" },
              { id: "ALL" as TabType, label: "All Orders" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const count = isActive ? filtered.length : undefined;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md border ${
                    isActive
                      ? "bg-white border-zinc-300 text-zinc-900 shadow-sm"
                      : "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] border ${
                        isActive ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-zinc-700">
              <Filter className="w-3 h-3" /> Filter
            </button>
            <button onClick={onRefresh} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-zinc-700">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* --- TABLE CONTENT --- */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-w-[1400px]"> 
          <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
            <thead className="bg-[#f9fafb] text-xs text-zinc-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left w-10 border-b border-zinc-200"><input type="checkbox" className="rounded border-zinc-300"/></th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Order</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Date</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Customer</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Channel</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Total</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Dispute / Risk</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">AI Actions</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Payment</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Tags</th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {pageOrders.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-500 border-t border-zinc-100">No orders in this view.</td></tr>
                ) : (
                  pageOrders.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-100 hover:bg-zinc-50 group">
                      <td className="px-4 py-2 align-middle"><input type="checkbox" className="rounded border-zinc-300"/></td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-900 font-medium">{order.id}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.date}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">
                         <div>{order.customer.name}</div>
                         <div className="text-[11px] text-zinc-400">{order.customer.email}</div>
                      </td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.channel || "Online Store"}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-900">{formatMoney(order)}</td>
                      <td className="px-4 py-2 align-middle">{getDisputeBadge(order)}</td>
                      
                      {/* --- NEW AI ACTION COLUMN --- */}
                      <td className="px-4 py-2 align-middle">
                        {(order.disputeStatus === DisputeStatus.NEEDS_RESPONSE || order.disputeStatus === DisputeStatus.UNDER_REVIEW || order.isHighRisk) ? (
                          <button
                            onClick={() => handleGenerate(order)}
                            disabled={generatingId === order.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-50"
                          >
                             {generatingId === order.id ? (
                               <>Generating...</>
                             ) : (
                               <><Sparkles className="w-3 h-3" /> Draft Rebuttal</>
                             )}
                          </button>
                        ) : (
                           <span className="text-zinc-300 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.paymentStatus}</td>
                      <td className="px-4 py-2 align-middle text-[12px] text-zinc-500 max-w-xs truncate">
                        {Array.isArray(order.tags) ? order.tags.join(", ") : ""}
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <div className="flex-none border-t border-zinc-200 bg-white px-4 py-2 flex items-center justify-between text-xs text-zinc-600 z-10 relative">
        <div>Showing <span className="font-medium">{displayStart}–{displayEnd}</span> of <span className="font-medium">{total}</span> orders</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} disabled={safePage === 1} className={`inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs ${safePage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-50"}`}>
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span className="text-[11px] text-zinc-500">Page {safePage} of {totalPages}</span>
          <button onClick={handleNext} disabled={safePage === totalPages} className={`inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs ${safePage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-50"}`}>
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      
    </div>
  );
};
