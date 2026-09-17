const db = require('../config/db');

// Get high-level totals, optionally filtered by date range [from, to]
async function getTotals({ from, to } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`r.repaired_at::date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`r.repaired_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
       COALESCE(SUM(r.price), 0) AS parts_revenue,
       COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
       COUNT(DISTINCT r.batch_id) AS repairs_count,
       COUNT(DISTINCT r.battery_id) AS batteries_count
     FROM repairs r
     ${whereClause}`,
    params
  );

  const { rows: staffRows } = await db.query(
    `SELECT COALESCE(SUM(salary), 0) AS staff_salary_total FROM staff WHERE active = true`
  );

  const repairRevenue = Number(rows[0].repair_revenue || 0);
  const partsRevenue = Number(rows[0].parts_revenue || 0);
  const laborRevenue = Number(rows[0].labor_revenue || 0);
  const repairsCount = parseInt(rows[0].repairs_count || 0, 10);
  const batteriesCount = parseInt(rows[0].batteries_count || 0, 10);
  const staffSalaryTotal = Number(staffRows[0].staff_salary_total || 0);

  return {
    repairRevenue,
    partsRevenue,
    laborRevenue,
    repairsCount,
    batteriesCount,
    staffSalaryTotal,
    avgRevenuePerRepair: repairsCount > 0 ? repairRevenue / repairsCount : 0,
  };
}

// Get breakdown grouped by month or day, with optional date filtering
async function getBreakdown({ from, to, breakdownType = 'month', limit = 60 } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`r.repaired_at::date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`r.repaired_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  if (breakdownType === 'day') {
    const { rows } = await db.query(
      `SELECT
         to_char(r.repaired_at, 'YYYY-MM-DD') AS period_key,
         r.repaired_at::date AS period_date,
         to_char(r.repaired_at, 'DD Mon YYYY') AS label,
         COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
         COALESCE(SUM(r.price), 0) AS parts_revenue,
         COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
         COUNT(DISTINCT r.batch_id) AS repairs_count,
         COUNT(DISTINCT r.battery_id) AS batteries_count
       FROM repairs r
       ${whereClause}
       GROUP BY period_key, period_date, label
       ORDER BY period_date DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return rows.map((r) => ({
      key: r.period_key,
      date: r.period_key,
      label: r.label,
      type: 'day',
      repairRevenue: Number(r.repair_revenue),
      partsRevenue: Number(r.parts_revenue),
      laborRevenue: Number(r.labor_revenue),
      repairsCount: parseInt(r.repairs_count, 10),
      batteriesCount: parseInt(r.batteries_count, 10),
    }));
  } else {
    // month breakdown
    const { rows } = await db.query(
      `SELECT
         to_char(r.repaired_at, 'YYYY-MM') AS period_key,
         date_trunc('month', r.repaired_at) AS period_month,
         to_char(r.repaired_at, 'Mon YYYY') AS label,
         COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
         COALESCE(SUM(r.price), 0) AS parts_revenue,
         COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
         COUNT(DISTINCT r.batch_id) AS repairs_count,
         COUNT(DISTINCT r.battery_id) AS batteries_count
       FROM repairs r
       ${whereClause}
       GROUP BY period_key, period_month, label
       ORDER BY period_month DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return rows.map((r) => ({
      key: r.period_key,
      month: r.period_key,
      label: r.label,
      type: 'month',
      repairRevenue: Number(r.repair_revenue),
      partsRevenue: Number(r.parts_revenue),
      laborRevenue: Number(r.labor_revenue),
      repairsCount: parseInt(r.repairs_count, 10),
      batteriesCount: parseInt(r.batteries_count, 10),
    }));
  }
}

// Get comprehensive period detail statement (for a specific month or day)
async function getPeriodDetail({ type = 'month', period, from, to }) {
  let startDate = from;
  let endDate = to;

  if (type === 'day' && period) {
    startDate = period;
    endDate = period;
  } else if (type === 'month' && period) {
    const [year, month] = period.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    startDate = firstDay.toISOString().slice(0, 10);
    endDate = lastDay.toISOString().slice(0, 10);
  }

  const conditions = [];
  const params = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`r.repaired_at::date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`r.repaired_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Overall Period Totals
  const { rows: totalsRows } = await db.query(
    `SELECT
       COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
       COALESCE(SUM(r.price), 0) AS parts_revenue,
       COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
       COUNT(DISTINCT r.batch_id) AS repairs_count,
       COUNT(DISTINCT r.battery_id) AS batteries_count,
       COUNT(DISTINCT r.staff_id) AS active_staff_count,
       COUNT(DISTINCT COALESCE(b.client_name, 'Direct')) AS active_clients_count
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     ${whereClause}`,
    params
  );

  const t = totalsRows[0] || {};
  const repairRevenue = Number(t.repair_revenue || 0);
  const partsRevenue = Number(t.parts_revenue || 0);
  const laborRevenue = Number(t.labor_revenue || 0);
  const repairsCount = parseInt(t.repairs_count || 0, 10);
  const batteriesCount = parseInt(t.batteries_count || 0, 10);
  const activeStaffCount = parseInt(t.active_staff_count || 0, 10);
  const activeClientsCount = parseInt(t.active_clients_count || 0, 10);

  // 2. Client Breakdown
  const { rows: clientRows } = await db.query(
    `SELECT
       COALESCE(c.id, 0) AS client_id,
       COALESCE(b.client_name, c.name, 'Direct / Unassigned') AS client_name,
       COUNT(DISTINCT r.batch_id) AS repairs_count,
       COUNT(DISTINCT b.id) AS batteries_count,
       COALESCE(SUM(r.price + r.labor_charge), 0) AS total_revenue,
       COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
       COALESCE(SUM(r.price), 0) AS parts_revenue
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
     LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
     ${whereClause}
     GROUP BY c.id, COALESCE(b.client_name, c.name, 'Direct / Unassigned')
     ORDER BY total_revenue DESC`,
    params
  );

  // 3. Staff Breakdown
  const { rows: staffRows } = await db.query(
    `SELECT
       s.id AS staff_id,
       s.name AS staff_name,
       s.role AS staff_role,
       COUNT(DISTINCT r.batch_id) AS repairs_count,
       COALESCE(SUM(r.price + r.labor_charge), 0) AS total_revenue,
       COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
       COALESCE(SUM(r.price), 0) AS parts_revenue,
       AVG(r.duration_seconds) AS avg_duration_seconds
     FROM repairs r
     JOIN staff s ON s.id = r.staff_id
     ${whereClause}
     GROUP BY s.id, s.name, s.role
     ORDER BY total_revenue DESC`,
    params
  );

  // 4. Parts / Services Breakdown
  const { rows: partRows } = await db.query(
    `SELECT
       p.id AS part_id,
       p.name AS part_name,
       p.sku AS part_sku,
       SUM(r.quantity_used) AS quantity_used,
       COALESCE(SUM(r.price), 0) AS total_revenue
     FROM repairs r
     JOIN parts p ON p.id = r.part_id
     ${whereClause}
     GROUP BY p.id, p.name, p.sku
     ORDER BY total_revenue DESC
     LIMIT 15`,
    params
  );

  // 5. Individual Repair Visits
  const { rows: repairRows } = await db.query(
    `SELECT
       MIN(r.id) AS id,
       array_agg(r.id ORDER BY r.id) AS repair_ids,
       r.batch_id,
       MAX(b.id) AS battery_id,
       MAX(b.battery_code) AS battery_code,
       MAX(b.status) AS battery_status,
       MAX(c.id) AS client_id,
       COALESCE(MAX(b.client_name), MAX(c.name), 'Direct / Unassigned') AS client_name,
       MAX(s.id) AS staff_id,
       MAX(s.name) AS staff_name,
       string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
       COALESCE(SUM(r.price), 0) AS parts_charge,
       COALESCE(SUM(r.labor_charge), 0) AS labor_charge,
       COALESCE(SUM(r.price + r.labor_charge), 0) AS total_charge,
       MIN(r.notes) AS notes,
       MIN(r.repaired_at) AS repaired_at,
       MIN(r.duration_seconds) AS duration_seconds
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
     LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
     JOIN staff s ON s.id = r.staff_id
     JOIN parts p ON p.id = r.part_id
     ${whereClause}
     GROUP BY r.batch_id
     ORDER BY MIN(r.repaired_at) DESC, MIN(r.id) DESC`,
    params
  );

  return {
    period: {
      type,
      period,
      startDate,
      endDate,
    },
    totals: {
      repairRevenue,
      partsRevenue,
      laborRevenue,
      repairsCount,
      batteriesCount,
      activeStaffCount,
      activeClientsCount,
      avgRevenuePerRepair: repairsCount > 0 ? repairRevenue / repairsCount : 0,
    },
    clientBreakdown: clientRows.map((c) => ({
      id: c.client_id,
      name: c.client_name,
      repairsCount: parseInt(c.repairs_count, 10),
      batteriesCount: parseInt(c.batteries_count, 10),
      totalRevenue: Number(c.total_revenue),
      laborRevenue: Number(c.labor_revenue),
      partsRevenue: Number(c.parts_revenue),
    })),
    staffBreakdown: staffRows.map((s) => ({
      id: s.staff_id,
      name: s.staff_name,
      role: s.staff_role,
      repairsCount: parseInt(s.repairs_count, 10),
      totalRevenue: Number(s.total_revenue),
      laborRevenue: Number(s.labor_revenue),
      partsRevenue: Number(s.parts_revenue),
      avgDurationSeconds: s.avg_duration_seconds ? Math.round(Number(s.avg_duration_seconds)) : null,
    })),
    partBreakdown: partRows.map((p) => ({
      id: p.part_id,
      name: p.name,
      sku: p.part_sku,
      quantityUsed: parseInt(p.quantity_used, 10),
      totalRevenue: Number(p.total_revenue),
    })),
    repairs: repairRows.map((r) => ({
      id: r.id,
      batchId: r.batch_id,
      batteryId: r.battery_id,
      batteryCode: r.battery_code,
      batteryStatus: r.battery_status,
      clientId: r.client_id,
      clientName: r.client_name || 'Direct / Unassigned',
      staffId: r.staff_id,
      staffName: r.staff_name,
      partName: r.part_name,
      partsCharge: Number(r.parts_charge),
      laborCharge: Number(r.labor_charge),
      totalCharge: Number(r.total_charge),
      notes: r.notes,
      repairedAt: r.repaired_at,
      durationSeconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
    })),
  };
}

module.exports = { getTotals, getBreakdown, getPeriodDetail };
