# 🚀 دليل النشر على Vercel — مركز الغزلان ERP

## 📋 خطوات النشر السريع

### 1. متغيرات البيئة المطلوبة (Vercel Dashboard → Settings → Environment Variables)

#### 🔴 إلزامي:

| المتغير | الوصف | مثال |
|---------|------|------|
| `MONGO_URL` | اتصال MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `DB_NAME` | اسم قاعدة البيانات | `ghazlan_erp` |
| `NEXT_PUBLIC_BASE_URL` | الرابط الكامل للموقع | `https://your-app.vercel.app` |

#### 🟡 موصى به:

| المتغير | الوصف |
|---------|------|
| `EMERGENT_LLM_KEY` | لتفعيل AI Insights و AI Chat |
| `VAPID_PUBLIC_KEY` | لتفعيل Push Notifications |
| `VAPID_PRIVATE_KEY` | لتفعيل Push Notifications |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | نفس قيمة VAPID_PUBLIC_KEY (للمتصفح) |
| `VAPID_CONTACT_EMAIL` | بريد إلكتروني لـ VAPID |

#### 🟢 اختياري (WhatsApp - يحتاج خادم منفصل):

| المتغير | الوصف |
|---------|------|
| `WHATSAPP_SERVICE_URL` | رابط خدمة WhatsApp المستضافة على Render/Railway |
| `WHATSAPP_SERVICE_TOKEN` | Token للمصادقة مع خدمة WhatsApp |

> ⚠️ **WhatsApp Microservice لا يعمل على Vercel** (يحتاج Chromium وعملية دائمة). انشره منفصلاً على Render/Railway/VPS.

### 2. أوامر البناء (Build Settings — مضبوطة تلقائياً)

- **Framework Preset:** Next.js
- **Build Command:** `yarn build` (أو يُكتشف تلقائياً)
- **Output Directory:** `.next` (افتراضي)
- **Install Command:** `yarn install`
- **Node Version:** 18.x أو 20.x

### 3. ملف vercel.json (موجود في المشروع)

النظام يدعم تلقائياً:
- ✅ API Routes كاملة عبر catch-all `[[...path]]`
- ✅ Service Worker على `/sw.js`
- ✅ PWA Manifest على `/manifest.json`
- ✅ CORS Headers
- ✅ تخزين رصيد الـ icons لمدة أسبوع

### 4. MongoDB Atlas (موصى به)

1. أنشئ حساب على [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (مجاني)
2. أنشئ Cluster من نوع M0 (مجاني)
3. **Network Access** → Add IP → `0.0.0.0/0` (لـ Vercel)
4. **Database Access** → Create user
5. **Connect** → Copy connection string
6. ضع الرابط في Vercel كـ `MONGO_URL`

### 5. التحقق بعد النشر

افتح هذه المسارات للتأكد:

| المسار | المتوقع |
|--------|---------|
| `/` | الصفحة الرئيسية (يجب تسجيل الدخول) |
| `/admin/login` | صفحة الدخول |
| `/api/dashboard/stats` | JSON يحتوي الإحصائيات |
| `/api/products` | مصفوفة المنتجات |
| `/api/mobile-app/info` | معلومات APK |
| `/store` | المتجر الإلكتروني |
| `/employee` | بوابة الموظف |

### 6. القيود المعروفة على Vercel

| الميزة | الحالة على Vercel |
|--------|-------------------|
| ✅ كل الـ APIs | تعمل |
| ✅ MongoDB | يعمل (مع Atlas) |
| ✅ PWA + Service Worker | يعمل |
| ✅ Push Notifications | يعمل (مع VAPID) |
| ✅ AI Chat + Insights | يعمل (مع EMERGENT_LLM_KEY) |
| ⚠️ رفع الملفات (uploads) | لا يحفظ بين الطلبات — استخدم S3/Cloudinary |
| ❌ WhatsApp Service | لا يعمل — انشره منفصلاً |
| ⚠️ Backup إلى ملفات | لا يحفظ — استخدم تحميل JSON المباشر |

## 🐛 حل المشاكل الشائعة

| المشكلة | الحل |
|--------|------|
| `MONGO_URL is not defined` | أضف المتغير في Vercel Dashboard |
| `ScrollArea is not defined` | تأكد من آخر نسخة من الكود (تم الإصلاح في 2026-05-22) |
| `Failed to fetch` | تحقق من `NEXT_PUBLIC_BASE_URL` (يجب أن يطابق نطاق Vercel) |
| Push Notifications لا تعمل | تأكد من إضافة جميع مفاتيح VAPID (الثلاثة) |
| AI Chat لا يستجيب | تأكد من `EMERGENT_LLM_KEY` |
| WhatsApp `not connected` | متوقع على Vercel — انشر الخدمة منفصلاً |

## 📞 الدعم

- **Production-ready:** ✅ نعم
- **MongoDB Connection Pooling:** ✅ مفعّل
- **Error Boundary:** ✅ مفعّل
- **Service Worker:** ✅ مفعّل
- **CORS:** ✅ مفعّل
- **Test Credentials:** انظر `/app/memory/test_credentials.md`
