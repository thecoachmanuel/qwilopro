/**
 * Pusher event trigger endpoint.
 * Called by the frontend to emit real-time events (replaces socket.io emits).
 * 
 * IMPORTANT: This endpoint must NEVER return 5xx — real-time events are
 * best-effort and the main order flow must not be blocked by Pusher failures.
 */

const buf = require('buffer');
if (!buf.SlowBuffer) buf.SlowBuffer = Buffer;

let pusher = null;
function getPusher() {
  try {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    if (!appId || !key || !secret) return null;
    if (!pusher) {
      const Pusher = require('pusher');
      pusher = new Pusher({
        appId,
        key,
        secret,
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
        useTLS: true,
      });
    }
    return pusher;
  } catch (e) {
    return null;
  }
}

export default async function pusherTrigger(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { event, payload, tenantId, qrcode } = req.body || {};

    if (!event) {
      return res.status(400).json({ message: 'event is required' });
    }

    const p = getPusher();
    if (!p) {
      // Pusher not configured — silently succeed so order flow is unaffected
      return res.status(200).json({ success: true, warning: 'Pusher credentials not configured' });
    }

    switch (event) {
      case 'new_order_backend': {
        if (!tenantId) return res.status(200).json({ success: false, warning: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'new_order', payload || {});
        break;
      }

      case 'new_qrorder_backend': {
        // If tenantId is provided directly, use it; otherwise try to resolve from qrcode
        if (tenantId) {
          await p.trigger(`tenant-${tenantId}`, 'new_qrorder', payload || {});
        } else if (qrcode) {
          // Lazy-load DB dependency only when needed
          try {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
              const { connectDB } = require('../../../src/backend/db/connect');
              await connectDB();
            }
            const { getTenantIdFromQRCode } = require('../../../src/backend/services/settings.service');
            const tid = await getTenantIdFromQRCode(qrcode);
            if (tid) {
              await p.trigger(`tenant-${tid}`, 'new_qrorder', payload || {});
            }
          } catch (dbErr) {
            console.warn('Pusher new_qrorder DB resolution warning:', dbErr?.message);
            // Non-fatal — real-time is best-effort
          }
        }
        break;
      }

      case 'order_update_backend': {
        if (!tenantId) return res.status(200).json({ success: false, warning: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'order_update', payload || {});
        break;
      }

      case 'token_call_backend': {
        if (!tenantId) return res.status(200).json({ success: false, warning: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'token_call', payload || {});
        break;
      }

      case 'cart_update_backend': {
        if (!tenantId) return res.status(200).json({ success: false, warning: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'cart_update', payload || {});
        break;
      }

      default:
        return res.status(200).json({ success: false, warning: `Unknown event: ${event}` });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    // Always return 200 so frontend order flow is never blocked by Pusher errors
    console.warn('Pusher trigger warning:', err?.message || err);
    return res.status(200).json({ success: false, warning: 'Failed to trigger event' });
  }
}

export const config = {
  api: { bodyParser: true, externalResolver: true },
};
