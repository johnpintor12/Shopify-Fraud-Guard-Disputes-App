import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { OrderTable } from './components/OrderTable';
import { MOCK_ORDERS } from './constants';
import { Order, ShopifyCredentials, TabType } from './types';
import { Search, Bell, HelpCircle, Lock, RefreshCw, AlertCircle, Globe, Upload, X } from 'lucide-react';
import { fetchOrders } from './services/shopifyService';
import { parseShopifyCSV } from './services/csvService';

const App: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ShopifyCredentials | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('RISK');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Load
  useEffect(() => {
    if (!credentials && !demoMode && orders.length === 0) {
      setShowSettings(true);
    } else if (demoMode) {
      setOrders(MOCK_ORDERS);
    }
  }, [credentials, demoMode]);

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
      const fetchedOrders = await fetchOrders(domain, token, useProxy);
      setCredentials({ shopDomain: domain, accessToken: token, useProxy });
      setOrders(fetchedOrders);
      setShowSettings(false);
    } catch (err: any) {
      let errorMessage = "Failed to connect.";
      if (err instanceof Error) {
         errorMessage = err.message;
      }
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = "Network Error: Unable to reach Shopify.\n\nPossible fixes:\n1. Ensure 'Use CORS Proxy' is CHECKED.\n2. Disable AdBlockers (they often block proxies).\n3. Check if your Shop Domain is correct.";
      }
      
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (demoMode) {
      setLoading(true);
      setTimeout(() => setLoading(false), 800);
      return;
    }

    if (!credentials) return;
    
    setLoading(true);
    try {
      const fetchedOrders = await fetchOrders(credentials.shopDomain, credentials.accessToken, credentials.useProxy);
      setOrders(fetchedOrders);
    } catch (err) {
      setError("Failed to refresh orders. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsedOrders = parseShopifyCSV(text);
        setOrders(parsedOrders);
        setShowSettings(false);
        setDemoMode(false); // Disable demo mode if CSV loaded
        setError(null);
      } catch (err) {
        setError("Failed to parse CSV. Please ensure it is a valid Shopify Order Export.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex min-h-screen bg-[#f1f2f4]">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".csv" 
      />

      {/* Settings/Connect Modal */}
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
              <div className="bg-green-100 p-2.5 rounded-lg">
                <Lock className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Connect Store</h2>
                <p className="text-sm text-zinc-500">Connect via API or Import CSV</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700 break-words max-h-32 overflow-y-auto">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Error</p>
                  <p className="whitespace-pre-line">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button 
                type="button"
                onClick={triggerFileUpload}
                className="w-full py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import CSV File
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-zinc-500">Or use API</span>
                </div>
              </div>

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Shop Domain</label>
                  <input 
                    name="shopDomain"
                    type="text" 
                    placeholder="your-store.myshopify.com"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Admin Access Token</label>
                  <input 
                    name="accessToken"
                    type="password" 
                    placeholder="shpat_..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <div className="flex items-center h-5">
                    <input
                      id="useProxy"
                      name="useProxy"
                      type="checkbox"
                      defaultChecked={true}
                      className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <label htmlFor="useProxy" className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-900">Use CORS Proxy</span>
                    <p className="text-xs text-zinc-500 mt-0.5">Required for browser-based API calls.</p>
                  </label>
                </div>
                
                <div className="pt-2 flex flex-col gap-3">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Connecting...' : 'Connect to Shopify'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setDemoMode(true); setShowSettings(false); }}
                    className="w-full py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                  >
                    Use Demo Data
                  </button>
                </div>
              </form>
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
            <h1 className="text-lg font-bold text-zinc-800">
              Dispute Management
            </h1>
            {demoMode && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium border border-amber-200">Demo Mode</span>}
            {credentials && <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium border border-green-200 flex items-center gap-1"><Globe className="w-3 h-3"/> Connected</span>}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={triggerFileUpload}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <div className="relative w-64 hidden md:block">
              <input 
                type="text" 
                placeholder="Search orders..." 
                className="w-full bg-zinc-100 border border-transparent rounded-md py-1.5 pl-9 pr-3 text-sm focus:bg-white focus:border-zinc-300 focus:outline-none transition-all"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute left-2.5 top-2" />
            </div>
            <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full">
              <Bell className="w-5 h-5" />
            </button>
             <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full">
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-bold">
              SH
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 flex-1 overflow-y-auto">
           <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2">
                 <h2 className="text-xl font-bold text-zinc-900">Fraud Monitoring & Disputes</h2>
                 <button 
                    onClick={handleRefresh}
                    className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors"
                    title="Refresh Orders"
                 >
                   <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                 </button>
               </div>
               <div className="flex gap-3">
                 <button className="px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm">
                   Export Evidence
                 </button>
               </div>
             </div>
             
             {loading && orders.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 gap-3">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
                 <p className="text-zinc-500 text-sm">Loading orders...</p>
               </div>
             ) : (
               <OrderTable 
                 orders={orders} 
                 activeTab={activeTab} 
                 onTabChange={setActiveTab}
               />
             )}
             
             {!loading && orders.length === 0 && !demoMode && (
               <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 border-dashed">
                 <p className="text-zinc-500 mb-3">No orders found. Connect API or Import CSV.</p>
                 <div className="flex justify-center gap-3">
                    <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800">
                      Connect API
                    </button>
                    <button onClick={triggerFileUpload} className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-md text-sm hover:bg-zinc-50">
                      <Upload className="w-4 h-4 inline mr-2" /> Import CSV
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
