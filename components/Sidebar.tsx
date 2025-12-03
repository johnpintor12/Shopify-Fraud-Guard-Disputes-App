// src/components/Sidebar.tsx
import React, { useMemo } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  ListChecks,
  Settings,
  FileWarning
} from 'lucide-react';
import { TabType, Order } from '../types';
import ClearDataButton from './ClearDataButton';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
  onClearData: () => void;
  orders?: Order[]; // Added orders prop to check for errors
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  onClearData,
  orders = []
}) => {
  
  // Check if we have any broken data
  const hasInvalidData = useMemo(() => {
    return orders.some(o => o.import_category === 'INVALID');
  }, [orders]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    {
      id: 'RISK',
      label: 'Fraud Monitoring',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'DISPUTES',
      label: 'Chargebacks',
      icon: <AlertOctagon className="w-4 h-4" />,
    },
    {
      id: 'HISTORY',
      label: 'Won / Lost',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: 'ALL',
      label: 'All Orders',
      icon: <ListChecks className="w-4 h-4" />,
    },
    // Only show this if we have bad data
    {
      id: 'QUARANTINE',
      label: 'Data Issues',
      icon: <FileWarning className="w-4 h-4 text-amber-500" />,
      hidden: !hasInvalidData
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full shrink-0">
      <div className="h-14 px-4 flex items-center border-b border-zinc-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">
            FG
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Fraud Guard
            </div>
            <div className="text-[11px] text-zinc-500">
              Shopify Dispute Hub
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {tabs.filter(t => !t.hidden).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <span
                  className={`${
                    isActive ? 'text-white' : 'text-zinc-500'
                  }`}
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-zinc-100 bg-zinc-50 shrink-0">
        <ClearDataButton onCleared={onClearData} />
      </div>
    </aside>
  );
};
