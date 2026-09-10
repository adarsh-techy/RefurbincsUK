const dashboardModel = require('../models/dashboard.model');

const TREND_DAYS = 7;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Fills in zero-count days so the sparkline always has TREND_DAYS points,
// even on days with no activity.
function buildDailySeries(rows, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const match = rows.find((row) => new Date(row.day).toDateString() === day.toDateString());
    series.push(match ? match.count : 0);
  }
  return series;
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ?date=YYYY-MM-DD picks which day "Today's Repairs" and the hourly Day
// Overview chart show — set by clicking a day in the dashboard's mini
// calendar. Defaults to today (see dashboardModel's CURRENT_DATE fallback).
async function summary(req, res, next) {
  try {
    const date = DATE_PATTERN.test(req.query.date) ? req.query.date : null;
    const [totals, monthly, intakeRows, repairRows, todaysRepairs, hourlyRows, byPart, byStaff, recentClientReturns] =
      await Promise.all([
        dashboardModel.getTotals(),
        dashboardModel.getMonthlyComparison(),
        dashboardModel.getDailyBatteryIntake(TREND_DAYS),
        dashboardModel.getDailyRepairs(TREND_DAYS),
        dashboardModel.getTodaysRepairs(date, 8),
        dashboardModel.getHourlyRepairsToday(date),
        dashboardModel.getAvgDurationByPart(8),
        dashboardModel.getAvgDurationByStaff(8),
        dashboardModel.getRecentClientReturns(6),
      ]);

    const totalBatteriesTrend = buildDailySeries(intakeRows, TREND_DAYS);
    const repairedTrend = buildDailySeries(repairRows, TREND_DAYS);
    // Backlog trend: how many more batteries came in than got repaired each day.
    const pendingRepairTrend = totalBatteriesTrend.map((count, i) =>
      Math.max(count - repairedTrend[i], 0)
    );

    res.json({
      totals: {
        totalBatteries: Number(totals.total_batteries),
        pendingRepair: Number(totals.pending_repair),
        repaired: Number(totals.repaired),
        unserviceable: Number(totals.unserviceable),
        recycled: Number(totals.recycled),
        lowStockParts: Number(totals.low_stock_parts),
      },
      changes: {
        totalBatteries: percentChange(
          Number(monthly.batteries_this_month),
          Number(monthly.batteries_last_month)
        ),
        repaired: percentChange(
          Number(monthly.repairs_this_month),
          Number(monthly.repairs_last_month)
        ),
      },
      trends: {
        totalBatteries: totalBatteriesTrend,
        pendingRepair: pendingRepairTrend,
        repaired: repairedTrend,
      },
      todaysRepairs: todaysRepairs.map((r) => ({
        id: r.id,
        staffName: r.staff_name,
        partName: r.part_name,
        batteryCode: r.battery_code,
        repairedAt: r.repaired_at,
      })),
      hourlyRepairsToday: hourlyRows.map((r) => ({ hour: r.hour, count: r.count })),
      recentClientReturns: recentClientReturns.map((r) => ({
        id: r.id,
        truckNumber: r.truck_number,
        driverName: r.driver_name,
        batteryCount: Number(r.battery_count),
        returnedAt: r.returned_at,
        clientName: r.client_name || 'All Clients',
        clientId: r.client_id,
      })),
      serviceTimes: {
        byPart: byPart.map((r) => ({
          partId: r.part_id,
          partName: r.part_name,
          avgDurationSeconds: r.avg_duration_seconds,
          repairCount: r.repair_count,
        })),
        byStaff: byStaff.map((r) => ({
          staffId: r.staff_id,
          staffName: r.staff_name,
          avgDurationSeconds: r.avg_duration_seconds,
          repairCount: r.repair_count,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary };
