const trashModel = require('../models/trash.model');
const auditLogModel = require('../models/audit-log.model');

async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      itemType,
      search,
      startDate,
      endDate,
    } = req.query;

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const result = await trashModel.findPage({
      limit: parsedLimit,
      offset,
      itemType: itemType === 'all' ? undefined : itemType,
      search,
      startDate,
      endDate,
    });

    const totalPages = Math.ceil(result.total / parsedLimit);

    res.json({
      data: result.rows,
      pagination: {
        total: result.total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasMore: result.hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await trashModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Trash item not found' });
    }
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await trashModel.getStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const item = await trashModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Trash item not found' });
    }

    await trashModel.remove(req.params.id);

    await auditLogModel.record({
      userId: req.user.id,
      action: 'permanent_delete',
      entity: 'trash_item',
      entityId: Number(req.params.id),
      details: {
        originalId: item.original_id,
        itemType: item.item_type,
        title: item.title,
      },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function clearAll(req, res, next) {
  try {
    await trashModel.clearAll();

    await auditLogModel.record({
      userId: req.user.id,
      action: 'empty_trash',
      entity: 'trash_items',
      entityId: null,
      details: { clearedBy: req.user.email },
    });

    res.json({ message: 'Trash cleared successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  getStats,
  remove,
  clearAll,
};
