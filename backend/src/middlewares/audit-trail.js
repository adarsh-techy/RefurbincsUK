const auditLogModel = require('../models/audit-log.model');

// Records a successful (2xx) admin change in audit_logs: who, what, which
// record, when. Added to routes whose controllers don't log on their own, so
// the Audit Log covers every create / edit / delete. Only a few harmless
// fields go into details — never passwords or personal data.
const SAFE_FIELDS = [
  'name', 'label', 'battery_code', 'batteryCode', 'status', 'blocked', 'role', 'active',
  'truck_number', 'truckNumber', 'vehicle_number', 'vehicleNumber', 'sku', 'rate', 'quantityAdded',
];

function pick(source) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const k of SAFE_FIELDS) if (source[k] !== undefined && source[k] !== '') out[k] = source[k];
  return out;
}

function auditTrail(entity, action) {
  return (req, res, next) => {
    let body;
    const json = res.json.bind(res);
    res.json = (payload) => {
      body = payload;
      return json(payload);
    };
    res.on('finish', () => {
      if (!req.user || res.statusCode < 200 || res.statusCode >= 300) return;
      const record = body && typeof body === 'object' ? body[entity] || body.data || body : null;
      const entityId = Number(req.params.id) || Number(record?.id) || null;
      auditLogModel
        .record({
          userId: req.user.id,
          action,
          entity,
          entityId,
          details: { ...pick(record), ...pick(req.body) },
        })
        .catch(() => {}); // the audit trail must never break the request
    });
    next();
  };
}

module.exports = { auditTrail };
