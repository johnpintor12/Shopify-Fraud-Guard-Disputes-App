import React from 'react';
import { Home, ShoppingBag, Users, BarChart2, Settings, FileText, ShieldAlert, Scale } from 'lucide-react';
import { TabType } from '../types';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onOpenSettings }) => {
  const navItemClass = (active: boolean) => 
    `flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 cursor-pointer transition-colors ${
      active ? 'bg-zinc-200 text-black' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
    }`;

  // Helper to determine if a menu item should look active based on the current dashboard tab
  const isFraudActive = activeTab === 'RISK' || activeTab === 'ALL';
  const isChargebackActive = activeTab === 'DISPUTES' || activeTab === 'HISTORY';

  return (
    <div className="w-64 bg-zinc-50 border-r border-zinc-200 min-h-screen flex flex-col p-3">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
           <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-zinc-900">Store Admin</span>
      </div>

      <nav className="flex-1">
        <div className={navItemClass(false)}>
          <Home className="w-4 h-4 mr-3" /> Home
        </div>
        <div className={navItemClass(false)}>
          <FileText className="w-4 h-4 mr-3" /> Orders
        </div>
        
        <div className="my-2 border-t border-zinc-200 mx-3"></div>
        <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Risk Management
        </div>

        <div 
          className={navItemClass(isFraudActive)}
          onClick={() => onTabChange('RISK')}
        >
          <ShieldAlert className="w-4 h-4 mr-3" /> Fraud Monitoring
        </div>
        <div 
          className={navItemClass(isChargebackActive)}
          onClick={() => onTabChange('DISPUTES')}
        >
          <Scale className="w-4 h-4 mr-3" /> Chargeback Monitoring
        </div>

        <div className="my-2 border-t border-zinc-200 mx-3"></div>

        <div className={navItemClass(false)}>
          <Users className="w-4 h-4 mr-3" /> Customers
        </div>
        <div className={navItemClass(false)}>
          <BarChart2 className="w-4 h-4 mr-3" /> Analytics
        </div>
      </nav>

      <div className="mt-auto">
        <div 
          className={navItemClass(false)}
          onClick={onOpenSettings}
        >
          <Settings className="w-4 h-4 mr-3" /> Settings
        </div>
      </div>
    </div>
  );
};