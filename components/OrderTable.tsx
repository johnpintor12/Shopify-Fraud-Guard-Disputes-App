import React, { useState, useMemo } from 'react';
import { Order, DisputeStatus, TabType } from '../types';
import { Filter, Archive, ChevronDown, Eye, FileText, AlertTriangle, Scale, Clock, CheckCircle, XCircle, AlertOctagon, ListFilter, Upload, Save, Check } from 'lucide-react';
import { generateChargebackResponse } from '../services/geminiService';
import { saveDisputeDraft } from '../services/disputeService';

interface OrderTableProps {
  orders: Order[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onRefresh?: () => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({ orders, activeTab, onTabChange, onRefresh }) => {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{id: string, text: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleOrder = (id: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrders(newSelected);
  };

  const handleGenerateResponse = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    
    // Check if we already have a saved draft locally
    if (order.savedDispute) {
      setAnalysisResult({ id: order.id, text: order.savedDispute.rebuttal_text });
      return;
    }

    setAnalyzingId(order.id);
    const result = await generateChargebackResponse(order);
    setAnalysisResult({ id: order.id, text: result });
    setAnalyzingId(null);
  };

  const handleSaveDraft = async () => {
    if (!analysisResult) return;
    setSaving(true);
    try {
      await saveDisputeDraft(analysisResult.id, analysisResult.text);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      if (onRefresh) onRefresh(); // Refresh parent to get new DB status
    } catch (err) {
      alert("Failed to save draft to database.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const closeAnalysis = () => setAnalysisResult(null);

  // Filter Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      switch (activeTab) {
        case 'RISK':
          return order.isHighRisk || order.tags.some(t => t.toLowerCase().includes('fraud')) || order.disputeStatus !== DisputeStatus.NONE;
        case 'DISPUTES':
          return order.disputeStatus === DisputeStatus.NEEDS_RESPONSE || order.disputeStatus === DisputeStatus.UNDER_REVIEW || !!order.savedDispute;
        case 'HISTORY':
          return order.disputeStatus === DisputeStatus.WON || order.disputeStatus === DisputeStatus.LOST;
        case 'ALL':
        default:
          return true;
      }
    });
  }, [orders, activeTab]);

  // Counters
  const counts = useMemo(() => {
    return {
      risk: orders.filter(o => o.isHighRisk || o.tags.some(t => t.toLowerCase().includes('fraud'))).length,
      disputes: orders.filter(o => o.disputeStatus === DisputeStatus.NEEDS_RESPONSE || o.disputeStatus === DisputeStatus.UNDER_REVIEW || !!o.savedDispute).length,
      history: orders.filter(o => o.disputeStatus === DisputeStatus.WON || o.disputeStatus === DisputeStatus.LOST).length,
      urgent: orders.filter(o => o.disputeStatus === DisputeStatus.NEEDS_RESPONSE).length
    };
  }, [orders]);

  const getDisputeBadge = (order: Order) => {
    if (order.savedDispute) {
       return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"><FileText className="w-3 h-3"/> Draft Saved</span>;
    }

    switch (order.disputeStatus) {
      case DisputeStatus.NEEDS_RESPONSE: 
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"><AlertTriangle className="w-3 h-3"/> Action Required</span>;
      case DisputeStatus.UNDER_REVIEW:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"><Clock className="w-3 h-3"/> Under Review</span>;
      case DisputeStatus.WON:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"><CheckCircle className="w-3 h-3"/> Won</span>;
      case DisputeStatus.LOST:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200"><XCircle className="w-3 h-3"/> Lost</span>;
      default:
        return <span className="text-zinc-400">-</span>;
    }
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'RISK', label: 'Fraud Monitoring', count: counts.risk },
    { id: 'DISPUTES', label: 'Chargeback Monitoring', count: counts.disputes },
    { id: 'HISTORY', label: 'Won/Lost', count: counts.history },
    { id: 'ALL', label: 'All Orders' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-zinc-200 flex flex-col h-full overflow-hidden relative">
      {/* Analysis Modal */}
      {analysisResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeAnalysis}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 border border-zinc-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 rounded-t-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Chargeback Rebuttal Draft</h3>
                  <p className="text-xs text-zinc-500">
                    {orders.find(o => o.id === analysisResult.id)?.savedDispute ? "Loading saved draft..." : `Automated evidence gathering for Order ${analysisResult.id}`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <textarea 
                 className="w-full h-full min-h-[300px] p-4 border border-zinc-300 rounded-lg font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none"
                 value={analysisResult.text}
                 onChange={(e) => setAnalysisResult({...analysisResult, text: e.target.value})}
              />
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 rounded-b-xl flex justify-between items-center shrink-0">
              <span className="text-xs text-zinc-500">
                {savedSuccess ? "Draft Saved!" : "Review and edit before saving."}
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={closeAnalysis}
                  className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors ${
                    savedSuccess 
                    ? 'bg-green-600 text-white border border-green-700' 
                    : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {savedSuccess ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(analysisResult.text);
                    closeAnalysis();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Copy & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section (Fixed) */}
      <div className="flex-none bg-white z-20">
        {/* Urgent Action Banner */}
        {counts.urgent > 0 && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {counts.urgent} Dispute{counts.urgent !== 1 ? 's' : ''} require{counts.urgent === 1 ? 's' : ''} your attention
              </p>
              <p className="text-xs text-red-600">Response deadlines are approaching. Use the AI drafter to reply quickly.</p>
            </div>
            <button 
              onClick={() => onTabChange('DISPUTES')}
              className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-medium rounded hover:bg-red-50 shadow-sm"
            >
              View Disputes
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 overflow-x-auto bg-zinc-50/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-zinc-500 border-transparent hover:text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters Bar */}
        <div className="p-3 border-b border-zinc-200 flex items-center justify-between gap-4 bg-white">
          <div className="relative flex-1 max-w-md">
             <input 
               type="text" 
               placeholder="Filter orders..." 
               className="w-full pl-8 pr-4 py-1.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
             />
             <Filter className="w-4 h-4 text-zinc-400 absolute left-2.5 top-2" />
          </div>
        </div>
      </div>

      {/* Table Section (Scrollable) */}
      <div className="flex-1 overflow-auto min-h-0 relative">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3 w-10 text-center bg-zinc-50">
                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
              </th>
              <th className="p-3 bg-zinc-50">Order</th>
              <th className="p-3 bg-zinc-50">Date</th>
              <th className="p-3 bg-zinc-50">Customer</th>
              <th className="p-3 bg-zinc-50">Total</th>
              <th className="p-3 bg-zinc-50">Dispute Status</th>
              <th className="p-3 bg-zinc-50">Payment</th>
              <th className="p-3 bg-zinc-50">Fulfillment</th>
              <th className="p-3 bg-zinc-50">Tags</th>
              <th className="p-3 text-right bg-zinc-50">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className={`group hover:bg-zinc-50 transition-colors ${selectedOrders.has(order.id) ? 'bg-zinc-50' : ''}`}
                  onClick={() => toggleOrder(order.id)}
                >
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrder(order.id)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" 
                    />
                  </td>
                  <td className="p-3 font-semibold text-zinc-900 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      {order.id}
                      {order.channel === 'CSV Import' && (
                        <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1 rounded border border-zinc-200">CSV</span>
                      )}
                      {order.isHighRisk && (
                        <div className="w-2 h-2 rounded-full bg-red-500" title="Flagged High Risk by Shopify"></div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-500">{order.date}</td>
                  <td className="p-3 text-zinc-900">{order.customer.name}</td>
                  <td className="p-3 text-zinc-900">${order.total.toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      {getDisputeBadge(order)}
                      {order.disputeDeadline && !order.savedDispute && (
                        <span className="text-[10px] text-red-600 font-medium mt-1">{order.disputeDeadline}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-500">{order.paymentStatus}</td>
                  <td className="p-3 text-zinc-500">{order.fulfillmentStatus}</td>
                  <td className="p-3">
                     <div className="flex gap-1">
                       {order.tags.length > 0 ? order.tags.map(tag => (
                         <span key={tag} className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-xs text-zinc-600">
                           {tag}
                         </span>
                       )) : <span className="text-zinc-300 text-xs italic">No tags</span>}
                     </div>
                  </td>
                  <td className="p-3 text-right">
                    {order.disputeStatus === DisputeStatus.NEEDS_RESPONSE || order.savedDispute ? (
                      <button 
                        className={`text-xs px-3 py-1.5 rounded-md border shadow-sm flex items-center gap-1 ml-auto ${
                          order.savedDispute 
                          ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                          : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        onClick={(e) => handleGenerateResponse(e, order)}
                        disabled={analyzingId === order.id}
                      >
                        {analyzingId === order.id ? (
                          <span className="animate-pulse">Loading...</span>
                        ) : (
                          <>
                             <FileText className="w-3 h-3" />
                             {order.savedDispute ? 'Edit Rebuttal' : 'Draft Rebuttal'}
                          </>
                        )}
                      </button>
                    ) : (
                      <button className="text-xs px-3 py-1.5 rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1 ml-auto">
                        <Eye className="w-3 h-3" /> Details
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="p-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3 text-zinc-400">
                      <ListFilter className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-zinc-900">No orders found in this view</p>
                    <div className="flex gap-3 mt-4">
                      {activeTab !== 'ALL' && (
                        <button 
                          onClick={() => onTabChange('ALL')}
                          className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 shadow-sm"
                        >
                          View All Orders
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
