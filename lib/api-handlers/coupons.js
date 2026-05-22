// Auto-extracted handler module
import { ok, err, getJsonBody, logActivity } from './_helpers';
import { v4 as uuidv4 } from 'uuid';

export async function handleCoupons(ctx) {
  const { path, method, request, db, clientIp } = ctx;

  if (path === 'coupons' && method === 'GET') {
    try {
      const coupons = await db.collection('coupons').find({}).sort({ createdAt: -1 }).toArray();
      const cleaned = coupons.map(c => { delete c._id; return c; });
      return ok(cleaned);
    } catch (e) { return ok([]); }
  }

  if (path === 'coupons' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      const code = String(body.code || '').toUpperCase().trim();
      if (!code) return err('كود الكوبون مطلوب', 400);
      if (!body.type || !['percent', 'fixed'].includes(body.type)) return err('نوع غير صحيح (percent/fixed)', 400);
      const value = Number(body.value);
      if (isNaN(value) || value <= 0) return err('قيمة غير صحيحة', 400);
      const existing = await db.collection('coupons').findOne({ code });
      if (existing) return err('كود الكوبون موجود مسبقاً', 400);
      const doc = {
        id: uuidv4(),
        code,
        type: body.type,
        value,
        minOrder: Number(body.minOrder || 0),
        maxUses: Number(body.maxUses || 0),  // 0 = unlimited
        usedCount: 0,
        expiresAt: body.expiresAt || null,
        description: body.description || '',
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await db.collection('coupons').insertOne(doc);
      delete doc._id;
      await logActivity(db, { action: 'coupon_created', entity: 'coupons', entityId: doc.id, details: `إنشاء كوبون ${code}: ${value}${doc.type === 'percent' ? '%' : ' د.ع'}`, ip: clientIp });
      return ok(doc, 201);
    } catch (e) { return err(e.message, 500); }
  }

  if (path.match(/^coupons\/[^/]+$/) && method === 'PUT') {
    try {
      const id = path.split('/')[1];
      const body = await getJsonBody(request);
      const update = {};
      ['active', 'description', 'minOrder', 'maxUses', 'value', 'expiresAt'].forEach(k => {
        if (body[k] !== undefined) update[k] = body[k];
      });
      update.updatedAt = new Date().toISOString();
      await db.collection('coupons').updateOne({ id }, { $set: update });
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  if (path.match(/^coupons\/[^/]+$/) && method === 'DELETE') {
    try {
      const id = path.split('/')[1];
      await db.collection('coupons').deleteOne({ id });
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  // Validate coupon (used at checkout)
  if (path === 'coupons/validate' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      const code = String(body.code || '').toUpperCase().trim();
      const orderTotal = Number(body.orderTotal || 0);
      if (!code) return err('كود مطلوب', 400);
      const c = await db.collection('coupons').findOne({ code });
      if (!c) return ok({ valid: false, error: 'كوبون غير موجود' });
      if (!c.active) return ok({ valid: false, error: 'الكوبون غير مفعّل' });
      if (c.expiresAt && new Date(c.expiresAt) < new Date()) return ok({ valid: false, error: 'الكوبون منتهي الصلاحية' });
      if (c.maxUses > 0 && c.usedCount >= c.maxUses) return ok({ valid: false, error: 'تم استنفاد عدد استخدامات الكوبون' });
      if (c.minOrder > 0 && orderTotal < c.minOrder) return ok({ valid: false, error: `الحد الأدنى للطلب: ${c.minOrder.toLocaleString('en-US')} د.ع` });
      // Calculate discount
      let discount = 0;
      if (c.type === 'percent') discount = Math.round(orderTotal * c.value / 100);
      else discount = Math.min(c.value, orderTotal);
      return ok({
        valid: true,
        coupon: { id: c.id, code: c.code, type: c.type, value: c.value, description: c.description },
        discount,
        finalTotal: Math.max(0, orderTotal - discount),
      });
    } catch (e) { return err(e.message, 500); }
  }



  return null; // not handled by this module
}
