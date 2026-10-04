/**
 * Pusher-based realtime client that provides a Socket.IO-compatible API.
 * Drop-in replacement for the socket.io-client so no view code needs to change.
 * 
 * The existing views call:
 *   socket.emit('new_order_backend', payload, tenantId)
 *   socket.emit('authenticate', tenantId)
 *   socket.on('new_order', handler)
 *   socket.off('new_order')
 * 
 * This shim maps those to Pusher channel subscriptions and API calls.
 */

import Pusher from 'pusher-js';

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

let pusherInstance = null;
let currentChannel = null;
let currentTenantId = null;

// Event listener registry (mirrors socket.io EventEmitter)
const listeners = {};

function getPusher() {
  if (!pusherInstance && typeof window !== 'undefined' && PUSHER_KEY) {
    pusherInstance = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });
  }
  return pusherInstance;
}

function subscribeToTenant(tenantId) {
  const p = getPusher();
  if (!p || !tenantId) return;

  if (currentTenantId === String(tenantId) && currentChannel) return;

  // Unsubscribe from old channel
  if (currentChannel) {
    currentChannel.unbind_all();
    p.unsubscribe(`tenant-${currentTenantId}`);
  }

  currentTenantId = String(tenantId);
  currentChannel = p.subscribe(`tenant-${currentTenantId}`);

  // Re-bind any listeners already registered
  Object.entries(listeners).forEach(([event, callbacks]) => {
    callbacks.forEach(cb => currentChannel.bind(event, cb));
  });
}

/**
 * Socket-compatible API shim
 */
const socketShim = {
  connected: false,

  connect() {
    const p = getPusher();
    if (p) {
      p.connection.bind('connected', () => { this.connected = true; });
      p.connection.bind('disconnected', () => { this.connected = false; });
    }
  },

  disconnect() {
    if (pusherInstance) {
      pusherInstance.disconnect();
      pusherInstance = null;
      currentChannel = null;
      currentTenantId = null;
    }
    this.connected = false;
  },

  /**
   * Emit a backend event.
   * Maps socket.io emit calls to the Pusher trigger REST endpoint.
   * 
   * socket.emit('authenticate', tenantId)
   * socket.emit('new_order_backend', payload, tenantId)
   * socket.emit('new_qrorder_backend', payload, qrcode)
   * socket.emit('order_update_backend', payload, tenantId)
   */
  emit(event, payload, tenantIdOrQrcode) {
    if (event === 'authenticate') {
      // payload IS the tenantId when called as socket.emit('authenticate', tenantId)
      const tenantId = payload;
      subscribeToTenant(tenantId);
      this.connected = true;
      // Fire any connect callbacks
      if (listeners['connect']) {
        listeners['connect'].forEach(cb => cb());
      }
      return;
    }

    // All other events: POST to /api/pusher/trigger
    const body = {
      event,
      payload,
      ...(event === 'new_qrorder_backend'
        ? { qrcode: tenantIdOrQrcode }
        : { tenantId: tenantIdOrQrcode }),
    };

    fetch('/api/pusher/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(err => console.error('Pusher trigger error:', err));
  },

  /**
   * Register an event listener (maps to Pusher channel bind).
   */
  on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);

    // If already subscribed to a channel, bind immediately
    if (currentChannel) {
      currentChannel.bind(event, callback);
    }
  },

  /**
   * Remove event listener(s).
   */
  off(event, callback) {
    if (!listeners[event]) return;
    if (callback) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
      if (currentChannel) currentChannel.unbind(event, callback);
    } else {
      listeners[event] = [];
      if (currentChannel) currentChannel.unbind(event);
    }
  },
};

export const initSocket = () => {
  socketShim.connect();
};

export const disconnectSocket = () => {
  socketShim.disconnect();
};

export default socketShim;
