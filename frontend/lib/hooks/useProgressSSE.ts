import { useEffect, useRef, useState } from 'react';
import { getApiBase } from '@/lib/api/baseUrl';

export interface ProgressEvent {
  status: string;
  message: string;
  progress?: number; // 0-100 if available
  // Job fit analysis SSE payloads (optional)
  fit_score?: number;
  fit_label?: string;
  fit_rationale?: string;
  gap_list?: string[];
  gap_roadmap?: {
    summary?: string;
    steps?: Array<{
      title: string;
      detail: string;
      category?: 'skill' | 'cert' | 'project' | 'experience' | 'other' | string;
    }>;
  } | null;
  fit_analysis_status?: string;
}

const TERMINAL_SSE_STATUSES = new Set([
  'READY',
  'FAILED',
  'FIT_ANALYZED',
  'FIT_ANALYSIS_FAILED',
]);

export interface UseProgressSSEOptions {
  entityType: 'profile' | 'job' | 'roast';
  entityId: string | number | null;
  onUpdate: (event: ProgressEvent) => void;
  onComplete: (finalStatus: string) => void;
  enabled?: boolean;
}

export function useProgressSSE({
  entityType,
  entityId,
  onUpdate,
  onComplete,
  enabled = true
}: UseProgressSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  
  const MAX_RETRIES = 5;
  const API_BASE = getApiBase();

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onCompleteRef.current = onComplete;
  }, [onUpdate, onComplete]);

  useEffect(() => {
    if (!enabled || !entityId) return;
    completedRef.current = false;

    const finish = (status: string) => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsConnected(false);
      onCompleteRef.current(status);
    };

    const connect = () => {
      try {
        const url = `${API_BASE}/progress/${entityType}/${entityId}`;
        const eventSource = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          retryCountRef.current = 0;
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as Partial<ProgressEvent>;
            if (!data.status && !data.message) return;
            onUpdateRef.current({
              ...data,
              status: data.status || '',
              message: data.message || `Status: ${data.status}`,
            });
            
            if (data.status && TERMINAL_SSE_STATUSES.has(data.status)) {
              finish(data.status);
            }
          } catch (err) {
            console.error('Failed to parse SSE message:', err);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setIsConnected(false);

          if (completedRef.current) return;
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            const backoffDelay = 2000 * retryCountRef.current;
            setTimeout(connect, backoffDelay);
          } else {
            setError('SSE connection failed, using fallback polling');
            startPollingFallback();
          }
        };
      } catch (err) {
        console.error('Failed to create EventSource:', err);
        setError('Failed to establish SSE connection');
      }
    };

    const startPollingFallback = () => {
      if (pollingIntervalRef.current) return;
      
      const poll = async () => {
        if (completedRef.current) return;
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${entityType}s/${entityId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          if (response.ok) {
            const data = await response.json();
            onUpdateRef.current({ status: data.status, message: `Status: ${data.status}` });
            
            if (data.status && TERMINAL_SSE_STATUSES.has(data.status)) {
              finish(data.status);
            }
          }
        } catch (err) {
          console.error('Polling failed:', err);
        }
      };

      pollingIntervalRef.current = setInterval(poll, 2000);
      poll();
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [entityType, entityId, enabled, API_BASE]);

  return { isConnected, error };
}
