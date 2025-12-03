// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { OrderTable } from './components/OrderTable';
import { Auth } from './components/Auth';
import { Order, TabType, ImportCategory } from './types';
import {
  LogOut,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { parseShopifyCSV } from './services/csvService';
import { supabase } from './lib/supabase';
import { fetchSavedDisputes } from './services/disputeService';
import { loadOrdersFromDb, saveOrdersToDb } from './services/storageService';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategory, setImportCategory] = useState<ImportCategory>('AUTO');

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

  // 2. Load Only Local DB Orders (Skip API Sync)
  useEffect(() => {
    if (session) {
      loadInitialData();
    }
  }, [session]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load cached orders from Database
      const dbOrders = await loadOrdersFromDb();
      if (dbOrders.length > 0) {
        setOrders(dbOrders);
        // Default to showing all if we have data
        setActiveTab('ALL'); 
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load orders from database.');
    } finally {
      setLoading(false);
    }
  };

  // Initial File Selection -> Opens Modal
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setImportCategory('AUTO'); // Default
      setShowImportModal(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Final Processing after Modal selection
  const processImport = () => {
    if (!pendingFile) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        console.log('Parsing CSV with category:', importCategory);

        // Pass the selected category to the parser
        const parsedOrders = parseShopifyCSV(text, importCategory);

        // Restore disputes from DB if they exist for these orders
        const savedDisputes = await fetchSavedDisputes();
        const mergedOrders = parsedOrders.map((order) => {
          const saved = savedDisputes.find((d) => d.order_id === order.id);
          return saved ? { ...order, savedDispute: saved } : order;
        });

        // SAVE TO DATABASE
        await saveOrdersToDb(mergedOrders);

        setOrders(mergedOrders);
        setNotification(`Imported & saved ${parsedOrders.length} orders.`);
        setTimeout(() => setNotification(null), 3000);

        // Switch tab based on import type to be helpful
        if (importCategory === 'RISK') setActiveTab('RISK');
        if (importCategory === 'DISPUTE_OPEN') setActiveTab('DISPUTES');
        if (importCategory === 'DISPUTE_WON' || importCategory === 'DISPUTE_LOST') setActiveTab('HISTORY');
        if (importCategory === 'AUTO') setActiveTab('ALL');
      } catch (err: any) {
        console.error('CSV Import Error:', err);
        setError(`Failed to parse CSV file: ${err.message}`);
      } finally {
        setLoading(false);
        setPendingFile(null);
        setShowImportModal(false);
      }
    };
    reader.readAsText(pendingFile);
  };

  const handleRefresh = async () => {
    // Just reload from DB in offline mode
    setLoading(true);
    try {
      const dbOrders = await loadOrdersFromDb();
      setOrders(dbOrders);
      setNotification('Refreshed data from database');
      setTimeout(() => setNotification(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOrders([]);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    // 1. OUTER SHELL: Full screen, no overflow
    <div className="flex h-screen w-full bg-[#f1f2f4] overflow-hidden">
      
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv"
        className="hidden"
      />

      {/* --- IMPORT MODAL --- */}
      {showImportModal && pendingFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
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

            <p className="text-sm text-zinc-600 mb-4">How should we classify the orders in this file?</p>

            <div className="space-y-3 mb-6">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${importCategory === 'AUTO' ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'AUTO'} onChange={() => setImportCategory('AUTO')} className="text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">Auto-Detect (Smart)</div>
                  <div className="text-xs text-zinc-500">Detects tags: won, lost, chargeback, risk</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${importCategory === 'RISK' ? 'border-red-500 bg-red-50' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'RISK'} onChange={() => setImportCategory('RISK')} className="text-red-600" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">High Risk / Fraud</div>
                  <div className="text-xs text-zinc-500">Force all as High Risk</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${importCategory === 'DISPUTE_OPEN' ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="radio" name="cat" checked={importCategory === 'DISPUTE_OPEN'} onChange={() => setImportCategory('DISPUTE_OPEN')} className="text-orange-600" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">Open Disputes</div>
                  <div className="text-xs text-zinc-500">Mark as Action Required</div>
                </div>
              </label>

              <div className="flex gap-2">
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${importCategory === 'DISPUTE_WON' ? 'border-green-500 bg-green-50' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                  <input type="radio" name="cat" checked={importCategory === 'DISPUTE_WON'} onChange={() => setImportCategory('DISPUTE_WON')} className="text-green-600" />
                  <div className="font-medium text-sm text-zinc-900">Won</div>
                </label>
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${importCategory === 'DISPUTE_LOST' ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                  <input type="radio" name="cat" checked={importCategory === 'DISPUTE_LOST'} onChange={() => setImportCategory('DISPUTE_LOST')} className="text-zinc-600" />
                  <div className="font-medium text-sm text-zinc-900">Lost</div>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowImportModal(false); setPendingFile(null); }} className="flex-1 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50">Cancel</button>
              <button onClick={processImport} disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? 'Processing...' : 'Import Orders'}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST NOTIFICATION --- */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm font-medium">{notification}</p>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 2. SIDEBAR */}
      <div className="flex-none h-full border-r border-zinc-200 bg-white">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => {}} // No settings needed for offline mode
          onClearData={() => setOrders([])}
        />
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <header className="h-14 flex-none bg-white border-b border-zinc-200 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-800">Dispute Management</h1>
            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-xs rounded-full font-medium border border-zinc-200 flex items-center gap-1">
               Offline / CSV Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
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
            
            {error && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded border border-red-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3"/> {error}
                </div>
            )}
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
