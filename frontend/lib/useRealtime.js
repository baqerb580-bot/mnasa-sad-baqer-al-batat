'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Subscribe to server-sent events stream.
 * @param {object} handlers - keyed by event type (e.g. { task_new: fn, subscriber_activated: fn })
 */
export function useRealtimeEvents(handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let es = null;
    let reconnect = null;

    const connect = () => {
      try {
        es = new EventSource(`/api/events/stream?since=${Date.now()}`);
        es.onopen = () => setConnected(true);
        es.onerror = () => {
          setConnected(false);
          try { es && es.close(); } catch {}
          // Reconnect after 3s
          if (reconnect) clearTimeout(reconnect);
          reconnect = setTimeout(connect, 3000);
        };
        // Listen on known event types
        const types = ['hello', 'ping', 'task_new', 'subscriber_activated', 'attendance_late', 'attendance_checkin', 'attendance_checkout', 'location_request_new', 'location_request_approved', 'location_request_rejected', 'employee_location', 'order_new'];
        for (const t of types) {
          es.addEventListener(t, (ev) => {
            try {
              const data = JSON.parse(ev.data);
              const fn = handlersRef.current[t] || handlersRef.current['*'];
              if (fn) fn(data, t);
            } catch {}
          });
        }
      } catch {
        if (reconnect) clearTimeout(reconnect);
        reconnect = setTimeout(connect, 3000);
      }
    };
    connect();

    return () => {
      try { es && es.close(); } catch {}
      if (reconnect) clearTimeout(reconnect);
    };
  }, []);

  return connected;
}
