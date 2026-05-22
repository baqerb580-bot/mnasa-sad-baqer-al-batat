// Auto-extracted handler module
import { ok, err, getJsonBody, logActivity } from './_helpers';
import { v4 as uuidv4 } from 'uuid';

export async function handleCRM(ctx) {
  const { path, method, request, db, clientIp } = ctx;

  // Helper: compute customer stats by enriching subscribers with their purchase history
  async function computeCustomerStats(subscriber, allSales, allActivations) {
    const phoneNormalized = String(subscriber.phone || '').replace(/[^\d]/g, '');
    const last4 = phoneNormalized.slice(-7); // match last 7 digits for flexibility

    // Sales linked by phone match in customer field OR exact subscriberId
    const linkedSales = allSales.filter(s => {
      const c = String(s.customer || '').replace(/[^\d]/g, '');
      return (s.subscriberId === subscriber.id) || (last4 && c.includes(last4));
    });

    // Activations linked by subscriberId
    const linkedActivations = allActivations.filter(a => a.subscriberId === subscriber.id);

    const salesTotal = linkedSales.reduce((s, x) => s + (Number(x.total) || 0), 0);
    const activationsTotal = linkedActivations.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const lifetimeValue = salesTotal + activationsTotal;

    // Loyalty points: 1 point per 1,000 IQD spent
    const loyaltyPoints = Math.floor(lifetimeValue / 1000);

    // Tier
    let tier = 'bronze';
    let tierLabel = 'برونزي';
    let tierIcon = '🥉';
    if (lifetimeValue >= 5000000) { tier = 'platinum'; tierLabel = 'بلاتيني'; tierIcon = '💎'; }
    else if (lifetimeValue >= 2000000) { tier = 'gold'; tierLabel = 'ذهبي'; tierIcon = '🥇'; }
    else if (lifetimeValue >= 500000) { tier = 'silver'; tierLabel = 'فضي'; tierIcon = '🥈'; }

    // Activity
    const allDates = [...linkedSales.map(s => s.createdAt), ...linkedActivations.map(a => a.createdAt)].filter(Boolean).sort();
    const firstPurchase = allDates[0] || subscriber.createdAt;
    const lastPurchase = allDates[allDates.length - 1] || null;
    const daysSinceLast = lastPurchase ? Math.floor((Date.now() - new Date(lastPurchase).getTime()) / 86400000) : null;

    // Risk: no activity in 60+ days OR expired subscription
    let riskLevel = 'low';
    if (subscriber.status === 'expired') riskLevel = 'high';
    else if (daysSinceLast !== null && daysSinceLast > 90) riskLevel = 'high';
    else if (daysSinceLast !== null && daysSinceLast > 60) riskLevel = 'medium';
    else if (daysSinceLast === null) riskLevel = 'unknown';

    return {
      subscriberId: subscriber.id,
      name: subscriber.name,
      phone: subscriber.phone,
      username: subscriber.username,
      status: subscriber.status,
      zoneName: subscriber.zoneName,
      agentName: subscriber.agentName,
      lifetimeValue,
      salesTotal,
      activationsTotal,
      loyaltyPoints,
      tier, tierLabel, tierIcon,
      transactionsCount: linkedSales.length + linkedActivations.length,
      salesCount: linkedSales.length,
      activationsCount: linkedActivations.length,
      firstPurchase,
      lastPurchase,
      daysSinceLast,
      riskLevel,
      notes: subscriber.crmNotes || [],
    };
  }

  if (path === 'crm/overview' && method === 'GET') {
    try {
      const [subscribers, sales, activations] = await Promise.all([
        db.collection('subscribers').find({}).toArray(),
        db.collection('sales').find({}).toArray(),
        db.collection('activations').find({}).toArray(),
      ]);
      const customers = await Promise.all(subscribers.map(s => computeCustomerStats(s, sales, activations)));
      const byTier = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
      const byRisk = { low: 0, medium: 0, high: 0, unknown: 0 };
      let totalLTV = 0;
      let totalLoyalty = 0;
      for (const c of customers) {
        byTier[c.tier] = (byTier[c.tier] || 0) + 1;
        byRisk[c.riskLevel] = (byRisk[c.riskLevel] || 0) + 1;
        totalLTV += c.lifetimeValue;
        totalLoyalty += c.loyaltyPoints;
      }
      const top10 = [...customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue).slice(0, 10);
      const atRisk = customers.filter(c => c.riskLevel === 'high' || c.riskLevel === 'medium')
        .sort((a, b) => (b.daysSinceLast || 0) - (a.daysSinceLast || 0)).slice(0, 20);
      const newThisMonth = customers.filter(c => {
        if (!c.firstPurchase) return false;
        const d = new Date(c.firstPurchase);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const avgLTV = customers.length ? Math.round(totalLTV / customers.length) : 0;
      return ok({
        totals: {
          totalCustomers: customers.length,
          totalLTV,
          totalLoyaltyPoints: totalLoyalty,
          avgLTV,
          newThisMonth: newThisMonth.length,
        },
        byTier,
        byRisk,
        top10,
        atRisk,
      });
    } catch (e) {
      console.error('[crm/overview] error:', e?.message);
      return err('Failed to compute CRM overview: ' + e.message, 500);
    }
  }

  if (path === 'crm/customers' && method === 'GET') {
    try {
      const [subscribers, sales, activations] = await Promise.all([
        db.collection('subscribers').find({}).toArray(),
        db.collection('sales').find({}).toArray(),
        db.collection('activations').find({}).toArray(),
      ]);
      const customers = await Promise.all(subscribers.map(s => computeCustomerStats(s, sales, activations)));
      // Sort by LTV desc
      customers.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
      return ok({ customers, count: customers.length });
    } catch (e) {
      console.error('[crm/customers] error:', e?.message);
      return err('Failed to compute customers: ' + e.message, 500);
    }
  }

  // Single customer detail
  if (path.match(/^crm\/customers\/[^/]+$/) && method === 'GET') {
    try {
      const subId = path.split('/')[2];
      const subscriber = await db.collection('subscribers').findOne({ id: subId });
      if (!subscriber) return err('Customer not found', 404);
      const [sales, activations] = await Promise.all([
        db.collection('sales').find({}).toArray(),
        db.collection('activations').find({ subscriberId: subId }).toArray(),
      ]);
      const stats = await computeCustomerStats(subscriber, sales, activations);
      const phoneNormalized = String(subscriber.phone || '').replace(/[^\d]/g, '');
      const last7 = phoneNormalized.slice(-7);
      const linkedSales = sales.filter(s => {
        const c = String(s.customer || '').replace(/[^\d]/g, '');
        return s.subscriberId === subscriber.id || (last7 && c.includes(last7));
      });
      return ok({
        ...stats,
        subscriber,
        sales: linkedSales.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        activations: activations.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
      });
    } catch (e) {
      console.error('[crm/customers/:id] error:', e?.message);
      return err('Failed to load customer: ' + e.message, 500);
    }
  }

  // Add a CRM note to a customer
  if (path.match(/^crm\/customers\/[^/]+\/note$/) && method === 'POST') {
    try {
      const subId = path.split('/')[2];
      const body = await getJsonBody(request);
      const text = (body?.text || '').trim();
      if (!text) return err('Note text is required', 400);
      const note = {
        id: uuidv4(),
        text,
        author: body?.author || 'الإدارة',
        createdAt: new Date().toISOString(),
      };
      await db.collection('subscribers').updateOne(
        { id: subId },
        { $push: { crmNotes: note } }
      );
      await logActivity(db, { action: 'crm_note_added', entity: 'subscribers', entityId: subId, details: `إضافة ملاحظة CRM: ${text.slice(0, 50)}`, ip: clientIp });
      return ok({ success: true, note });
    } catch (e) {
      return err(e.message, 500);
    }
  }

  // Delete a CRM note
  if (path.match(/^crm\/customers\/[^/]+\/note\/[^/]+$/) && method === 'DELETE') {
    try {
      const parts = path.split('/');
      const subId = parts[2];
      const noteId = parts[4];
      await db.collection('subscribers').updateOne(
        { id: subId },
        { $pull: { crmNotes: { id: noteId } } }
      );
      return ok({ success: true });
    } catch (e) {
      return err(e.message, 500);
    }
  }



  return null; // not handled by this module
}
