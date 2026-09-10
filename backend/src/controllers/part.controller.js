const partModel = require('../models/part.model');
const realtime = require('../realtime');

async function list(req, res, next) {
  try {
    res.json(await partModel.findAll());
  } catch (err) {
    next(err);
  }
}

// Part detail page: the part's own info plus every repair that's used it and
// every manual restock, for the "how often used, how often topped up" view.
async function getById(req, res, next) {
  try {
    const part = await partModel.findById(req.params.id);
    if (!part) {
      return res.status(404).json({ message: 'Part not found' });
    }
    const [usageHistory, stockHistory] = await Promise.all([
      partModel.findUsageHistory(req.params.id),
      partModel.findStockHistory(req.params.id),
    ]);
    res.json({ part, usageHistory, stockHistory });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, sku, quantity, repairCost, serviceCharge } = req.body;
    const part = await partModel.create({
      name,
      sku,
      quantity: quantity || 0,
      repairCost: repairCost || 0,
      serviceCharge: serviceCharge || 0,
    });
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(201).json(part);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, sku, quantity, repairCost, serviceCharge } = req.body;
    const part = await partModel.update(req.params.id, {
      name,
      sku,
      quantity: quantity || 0,
      repairCost: repairCost || 0,
      serviceCharge: serviceCharge || 0,
    });
    if (!part) {
      return res.status(404).json({ message: 'Part not found' });
    }
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.json(part);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await partModel.remove(req.params.id);
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(204).end();
  } catch (err) {
    // FK violation: this part has been used in a repair.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete a part that has been used in a repair.',
      });
    }
    next(err);
  }
}

// Tops up an out-of-stock (or any) part's quantity and logs who added how
// much, separate from the full edit form so restocking doesn't require
// re-typing the part's name/SKU/cost just to bump the count.
async function restock(req, res, next) {
  try {
    const quantityAdded = Number(req.body.quantityAdded);
    if (!Number.isInteger(quantityAdded) || quantityAdded <= 0) {
      return res.status(400).json({ message: 'quantityAdded must be a positive whole number' });
    }
    const part = await partModel.addStock(req.params.id, {
      quantityAdded,
      note: req.body.note,
      adjustedByUserId: req.user.id,
    });
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.json(part);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
}

module.exports = { list, getById, create, update, remove, restock };
