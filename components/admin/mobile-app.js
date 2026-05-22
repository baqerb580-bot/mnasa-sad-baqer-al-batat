'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Smartphone, Download, Package, CheckCircle2, AlertCircle, Copy,
  Terminal, FileCode, Settings, Zap, ChevronRight, Info
} from 'lucide-react';

export default function MobileAppPage() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const d = await api('mobile-app/info');
      setInfo(d);
    } catch (e) {
      toast.error('فشل تحميل المعلومات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInfo(); }, []);

  const downloadProject = async () => {
    setDownloading(true);
    try {
      // Trigger the download via direct URL (browser handles streaming)
      const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/mobile-app/download-project`;
      window.location.href = url;
      setTimeout(() => {
        toast.success('📥 جاري تنزيل ملف ZIP المشروع…');
        setDownloading(false);
      }, 1500);
    } catch (e) {
      toast.error('خطأ: ' + e.message);
      setDownloading(false);
    }
  };

  const copyCmd = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('📋 تم النسخ');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="glass-strong border-gold/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Smartphone className="w-6 h-6" />
                تطبيق الموبايل (Android APK)
              </CardTitle>
              <CardDescription className="mt-1">
                تطبيق Android جاهز للبناء عبر Capacitor — يفتح الموقع مباشرة كتطبيق أصلي
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              <CheckCircle2 className="w-3 h-3 ml-1" /> جاهز للبناء
            </Badge>
          </div>
        </CardHeader>

        {/* Info Grid */}
        {info && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-1">اسم التطبيق</p>
                <p className="font-bold text-sm gold-text">{info.appName}</p>
              </div>
              <div className="p-3 rounded-lg bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-1">Package ID</p>
                <p className="font-mono text-xs text-cyan-400">{info.appId}</p>
              </div>
              <div className="p-3 rounded-lg bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-1">حجم المشروع</p>
                <p className="font-bold text-sm">{info.projectSizeMB} MB</p>
              </div>
              <div className="p-3 rounded-lg bg-input/30 border border-gold-soft">
                <p className="text-[10px] text-muted-foreground mb-1">حجم APK المتوقع</p>
                <p className="font-bold text-sm text-emerald-400">~5-7 MB</p>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1">
              <p className="flex items-center gap-2"><Info className="w-3 h-3 text-cyan-400" /> <strong>URL المستهدف:</strong> <span className="font-mono text-cyan-400" dir="ltr">{info.serverUrl}</span></p>
              <p>📱 يدعم: Android 5.1+ · صلاحيات الكاميرا + الشبكة + الإشعارات · توجيه عمودي</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="download" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-input/30">
          <TabsTrigger value="download"><Download className="w-3 h-3 ml-1" /> تنزيل المشروع</TabsTrigger>
          <TabsTrigger value="build"><Terminal className="w-3 h-3 ml-1" /> خطوات البناء</TabsTrigger>
          <TabsTrigger value="features"><Settings className="w-3 h-3 ml-1" /> المميزات</TabsTrigger>
        </TabsList>

        {/* Download Tab */}
        <TabsContent value="download" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-gold" /> الخيار 1: تنزيل المشروع المُجهَّز كاملاً</CardTitle>
              <CardDescription>ZIP يحتوي مشروع Android كامل (Gradle + Manifest + Icons + Splash)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={downloadProject}
                disabled={downloading}
                className="btn-gold w-full h-14 text-lg"
              >
                {downloading ? (
                  <>⏳ جاري التحضير…</>
                ) : (
                  <>
                    <Download className="w-5 h-5 ml-2" />
                    تنزيل مشروع Android (.zip)
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                💡 بعد التنزيل: فك الضغط ثم نفّذ <code className="text-gold font-mono">cd android && ./gradlew assembleDebug</code>
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileCode className="w-4 h-4 text-cyan-400" /> الخيار 2: استخدام Save to GitHub</CardTitle>
              <CardDescription>إذا حفظت المشروع على GitHub، يحتوي على مجلد <code>/android</code> جاهز</CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="p-2 rounded bg-input/30 font-mono text-[11px] flex items-center justify-between">
                <span dir="ltr">git clone &lt;your-repo&gt; && cd &lt;repo&gt;</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCmd('git clone <your-repo> && cd <repo>')}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="p-2 rounded bg-input/30 font-mono text-[11px] flex items-center justify-between">
                <span dir="ltr">yarn install && npx cap sync android</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCmd('yarn install && npx cap sync android')}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="p-2 rounded bg-input/30 font-mono text-[11px] flex items-center justify-between">
                <span dir="ltr">cd android && ./gradlew assembleDebug</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCmd('cd android && ./gradlew assembleDebug')}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Build Steps Tab */}
        <TabsContent value="build" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4 text-gold" /> متطلبات البناء</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { name: 'Java JDK 17+', cmd: 'java -version', hint: 'حمّل من: adoptium.net' },
                { name: 'Android SDK (API 34+)', cmd: 'sdkmanager --list', hint: 'حمّل Android Studio أو Command Line Tools' },
                { name: 'متغير ANDROID_HOME', cmd: 'echo $ANDROID_HOME', hint: 'يجب أن يشير لمجلد Android SDK' },
              ].map((req, i) => (
                <div key={i} className="p-3 rounded-lg bg-input/30 border border-gold-soft space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{i + 1}. {req.name}</p>
                    <Badge variant="outline" className="text-[9px]">مطلوب</Badge>
                  </div>
                  <div className="flex items-center justify-between bg-background/50 rounded px-2 py-1 font-mono text-[11px]">
                    <span dir="ltr">{req.cmd}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyCmd(req.cmd)}><Copy className="w-2.5 h-2.5" /></Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">💡 {req.hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-400" /> أوامر البناء</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="font-bold text-emerald-400 text-xs mb-2 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Debug APK (للاختبار)
                </p>
                <div className="bg-background/70 rounded p-2 font-mono text-[11px] flex items-center justify-between">
                  <span dir="ltr">cd android && ./gradlew assembleDebug</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyCmd('cd android && ./gradlew assembleDebug')}><Copy className="w-3 h-3" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  ✅ الناتج: <code>android/app/build/outputs/apk/debug/app-debug.apk</code>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <p className="font-bold text-blue-400 text-xs mb-2 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> Release APK (للنشر)
                </p>
                <div className="bg-background/70 rounded p-2 font-mono text-[11px] flex items-center justify-between">
                  <span dir="ltr">cd android && ./gradlew assembleRelease</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyCmd('cd android && ./gradlew assembleRelease')}><Copy className="w-3 h-3" /></Button>
                </div>
                <p className="text-[10px] text-amber-400 mt-2">
                  ⚠️ يحتاج keystore للتوقيع — انظر ANDROID_BUILD.md للتفاصيل
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="font-bold text-purple-400 text-xs mb-2 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> فتح في Android Studio
                </p>
                <div className="bg-background/70 rounded p-2 font-mono text-[11px] flex items-center justify-between">
                  <span dir="ltr">npx cap open android</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyCmd('npx cap open android')}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <p className="font-bold text-cyan-400 text-xs mb-2 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> تثبيت APK على الهاتف
                </p>
                <div className="bg-background/70 rounded p-2 font-mono text-[11px] flex items-center justify-between">
                  <span dir="ltr">adb install android/app/build/outputs/apk/debug/app-debug.apk</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyCmd('adb install android/app/build/outputs/apk/debug/app-debug.apk')}><Copy className="w-3 h-3" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">أو انقل ملف APK يدوياً للهاتف وفعّل "تثبيت من مصادر غير معروفة"</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-xs">
              <p className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-amber-400">ملاحظة:</strong> البناء يتم محلياً على جهازك (الحاوية السحابية لا تحتوي Android SDK).
                  المدة المتوقعة: 2-5 دقائق في أول بناء، ثم 30 ثانية للبناءات اللاحقة.
                </span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-3">
          <Card className="glass-card border-gold-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-gold" /> مميزات التطبيق المدمجة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {[
                  { icon: '🎨', title: 'تصميم داكن', desc: 'خلفية #0a0a0a + ذهبي #d4af37' },
                  { icon: '🖼️', title: 'أيقونة مخصصة', desc: 'شعار "مركز الغزلان" بجميع الكثافات' },
                  { icon: '⚡', title: 'Splash Screen', desc: 'شاشة افتتاحية مع الشعار (2 ثانية)' },
                  { icon: '📷', title: 'الكاميرا', desc: 'صلاحيات لمسح الباركود' },
                  { icon: '🔔', title: 'الإشعارات', desc: 'صلاحيات Push Notifications' },
                  { icon: '🌐', title: 'الشبكة', desc: 'INTERNET + WIFI_STATE' },
                  { icon: '💾', title: 'التخزين', desc: 'READ + WRITE EXTERNAL_STORAGE' },
                  { icon: '📱', title: 'توجيه ثابت', desc: 'عمودي (Portrait) فقط' },
                  { icon: '🌍', title: 'دعم العربية', desc: 'RTL تلقائي + RECOVERY' },
                  { icon: '🔒', title: 'HTTPS فقط', desc: 'اتصال آمن (no cleartext)' },
                ].map((f, i) => (
                  <div key={i} className="p-2 rounded bg-input/30 border border-gold-soft flex items-start gap-2">
                    <span className="text-lg">{f.icon}</span>
                    <div>
                      <p className="font-bold text-[11px]">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-base">🔌 Capacitor Plugins المدمجة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p>✅ <code className="text-gold">@capacitor/core</code> — النواة</p>
              <p>✅ <code className="text-gold">@capacitor/app</code> — أحداث التطبيق (back button, deep links)</p>
              <p>✅ <code className="text-gold">@capacitor/splash-screen</code> — شاشة افتتاحية</p>
              <p>✅ <code className="text-gold">@capacitor/status-bar</code> — تخصيص شريط الحالة</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
