// Shared API helpers for handler modules
import { NextResponse } from 'next/server';

export function ok(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export function err(message, status = 400) {
  return ok({ error: message }, status);
}

export async function getJsonBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function logActivity(db, { action, entity, entityId, user, userId, details, ip }) {
  try {
    await db.collection('activity_logs').insertOne({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action, entity, entityId,
      user: user || 'system', userId: userId || null,
      details: details || '', ip: ip || null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { console.error('logActivity failed', e); }
}
