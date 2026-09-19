const issueReasonModel = require('../models/issue-reason.model');
const trashModel = require('../models/trash.model');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    res.json(await issueReasonModel.findAll({ activeOnly }));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
    if (!label) {
      return res.status(400).json({ message: 'Label is required' });
    }
    const sortOrder = Number(req.body.sortOrder) || 0;
    if (await issueReasonModel.findBySortOrder(sortOrder)) {
      return res.status(409).json({ message: 'That order number is already used by another reason.' });
    }
    const reason = await issueReasonModel.create({ label, sortOrder });
    res.status(201).json(reason);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'That reason already exists.' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
    if (!label) {
      return res.status(400).json({ message: 'Label is required' });
    }
    const sortOrder = Number(req.body.sortOrder) || 0;
    if (await issueReasonModel.findBySortOrder(sortOrder, req.params.id)) {
      return res.status(409).json({ message: 'That order number is already used by another reason.' });
    }
    const reason = await issueReasonModel.update(req.params.id, {
      label,
      active: req.body.active !== false,
      sortOrder,
    });
    if (!reason) {
      return res.status(404).json({ message: 'Reason not found' });
    }
    res.json(reason);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'That reason already exists.' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const reason = await issueReasonModel.findById(req.params.id);
    if (!reason) {
      return res.status(404).json({ message: 'Reason not found' });
    }

    await issueReasonModel.remove(req.params.id);

    try {
      await trashModel.record({
        originalId: reason.id,
        itemType: 'issue_reason',
        title: reason.label || `Reason #${reason.id}`,
        subtitle: `Sort Order: ${reason.sort_order} • Active: ${reason.active ? 'Yes' : 'No'}`,
        itemData: reason,
        user: req.user,
      });
    } catch (trashErr) {
      console.error('Error logging issue reason to trash:', trashErr);
    }

    res.status(204).end();
  } catch (err) {
    // FK violation: this reason has already been used to report an issue.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete a reason that has already been used to report a battery issue.',
      });
    }
    next(err);
  }
}

module.exports = { list, create, update, remove };
