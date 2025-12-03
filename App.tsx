// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { OrderTable } from './components/OrderTable';
import { Auth } from './components/Auth';
import { Order, ShopifyCredentials, TabType, ImportCategory } from './types';
import {
  LogOut,
  Database,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  X,
  RefreshCw,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { fetchOrders } from './services/shopifyService';
import { parseShopifyCSV } from './services/csvService';
import { supabase } from './lib/supabase';
import {
  fetchSavedDisputes,
  fetchUserProfile,
  saveUserProfile,
} from './services/disputeService';
import { loadOrdersFromDb, saveOrdersToDb } from './services/storageService';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ShopifyCredentials | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategory, setImportCategory] =
    useState<ImportCategory>('AUTO');

  // 1. Auth & Session Management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load User Profile & Orders on Login
  useEffect(() => {
    if (session) {
      loadInitialData();
    }
  }, [session]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // A. Load cached orders from Database first (Fast!)
      const dbOrders = await loadOrdersFromDb();
      if (dbOrders.length > 0) {
        setOrders(dbOrders);
      }

      // B. Fetch Profile for API Keys
      const profile = await fetchUserProfile();

      let domain =
        profile?.shopify_domain || import.meta.env.VITE_SHOPIFY_STORE;
      let token =
        profile?.shopify_access_token || import.meta.env.VITE_SHOPIFY_API_KEY;

      if (domain && token) {
        setCredentials({
          shopDomain: domain,
          accessToken: token,
          useProxy: true,
        });
        // Background sync with Shopify
        await loadAndSyncOrders(domain, token, true);
      } else if (dbOrders.length === 0) {
        // Only show settings if we have NO data at all
        setShowSettings(true);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  const loadAndSyncOrders = async (
    domain: string,
    token: string,
    useProxy: boolean
  ) => {
    try {
      const liveOrders = await fetchOrders(domain, token, useProxy);
      const savedDisputes = await fetchSavedDisputes();

      const mergedOrders = liveOrders.map((order) => {
        const saved = savedDisputes.find((d) => d.order_id === order.id);
        return saved ? { ...order, savedDispute: saved } : order;
      });

      await saveOrdersToDb(mergedOrders);
      setOrders(mergedOrders);

      setNotification('Synced with Shopify & saved to database');
      setTimeout(() => setNotification(null), 3000);
    } catch (e: any) {
      console.error('Sync failed', e);
      setError('Sync failed: ' + e.message);
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
        if (
          importCategory === 'DISPUTE_WON' ||
          importCategory === 'DISPUTE_LOST'
        )
          setActiveTab('HISTORY');
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
    if (!credentials) return;
    setLoading(true);
    try {
      await loadAndSyncOrders(
        credentials.shopDomain,
        credentials.accessToken,
        credentials.useProxy || true
      );
    } catch (err) {
      setError('Failed to refresh orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const domain = (form.elements.namedItem('shopDomain') as HTMLInputElement)
      .value;
    const token = (form.elements.namedItem('accessToken') as HTMLInputElement)
      .value;
    const useProxy = (form.elements.namedItem('useProxy') as HTMLInputElement)
      .checked;

    if (!domain || !token) return;

    setLoading(true);
    setError(null);
    try {
      await fetchOrders(domain, token, useProxy);
      setCredentials({ shopDomain: domain, accessToken: token, useProxy });

      if (session) {
        await saveUserProfile(domain, token, '');
      }

      await loadAndSyncOrders(domain, token, useProxy);
      setShowSettings(false);
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to connect.';
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage =
          "Network error. Please enable 'Use CORS Proxy' or check AdBlocker.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOrders([]);
    setCredentials(null);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    // OUTER SHELL: Full screen, no overflow
    <div className="flex h-screen w-full bg-[#f1f2f4] overflow-hidden">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv"
        className="hidden"
      />

      {/* Import Categorization Modal */}
      {showImportModal && pendingFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Categorize Import
                </h2>
                <p className="text-sm text-zinc-500 max-w-[250px] truncate">
                  {pendingFile.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 mb-4">
              How should we classify the orders in this file?
            </p>

            <div className="space-y-3 mb-6">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  importCategory === 'AUTO'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={importCategory === 'AUTO'}
                  onChange={() => setImportCategory('AUTO')}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">
                    Auto-Detect (Smart)
                  </div>
                  <div className="text-xs text-zinc-500">
                    Use tags & status from file
                  </div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  importCategory === 'RISK'
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={importCategory === 'RISK'}
                  onChange={() => setImportCategory('RISK')}
                  className="text-red-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">
                    High Risk / Fraud
                  </div>
                  <div className="text-xs text-zinc-500">
                    Force all as High Risk
                  </div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  importCategory === 'DISPUTE_OPEN'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={importCategory === 'DISPUTE_OPEN'}
                  onChange={() => setImportCategory('DISPUTE_OPEN')}
                  className="text-orange-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-zinc-900">
                    Open Disputes
                  </div>
                  <div className="text-xs text-zinc-500">
                    Mark as Action Required
                  </div>
                </div>
              </label>

              <div className="flex gap-2">
                <label
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    importCategory === 'DISPUTE_WON'
                      ? 'border-green-500 bg-green-50'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cat"
                    checked={importCategory === 'DISPUTE_WON'}
                    onChange={() => setImportCategory('DISPUTE_WON')}
                    className="text-green-600"
                  />
                  <div className="font-medium text-sm text-zinc-900">
                    Won
                  </div>
                </label>
                <label
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    importCategory === 'DISPUTE_LOST'
                      ? 'border-zinc-500 bg-zinc-100'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cat"
                    checked={importCategory === 'DISPUTE_LOST'}
                    onChange={() => setImportCategory('DISPUTE_LOST')}
                    className="text-zinc-600"
                  />
                  <div className="font-medium text-sm text-zinc-900">
                    Lost
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setPendingFile(null);
                }}
                className="flex-1 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={processImport}
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Import Orders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm font-medium">{notification}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-zinc-200 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-zinc-900 p-2.5 rounded-lg text-white">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Store Settings
                </h2>
                <p className="text-sm text-zinc-500">
                  Credentials are saved to your account.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Shop Domain
                </label>
                <input
                  name="shopDomain"
                  type="text"
                  defaultValue={credentials?.shopDomain}
                  placeholder="your-store.myshopify.com"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Admin Access Token
                </label>
                <input
                  name="accessToken"
                  type="password"
                  defaultValue={credentials?.accessToken}
                  placeholder="shpat_."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-start gap-2 pt-1">
                <input
                  id="useProxy"
                  name="useProxy"
                  type="checkbox"
                  defaultChecked={true}
                  className="mt-1"
                />
                <label htmlFor="useProxy" className="text-sm text-zinc-600">
                  Use CORS Proxy (Required for Web)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save & Connect'}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  fileInputRef.current?.click();
                }}
                className="w-full py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import CSV Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR: Flex-none ensures it doesn't shrink. h-full ensures it hits the bottom. */}
      <div className="flex-none h-full border-r border-zinc-200 bg-white">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => setShowSettings(true)}
          onClearData={() => setOrders([])}
        />
      </div>

      {/* MAIN CONTENT: Flex-1 fills remaining width. Flex-col handles vertical layout. */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* HEADER: Fixed height, stays at top */}
        <header className="h-14 flex-none bg-white border-b border-zinc-200 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-800">
              Dispute Management
            </h1>
            {credentials && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium border border-green-200 flex items-center gap-1">
                <Globe className="w-3 h-3" /> {credentials.shopDomain}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
              title="Import Shopify CSV"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>

            <div className="text-sm text-zinc-500 hidden md:block">
              {session.user.email}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* MAIN BODY: Flex-1 takes remaining height. Overflow-hidden prevents double scrollbars. */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#f1f2f4] p-6">
          <div className="flex justify-between items-center mb-4 flex-none">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-900">
                Fraud & Disputes
              </h2>
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors"
                title="Refresh Orders"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* TABLE CONTAINER: Flex-1 fills the rest of the vertical space. */}
          {/* This div effectively becomes the "Card" boundary */}
          <div className="flex-1 min-h-0 relative flex flex-col bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            {loading && orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
                <p className="text-zinc-500 text-sm mt-3">Syncing...</p>
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
                <p className="text-zinc-500 mb-3">
                  No orders found. Please configure your store.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800"
                  >
                    Configure Store
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-md text-sm hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Import CSV
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
