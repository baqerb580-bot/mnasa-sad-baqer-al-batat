# 📱 بناء تطبيق Android APK لـ مركز الغزلان

تطبيق Android جاهز للبناء عبر **Capacitor** (نمط WebView).

## 🎯 معلومات التطبيق

| المعلومة | القيمة |
|---------|--------|
| **اسم التطبيق** | مركز الغزلان |
| **Package ID** | `com.ghazlan.erp` |
| **النوع** | WebView Wrapper (يفتح الموقع المباشر) |
| **URL المستهدف** | `https://isp-noc-hub.preview.emergentagent.com` |
| **حجم APK المتوقع** | ~5 ميجابايت |
| **الحد الأدنى لـ Android** | 5.1 (API 22) |

## 🛠️ متطلبات البناء (على جهازك المحلي)

```bash
# 1. Java JDK 17+
java -version  # يجب أن يكون 17 أو أعلى

# 2. Android SDK
# نزّل Android Studio من: https://developer.android.com/studio
# أو فقط Command Line Tools

# 3. تأكد من متغيرات البيئة
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 4. ثبّت أدوات SDK المطلوبة
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

## 🚀 خطوات البناء (سريعة - 3 دقائق)

### الخطوة 1: انسخ المشروع
استخدم زر **"Save to GitHub"** في Emergent، ثم على جهازك:

```bash
git clone <your-repo>
cd <repo>
yarn install
```

### الخطوة 2: مزامنة Capacitor

```bash
npx cap sync android
```

### الخطوة 3: بناء APK

#### 🟢 الطريقة A: Debug APK (للاختبار - بدون توقيع)
```bash
cd android
./gradlew assembleDebug
```
الناتج: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 🔵 الطريقة B: Release APK (للتوزيع - يحتاج توقيع)
```bash
# 1. أنشئ keystore (مرة واحدة فقط)
keytool -genkey -v -keystore ghazlan.keystore \
        -alias ghazlan -keyalg RSA -keysize 2048 -validity 10000

# 2. ضع الـ keystore في android/app/

# 3. أضف في android/app/build.gradle داخل android{}:
#    signingConfigs {
#      release {
#        storeFile file('ghazlan.keystore')
#        storePassword 'YOUR_PASSWORD'
#        keyAlias 'ghazlan'
#        keyPassword 'YOUR_PASSWORD'
#      }
#    }
#    buildTypes { release { signingConfig signingConfigs.release } }

# 4. بناء
cd android
./gradlew assembleRelease
```
الناتج: `android/app/build/outputs/apk/release/app-release.apk`

### الخطوة 4 (اختياري): فتح في Android Studio

```bash
npx cap open android
```
ثم: **Build → Build Bundle(s)/APK(s) → Build APK(s)**

## 📦 تثبيت APK على هاتف Android

```bash
# عبر USB Debugging
adb install android/app/build/outputs/apk/debug/app-debug.apk

# أو انقل ملف .apk إلى الهاتف وثبّته يدوياً
# (فعّل "Install from Unknown Sources" في الإعدادات)
```

## 🔧 تخصيصات مدمجة بالفعل

- ✅ اسم التطبيق: `مركز الغزلان` (عربي)
- ✅ Package ID: `com.ghazlan.erp`
- ✅ أيقونة التطبيق من شعار `مركز الغزلان` (جميع الكثافات)
- ✅ Splash Screen أسود (`#0a0a0a`) مع الشعار في المنتصف
- ✅ ألوان داكنة (Status Bar أسود، Accent ذهبي)
- ✅ توجيه عمودي مفروض (Portrait)
- ✅ صلاحيات الكاميرا (لمسح الباركود) + التخزين + الشبكة + الإشعارات
- ✅ دعم RTL تلقائي
- ✅ يستخدم HTTPS فقط (آمن)

## 🌐 تغيير عنوان السيرفر

لتغيير URL السيرفر المستهدف، عدّل ملف `/app/capacitor.config.json`:

```json
{
  "server": {
    "url": "https://your-new-url.com"
  }
}
```
ثم: `npx cap sync android`

## 🐛 أخطاء شائعة

| الخطأ | الحل |
|------|------|
| `SDK location not found` | أنشئ `android/local.properties` وأضف `sdk.dir=/path/to/Android/Sdk` |
| `Java version mismatch` | استخدم JDK 17 أو 21 (وليس JDK 8 القديم) |
| `Gradle build failed` | شغّل `cd android && ./gradlew clean` ثم أعد البناء |
| APK لا يفتح الموقع | تأكد من اتصال الإنترنت + URL في `capacitor.config.json` |

## 🚀 رفع APK إلى Google Play (لاحقاً)

1. ابنِ **AAB** بدل APK: `./gradlew bundleRelease`
2. الملف في: `android/app/build/outputs/bundle/release/app-release.aab`
3. ارفعه في [Google Play Console](https://play.google.com/console)

---

**ملاحظة:** الحاوية السحابية (Kubernetes) لا تحتوي على Android SDK، لذا البناء يجب أن يتم محلياً.
