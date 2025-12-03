// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { OrderTable } from './components/OrderTable';
import { Auth } from './components/Auth';
import { Order, TabType, ImportCategory, Alert } from './types';
import {
  LogOut,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  X,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Bell,
  Info,
  ChevronRight
} from 'lucide-react';
import { parseShopifyCSV } from './services/csvService';
import { supabase } from './lib/supabase';
import { fetchSavedDisputes } from './services/disputeService';
import { loadOrdersFromDb, saveOrdersToDb } from './services/storageService';
import { fetchAlerts, createAlert, markAlertsRead, clearAlerts } from './services/alertService';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- ALERT SYSTEM STATE ---
  // Toasts are the temporary floating popups (UI only)
  const [toasts, setToasts] = useState<Alert[]>([]); 
  // AlertHistory is the persistent list from the Database
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]); 
  
  const [showAlertHistory, setShowAlertHistory] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategory, setImportCategory] = useState<ImportCategory>('DISPUTE_OPEN');

  // --- HELPER: ADD ALERT (DB + UI) ---
  const addToast = async (title: string, message: string, type: 'success' | 'error', details?: any) => {
    // 1. Create locally for immediate UI feedback (Floating Toast)
    const tempId = Math.random().toString(36).substring(7);
    const tempToast: Alert = {
      id: tempId,
      title,
      message,
      type,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      read: false,
      created_at: new Date().toISOString()
    };

    setToasts((prev) => [...prev, tempToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== tempId));
    }, 5000);

    // 2. Persist to Database
    const savedAlert = await createAlert(title, message, type, details);
    
    // 3. Update History List with the real DB record (or fallback to temp)
    if (savedAlert) {
        setAlertHistory((prev) => [savedAlert, ...prev]);
    } else {
        setAlertHistory((prev) => [tempToast, ...prev]);
    }
  };

  // 1. Auth & Session Management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. Load Data on Startup
  useEffect(() => {
    if (session) {
      loadInitialData();
    }
  }, [session]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Parallel fetch: Orders + Alerts
      const [dbOrders, dbAlerts] = await Promise.all([
        loadOrdersFromDb(),
        fetchAlerts()
      ]);

      if (dbOrders.length > 0) {
        setOrders(dbOrders);
        setActiveTab('ALL'); 
      }
      
      if (dbAlerts) {
        setAlertHistory(dbAlerts);
      }

    } catch (err: any) {
      console.error(err);
      addToast('Load Error', 'Failed to load data from database.', 'error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setImportCategory('DISPUTE_OPEN'); 
      setShowImportModal(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processImport = () => {
    if (!pendingFile) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        console.log('Parsing CSV with category:', importCategory);

        const parsedOrders = parseShopifyCSV(text, importCategory);

        const savedDisputes = await fetchSavedDisputes();
        const mergedOrders = parsedOrders.map((order) => {
          const saved = savedDisputes.find((d) => d.order_id === order.id);
          return saved ? { ...order, savedDispute: saved } : order;
        });

        await saveOrdersToDb(mergedOrders);

        setOrders(mergedOrders);
        
        addToast(
            'Import Successful', 
            `Successfully imported ${parsedOrders.length} orders.`, 
            'success'
        );
        
        if (importCategory === 'RISK') setActiveTab('RISK');
        if (importCategory === 'DISPUTE_OPEN' || importCategory === 'DISPUTE_SUBMITTED') setActiveTab('DISPUTES');
        if (importCategory === 'DISPUTE_WON' || importCategory === 'DISPUTE_LOST') setActiveTab('HISTORY');
        
      } catch (err: any) {
        console.error('CSV Import Error:', err);
        addToast(
            'Import Failed', 
            err.message || 'Unknown error occurred during import.', 
            'error',
            err
        );
      } finally {
        setLoading(false);
        setPendingFile(null);
        setShowImportModal(false);
      }
    };
    reader.readAsText(pendingFile);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const dbOrders = await loadOrdersFromDb();
      setOrders(dbOrders);
      // Refresh alerts too
      const dbAlerts = await fetchAlerts();
      setAlertHistory(dbAlerts);
      
      addToast('Refreshed', 'Data synced from database.', 'success');
    } catch (err: any) {
      addToast('Refresh Failed', 'Could not load data.', 'error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOrders([]);
    setAlertHistory([]);
  };

  const handleClearAlerts = async () => {
      await clearAlerts();
      setAlertHistory([]);
  };

  const handleOpenAlertHistory = async () => {
      setShowAlertHistory(!showAlertHistory);
      if (!showAlertHistory) {
          // If opening, mark as read in DB
          await markAlertsRead();
          // Update local UI
          setAlertHistory(prev => prev.map(a => ({ ...a, read: true })));
      }
  };

  const unreadCount = alertHistory.filter(a => !a.read).length;

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-full bg-[#f1f2f4] overflow-hidden">
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv"
        className="hidden"
      />

      {/* --- ALERT DETAIL MODAL --- */}
      {selectedAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className={`px-6 py-4 border-b flex items-center justify-between ${selectedAlert.type === 'error' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <div className="flex items-center gap-3">
                        {selectedAlert.type === 'error' ? <AlertCircle className="w-6 h-6 text-red-600"/> : <CheckCircle className="w-6 h-6 text-green-600"/>}
                        <div>
                            <h3 className={`font-bold text-lg ${selectedAlert.type === 'error' ? 'text-red-900' : 'text-green-900'}`}>{selectedAlert.title}</h3>
                            <p className="text-xs opacity-70">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5 opacity-50"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <p className="text-zinc-700 font-medium mb-4">{selectedAlert.message}</p>
                    
                    {selectedAlert.details && (
                        <div className="bg-zinc-900 rounded-lg p-4 text-zinc-300 text-xs font-mono overflow-x-auto border border-zinc-800">
                            <div className="flex items-center gap-2 mb-2 text-zinc-500 uppercase tracking-wider font-bold text-[10px]">
                                <Info className="w-3 h-3" /> Technical Details
                            </div>
                            <pre className="whitespace-pre-wrap">{selectedAlert.details}</pre>
                        </div>
                    )}

                    {selectedAlert.type === 'error' && (
                        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            <strong>Potential Fix:</strong> Check if your database schema matches the code, or verify that your CSV file isn't corrupted.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                    <button onClick={() => setSelectedAlert(null)} className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-100 transition-colors">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {showImportModal && pendingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Categorize Import</h2>
                <p className="text-sm text-zinc-500 max-w-[250px] truncate">{pendingFile.name}</p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 mb-4 font-medium">Select the status for these orders:</p>

            <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto pr-1">
              {/* Option 1: Open Dispute */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importCategory === 'DISPUTE_OPEN' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500 shadow-sm' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'DISPUTE_OPEN'} onChange={() => setImportCategory('DISPUTE_OPEN')} className="accent-amber-600 w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-zinc-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Chargeback Open
                  </div>
                  <div className="text-xs text-zinc-500 pl-6">Action Required / Response Needed</div>
                </div>
              </label>

              {/* Option 2: Submitted */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importCategory === 'DISPUTE_SUBMITTED' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'DISPUTE_SUBMITTED'} onChange={() => setImportCategory('DISPUTE_SUBMITTED')} className="accent-blue-600 w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-zinc-900">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Chargeback Submitted
                  </div>
                  <div className="text-xs text-zinc-500 pl-6">Evidence sent / Under Review</div>
                </div>
              </label>

              {/* Option 3: Won */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importCategory === 'DISPUTE_WON' ? 'border-green-500 bg-green-50 ring-1 ring-green-500 shadow-sm' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'DISPUTE_WON'} onChange={() => setImportCategory('DISPUTE_WON')} className="accent-green-600 w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-zinc-900">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    Dispute Won
                  </div>
                  <div className="text-xs text-zinc-500 pl-6">Case closed in your favor</div>
                </div>
              </label>

              {/* Option 4: Lost */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importCategory === 'DISPUTE_LOST' ? 'border-zinc-500 bg-zinc-100 ring-1 ring-zinc-500 shadow-sm' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'DISPUTE_LOST'} onChange={() => setImportCategory('DISPUTE_LOST')} className="accent-zinc-600 w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-zinc-900">
                    <ThumbsDown className="w-4 h-4 text-zinc-600" />
                    Dispute Lost
                  </div>
                  <div className="text-xs text-zinc-500 pl-6">Funds lost</div>
                </div>
              </label>

              {/* Option 5: High Risk */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${importCategory === 'RISK' ? 'border-red-500 bg-red-50 ring-1 ring-red-500 shadow-sm' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'RISK'} onChange={() => setImportCategory('RISK')} className="accent-red-600 w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-zinc-900">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    High Risk / Fraud
                  </div>
                  <div className="text-xs text-zinc-500 pl-6">Suspicious orders (No dispute yet)</div>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowImportModal(false); setPendingFile(null); }} className="flex-1 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 shadow-sm transition-colors">Cancel</button>
              <button onClick={processImport} disabled={loading} className="flex-1 py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50 shadow-md transition-all active:scale-95">{loading ? 'Processing...' : 'Import Orders'}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- FLOATING TOAST STACK --- */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border w-80 animate-in slide-in-from-right-10 fade-in duration-300
              ${toast.type === 'success' ? 'bg-white border-green-200 text-zinc-900' : 'bg-red-50 border-red-200 text-red-900'}
            `}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1">
                <div className="font-bold text-sm mb-0.5">{toast.title}</div>
                <div className="text-xs leading-relaxed opacity-90">{toast.message}</div>
            </div>

            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} 
              className={`shrink-0 hover:opacity-70 ${toast.type === 'success' ? 'text-zinc-400' : 'text-red-700'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 2. SIDEBAR */}
      <div className="flex-none h-full border-r border-zinc-200 bg-white">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => {}} 
          onClearData={() => { setOrders([]); addToast('Data Purged', 'All records cleared.', 'success'); }}
          orders={orders}
        />
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <header className="h-14 flex-none bg-white border-b border-zinc-200 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-800 text-red-600">Dispute Management v2</h1>
            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-xs rounded-full font-medium border border-zinc-200 flex items-center gap-1">
               Offline / CSV Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* ALERT HISTORY DROPDOWN */}
            <div className="relative">
                <button 
                    onClick={handleOpenAlertHistory} 
                    className="relative p-2 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    )}
                </button>

                {showAlertHistory && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-zinc-200 z-[90] overflow-hidden">
                        <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
                            <span className="text-xs font-semibold text-zinc-600">Alert History</span>
                            <button onClick={handleClearAlerts} className="text-[10px] text-zinc-400 hover:text-red-600 transition-colors">Clear All</button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {alertHistory.length === 0 ? (
                                <div className="px-4 py-8 text-center text-xs text-zinc-400">No recent alerts.</div>
                            ) : (
                                alertHistory.map(alert => (
                                    <button 
                                        key={alert.id}
                                        onClick={() => { setSelectedAlert(alert); setShowAlertHistory(false); }}
                                        className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors flex gap-3 ${alert.type === 'error' ? 'bg-red-50/30' : ''}`}
                                    >
                                        {alert.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" /> : <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <span className={`text-xs font-semibold ${alert.type === 'error' ? 'text-red-900' : 'text-zinc-900'}`}>{alert.title}</span>
                                                <span className="text-[10px] text-zinc-400">{new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 truncate">{alert.message}</p>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-zinc-300 self-center" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-zinc-200"></div>

            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors" title="Import Shopify CSV">
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <div className="text-sm text-zinc-500 hidden md:block">{session.user.email}</div>
            <button onClick={handleSignOut} className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#f1f2f4] p-6">
          <div className="flex justify-between items-center mb-4 flex-none">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-900">Fraud & Disputes</h2>
              <button onClick={handleRefresh} className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors" title="Reload from Database">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 min-h-0 relative flex flex-col bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            {loading && orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
                <p className="text-zinc-500 text-sm mt-3">Loading data...</p>
              </div>
            ) : null}

            {orders.length > 0 || loading ? (
              <OrderTable
                orders={orders}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onRefresh={handleRefresh}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                    <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-zinc-900 font-medium text-lg mb-1">No orders yet</h3>
                <p className="text-zinc-500 mb-6 max-w-sm">
                  Import your Shopify CSV export to start monitoring chargebacks and risk.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm hover:bg-zinc-800 flex items-center gap-2 font-medium shadow-sm transition-all hover:scale-105">
                    <Upload className="w-4 h-4" /> Import Orders CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
