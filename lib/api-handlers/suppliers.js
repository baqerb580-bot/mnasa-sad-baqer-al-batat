// Auto-extracted handler module
import { ok, err, getJsonBody, logActivity } from './_helpers';
import { v4 as uuidv4 } from 'uuid';

export async function handleSuppliers(ctx) {
  const { path, method, request, db, clientIp } = ctx;

  // ----- Suppliers CRUD -----
  if (path === 'suppliers' && method === 'GET') {
    try {
      const list = await db.collection('suppliers').find({}).sort({ createdAt: -1 }).toArray();
      return ok(list.map(s => { delete s._id; return s; }));
    } catch (e) { return ok([]); }
  }

  if (path === 'suppliers' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      if (!body.name) return err('الاسم مطلوب', 400);
      const doc = {
        id: uuidv4(),
        name: body.name,
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        contactPerson: body.contactPerson || '',
        category: body.category || 'عام',
        paymentTerms: body.paymentTerms || 'نقدي',
        notes: body.notes || '',
        balance: Number(body.balance || 0), // positive = we owe them
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await db.collection('suppliers').insertOne(doc);
      delete doc._id;
      await logActivity(db, { action: 'supplier_created', entity: 'suppliers', entityId: doc.id, details: `إضافة مورد: ${doc.name}`, ip: clientIp });
      return ok(doc, 201);
    } catch (e) { return err(e.message, 500); }
  }

  if (path.match(/^suppliers\/[^/]+$/) && method === 'PUT') {
    try {
      const id = path.split('/')[1];
      const body = await getJsonBody(request);
      const update = {};
      ['name','phone','email','address','contactPerson','category','paymentTerms','notes','balance','active'].forEach(k => {
        if (body[k] !== undefined) update[k] = body[k];
      });
      update.updatedAt = new Date().toISOString();
      await db.collection('suppliers').updateOne({ id }, { $set: update });
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  if (path.match(/^suppliers\/[^/]+$/) && method === 'DELETE') {
    try {
      const id = path.split('/')[1];
      // Check no purchase orders linked
      const linked = await db.collection('purchase_orders').countDocuments({ supplierId: id });
      if (linked > 0) return err(`لا يمكن الحذف — يوجد ${linked} فاتورة شراء مرتبطة`, 400);
      await db.collection('suppliers').deleteOne({ id });
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  // ----- Purchase Orders (PO) -----
  if (path === 'purchase-orders' && method === 'GET') {
    try {
      const list = await db.collection('purchase_orders').find({}).sort({ createdAt: -1 }).toArray();
      return ok(list.map(s => { delete s._id; return s; }));
    } catch (e) { return ok([]); }
  }

  if (path === 'purchase-orders' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      if (!body.supplierId) return err('اختر مورد', 400);
      const supplier = await db.collection('suppliers').findOne({ id: body.supplierId });
      if (!supplier) return err('المورد غير موجود', 404);
      const items = Array.isArray(body.items) ? body.items.filter(i => i.productId || i.name).map(i => ({
        productId: i.productId || null,
        name: i.name,
        quantity: Number(i.quantity || 1),
        cost: Number(i.cost || 0),
        total: Number(i.quantity || 1) * Number(i.cost || 0),
      })) : [];
      if (items.length === 0) return err('أضف منتج واحد على الأقل', 400);
      const subtotal = items.reduce((s, x) => s + x.total, 0);
      const tax = Number(body.tax || 0);
      const discount = Number(body.discount || 0);
      const total = Math.max(0, subtotal + tax - discount);
      const paid = Number(body.paid || 0);
      const remaining = Math.max(0, total - paid);

      const poNumber = `PO-${Date.now()}`;
      const doc = {
        id: uuidv4(),
        poNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        items, subtotal, tax, discount, total, paid, remaining,
        paymentMethod: body.paymentMethod || 'cash',
        status: remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        notes: body.notes || '',
        receivedAt: body.receivedAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: body.createdBy || 'admin',
      };
      await db.collection('purchase_orders').insertOne(doc);
      delete doc._id;

      // Update supplier balance (debt)
      if (remaining > 0) {
        await db.collection('suppliers').updateOne(
          { id: supplier.id },
          { $inc: { balance: remaining } }
        );
      }

      // Update product stock if linked
      if (body.updateStock !== false) {
        for (const it of items) {
          if (it.productId) {
            await db.collection('products').updateOne(
              { id: it.productId },
              { $inc: { stock: it.quantity }, $set: { lastCost: it.cost } }
            );
          }
        }
      }

      await logActivity(db, { action: 'purchase_order_created', entity: 'purchase_orders', entityId: doc.id, details: `فاتورة شراء ${poNumber} من ${supplier.name}: ${total.toLocaleString('en-US')} د.ع`, ip: clientIp });
      return ok(doc, 201);
    } catch (e) {
      console.error('[purchase-orders POST]', e?.stack);
      return err(e.message, 500);
    }
  }

  // Pay supplier (decrease balance)
  if (path.match(/^suppliers\/[^/]+\/pay$/) && method === 'POST') {
    try {
      const id = path.split('/')[1];
      const body = await getJsonBody(request);
      const amount = Number(body.amount || 0);
      if (amount <= 0) return err('المبلغ غير صحيح', 400);
      const supplier = await db.collection('suppliers').findOne({ id });
      if (!supplier) return err('المورد غير موجود', 404);
      await db.collection('suppliers').updateOne({ id }, { $inc: { balance: -amount } });
      const payment = {
        id: uuidv4(),
        supplierId: id,
        supplierName: supplier.name,
        amount,
        paymentMethod: body.paymentMethod || 'cash',
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
        createdBy: body.createdBy || 'admin',
      };
      await db.collection('supplier_payments').insertOne(payment);
      delete payment._id;
      await logActivity(db, { action: 'supplier_payment', entity: 'suppliers', entityId: id, details: `تسديد ${amount.toLocaleString('en-US')} د.ع للمورد ${supplier.name}`, ip: clientIp });
      return ok({ success: true, payment, newBalance: (supplier.balance || 0) - amount });
    } catch (e) { return err(e.message, 500); }
  }

  // Supplier statement (POs + payments)
  if (path.match(/^suppliers\/[^/]+\/statement$/) && method === 'GET') {
    try {
      const id = path.split('/')[1];
      const supplier = await db.collection('suppliers').findOne({ id });
      if (!supplier) return err('المورد غير موجود', 404);
      const [pos, payments] = await Promise.all([
        db.collection('purchase_orders').find({ supplierId: id }).sort({ createdAt: -1 }).toArray(),
        db.collection('supplier_payments').find({ supplierId: id }).sort({ createdAt: -1 }).toArray(),
      ]);
      const totalPurchased = pos.reduce((s, p) => s + (p.total || 0), 0);
      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0) + pos.reduce((s, p) => s + (p.paid || 0), 0);
      delete supplier._id;
      return ok({
        supplier,
        pos: pos.map(p => { delete p._id; return p; }),
        payments: payments.map(p => { delete p._id; return p; }),
        totalPurchased,
        totalPaid,
        currentBalance: supplier.balance || 0,
      });
    } catch (e) { return err(e.message, 500); }
  }



  return null; // not handled by this module
}
