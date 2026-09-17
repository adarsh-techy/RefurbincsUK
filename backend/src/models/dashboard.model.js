const db = require('../config/db');

async function getTotals() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM batteries) AS total_batteries,
      (SELECT COUNT(*) FROM batteries WHERE status = 'in_repair') AS pending_repair,
      -- Cumulative repair jobs completed (not a battery-status snapshot,
      -- which would drop back down once a battery is returned).
      (SELECT COUNT(*) FROM repairs) AS repaired,
      (SELECT COUNT(*) FROM batteries WHERE status = 'returned') AS returned,
      (SELECT COUNT(*) FROM batteries WHERE status IN ('unserviceable', 'tested_parts_removed')) AS unserviceable,
      (SELECT COUNT(*) FROM batteries WHERE status = 'recycled') AS recycled,
      (SELECT COUNT(*) FROM parts WHERE quantity <= 5) AS low_stock_parts
  `);
  return rows[0];
}

async function getMonthlyComparison() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM batteries
        WHERE created_at >= date_trunc('month', now())) AS batteries_this_month,
      (SELECT COUNT(*) FROM batteries
        WHERE created_at >= date_trunc('month', now() - interval '1 month')
          AND created_at < date_trunc('month', now())) AS batteries_last_month,
      (SELECT COUNT(*) FROM repairs
        WHERE repaired_at >= date_trunc('month', now())) AS repairs_this_month,
      (SELECT COUNT(*) FROM repairs
        WHERE repaired_at >= date_trunc('month', now() - interval '1 month')
          AND repaired_at < date_trunc('month', now())) AS repairs_last_month
  `);
  return rows[0];
}

async function getDailyBatteryIntake(days) {
  const { rows } = await db.query(
    `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
     FROM batteries
     WHERE created_at >= now() - ($1 || ' days')::interval
     GROUP BY day
     ORDER BY day`,
    [days]
  );
  return rows;
}

async function getDailyRepairs(days) {
  const { rows } = await db.query(
    `SELECT date_trunc('day', repaired_at) AS day, COUNT(*)::int AS count
     FROM repairs
     WHERE repaired_at >= now() - ($1 || ' days')::interval
     GROUP BY day
     ORDER BY day`,
    [days]
  );
  return rows;
}

// Grouped by batch_id (same pattern as repair.model.js's findPage) — every
// part changed in one visit is one card on the dashboard, not one per part.
// LIMIT applies to visits, not raw repair rows. date is a 'YYYY-MM-DD'
// string or null (COALESCEs to Postgres's own CURRENT_DATE, so "today"
// always means today in the database's timezone, not the Node process's) —
// the mini calendar picks which day to show.
async function getTodaysRepairs(date, limit) {
  const { rows } = await db.query(
    `SELECT
       MIN(r.id) AS id,
       MIN(r.repaired_at) AS repaired_at,
       MAX(s.name) AS staff_name,
       string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
       MAX(b.battery_code) AS battery_code
     FROM repairs r
     JOIN staff s ON s.id = r.staff_id
     JOIN parts p ON p.id = r.part_id
     JOIN batteries b ON b.id = r.battery_id
     WHERE r.repaired_at::date = COALESCE($1::date, CURRENT_DATE)
     GROUP BY r.batch_id
     ORDER BY MIN(r.repaired_at) DESC
     LIMIT $2`,
    [date, limit]
  );
  return rows;
}

async function getHourlyRepairsToday(date) {
  const { rows } = await db.query(
    `SELECT EXTRACT(HOUR FROM repaired_at)::int AS hour, COUNT(*)::int AS count
     FROM repairs
     WHERE repaired_at::date = COALESCE($1::date, CURRENT_DATE)
     GROUP BY hour
     ORDER BY hour`,
    [date]
  );
  return rows;
}

// Average repair-phase duration (Start Work -> Submit for Testing) grouped
// by part, so an admin can see which service tends to take longest. Only
// repairs from the last 90 days count, so a slow one-off years ago doesn't
// permanently skew the average; only rows with a recorded duration count
// (older repairs logged before duration tracking existed have none).
async function getAvgDurationByPart(limit) {
  const { rows } = await db.query(
    `SELECT p.id AS part_id,
            p.name AS part_name,
            ROUND(AVG(r.duration_seconds))::int AS avg_duration_seconds,
            COUNT(*)::int AS repair_count
     FROM repairs r
     JOIN parts p ON p.id = r.part_id
     WHERE r.duration_seconds IS NOT NULL
       AND r.repaired_at >= now() - interval '90 days'
     GROUP BY p.id, p.name
     ORDER BY avg_duration_seconds DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// Same as above, but grouped by technician — so an admin can see which
// staff member tends to take longer per repair. Includes both the repair
// phase (duration_seconds) and, separately, how long their batteries spend
// in testing afterward (testing_duration_seconds lives on the battery, not
// the repair, since one battery's testing is one event regardless of how
// many parts were changed).
async function getAvgDurationByStaff(limit) {
  const { rows } = await db.query(
    `SELECT s.id AS staff_id,
            s.name AS staff_name,
            ROUND(AVG(r.duration_seconds))::int AS avg_duration_seconds,
            COUNT(*)::int AS repair_count
     FROM repairs r
     JOIN staff s ON s.id = r.staff_id
     WHERE r.duration_seconds IS NOT NULL
       AND r.repaired_at >= now() - interval '90 days'
     GROUP BY s.id, s.name
     ORDER BY avg_duration_seconds DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getRecentClientReturns(limit = 6) {
  const { rows } = await db.query(
    `SELECT 
       r.id,
       r.truck_number,
       r.driver_name,
       r.battery_count,
       r.returned_at,
       c.name AS client_name,
       c.id AS client_id
     FROM returns r
     LEFT JOIN clients c ON c.id = r.client_id
     ORDER BY r.returned_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  getTotals,
  getMonthlyComparison,
  getDailyBatteryIntake,
  getDailyRepairs,
  getTodaysRepairs,
  getHourlyRepairsToday,
  getAvgDurationByPart,
  getAvgDurationByStaff,
  getRecentClientReturns,
};
