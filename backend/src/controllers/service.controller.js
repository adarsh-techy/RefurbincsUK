const serviceModel = require('../models/service.model');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const services = await serviceModel.findAll({ activeOnly });
    res.json(services);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const service = await serviceModel.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Service name is required' });
    }
    const rate = Number(req.body.rate);
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ message: 'A valid positive rate is required' });
    }
    const sortOrder = Number(req.body.sortOrder) || 0;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const active = req.body.active !== false;

    const existingOrder = await serviceModel.findBySortOrder(sortOrder);
    if (existingOrder && sortOrder !== 0) {
      return res.status(409).json({ message: `Sort order ${sortOrder} is already in use` });
    }

    const service = await serviceModel.create({
      name,
      description,
      rate,
      sortOrder,
      active,
    });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await serviceModel.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const name = req.body.name !== undefined ? (typeof req.body.name === 'string' ? req.body.name.trim() : '') : existing.name;
    if (!name) {
      return res.status(400).json({ message: 'Service name cannot be empty' });
    }

    const rate = req.body.rate !== undefined ? Number(req.body.rate) : existing.rate;
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ message: 'A valid positive rate is required' });
    }

    const sortOrder = req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : existing.sort_order;
    if (sortOrder !== 0 && sortOrder !== existing.sort_order) {
      const orderConflict = await serviceModel.findBySortOrder(sortOrder, id);
      if (orderConflict) {
        return res.status(409).json({ message: `Sort order ${sortOrder} is already in use` });
      }
    }

    const description = req.body.description !== undefined ? (typeof req.body.description === 'string' ? req.body.description.trim() : '') : existing.description;
    const active = req.body.active !== undefined ? Boolean(req.body.active) : existing.active;

    const updated = await serviceModel.update(id, {
      name,
      description,
      rate,
      active,
      sortOrder,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await serviceModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
