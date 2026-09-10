const clientModel = require('../models/client.model');
const recycleModel = require('../models/recycle.model');

// Dashboard stats + recent shipments for the logged-in recycle_client.
// The user's client profile is resolved via clients.user_id = req.user.id.
async function dashboard(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const data = await recycleModel.getClientDashboard(client.id);
    res.json({ client, ...data });
  } catch (err) {
    next(err);
  }
}

// Paginated list of recycle batches for the logged-in recycle_client.
async function shipments(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const batches = await recycleModel.findAll({ recycleClientId: client.id });
    res.json({ data: batches });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, shipments };
