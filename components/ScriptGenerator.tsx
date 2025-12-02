import React, { useState } from 'react';
import { Copy, Check, FileJson, Sheet } from 'lucide-react';
import { GOOGLE_SCRIPT_TEMPLATE } from '../constants';

export const ScriptGenerator: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(GOOGLE_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Automated Google Sheets Sync</h2>
        <p className="text-zinc-600 mb-6">
          Use the script below to automatically sync <strong>High Risk</strong> and <strong>Fraud</strong> orders from your store to a Google Sheet. 
          The script specifically filters for orders tagged with 'fraud' or 'chargeback' to help you monitor disputes externally.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 border border-zinc-200 rounded-lg bg-zinc-50">
             <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded flex items-center justify-center mb-3">
               <Sheet className="w-5 h-5" />
             </div>
             <h3 className="font-semibold text-sm mb-1">1. Open Sheets</h3>
             <p className="text-xs text-zinc-500">Go to your Google Sheet, click Extensions &gt; Apps Script.</p>
          </div>
          <div className="p-4 border border-zinc-200 rounded-lg bg-zinc-50">
             <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded flex items-center justify-center mb-3">
               <Copy className="w-5 h-5" />
             </div>
             <h3 className="font-semibold text-sm mb-1">2. Paste Code</h3>
             <p className="text-xs text-zinc-500">Copy the code below and paste it into the script editor.</p>
          </div>
          <div className="p-4 border border-zinc-200 rounded-lg bg-zinc-50">
             <div className="w-8 h-8 bg-green-100 text-green-600 rounded flex items-center justify-center mb-3">
               <FileJson className="w-5 h-5" />
             </div>
             <h3 className="font-semibold text-sm mb-1">3. Configure</h3>
             <p className="text-xs text-zinc-500">Add your Shopify API Admin Key and Access Token to the config section.</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-3 right-3">
            <button 
              onClick={handleCopy}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                copied 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Code</>}
            </button>
          </div>
          <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed h-96 border border-zinc-700">
            <code>{GOOGLE_SCRIPT_TEMPLATE}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};