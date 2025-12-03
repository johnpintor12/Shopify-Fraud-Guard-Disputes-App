import React, { useMemo, useState, useEffect } from "react";
import { Order, TabType, DisputeStatus } from "../types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  X,
  Copy,
  Check,
  AlertTriangle,
  ScanSearch,
  Pencil,
  CheckCircle2
} from "lucide-react";
import { generateChargebackResponse } from "../services/geminiService";

interface OrderTableProps {
  orders: Order[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onValidate: () => void;
  onEdit?: (order: Order, updates: Partial<Order>) => void;
  onApprove?: (order: Order) => void;
}

const ROWS_PER_PAGE = 50;

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  activeTab,
  onTabChange,
  onValidate,
  onEdit,
  onApprove
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // AI Modal State
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ id: '', date: '', email: '', tags: '' });

  useEffect(() => {
    if (editingOrder) {
        setEditForm({
            id: editingOrder.id,
            date: editingOrder.date,
            email: editingOrder.customer.email,
            tags: editingOrder.tags.join(', ')
        });
    }
  }, [editingOrder]);

  const handleSaveEdit = () => {
      if (!editingOrder || !onEdit) return;
      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      onEdit(editingOrder, {
          id: editForm.id,
          date: editForm.date,
          customer: { ...editingOrder.customer, email: editForm.email },
          tags: tagsArray
      });
      setEditingOrder(null);
  };

  const handleGenerate = async (order: Order) => {
    setGeneratingId(order.id);
    try {
      const response = await generateChargebackResponse(order);
      setGeneratedLetter(response);
      setShowModal(true);
    } catch (error) {
      console.error(error);
      alert("Failed to generate response. Check API Key.");
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

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const tagString = Array.isArray(order.tags) ? order.tags.join(",") : "";
      const lowerTags = tagString.toLowerCase();
      const disputeStatus = (order.disputeStatus || "").toLowerCase();
      const riskFlag = (order.risk_category || "").toLowerCase();
      const importCategory = (order.import_category || "").toLowerCase();

      switch (activeTab) {
        case "RISK":
          return (
            (order.isHighRisk || riskFlag.includes("high") || lowerTags.includes("fraud") || importCategory.includes("risk")) &&
            importCategory !== 'invalid'
          );
        case "DISPUTES":
          return (
            (disputeStatus === 'needs response' || disputeStatus === 'under review' || importCategory.includes("dispute")) &&
            importCategory !== 'invalid'
          );
        case "HISTORY":
          return (
            (disputeStatus === 'won' || disputeStatus === 'lost' || importCategory.includes("dispute_won") || importCategory.includes("dispute_lost")) &&
            importCategory !== 'invalid'
          );
        case "QUARANTINE":
          return importCategory === 'invalid';
        case "ALL":
        default:
          return importCategory !== 'invalid';
      }
    });
  }, [orders, activeTab]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const sliceStart = (safePage - 1) * ROWS_PER_PAGE;
  const pageOrders = filtered.slice(sliceStart, sliceStart + ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [activeTab, total]);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const formatMoney = (order: Order) => {
    const amount = order.total || 0;
    const currency = order.currency || "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  };

  const getDisputeBadge = (order: Order) => {
    if (order.import_category === 'INVALID') {
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
                {/* SHOW ORIGINAL TYPE IF AVAILABLE */}
                {order.original_category && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100 mt-0.5">
                        Type: {displayCategory}
                    </span>
                )}
            </div>
        );
    }
    const status = order.disputeStatus;
    if (status === DisputeStatus.WON) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Won</span>;
    if (status === DisputeStatus.LOST) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">Lost</span>;
    if (status === DisputeStatus.NEEDS_RESPONSE) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Action required</span>;
    if (status === DisputeStatus.UNDER_REVIEW) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Under Review</span>;
    if (order.isHighRisk) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">High risk</span>;
    return <span className="text-xs text-zinc-400">No dispute</span>;
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      
      {/* EDIT MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-zinc-200 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-zinc-50 rounded-t-xl">
                    <h3 className="font-bold text-zinc-900">Edit Order Details</h3>
                    <button onClick={() => setEditingOrder(null)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Order ID</label>
                        <input value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                        <input value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Customer Email</label>
                        <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Tags</label>
                        <input value={editForm.tags} onChange={e => setEditForm({...editForm, tags: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                    </div>
                </div>
                <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex gap-3 justify-end rounded-b-xl">
                    <button onClick={() => setEditingOrder(null)} className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium">Cancel</button>
                    <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save & Validate</button>
                </div>
            </div>
        </div>
      )}

      {/* AI MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-zinc-900 font-bold text-lg"><Sparkles className="w-5 h-5 text-purple-600" /><h3>AI Rebuttal</h3></div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50">
               <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm text-sm font-mono whitespace-pre-wrap leading-relaxed">{generatedLetter}</div>
            </div>
            <div className="p-4 border-t border-zinc-200 bg-white flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-zinc-700 font-medium hover:bg-zinc-50 rounded-lg border border-zinc-300">Close</button>
              <button onClick={copyToClipboard} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors">{copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copySuccess ? "Copied!" : "Copy to Clipboard"}</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & FILTER */}
      <div className="flex-none border-b border-zinc-200 bg-zinc-50 px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-600"><AlertCircle className="w-4 h-4 text-amber-500" /><span>{total > 0 ? <strong>{total} orders in this view.</strong> : "No orders match this view yet."}</span></div>
      </div>
      <div className="flex-none border-b border-zinc-200 px-6 pt-3 pb-2 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: "RISK" as TabType, label: "Fraud Monitoring" },
              { id: "DISPUTES" as TabType, label: "Chargebacks" },
              { id: "HISTORY" as TabType, label: "Won / Lost" },
              { id: "ALL" as TabType, label: "All Orders" },
              { id: "QUARANTINE" as TabType, label: "Data Issues" },
            ].map((tab) => {
              if (tab.id === 'QUARANTINE' && !orders.some(o => o.import_category === 'INVALID')) return null;
              const isActive = activeTab === tab.id;
              const count = isActive ? filtered.length : undefined;
              return (
                <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`relative px-3 py-1.5 text-xs font-medium rounded-md border ${isActive ? "bg-white border-zinc-300 text-zinc-900 shadow-sm" : "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100"}`}>
                  <span>{tab.label}</span>
                  {count !== undefined && <span className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] border ${isActive ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-zinc-700"><Filter className="w-3 h-3" /> Filter</button>
            <button onClick={onValidate} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 text-blue-700 font-medium"><ScanSearch className="w-3 h-3" /> Validate Data</button>
          </div>
        </div>
      </div>

      {/* TABLE */}
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
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Actions</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Payment</th>
                  <th className="bg-[#f9fafb] px-4 py-2 text-left text-[11px] font-medium border-b border-zinc-200">Tags</th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {pageOrders.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-100 hover:bg-zinc-50 group">
                      <td className="px-4 py-2 align-middle"><input type="checkbox" className="rounded border-zinc-300"/></td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-900 font-medium">{order.id}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.date}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700"><div>{order.customer.name}</div><div className="text-[11px] text-zinc-400">{order.customer.email}</div></td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.channel || "Online Store"}</td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-900">{formatMoney(order)}</td>
                      <td className="px-4 py-2 align-middle">{getDisputeBadge(order)}</td>
                      <td className="px-4 py-2 align-middle">
                        {activeTab === 'QUARANTINE' && order.import_category === 'INVALID' ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setEditingOrder(order)} className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-600 border border-zinc-200" title="Edit Order"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onApprove && onApprove(order)} className="p-1.5 bg-green-50 hover:bg-green-100 rounded text-green-600 border border-green-200" title="Mark as Valid"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ) : (order.disputeStatus === DisputeStatus.NEEDS_RESPONSE || order.isHighRisk) && order.import_category !== 'INVALID' ? (
                          <button onClick={() => handleGenerate(order)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"><Sparkles className="w-3 h-3" /> Draft Rebuttal</button>
                        ) : <span className="text-zinc-300 text-[11px]">—</span>}
                      </td>
                      <td className="px-4 py-2 align-middle text-[13px] text-zinc-700">{order.paymentStatus}</td>
                      <td className="px-4 py-2 align-middle text-[12px] text-zinc-500 max-w-xs truncate">{Array.isArray(order.tags) ? order.tags.join(", ") : ""}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex-none border-t border-zinc-200 bg-white px-4 py-2 flex items-center justify-between text-xs text-zinc-600 z-10 relative">
        <div>Showing <span className="font-medium">{displayStart}–{displayEnd}</span> of <span className="font-medium">{total}</span> orders</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} disabled={safePage === 1} className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs hover:bg-zinc-50 disabled:opacity-50"><ChevronLeft className="w-3 h-3" /> Prev</button>
          <span className="text-[11px] text-zinc-500">Page {safePage} of {totalPages}</span>
          <button onClick={handleNext} disabled={safePage === totalPages} className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-xs hover:bg-zinc-50 disabled:opacity-50">Next <ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
};
