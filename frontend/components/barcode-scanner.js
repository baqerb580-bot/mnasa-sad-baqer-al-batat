'use client';

/**
 * 📷 Barcode/QR Scanner using device camera
 * - Uses html5-qrcode library (supports EAN-13, UPC, Code128, QR, Data Matrix, etc.)
 * - Switches between cameras (front/back/external)
 * - Calls onDetected(decodedText, decodedResult) when a code is recognized
 * - Auto-stops on first valid scan, but can be set to continuous mode
 */
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, X, RefreshCw, ZapOff, Zap, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export function BarcodeScanner({ open, onClose, onDetected, continuous = false, title = 'مسح الباركود بالكاميرا' }) {
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef(null);
  const elementId = 'barcode-scanner-region';

  // Load cameras on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!devices?.length) {
          setError('❌ لم يتم العثور على كاميرا في هذا الجهاز.');
          return;
        }
        setCameras(devices);
        // Prefer back camera
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        setCurrentCameraId(back.id);
      } catch (e) {
        setError('فشل الوصول للكاميرا: ' + (e?.message || 'تأكد من السماح بصلاحية الكاميرا.'));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Start/stop scanner when camera changes
  useEffect(() => {
    if (!open || !currentCameraId) return;
    let html5Qrcode = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        // Limit formats to common barcodes for faster scanning
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ];
        html5Qrcode = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = html5Qrcode;
        setScanning(true);
        setError(null);
        // Use high-res back camera with continuous autofocus for sharper images
        const cameraConfig = (typeof currentCameraId === 'string' && currentCameraId)
          ? { deviceId: { exact: currentCameraId } }
          : { facingMode: { ideal: 'environment' } };
        await html5Qrcode.start(
          cameraConfig,
          {
            fps: 30,
            qrbox: (w, h) => {
              const minEdge = Math.min(w, h);
              const size = Math.floor(minEdge * 0.8);
              return { width: size, height: Math.floor(size * 0.55) };
            },
            aspectRatio: window.innerWidth < 640 ? 1.3333334 : 1.7777778,
            disableFlip: false,
            videoConstraints: {
              deviceId: typeof currentCameraId === 'string' ? { exact: currentCameraId } : undefined,
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              advanced: [
                { focusMode: 'continuous' },
                { focusMode: 'auto' },
                { exposureMode: 'continuous' },
                { whiteBalanceMode: 'continuous' },
              ],
            },
          },
          (decodedText, decodedResult) => {
            // success callback - instant capture
            const now = Date.now();
            // Debounce duplicate scans within 800ms
            if (lastScanRef.current && lastScanRef.current.text === decodedText && (now - lastScanRef.current.ts) < 800) {
              return;
            }
            const scan = { text: decodedText, format: decodedResult?.result?.format?.formatName, ts: now };
            lastScanRef.current = scan;
            setLastScan(scan);
            try { navigator.vibrate?.(80); } catch {}
            try { onDetected?.(decodedText, decodedResult); } catch {}
            if (!continuous) {
              try { html5Qrcode.stop().catch(() => {}); } catch {}
              setScanning(false);
            }
          },
          () => {} // error callback (fired every frame, ignore)
        );
        // After start, try to apply continuous autofocus on the video track explicitly
        try {
          const vid = document.querySelector(`#${elementId} video`);
          const track = vid?.srcObject?.getVideoTracks?.()?.[0];
          if (track && 'applyConstraints' in track) {
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            const advanced = [];
            if (caps.focusMode && caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
            if (caps.exposureMode && caps.exposureMode.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
            if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
            if (advanced.length) await track.applyConstraints({ advanced }).catch(() => {});
          }
        } catch {}
      } catch (e) {
        if (!cancelled) setError('تعذّر تشغيل الكاميرا: ' + (e?.message || 'حاول إعادة المحاولة'));
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (html5Qrcode && html5Qrcode.isScanning) html5Qrcode.stop().catch(() => {});
      } catch {}
      scannerRef.current = null;
    };
  }, [open, currentCameraId, continuous, onDetected]);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex(c => c.id === currentCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    setCurrentCameraId(next.id);
  };

  const toggleTorch = async () => {
    const sc = scannerRef.current;
    if (!sc) return;
    try {
      const stream = sc.getVideoElement?.()?.srcObject;
      const track = stream?.getVideoTracks?.()?.[0];
      if (!track || !('applyConstraints' in track)) {
        toast.warning('⚠️ هذا المتصفح لا يدعم الفلاش');
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch (e) {
      toast.error('الكاميرا لا تدعم الفلاش');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="glass-strong border-cyan-500/40 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 flex items-center gap-2">
            <Camera className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Camera preview */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-cyan-500/30">
            <div id={elementId} className="w-full h-full" />
            {!scanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-cyan-400/50">
                <Camera className="w-16 h-16 animate-pulse" />
              </div>
            )}
            {scanning && (
              <>
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 animate-pulse" style={{ animation: 'scan-line 2s ease-in-out infinite' }} />
                <Badge className="absolute top-2 right-2 bg-emerald-500/30 text-emerald-300 border-emerald-500/50 text-[10px]">
                  <ScanLine className="w-3 h-3 ml-1 animate-pulse" /> جاري المسح...
                </Badge>
              </>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</p>
              </div>
            )}
            <style jsx>{`
              @keyframes scan-line {
                0% { top: 10%; }
                50% { top: 85%; }
                100% { top: 10%; }
              }
            `}</style>
          </div>

          {/* Last scan result */}
          {lastScan && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] text-emerald-300/70">آخر باركود مكتشف:</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-emerald-400 truncate">{lastScan.text}</p>
                {lastScan.format && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]">{lastScan.format}</Badge>}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {cameras.length > 1 && (
              <Button size="sm" variant="outline" onClick={switchCamera} className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10">
                <RefreshCw className="w-3 h-3 ml-1" /> تبديل الكاميرا
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={toggleTorch} className={`${torchOn ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'border-zinc-500/40 text-zinc-400'}`}>
              {torchOn ? <Zap className="w-3 h-3 ml-1" /> : <ZapOff className="w-3 h-3 ml-1" />}
              {torchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
            </Button>
            <p className="text-[10px] text-muted-foreground flex-1 min-w-0">
              📌 وجّه الكاميرا نحو الباركود (EAN، UPC، QR، Code128 وغيرها)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full border-zinc-500/40">
            <X className="w-4 h-4 ml-2" /> إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BarcodeScanner;
