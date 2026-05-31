'use client';
import { useEffect, useRef } from 'react';

// Simple Leaflet map - dynamic import to avoid SSR
export function GPSMap({ lat, lng, label = 'الموقع', height = 300 }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    if (!lat || !lng) return;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!mounted || !containerRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(containerRef.current).setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      const icon = L.divIcon({
        html: '<div style="background:#d4af37;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(212,175,55,0.8);"></div>',
        className: '', iconSize: [24, 24], iconAnchor: [12, 12],
      });
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(label).openPopup();
      mapRef.current = map;
    })();
    return () => { mounted = false; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng, label]);

  if (!lat || !lng) {
    return <div className="h-32 rounded-lg bg-input/30 flex items-center justify-center text-xs text-muted-foreground">📍 لم يتم تسجيل الموقع لهذه البصمة</div>;
  }
  return (
    <div className="space-y-2">
      <div ref={containerRef} style={{ height: `${height}px`, borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(212,175,55,0.3)' }} />
      <p className="text-[10px] text-muted-foreground text-center font-mono">
        📍 {lat.toFixed(6)}, {lng.toFixed(6)} ·
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline mr-1">فتح في Google Maps</a>
      </p>
    </div>
  );
}

// Barcode component
export function Barcode({ value, height = 60, displayValue = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!value || !ref.current) return;
    (async () => {
      const JsBarcode = (await import('jsbarcode')).default;
      try {
        JsBarcode(ref.current, String(value), {
          format: 'CODE128', height, width: 1.5,
          displayValue, fontSize: 12, background: '#ffffff', lineColor: '#000000',
          margin: 4,
        });
      } catch (e) { console.error(e); }
    })();
  }, [value, height, displayValue]);
  return <svg ref={ref} />;
}
