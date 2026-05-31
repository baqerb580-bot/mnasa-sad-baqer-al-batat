# 🚀 Vercel Deployment Guide — مركز الغزلان ERP

## ⚠️ المشكلة الشائعة: تسجيل الدخول لا يعمل بعد النشر على Vercel

السبب: قاعدة البيانات على Vercel فارغة (MongoDB Atlas جديدة) فلا يوجد فيها حساب admin.

## ✅ الحل السريع (دقيقتان)

### 1️⃣ افتح هذا الرابط في المتصفح بعد النشر:
```
https://YOUR-VERCEL-URL.vercel.app/api/setup
```

سيقوم تلقائياً بـ:
- ✅ إنشاء حساب `admin` بكلمة سر `admin1982`
- ✅ إنشاء حساب `superadmin` بكلمة سر `SuperAdmin@2026`
- ✅ زرع البيانات في الـ 3 أنظمة (users / employees / settings)
- ✅ مسح أي قفل حسابات سابق
- ✅ إظهار تقرير تشخيص JSON كامل

### 2️⃣ سجّل الدخول:
| البوابة | الرابط | المستخدم | كلمة السر |
|---------|--------|----------|----------|
| Super Admin | `/admin/login` | `admin` | `admin1982` |
| Employee | `/employee` | `admin` | `admin1982` |

---

## 🔐 Environment Variables المطلوبة على Vercel

اذهب إلى: **Vercel Dashboard → Project → Settings → Environment Variables**

### ✅ متغيرات إلزامية (Required)
| المتغير | القيمة | ملاحظات |
|---------|--------|---------|
| `MONGO_URL` | `mongodb+srv://USER:PASS@cluster.mongodb.net/?retryWrites=true&w=majority` | من MongoDB Atlas |
| `DB_NAME` | `ghazlan_erp` | اسم قاعدة البيانات |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` | رابط Vercel كاملاً (بدون / في النهاية) |

### 🟡 متغيرات اختيارية (Optional)
| المتغير | القيمة | الفائدة |
|---------|--------|---------|
| `EMERGENT_LLM_KEY` | `sk-...` | مساعد AI |
| `TELEGRAM_BOT_TOKEN` | `12345:ABC...` | بوت الإحصائيات |

---

## 📋 إعداد MongoDB Atlas (إن لم تكن أعددته)

1. اذهب إلى https://cloud.mongodb.com
2. أنشئ **Free Cluster** (M0 — مجاني)
3. **Database Access** → أنشئ مستخدم بكلمة سر قوية
4. **Network Access** → ⚠️ **مهم جداً**:
   - أضف IP: `0.0.0.0/0` (يسمح لـ Vercel بالاتصال)
   - بدون هذا، Vercel لن يستطيع الوصول
5. **Connect** → **Drivers** → انسخ connection string
6. استبدل `<username>` و `<password>` بالقيم الفعلية
7. ألصق في `MONGO_URL` على Vercel

---

## 🐛 استكشاف الأخطاء

### ❌ "بيانات الدخول غير صحيحة"
- افتح `/api/setup` لزرع الحساب تلقائياً
- إذا أظهر `seeded: []` فالحساب موجود فعلاً

### ❌ "Internal Server Error" أو 500
- افتح `/api/setup` → انظر `env.MONGO_URL_set` و `database.connected`
- إذا `connected: false` → تحقق من `MONGO_URL` على Vercel و IP whitelist على Atlas

### ❌ "Database connection failed"
- ✅ تأكد من إضافة `0.0.0.0/0` في **Network Access** على Atlas
- ✅ تأكد من صحة username/password في `MONGO_URL`
- ✅ تأكد من إضافة المتغير لكل البيئات: **Production, Preview, Development**

### ❌ "تم قفل الحساب مؤقتاً"
- افتح `/api/setup` (يمسح المحاولات الفاشلة تلقائياً)
- أو انتظر 15 دقيقة

### ❌ Cookie / Session issues
- النظام يستخدم `localStorage` + `Authorization: Bearer` header
- لا يعتمد على الكوكيز للعمل عبر النطاقات
- إذا استمرت المشكلة، امسح localStorage من DevTools

---

## 🔄 إعادة ضبط كلمة سر admin (إن نسيتها)

اذهب إلى `/api/setup` — يعيد إنشاء الحساب بكلمة السر الافتراضية `admin1982` إذا لم يكن موجوداً.

لتغيير كلمة السر فعلياً بعد الدخول:
- **Super Admin Panel** → الإعدادات → الأمان وتسجيل الدخول → تغيير كلمة المرور

---

## 📦 ما تم اختباره ويعمل على Vercel

- ✅ Next.js 14 App Router
- ✅ API Routes (`/api/**`)
- ✅ MongoDB Atlas (mongodb+srv)
- ✅ bcrypt للتشفير
- ✅ JWT-style session tokens (UUID-based)
- ✅ PWA + Service Worker
- ✅ Server-Sent Events (`/api/events/stream`)
- ✅ File uploads (logo, images via Base64)
- ✅ XLSX export (المحاسبة + النسخ الاحتياطي)
- ✅ Recharts (الرسوم البيانية)

## ⚠️ ملاحظات Vercel-specific

- **Function timeout**: 10 ثواني (Free) / 60 ثانية (Pro). 
  - النسخ الاحتياطي الكبير قد يفشل على Free — استخدم Cron Jobs منفصل
- **Static file storage**: لا يمكن الكتابة على disk على Vercel (read-only filesystem)
  - الباك أب يُحفظ في `backups` collection في MongoDB كـ Base64 (محفوظ بالفعل ✅)
- **Cold starts**: أول طلب بعد فترة خمول يكون أبطأ (~2-3 ثانية)

---

## 🆘 إذا استمرت المشكلة بعد كل ذلك

افتح هذا الرابط وأرسل ناتجه JSON:
```
https://YOUR-VERCEL-URL.vercel.app/api/setup
```

سيُظهر تشخيصاً كاملاً يساعد في تحديد المشكلة الفعلية.
