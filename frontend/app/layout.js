import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import PWAInstaller from '@/components/pwa-installer';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: 'مركز الغزلان ERP | Smart ISP & Enterprise Platform',
  description: 'منصة ERP + NOC + POS + AI متكاملة لإدارة شركات الإنترنت والمبيعات والصيانة',
  applicationName: 'مركز الغزلان',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'مركز الغزلان',
    startupImage: '/icons/icon-512.png',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/favicon-32.png',
  },
  openGraph: {
    title: 'مركز الغزلان ERP',
    description: 'منصة ERP + NOC + POS + AI متكاملة',
    images: ['/icons/icon-512.png'],
    type: 'website',
    locale: 'ar_IQ',
  },
};

export const viewport = {
  themeColor: '#d4af37',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        {/* Apple PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="مركز الغزلان" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Windows tiles */}
        <meta name="msapplication-TileColor" content="#0f0f19" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />
        <meta name="msapplication-navbutton-color" content="#d4af37" />
        {/* Splash background for safe area on mobile */}
        <meta name="theme-color" content="#0f0f19" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" theme="dark" richColors />
        <PWAInstaller />
      </body>
    </html>
  );
}
