const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { corsOrigin } = require('../config/cors-origin');
const userModel = require('../models/user.model');
const partModel = require('../models/part.model');
const batteryModel = require('../models/battery.model');
const clientModel = require('../models/client.model');

// Rooms — every event is sent to a room, never io.emit to everyone, so one
// client's login can't listen in on another client's tickets or batteries,
// or on workshop-only data like part pricing.
//   workshop            super_admin / admin / staff / technician
//   office              super_admin / admin / staff (support tickets)
//   client:<id>         one client company's logins (by clients.id)
//   clientname:<name>   same, keyed by lower-cased name for rows that only
//                       carry client_name (batteries, legacy tickets)
const WORKSHOP = 'workshop';
const OFFICE = 'office';
const OFFICE_ROLES = ['super_admin', 'admin', 'staff'];
const clientRoom = (id) => `client:${id}`;
const clientNameRoom = (name) => `clientname:${String(name).trim().toLowerCase()}`;

async function joinRooms(socket) {
  const { role, id } = socket.user;
  if (OFFICE_ROLES.includes(role)) {
    socket.join([WORKSHOP, OFFICE]);
  } else if (role === 'technician') {
    socket.join(WORKSHOP);
  } else if (role === 'client' || role === 'recycle_client') {
    try {
      const client = await clientModel.findByUserId(id);
      if (client) socket.join([clientRoom(client.id), clientNameRoom(client.name)]);
    } catch {
      // unlinked/failed lookup: the socket simply receives no client events
    }
  }
}

// Sends a ticket event to the office and to the ticket's own client only.
function emitTicketEvent(event, payload, ticket) {
  let target = io.to(OFFICE);
  if (ticket?.client_id) target = target.to(clientRoom(ticket.client_id));
  if (ticket?.client_name) target = target.to(clientNameRoom(ticket.client_name));
  target.emit(event, payload);
}

let io = null;

// Verifies the same JWT used for HTTP requests (see middlewares/auth.js) on
// the socket handshake.
async function authenticate(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await userModel.findById(decoded.id);
    if (!user || !user.active) return next(new Error('Invalid or expired token'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}

// Attaches one Socket.IO instance to every underlying HTTP(S) server passed
// in — the app runs plain http and https servers side by side (see
// server.js), and both need to accept socket connections.
function init(servers) {
  io = new Server({ cors: { origin: corsOrigin, credentials: true } });
  io.use(authenticate);
  io.on('connection', joinRooms);
  servers.forEach((server) => io.attach(server));
  return io;
}

// Recomputes the out-of-stock parts list and pushes it to workshop logins
async function broadcastOutOfStockParts() {
  if (!io) return;
  const parts = await partModel.findAll();
  const outOfStock = parts.filter((p) => !p.in_stock);
  io.to(WORKSHOP).emit('parts:out-of-stock', outOfStock);
}

// Recomputes this month's repeat truck intakes and pushes them to workshop logins
async function broadcastRepeatIntakes() {
  if (!io) return;
  const repeats = await batteryModel.findRepeatIntakesThisMonth();
  io.to(WORKSHOP).emit('intakes:repeats', repeats);
}

// Recomputes how many batteries are marked unserviceable
async function broadcastUnserviceableCount() {
  if (!io) return;
  const count = await batteryModel.countByStatus(['unserviceable', 'tested_parts_removed']);
  io.to(WORKSHOP).emit('batteries:unserviceable-count', count);
}

// Pushes a battery's current row whenever its status changes
function broadcastBatteryUpdated(battery) {
  if (!io || !battery) return;
  io.to(WORKSHOP).emit('battery:updated', battery);
  // The owning client only gets enough to know which battery to re-fetch —
  // the full row carries internal notes.
  if (battery.client_name) {
    io.to(clientNameRoom(battery.client_name)).emit('battery:updated', {
      id: battery.id,
      battery_code: battery.battery_code,
      status: battery.status,
    });
  }
}

// Pushes support ticket events (create, new message, status update)
function broadcastTicketCreated(ticket) {
  if (!io || !ticket) return;
  emitTicketEvent('ticket:created', ticket, ticket);
}

function broadcastTicketMessage(payload) {
  if (!io || !payload) return;
  emitTicketEvent('ticket:message', payload, payload.ticket);
}

function broadcastTicketStatus(ticket) {
  if (!io || !ticket) return;
  emitTicketEvent('ticket:updated', ticket, ticket);
}

module.exports = {
  init,
  broadcastOutOfStockParts,
  broadcastRepeatIntakes,
  broadcastUnserviceableCount,
  broadcastBatteryUpdated,
  broadcastTicketCreated,
  broadcastTicketMessage,
  broadcastTicketStatus,
};
