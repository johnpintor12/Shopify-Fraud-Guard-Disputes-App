import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { OrderTable } from './components/OrderTable';
import { Auth } from './components/Auth';
import { MOCK_ORDERS } from './constants';
import { Order, ShopifyCredentials, TabType } from './types';
import { Search, Bell, HelpCircle, Lock, RefreshCw, AlertCircle, Globe, Upload, X, LogOut, Database, CheckCircle } from 'lucide-react';
import { fetchOrders } from './services/shopifyService';
import { parseShopifyCSV } from './services/csvService';
import { supabase } from './lib/supabase';
import { fetchSavedDisputes, fetchUserProfile, saveUserProfile } from './services/disputeService';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ShopifyCredentials | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 2. Load User Profile (API Keys) & Orders on Login
  useEffect(() => {
    if (session) {
      loadInitialData();
    }
  }, [session]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // A. Fetch Profile from DB
      const profile = await fetchUserProfile();
      
      // B. Determine which credentials to use
      // Priority: DB Profile -> Env Vars (Vercel) -> Null
      let domain = profile?.shopify_domain || import.meta.env.VITE_SHOPIFY_STORE;
      let token = profile?.shopify_access_token || import.meta.env.VITE_SHOPIFY_API_KEY;

      if (domain && token) {
        setCredentials({ 
          shopDomain: domain, 
          accessToken: token, 
          useProxy: true 
        });
        await loadAndSyncOrders(domain, token, true);
      } else {
        // No creds found, open modal
        setShowSettings(true);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadAndSyncOrders = async (domain: string, token: string, useProxy: boolean) => {
     // 1. Fetch live orders from Shopify
     const liveOrders = await fetchOrders(domain, token, useProxy);
     
     // 2. Fetch saved dispute drafts from Supabase
     const savedDisputes = await fetchSavedDisputes();

     // 3. Merge Data: Attach saved DB drafts to live Shopify orders
     const mergedOrders = liveOrders.map(order => {
       const saved = savedDisputes.find(d => d.order_id === order.id);
       if (saved) {
         return { 
           ...order, 
           savedDispute: saved,
           // If we have a draft, considering prioritizing it in UI
         };
       }
       return order;
     });

     setOrders(mergedOrders);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const domain = (form.elements.namedItem('shopDomain') as HTMLInputElement).value;
    const token = (form.elements.namedItem('accessToken') as HTMLInputElement).value;
    const useProxy = (form.elements.namedItem('useProxy') as HTMLInputElement).checked;

    if (!domain || !token) return;

    setLoading(true);
    setError(null);
    try {
      // Validate connection
      await fetchOrders(domain, token, useProxy);
      
      // Save to State
      setCredentials({ shopDomain: domain, accessToken: token, useProxy });
      
      // Save to Database (Persist for next time)
      if (session) {
        await saveUserProfile(domain, token, ""); // We can add Gemini Key later
      }

      // Sync
      await loadAndSyncOrders(domain, token, useProxy);
      setShowSettings(false);
    } catch (err: any) {
      let errorMessage = err.message || "Failed to connect.";
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = "Network Error. Please enable 'Use CORS Proxy' or check AdBlocker.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsedOrders = parseShopifyCSV(text);
        
        // Fetch saved disputes to merge with CSV data
        const savedDisputes = await fetchSavedDisputes();
        const mergedOrders = parsedOrders.map(order => {
          const saved = savedDisputes.find(d => d.order_id === order.id);
          return saved ? { ...order, savedDispute: saved } : order;
        });

        setOrders(mergedOrders);
        setNotification(`Successfully imported ${parsedOrders.length} orders from CSV.`);
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        setError("Failed to parse CSV file. Please ensure it is a valid Shopify export.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRefresh = async () => {
    if (demoMode) return;
    if (!credentials) return;
    setLoading(true);
    try {
      await loadAndSyncOrders(credentials.shopDomain, credentials.accessToken, credentials.useProxy || true);
    } catch (err) {
      setError("Failed to refresh orders.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOrders([]);
    setCredentials(null);
  };

  // Render Login Screen if not authenticated
  if (!session) {
    return <Auth />;
  }

  // --- Main App Render ---
  return (
    <div className="flex min-h-screen bg-[#f1f2f4]">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".csv" 
        className="hidden" 
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm font-medium">{notification}</p>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                <h2 className="text-xl font-bold text-zinc-900">Store Settings</h2>
                <p className="text-sm text-zinc-500">Credentials are saved to your account.</p>
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
                <label className="block text-sm font-medium text-zinc-700 mb-1">Shop Domain</label>
                <input 
                  name="shopDomain"
                  type="text" 
                  defaultValue={credentials?.shopDomain}
                  placeholder="your-store.myshopify.com"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Admin Access Token</label>
                <input 
                  name="accessToken"
                  type="password" 
                  defaultValue={credentials?.accessToken}
                  placeholder="shpat_..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-start gap-2 pt-1">
                 <input id="useProxy" name="useProxy" type="checkbox" defaultChecked={true} className="mt-1" />
                 <label htmlFor="useProxy" className="text-sm text-zinc-600">Use CORS Proxy (Required for Web)</label>
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
                 onClick={() => { setShowSettings(false); fileInputRef.current?.click(); }}
                 className="w-full py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 flex items-center justify-center gap-2"
               >
                 <Upload className="w-4 h-4" /> Import CSV Instead
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-800">Dispute Management</h1>
            {credentials && <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium border border-green-200 flex items-center gap-1"><Globe className="w-3 h-3"/> {credentials.shopDomain}</span>}
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
            <button onClick={handleSignOut} className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 flex-1 overflow-y-auto">
           <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2">
                 <h2 className="text-xl font-bold text-zinc-900">Fraud & Disputes</h2>
                 <button 
                    onClick={handleRefresh}
                    className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors"
                    title="Refresh Orders"
                 >
                   <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                 </button>
               </div>
             </div>
             
             {loading && orders.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 gap-3">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
                 <p className="text-zinc-500 text-sm">Syncing...</p>
               </div>
             ) : (
               <OrderTable 
                 orders={orders} 
                 activeTab={activeTab} 
                 onTabChange={setActiveTab}
                 onRefresh={handleRefresh}
               />
             )}
             
             {!loading && orders.length === 0 && (
               <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 border-dashed">
                 <p className="text-zinc-500 mb-3">No orders found. Please configure your store.</p>
                 <div className="flex gap-3 justify-center">
                    <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800">
                      Configure Store
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-md text-sm hover:bg-zinc-50 flex items-center gap-2">
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
