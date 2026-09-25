const db = require('../config/db');

// Get high-level totals, optionally filtered by date range [from, to]
// Recycle revenue per period, reconciled from the two sources we hold:
// invoices raised to recycle clients (actual billing) and recycle batches
// priced by weight (the partner's quoted rate). For any one period the
// invoice figure wins when it exists, otherwise the weight estimate — never
// a cross-period max (which discarded whichever source was smaller overall)
// and never a plain sum (which double-counts a batch that was also invoiced).
// Rows carry the same period_key/period_date/label shape as the repair and
// service breakdown queries so they merge and sort cleanly.
async function recycleRevenueByPeriod({ from, to, timeFormat = 'YYYY-MM', labelFormat = 'Mon YYYY' } = {}) {
  const params = [];
  const invoiceConditions = ["u.role = 'recycle_client'"];
  const batchConditions = [];
  if (from) {
    params.push(from);
    invoiceConditions.push(`i.issue_date >= $${params.length}`);
    batchConditions.push(`rb.recycled_at::date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    invoiceConditions.push(`i.issue_date <= $${params.length}`);
    batchConditions.push(`rb.recycled_at::date <= $${params.length}`);
  }
  const batchWhere = batchConditions.length ? `WHERE ${batchConditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `WITH inv AS (
       SELECT to_char(i.issue_date, '${timeFormat}') AS period_key, SUM(i.amount) AS amount
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       JOIN users u ON u.id = c.user_id
       WHERE ${invoiceConditions.join(' AND ')}
       GROUP BY 1
     ),
     wt AS (
       SELECT to_char(rb.recycled_at, '${timeFormat}') AS period_key,
              SUM(COALESCE(rb.total_weight_kg * rb.price_per_kg, 0)) AS amount
       FROM recycle_batches rb
       ${batchWhere}
       GROUP BY 1
     ),
     merged AS (
       SELECT COALESCE(inv.period_key, wt.period_key) AS period_key,
              COALESCE(NULLIF(inv.amount, 0), wt.amount, 0) AS recycle_revenue
       FROM inv
       FULL OUTER JOIN wt ON wt.period_key = inv.period_key
     )
     SELECT period_key,
            to_date(period_key, '${timeFormat}')::timestamp AS period_date,
            to_char(to_date(period_key, '${timeFormat}'), '${labelFormat}') AS label,
            recycle_revenue
     FROM merged
     ORDER BY period_date DESC`,
    params
  );
  return rows;
}

async function getTotals({ from, to } = {}) {
  const repairConditions = [];
  const repairParams = [];
  if (from) {
    repairParams.push(from);
    repairConditions.push(`r.repaired_at::date >= $${repairParams.length}`);
  }
  if (to) {
    repairParams.push(to);
    repairConditions.push(`r.repaired_at::date <= $${repairParams.length}`);
  }
  const repairWhere = repairConditions.length ? `WHERE ${repairConditions.join(' AND ')}` : '';

  const serviceConditions = [];
  const serviceParams = [];
  if (from) {
    serviceParams.push(from);
    serviceConditions.push(`bs.completed_at::date >= $${serviceParams.length}`);
  }
  if (to) {
    serviceParams.push(to);
    serviceConditions.push(`bs.completed_at::date <= $${serviceParams.length}`);
  }
  const serviceWhere = serviceConditions.length ? `WHERE ${serviceConditions.join(' AND ')}` : '';

  const [
    { rows: repairRows },
    { rows: serviceRows },
    recycleRows,
    { rows: allBatteriesRows },
  ] = await Promise.all([
    // 1. Repair revenue (parts + labor)
    db.query(
      `SELECT
         COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
         COALESCE(SUM(r.price), 0) AS parts_revenue,
         COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
         COUNT(DISTINCT r.batch_id) AS repairs_count,
         COUNT(DISTINCT r.battery_id) AS repair_batteries_count
       FROM repairs r
       ${repairWhere}`,
      repairParams
    ),

    // 2. Battery services & intake / diagnostic fees revenue
    db.query(
      `SELECT
         COALESCE(SUM(bs.rate), 0) AS services_revenue,
         COUNT(DISTINCT bs.id) AS services_count,
         COUNT(DISTINCT bs.battery_id) AS service_batteries_count
       FROM battery_services bs
       ${serviceWhere}`,
      serviceParams
    ),

    // 3. Recycle revenue (invoices reconciled with weight-priced batches, per period)
    recycleRevenueByPeriod({ from, to }),

    // 4. Total distinct batteries serviced across all repairs & services
    db.query(
      `SELECT COUNT(DISTINCT battery_id) AS total_batteries_count
       FROM (
         SELECT r.battery_id FROM repairs r ${repairWhere}
         UNION
         SELECT bs.battery_id FROM battery_services bs ${serviceWhere}
       ) combined`,
      repairParams.length >= serviceParams.length ? repairParams : serviceParams
    ),
  ]);

  const repairRevenue = Number(repairRows[0]?.repair_revenue || 0);
  const partsRevenue = Number(repairRows[0]?.parts_revenue || 0);
  const laborRevenue = Number(repairRows[0]?.labor_revenue || 0);
  const repairsCount = parseInt(repairRows[0]?.repairs_count || 0, 10);

  const servicesRevenue = Number(serviceRows[0]?.services_revenue || 0);
  const servicesCount = parseInt(serviceRows[0]?.services_count || 0, 10);

  const recycleRevenue = recycleRows.reduce((sum, r) => sum + Number(r.recycle_revenue || 0), 0);

  const totalRevenue = repairRevenue + servicesRevenue + recycleRevenue;
  const batteriesCount = parseInt(allBatteriesRows[0]?.total_batteries_count || 0, 10);

  return {
    repairRevenue,
    partsRevenue,
    laborRevenue,
    servicesRevenue,
    recycleRevenue,
    totalRevenue,
    repairsCount,
    servicesCount,
    batteriesCount,
    avgRevenuePerRepair: repairsCount > 0 ? repairRevenue / repairsCount : 0,
    avgRevenuePerBattery: batteriesCount > 0 ? (repairRevenue + servicesRevenue) / batteriesCount : 0,
  };
}

// Get breakdown grouped by month or day, with optional date filtering
async function getBreakdown({ from, to, breakdownType = 'month', limit = 60 } = {}) {
  const isDay = breakdownType === 'day';
  const timeFormat = isDay ? 'YYYY-MM-DD' : 'YYYY-MM';
  const labelFormat = isDay ? 'DD Mon YYYY' : 'Mon YYYY';
  const dateTrunc = isDay ? 'day' : 'month';

  const repairConditions = [];
  const repairParams = [];
  if (from) {
    repairParams.push(from);
    repairConditions.push(`r.repaired_at::date >= $${repairParams.length}`);
  }
  if (to) {
    repairParams.push(to);
    repairConditions.push(`r.repaired_at::date <= $${repairParams.length}`);
  }
  const repairWhere = repairConditions.length ? `WHERE ${repairConditions.join(' AND ')}` : '';

  const serviceConditions = [];
  const serviceParams = [];
  if (from) {
    serviceParams.push(from);
    serviceConditions.push(`bs.completed_at::date >= $${serviceParams.length}`);
  }
  if (to) {
    serviceParams.push(to);
    serviceConditions.push(`bs.completed_at::date <= $${serviceParams.length}`);
  }
  const serviceWhere = serviceConditions.length ? `WHERE ${serviceConditions.join(' AND ')}` : '';

  const [
    { rows: repairBreakdown },
    { rows: serviceBreakdown },
    recycleBreakdown,
    { rows: batteryBreakdown },
  ] = await Promise.all([
    // 1. Repair breakdown
    db.query(
      `SELECT
         to_char(r.repaired_at, '${timeFormat}') AS period_key,
         date_trunc('${dateTrunc}', r.repaired_at) AS period_date,
         to_char(r.repaired_at, '${labelFormat}') AS label,
         COALESCE(SUM(r.price + r.labor_charge), 0) AS repair_revenue,
         COALESCE(SUM(r.price), 0) AS parts_revenue,
         COALESCE(SUM(r.labor_charge), 0) AS labor_revenue,
         COUNT(DISTINCT r.batch_id) AS repairs_count,
         COUNT(DISTINCT r.battery_id) AS repair_batteries_count
       FROM repairs r
       ${repairWhere}
       GROUP BY period_key, period_date, label
       ORDER BY period_date DESC`,
      repairParams
    ),

    // 2. Services breakdown
    db.query(
      `SELECT
         to_char(bs.completed_at, '${timeFormat}') AS period_key,
         date_trunc('${dateTrunc}', bs.completed_at) AS period_date,
         to_char(bs.completed_at, '${labelFormat}') AS label,
         COALESCE(SUM(bs.rate), 0) AS services_revenue,
         COUNT(DISTINCT bs.id) AS services_count,
         COUNT(DISTINCT bs.battery_id) AS service_batteries_count
       FROM battery_services bs
       ${serviceWhere}
       GROUP BY period_key, period_date, label
       ORDER BY period_date DESC`,
      serviceParams
    ),

    // 3. Recycle breakdown (invoices reconciled with weight-priced batches)
    recycleRevenueByPeriod({ from, to, timeFormat, labelFormat }),

    // 4. Distinct batteries per period
    db.query(
      `SELECT
         period_key,
         COUNT(DISTINCT battery_id) AS batteries_count
       FROM (
         SELECT to_char(r.repaired_at, '${timeFormat}') AS period_key, r.battery_id FROM repairs r ${repairWhere}
         UNION
         SELECT to_char(bs.completed_at, '${timeFormat}') AS period_key, bs.battery_id FROM battery_services bs ${serviceWhere}
       ) combined
       GROUP BY period_key`,
      repairParams.length >= serviceParams.length ? repairParams : serviceParams
    ),
  ]);

  const map = new Map();

  function ensureEntry(key, date, label) {
    if (!map.has(key)) {
      map.set(key, {
        key,
        date: isDay ? key : undefined,
        month: !isDay ? key : undefined,
        label: label || key,
        type: breakdownType,
        period_date: new Date(date || key),
        repairRevenue: 0,
        partsRevenue: 0,
        laborRevenue: 0,
        servicesRevenue: 0,
        recycleRevenue: 0,
        totalRevenue: 0,
        repairsCount: 0,
        servicesCount: 0,
        batteriesCount: 0,
      });
    }
    return map.get(key);
  }

  repairBreakdown.forEach((r) => {
    const entry = ensureEntry(r.period_key, r.period_date, r.label);
    entry.repairRevenue += Number(r.repair_revenue || 0);
    entry.partsRevenue += Number(r.parts_revenue || 0);
    entry.laborRevenue += Number(r.labor_revenue || 0);
    entry.repairsCount += parseInt(r.repairs_count || 0, 10);
  });

  serviceBreakdown.forEach((s) => {
    const entry = ensureEntry(s.period_key, s.period_date, s.label);
    entry.servicesRevenue += Number(s.services_revenue || 0);
    entry.servicesCount += parseInt(s.services_count || 0, 10);
  });

  recycleBreakdown.forEach((rec) => {
    const entry = ensureEntry(rec.period_key, rec.period_date, rec.label);
    entry.recycleRevenue += Number(rec.recycle_revenue || 0);
  });

  const batteryCountMap = new Map(batteryBreakdown.map((b) => [b.period_key, parseInt(b.batteries_count || 0, 10)]));

  const results = Array.from(map.values())
    .map((item) => {
      item.batteriesCount = batteryCountMap.get(item.key) || (item.repairsCount > 0 ? item.repairsCount : item.servicesCount > 0 ? item.servicesCount : 0);
      item.totalRevenue = item.repairRevenue + item.servicesRevenue + item.recycleRevenue;
      return item;
    })
    .sort((a, b) => b.period_date - a.period_date)
    .slice(0, limit);

  return results;
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

  const repairConditions = [];
  const repairParams = [];
  if (startDate) {
    repairParams.push(startDate);
    repairConditions.push(`r.repaired_at::date >= $${repairParams.length}`);
  }
  if (endDate) {
    repairParams.push(endDate);
    repairConditions.push(`r.repaired_at::date <= $${repairParams.length}`);
  }
  const repairWhere = repairConditions.length ? `WHERE ${repairConditions.join(' AND ')}` : '';

  const serviceConditions = [];
  const serviceParams = [];
  if (startDate) {
    serviceParams.push(startDate);
    serviceConditions.push(`bs.completed_at::date >= $${serviceParams.length}`);
  }
  if (endDate) {
    serviceParams.push(endDate);
    serviceConditions.push(`bs.completed_at::date <= $${serviceParams.length}`);
  }
  const serviceWhere = serviceConditions.length ? `WHERE ${serviceConditions.join(' AND ')}` : '';

  const [
    totalsRes,
    clientBreakdownRes,
    staffBreakdownRes,
    partBreakdownRes,
    serviceBreakdownRes,
    allChargesRes,
  ] = await Promise.all([
    // 1. Overall Period Totals
    getTotals({ from: startDate, to: endDate }),

    // 2. Client Breakdown (Combining repairs + services/intake fees)
    db.query(
      `WITH client_charges AS (
         SELECT
           COALESCE(c.id, 0) AS client_id,
           COALESCE(b.client_name, c.name, 'Direct / Unassigned') AS client_name,
           b.id AS battery_id,
           r.batch_id AS repair_batch_id,
           NULL::int AS service_id,
           COALESCE(r.price + r.labor_charge, 0) AS repair_revenue,
           COALESCE(r.price, 0) AS parts_revenue,
           COALESCE(r.labor_charge, 0) AS labor_revenue,
           0::numeric AS service_revenue
         FROM repairs r
         JOIN batteries b ON b.id = r.battery_id
         LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
         LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
         ${repairWhere}

         UNION ALL

         SELECT
           COALESCE(c.id, 0) AS client_id,
           COALESCE(b.client_name, c.name, 'Direct / Unassigned') AS client_name,
           b.id AS battery_id,
           NULL::varchar AS repair_batch_id,
           bs.id AS service_id,
           0::numeric AS repair_revenue,
           0::numeric AS parts_revenue,
           0::numeric AS labor_revenue,
           COALESCE(bs.rate, 0) AS service_revenue
         FROM battery_services bs
         JOIN batteries b ON b.id = bs.battery_id
         LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
         LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
         ${serviceWhere}
       )
       SELECT
         client_id,
         client_name,
         COUNT(DISTINCT repair_batch_id) AS repairs_count,
         COUNT(DISTINCT service_id) AS services_count,
         COUNT(DISTINCT battery_id) AS batteries_count,
         COALESCE(SUM(repair_revenue + service_revenue), 0) AS total_revenue,
         COALESCE(SUM(repair_revenue), 0) AS repair_revenue,
         COALESCE(SUM(service_revenue), 0) AS services_revenue,
         COALESCE(SUM(labor_revenue), 0) AS labor_revenue,
         COALESCE(SUM(parts_revenue), 0) AS parts_revenue
       FROM client_charges
       GROUP BY client_id, client_name
       ORDER BY total_revenue DESC`,
      repairParams.length >= serviceParams.length ? repairParams : serviceParams
    ),

    // 3. Staff Breakdown (Repairs + Services performed)
    db.query(
      `WITH staff_work AS (
         SELECT
           s.id AS staff_id,
           s.name AS staff_name,
           s.role AS staff_role,
           r.batch_id AS repair_batch_id,
           NULL::int AS service_id,
           COALESCE(r.price + r.labor_charge, 0) AS revenue,
           COALESCE(r.labor_charge, 0) AS labor_revenue,
           COALESCE(r.price, 0) AS parts_revenue,
           r.duration_seconds
         FROM repairs r
         JOIN staff s ON s.id = r.staff_id
         ${repairWhere}

         UNION ALL

         SELECT
           s.id AS staff_id,
           s.name AS staff_name,
           s.role AS staff_role,
           NULL::varchar AS repair_batch_id,
           bs.id AS service_id,
           COALESCE(bs.rate, 0) AS revenue,
           COALESCE(bs.rate, 0) AS labor_revenue,
           0::numeric AS parts_revenue,
           NULL::int AS duration_seconds
         FROM battery_services bs
         JOIN staff s ON s.id = bs.staff_id
         ${serviceWhere}
       )
       SELECT
         staff_id,
         staff_name,
         staff_role,
         COUNT(DISTINCT repair_batch_id) AS repairs_count,
         COUNT(DISTINCT service_id) AS services_count,
         COALESCE(SUM(revenue), 0) AS total_revenue,
         COALESCE(SUM(labor_revenue), 0) AS labor_revenue,
         COALESCE(SUM(parts_revenue), 0) AS parts_revenue,
         AVG(duration_seconds) AS avg_duration_seconds
       FROM staff_work
       GROUP BY staff_id, staff_name, staff_role
       ORDER BY total_revenue DESC`,
      repairParams.length >= serviceParams.length ? repairParams : serviceParams
    ),

    // 4. Parts Breakdown
    db.query(
      `SELECT
         p.id AS part_id,
         p.name AS part_name,
         p.sku AS part_sku,
         SUM(r.quantity_used) AS quantity_used,
         COALESCE(SUM(r.price), 0) AS total_revenue
       FROM repairs r
       JOIN parts p ON p.id = r.part_id
       ${repairWhere}
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_revenue DESC
       LIMIT 15`,
      repairParams
    ),

    // 5. Services & Intake Fees Breakdown
    db.query(
      `SELECT
         bs.service_id,
         bs.service_name,
         COUNT(DISTINCT bs.id) AS times_applied,
         COUNT(DISTINCT bs.battery_id) AS batteries_count,
         AVG(bs.rate) AS avg_rate,
         COALESCE(SUM(bs.rate), 0) AS total_revenue
       FROM battery_services bs
       ${serviceWhere}
       GROUP BY bs.service_id, bs.service_name
       ORDER BY total_revenue DESC`,
      serviceParams
    ),

    // 6. Complete Itemized Battery Charge / Fee Ledger
    db.query(
      `SELECT * FROM (
         -- Repair Jobs
         SELECT
           r.batch_id AS item_key,
           'repair' AS charge_type,
           MAX(b.id) AS battery_id,
           MAX(b.battery_code) AS battery_code,
           MAX(b.status) AS battery_status,
           MAX(c.id) AS client_id,
           COALESCE(MAX(b.client_name), MAX(c.name), 'Direct / Unassigned') AS client_name,
           MAX(s.id) AS staff_id,
           MAX(s.name) AS staff_name,
           string_agg(p.name, ', ' ORDER BY p.name) AS item_description,
           COALESCE(SUM(r.price), 0) AS parts_charge,
           COALESCE(SUM(r.labor_charge), 0) AS labor_charge,
           0::numeric AS service_fee,
           COALESCE(SUM(r.price + r.labor_charge), 0) AS total_charge,
           MIN(r.notes) AS notes,
           MIN(r.repaired_at) AS charge_date,
           MIN(r.duration_seconds) AS duration_seconds
         FROM repairs r
         JOIN batteries b ON b.id = r.battery_id
         LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
         LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
         JOIN staff s ON s.id = r.staff_id
         JOIN parts p ON p.id = r.part_id
         ${repairWhere}
         GROUP BY r.batch_id

         UNION ALL

         -- Battery Services & Mandatory Intake Fees
         SELECT
           'service_' || bs.id::text AS item_key,
           'service_fee' AS charge_type,
           b.id AS battery_id,
           b.battery_code,
           b.status AS battery_status,
           c.id AS client_id,
           COALESCE(b.client_name, c.name, 'Direct / Unassigned') AS client_name,
           s.id AS staff_id,
           s.name AS staff_name,
           bs.service_name AS item_description,
           0::numeric AS parts_charge,
           0::numeric AS labor_charge,
           COALESCE(bs.rate, 0) AS service_fee,
           COALESCE(bs.rate, 0) AS total_charge,
           bs.notes,
           bs.completed_at AS charge_date,
           NULL::int AS duration_seconds
         FROM battery_services bs
         JOIN batteries b ON b.id = bs.battery_id
         LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
         LEFT JOIN clients c ON c.id = ti.client_id OR lower(c.name) = lower(b.client_name)
         LEFT JOIN staff s ON s.id = bs.staff_id
         ${serviceWhere}
       ) unified
       ORDER BY charge_date DESC`,
      repairParams.length >= serviceParams.length ? repairParams : serviceParams
    ),
  ]);

  return {
    period: {
      type,
      period,
      startDate,
      endDate,
    },
    totals: totalsRes,
    clientBreakdown: clientBreakdownRes.rows.map((c) => ({
      id: c.client_id,
      name: c.client_name,
      repairsCount: parseInt(c.repairs_count || 0, 10),
      servicesCount: parseInt(c.services_count || 0, 10),
      batteriesCount: parseInt(c.batteries_count || 0, 10),
      totalRevenue: Number(c.total_revenue || 0),
      repairRevenue: Number(c.repair_revenue || 0),
      servicesRevenue: Number(c.services_revenue || 0),
      laborRevenue: Number(c.labor_revenue || 0),
      partsRevenue: Number(c.parts_revenue || 0),
    })),
    staffBreakdown: staffBreakdownRes.rows.map((s) => ({
      id: s.staff_id,
      name: s.staff_name,
      role: s.staff_role,
      repairsCount: parseInt(s.repairs_count || 0, 10),
      servicesCount: parseInt(s.services_count || 0, 10),
      totalRevenue: Number(s.total_revenue || 0),
      laborRevenue: Number(s.labor_revenue || 0),
      partsRevenue: Number(s.parts_revenue || 0),
      avgDurationSeconds: s.avg_duration_seconds ? Math.round(Number(s.avg_duration_seconds)) : null,
    })),
    partBreakdown: partBreakdownRes.rows.map((p) => ({
      id: p.part_id,
      name: p.name,
      sku: p.part_sku,
      quantityUsed: parseInt(p.quantity_used || 0, 10),
      totalRevenue: Number(p.total_revenue || 0),
    })),
    serviceBreakdown: serviceBreakdownRes.rows.map((s) => ({
      id: s.service_id,
      name: s.service_name,
      timesApplied: parseInt(s.times_applied || 0, 10),
      batteriesCount: parseInt(s.batteries_count || 0, 10),
      avgRate: Number(s.avg_rate || 0),
      totalRevenue: Number(s.total_revenue || 0),
    })),
    repairs: (() => {
      const batteryMap = new Map();

      allChargesRes.rows.forEach((r, idx) => {
        const bCode = (r.battery_code || '').trim();
        const bId = r.battery_id;
        const key = bCode ? `code_${bCode.toUpperCase()}` : (bId ? `id_${bId}` : `item_${r.item_key || idx}`);

        if (!batteryMap.has(key)) {
          batteryMap.set(key, {
            id: `battery_${bId || bCode || idx}`,
            chargeType: r.charge_type,
            chargeTypes: new Set(),
            batchId: r.item_key,
            batteryId: bId,
            batteryCode: r.battery_code,
            batteryStatus: r.battery_status,
            clientId: r.client_id,
            clientName: r.client_name || 'Direct / Unassigned',
            staffId: r.staff_id,
            staffName: r.staff_name || 'System / Auto',
            staffList: [],
            serviceNames: new Set(),
            partNames: new Set(),
            partsCharge: 0,
            laborCharge: 0,
            serviceFee: 0,
            totalCharge: 0,
            notes: [],
            repairedAt: r.charge_date,
            durationSeconds: 0,
            items: [],
          });
        }

        const group = batteryMap.get(key);

        group.partsCharge += Number(r.parts_charge || 0);
        group.laborCharge += Number(r.labor_charge || 0);
        group.serviceFee += Number(r.service_fee || 0);
        group.totalCharge += Number(r.total_charge || 0);

        if (r.duration_seconds) {
          group.durationSeconds += Number(r.duration_seconds);
        }

        if (r.charge_type) {
          group.chargeTypes.add(r.charge_type);
        }

        const sName = r.staff_name || (r.staff_id ? `Staff #${r.staff_id}` : 'System / Auto');
        if (sName && !group.staffList.some((s) => s.id === r.staff_id && s.name === sName)) {
          group.staffList.push({ id: r.staff_id, name: sName });
        }

        if (r.charge_type === 'service_fee') {
          if (r.item_description) group.serviceNames.add(r.item_description.trim());
        } else {
          const parts = (r.item_description || '').split(',').map((p) => p.trim()).filter(Boolean);
          parts.forEach((p) => group.partNames.add(p));
        }

        if (r.notes && r.notes.trim()) {
          group.notes.push(r.notes.trim());
        }

        if (r.charge_date) {
          if (!group.repairedAt || new Date(r.charge_date) > new Date(group.repairedAt)) {
            group.repairedAt = r.charge_date;
          }
        }

        if (r.battery_status) {
          group.batteryStatus = r.battery_status;
        }
        if (r.client_name && r.client_name !== 'Direct / Unassigned') {
          group.clientName = r.client_name;
        }

        group.items.push({
          id: r.item_key,
          chargeType: r.charge_type,
          batteryId: r.battery_id,
          batteryCode: r.battery_code,
          staffId: r.staff_id,
          staffName: r.staff_name || 'System / Auto',
          itemDescription: r.item_description,
          partName: r.item_description,
          partsCharge: Number(r.parts_charge || 0),
          laborCharge: Number(r.labor_charge || 0),
          serviceFee: Number(r.service_fee || 0),
          totalCharge: Number(r.total_charge || 0),
          notes: r.notes,
          repairedAt: r.charge_date,
        });
      });

      const consolidated = Array.from(batteryMap.values()).map((e) => {
        const services = Array.from(e.serviceNames);
        const parts = Array.from(e.partNames);
        const allDescriptions = [...services, ...parts];

        return {
          id: e.id,
          chargeType: e.chargeTypes.size > 1 ? 'repair, service_fee' : (Array.from(e.chargeTypes)[0] || 'repair'),
          chargeTypes: Array.from(e.chargeTypes),
          batchId: e.batchId,
          batteryId: e.batteryId,
          batteryCode: e.batteryCode,
          batteryStatus: e.batteryStatus,
          clientId: e.clientId,
          clientName: e.clientName,
          staffId: e.staffId,
          staffName: e.staffList.map((s) => s.name).join(', ') || e.staffName,
          staffList: e.staffList,
          partName: allDescriptions.join(', '),
          itemDescription: allDescriptions.join(', '),
          services,
          parts,
          partsCharge: e.partsCharge,
          laborCharge: e.laborCharge,
          serviceFee: e.serviceFee,
          totalCharge: e.totalCharge,
          notes: e.notes.join('; '),
          repairedAt: e.repairedAt,
          durationSeconds: e.durationSeconds || null,
          items: e.items.sort((a, b) => new Date(b.repairedAt || 0) - new Date(a.repairedAt || 0)),
        };
      });

      consolidated.sort((a, b) => new Date(b.repairedAt || 0) - new Date(a.repairedAt || 0));
      return consolidated;
    })(),
  };
}

module.exports = { getTotals, getBreakdown, getPeriodDetail };

