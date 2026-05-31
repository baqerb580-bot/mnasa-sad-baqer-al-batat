'use client';
import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Share2, Plus } from 'lucide-react';

/**
 * Professional PWA Install Prompt
 * - Detects mobile/desktop
 * - Shows native install on Android/Desktop via beforeinstallprompt
 * - Shows instructions for iOS (no native API)
 * - Registers service worker
 */
export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Register service worker
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope);
          // Check for updates every 60s
          setInterval(() => reg.update().catch(() => {}), 60000);

          // Auto-update on new SW: skip waiting, then reload page once new SW activates
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (nw) {
              nw.addEventListener('statechange', () => {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version available — applying…');
                  // Tell new SW to skip waiting and become active
                  nw.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          // When the controlling SW changes, reload once to use fresh assets
          let reloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            console.log('[PWA] SW controller changed — reloading');
            window.location.reload();
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    }

    // Detect standalone mode (already installed)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Listen for install prompt (Android/Desktop Chrome/Edge)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Don't show immediately if dismissed recently
      const lastDismissed = Number(localStorage.getItem('pwa_dismissed_at') || 0);
      const oneDay = 24 * 60 * 60 * 1000;
      if (!standalone && Date.now() - lastDismissed > oneDay) {
        setTimeout(() => setShowBanner(true), 5000); // delay 5s after page load
      }
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', '1');
    });

    // Show iOS guide for iPhone users (if not installed and not dismissed)
    if (ios && !standalone) {
      const lastDismissed = Number(localStorage.getItem('pwa_ios_dismissed_at') || 0);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastDismissed > sevenDays) {
        setTimeout(() => setShowBanner(true), 6000);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem(isIOS ? 'pwa_ios_dismissed_at' : 'pwa_dismissed_at', String(Date.now()));
  };

  // Don't show anything if already installed
  if (isStandalone) return null;

  // iOS Guide modal
  if (showIOSGuide) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4"
        onClick={() => setShowIOSGuide(false)}
      >
        <div
          className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f19] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#d4af37] flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> ثبّت التطبيق على iPhone
            </h3>
            <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-[#d4af37] text-black rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">1</span>
              <span>اضغط على زر المشاركة <Share2 className="inline w-4 h-4 mx-1 text-blue-400" /> في الأسفل (Safari)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-[#d4af37] text-black rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">2</span>
              <span>اختر <strong>إضافة إلى الشاشة الرئيسية</strong> <Plus className="inline w-4 h-4 mx-1" /></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-[#d4af37] text-black rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">3</span>
              <span>اضغط <strong>إضافة</strong> في الزاوية اليمنى العليا</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-[#d4af37] text-black rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">4</span>
              <span>سيظهر تطبيق <strong>مركز الغزلان</strong> على شاشتك الرئيسية 🎉</span>
            </li>
          </ol>
          <button
            onClick={() => { setShowIOSGuide(false); dismiss(); }}
            className="mt-5 w-full bg-[#d4af37] text-black font-bold py-3 rounded-xl hover:bg-[#c4a030] transition"
          >
            ✅ فهمت
          </button>
        </div>
      </div>
    );
  }

  // Install banner (Android / Desktop / iOS)
  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[9998] animate-in slide-in-from-bottom-4"
      dir="rtl"
    >
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f19] border border-[#d4af37]/50 rounded-2xl shadow-2xl p-4 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-96.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-[#d4af37] text-sm flex items-center gap-1">
              {isIOS ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              ثبّت مركز الغزلان
            </h4>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              {isIOS
                ? 'أضفه إلى شاشتك الرئيسية واستخدمه كتطبيق حقيقي 🚀'
                : 'ثبّته على جهازك للوصول السريع والعمل بدون متصفح'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="flex-1 bg-[#d4af37] hover:bg-[#c4a030] text-black font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition"
              >
                <Download className="w-4 h-4" /> {isIOS ? 'كيف؟' : 'تثبيت'}
              </button>
              <button
                onClick={dismiss}
                className="text-xs px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                ليس الآن
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-500 hover:text-white p-1"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
