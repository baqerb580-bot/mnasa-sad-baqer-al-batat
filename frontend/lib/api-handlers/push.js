// Auto-extracted handler module
import { ok, err, getJsonBody, logActivity } from './_helpers';
import { v4 as uuidv4 } from 'uuid';

export async function handlePush(ctx) {
  const { path, method, request, db, clientIp } = ctx;

  if (path === 'push/vapid-key' && method === 'GET') {
    return ok({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '' });
  }

  if (path === 'push/subscribe' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      const sub = body?.subscription;
      if (!sub?.endpoint) return err('Subscription invalid', 400);
      const userId = body?.userId || null;
      const userAgent = request.headers.get('user-agent') || '';
      // Upsert by endpoint
      await db.collection('push_subscriptions').updateOne(
        { endpoint: sub.endpoint },
        {
          $set: {
            endpoint: sub.endpoint,
            keys: sub.keys || {},
            userId,
            userAgent,
            label: body?.label || '',
            tags: Array.isArray(body?.tags) ? body.tags : [],
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            id: uuidv4(),
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  if (path === 'push/unsubscribe' && method === 'POST') {
    try {
      const body = await getJsonBody(request);
      if (body?.endpoint) {
        await db.collection('push_subscriptions').deleteOne({ endpoint: body.endpoint });
      }
      return ok({ success: true });
    } catch (e) { return err(e.message, 500); }
  }

  if (path === 'push/subscriptions' && method === 'GET') {
    try {
      const list = await db.collection('push_subscriptions').find({}).sort({ createdAt: -1 }).toArray();
      return ok(list.map(s => {
        delete s._id;
        // Don't expose keys/endpoint full
        return {
          id: s.id,
          label: s.label || s.userAgent?.slice(0, 50) || 'متصفح',
          userId: s.userId,
          tags: s.tags || [],
          userAgent: s.userAgent,
          createdAt: s.createdAt,
        };
      }));
    } catch (e) { return ok([]); }
  }

  if (path === 'push/send' && method === 'POST') {
    try {
      const webpush = (await import('web-push')).default;
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const contact = process.env.VAPID_CONTACT_EMAIL || 'admin@example.com';
      if (!publicKey || !privateKey) return err('VAPID keys not configured', 500);
      webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);

      const body = await getJsonBody(request);
      const title = body?.title || 'مركز الغزلان';
      const message = body?.message || body?.body || '';
      const url = body?.url || '/';
      const tag = body?.tag || 'broadcast';
      const targetTag = body?.targetTag || null; // null = all
      const userId = body?.userId || null;

      let query = {};
      if (userId) query.userId = userId;
      else if (targetTag) query.tags = targetTag;

      const subs = await db.collection('push_subscriptions').find(query).toArray();
      const payload = JSON.stringify({ title, body: message, url, tag, icon: '/icons/icon-192.png' });

      let sent = 0, failed = 0;
      const expired = [];
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
          sent++;
        } catch (e) {
          failed++;
          if (e?.statusCode === 410 || e?.statusCode === 404) expired.push(s.endpoint);
        }
      }
      // Clean up expired
      if (expired.length > 0) {
        await db.collection('push_subscriptions').deleteMany({ endpoint: { $in: expired } });
      }

      await logActivity(db, { action: 'push_broadcast', details: `Push: "${title}" sent to ${sent}/${subs.length}`, ip: clientIp });
      return ok({ success: true, sent, failed, expired: expired.length, total: subs.length });
    } catch (e) {
      console.error('[push/send] error:', e?.stack || e?.message);
      return err('Failed to send push: ' + e.message, 500);
    }
  }

  if (path === 'push/test' && method === 'POST') {
    // Same as push/send but sends a test message
    try {
      const webpush = (await import('web-push')).default;
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const contact = process.env.VAPID_CONTACT_EMAIL || 'admin@example.com';
      if (!publicKey || !privateKey) return err('VAPID keys not configured', 500);
      webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);

      const body = await getJsonBody(request);
      const subs = body?.endpoint
        ? await db.collection('push_subscriptions').find({ endpoint: body.endpoint }).toArray()
        : await db.collection('push_subscriptions').find({}).limit(1).toArray();
      if (subs.length === 0) return err('No subscriptions found', 404);
      const payload = JSON.stringify({
        title: '🧪 رسالة اختبار',
        body: 'هذه رسالة اختبار من مركز الغزلان — Push Notifications تعمل بشكل صحيح ✅',
        url: '/',
        icon: '/icons/icon-192.png',
      });
      let sent = 0, failed = 0;
      for (const s of subs) {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload); sent++; }
        catch { failed++; }
      }
      return ok({ success: true, sent, failed });
    } catch (e) { return err(e.message, 500); }
  }



  return null; // not handled by this module
}
