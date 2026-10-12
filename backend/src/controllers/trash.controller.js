const trashModel = require('../models/trash.model');
const auditLogModel = require('../models/audit-log.model');
const realtime = require('../realtime');

// Adds restorable / restore_blocked_reason / restore_note to a trash row.
const withRestoreInfo = (row) => ({ ...row, ...trashModel.restoreInfo(row.item_type) });

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
    // ?offset= (mobile lists) wins over ?page= (web pager)
    const offset = req.query.offset !== undefined
      ? Math.max(0, parseInt(req.query.offset, 10) || 0)
      : (parsedPage - 1) * parsedLimit;

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
      data: result.rows.map(withRestoreInfo),
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
    res.json({ data: withRestoreInfo(item) });
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

// Puts a trashed record back where it came from (super admin only, via the
// router). 409 when it would clash with something created since.
async function restore(req, res, next) {
  try {
    const { item, record, notes } = await trashModel.restore(req.params.id);

    await auditLogModel.record({
      userId: req.user.id,
      action: 'restore',
      entity: item.item_type,
      entityId: record.id,
      details: {
        trashItemId: item.id,
        originalId: item.original_id,
        title: item.title,
        notes,
      },
    });

    if (item.item_type === 'part') {
      realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    }
    if (item.item_type === 'battery') {
      realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    }

    res.json({
      message: `${item.title} was restored.`,
      itemType: item.item_type,
      restoredId: record.id,
      notes,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
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
  restore,
  list,
  getById,
  getStats,
  remove,
  clearAll,
};
