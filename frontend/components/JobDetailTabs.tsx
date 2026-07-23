'use client';

import { useState, type ReactNode } from 'react';
import type { Job } from '@/types';
import NetworkingTab from './NetworkingTab';
import ApplicationTracker from './ApplicationTracker';

interface JobDetailTabsProps {
  job: Job;
}

type TabType = 'networking' | 'application';

export default function JobDetailTabs({ job }: JobDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('networking');

  const tabs: { id: TabType; label: string; icon: ReactNode }[] = [
    {
      id: 'networking',
      label: 'Networking',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'application',
      label: 'Application',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? 'var(--teal)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'networking' && <NetworkingTab job={job} />}
      {activeTab === 'application' && <ApplicationTracker job={job} />}
    </div>
  );
}
