const ratingModel = require('../models/rating.model');
const clientModel = require('../models/client.model');
const batteryModel = require('../models/battery.model');

function isClientRole(role) {
  return role === 'client' || role === 'recycle_client';
}

async function create(req, res, next) {
  try {
    const { batteryCode, returnId, rating, presetTags, customFeedback } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: 'A valid rating between 1 and 5 stars is required.' });
    }

    let clientId = null;
    if (isClientRole(req.user?.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      if (client) {
        clientId = client.id;
      }
    } else if (req.body.clientId) {
      clientId = req.body.clientId;
    }

    let batteryId = null;
    if (batteryCode) {
      try {
        const battery = await batteryModel.findByCode(batteryCode.trim().toUpperCase());
        if (battery) batteryId = battery.id;
      } catch {
        // non-fatal if battery lookup by code doesn't exist
      }
    }

    const created = await ratingModel.create({
      clientId,
      clientUserId: req.user?.id || null,
      batteryId,
      batteryCode,
      returnId,
      rating: Number(rating),
      presetTags: Array.isArray(presetTags) ? presetTags : [],
      customFeedback,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { clientId, rating, search, limit = 50, offset = 0 } = req.query;
    let targetClientId = clientId ? Number(clientId) : null;

    if (isClientRole(req.user?.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      targetClientId = client.id;
    }

    const [ratings, stats] = await Promise.all([
      ratingModel.findAll({
        clientId: targetClientId,
        rating: rating ? Number(rating) : null,
        search,
        limit: Number(limit),
        offset: Number(offset),
      }),
      ratingModel.getStats(targetClientId),
    ]);

    res.json({
      data: ratings,
      stats,
    });
  } catch (err) {
    next(err);
  }
}

async function myRatings(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(404).json({ message: 'Client profile not found.' });
    }

    const ratings = await ratingModel.findByClient(client.id);
    res.json({ data: ratings });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  myRatings,
};
