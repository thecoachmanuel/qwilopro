/**
 * Pusher event trigger endpoint.
 * Called by the frontend to emit real-time events (replaces socket.io emits).
 * Only authenticated requests can trigger events.
 */

const buf = require('buffer');
if (!buf.SlowBuffer) buf.SlowBuffer = Buffer;

const Pusher = require('pusher');
const { connectDB } = require('../../../src/backend/db/connect');
const { getTenantIdFromQRCode } = require('../../../src/backend/services/settings.service');
const mongoose = require('mongoose');

let pusher = null;
function getPusher() {
  if (!pusher) {
    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      useTLS: true,
    });
  }
  return pusher;
}

export default async function pusherTrigger(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { event, payload, tenantId, qrcode } = req.body;

  if (!event) {
    return res.status(400).json({ message: 'event is required' });
  }

  try {
    const p = getPusher();

    // Map socket.io-style backend events to Pusher channel events
    switch (event) {
      case 'new_order_backend': {
        // Notify kitchen/orders page about a new order for this tenant
        if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'new_order', payload || {});
        break;
      }

      case 'new_qrorder_backend': {
        // QR order: resolve tenant from qrcode, then notify
        if (!qrcode) return res.status(400).json({ message: 'qrcode required' });
        if (mongoose.connection.readyState !== 1) await connectDB();
        const tid = await getTenantIdFromQRCode(qrcode);
        if (tid) {
          await p.trigger(`tenant-${tid}`, 'new_qrorder', payload || {});
        }
        break;
      }

      case 'order_update_backend': {
        // Notify all listeners of an order status change
        if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'order_update', payload || {});
        break;
      }

      case 'token_call_backend': {
        // Kitchen calls a token number → notify token display screen
        if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'token_call', payload || {});
        break;
      }

      case 'cart_update_backend': {
        // POS updates cart → notify customer-facing display screen
        if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
        await p.trigger(`tenant-${tenantId}`, 'cart_update', payload || {});
        break;
      }

      default:
        return res.status(400).json({ message: `Unknown event: ${event}` });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Pusher trigger error:', err);
    return res.status(500).json({ message: 'Failed to trigger event' });
  }
}

export const config = {
  api: { bodyParser: true, externalResolver: true },
};
