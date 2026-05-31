// Real-time event hub (SSE-based) + WhatsApp/Telegram deep links

// Build wa.me deep link with prefilled text
export function whatsappLink(phone, text) {
  if (!phone) return null;
  // Normalize: remove +, spaces, dashes; ensure it starts with country code (Iraq: 964)
  let p = String(phone).replace(/[^\d]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '964' + p.slice(1); // Iraqi local mobile → with country code
  // If <11 digits, just use as-is
  const enc = encodeURIComponent(text || '');
  return `https://wa.me/${p}${enc ? `?text=${enc}` : ''}`;
}

export function telegramLink(usernameOrPhone, text) {
  // For Telegram, we can't prefill chat with phone, but with username we can open chat
  if (!usernameOrPhone) return null;
  const u = String(usernameOrPhone).replace(/^@/, '');
  return `https://t.me/${u}`;
}

// Default WhatsApp templates (Arabic, with placeholders)
export const defaultWhatsAppTemplates = {
  activation: `🌟 *مركز الغزلان للإنترنت* 🌟

مرحبا أستاذ {name} 👋

✅ تم تفعيل اشتراكك بنجاح
📦 الباقة: {package}
⚡ السرعة: {speed}
💰 المبلغ: {amount} د.ع
💳 طريقة الدفع: {paymentMethod}
📅 تاريخ التفعيل: {startDate}
⏰ تاريخ الانتهاء: {endDate}

شكرا لثقتكم بنا 🙏
لأي استفسار: 07707889032`,

  expiry: `⚠️ *تذكير انتهاء الاشتراك* ⚠️

مرحبا أستاذ {name}

اشتراكك سينتهي بتاريخ: {endDate}
يرجى التجديد لتفادي انقطاع الخدمة

للتجديد اتصل بنا: 07707889032`,

  debt: `💰 *تذكير بالمستحقات* 💰

مرحبا أستاذ {name}

لديك مبلغ مستحق: {amount} د.ع
يرجى التسديد في أقرب وقت

للاستفسار: 07707889032`,

  welcome: `🎉 *أهلا بك في مركز الغزلان* 🎉

مرحبا أستاذ {name}

تم تسجيلك بنجاح في نظامنا 
سيتم التواصل معك قريباً لإتمام التفعيل

شكرا لاختياركم خدماتنا 🙏`,
};

export function fillTemplate(template, data) {
  if (!template) return '';
  let result = String(template);
  Object.entries(data || {}).forEach(([key, value]) => {
    const re = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(re, value ?? '');
  });
  return result;
}
