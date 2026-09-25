const financeModel = require('../models/finance.model');

// Helper to compute date range from presets
function resolveDateRange(preset, from, to) {
  if (preset === 'custom') {
    return { from: from || undefined, to: to || undefined };
  }

  const now = new Date();
  const formatIsoDate = (d) => d.toISOString().slice(0, 10);

  if (preset === 'today') {
    const today = formatIsoDate(now);
    return { from: today, to: today };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = formatIsoDate(yesterday);
    return { from: yStr, to: yStr };
  }

  if (preset === '7days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: formatIsoDate(start), to: formatIsoDate(now) };
  }

  if (preset === '30days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { from: formatIsoDate(start), to: formatIsoDate(now) };
  }

  if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatIsoDate(firstDay), to: formatIsoDate(lastDay) };
  }

  if (preset === 'year') {
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const lastDay = new Date(now.getFullYear(), 11, 31);
    return { from: formatIsoDate(firstDay), to: formatIsoDate(lastDay) };
  }

  // 'all' or default
  return { from: from || undefined, to: to || undefined };
}

async function summary(req, res, next) {
  try {
    const { preset = 'all', from: rawFrom, to: rawTo, breakdown = 'month' } = req.query;
    const { from, to } = resolveDateRange(preset, rawFrom, rawTo);

    const [totals, breakdownList] = await Promise.all([
      financeModel.getTotals({ from, to }),
      financeModel.getBreakdown({ from, to, breakdownType: breakdown, limit: 60 }),
    ]);

    res.json({
      totals,
      // Keep backward compatibility if old code expected `monthly`
      monthly: breakdown === 'month' ? breakdownList : [],
      breakdown: breakdownList,
      filter: {
        preset,
        from: from || null,
        to: to || null,
        breakdown,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function periodDetail(req, res, next) {
  try {
    const { type = 'month', period, from, to } = req.query;
    if (!period && !from) {
      return res.status(400).json({ message: 'Period or date range is required.' });
    }

    const detail = await financeModel.getPeriodDetail({ type, period, from, to });
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, periodDetail };
