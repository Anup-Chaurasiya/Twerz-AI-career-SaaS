'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/endpoints';
import { getApiBase } from '@/lib/api/baseUrl';

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: Record<string, unknown>,
          callback: (response: { ok?: boolean; error?: string }) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

async function freshAccessToken(): Promise<string | null> {
  const existing = localStorage.getItem('token');
  if (!existing) return null;
  try {
    const res = await authApi.refresh();
    const token = res.data.access_token;
    localStorage.setItem('token', token);
    return token;
  } catch {
    return existing;
  }
}

export default function ExtensionConnectPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking your session…');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const extensionId = params.get('extension_id');
      const apiBase = getApiBase() || 'http://localhost:8000';
      const appBase = window.location.origin;

      if (!localStorage.getItem('token')) {
        if (cancelled) return;
        setStatus('Sign in to connect the Chrome extension.');
        const redirect = encodeURIComponent(
          `/extension/connect${extensionId ? `?extension_id=${extensionId}` : ''}`,
        );
        router.replace(`/login?redirect=${redirect}`);
        return;
      }

      if (!extensionId || !window.chrome?.runtime?.sendMessage) {
        if (cancelled) return;
        setStatus('Open this page from the Twerz Chrome extension Connect button.');
        return;
      }

      if (cancelled) return;
      setStatus('Refreshing session and connecting extension…');

      const token = await freshAccessToken();
      if (!token) {
        if (cancelled) return;
        setStatus('Sign in to connect the Chrome extension.');
        router.replace('/login?redirect=%2Fextension%2Fconnect');
        return;
      }

      window.chrome.runtime.sendMessage(
        extensionId,
        { type: 'AUTH', token, apiBase, appBase },
        (response) => {
          if (cancelled) return;
          if (window.chrome?.runtime?.lastError) {
            setStatus(
              'Could not reach the extension. Reload the unpacked extension and try again.',
            );
            return;
          }
          if (response?.ok) {
            setConnected(true);
            setStatus(
              'Extension connected. You can close this tab and capture jobs from any supported board.',
            );
            return;
          }
          setStatus('Connection failed. Try again from the extension popup.');
        },
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Connect Chrome extension</h1>
        <p style={{ margin: '0 0 16px', color: '#cbd5e1', lineHeight: 1.5 }}>{status}</p>
        {connected ? (
          <p style={{ margin: 0, color: '#86efac', fontSize: 14 }}>
            Apply Assist is ready — capture JDs, fill employer forms, you submit.
          </p>
        ) : (
          <Link href="/dashboard" style={{ color: '#93c5fd' }}>
            Go to dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
