const db = require('../config/db');

const MILESTONE_TIERS = [
  {
    count: 100,
    tier: '100_batteries',
    title: 'Bronze Eco Champion — 100 Batteries Serviced',
    co2Kg: 1520,
    ewasteKg: 280,
    subtitle: '100 Battery Restoration & Life-Extension Milestone',
    badge: 'Bronze',
  },
  {
    count: 500,
    tier: '500_batteries',
    title: 'Silver Circular Pioneer — 500 Batteries Serviced',
    co2Kg: 7600,
    ewasteKg: 1400,
    subtitle: '500 Battery Restoration & Circular Economy Milestone',
    badge: 'Silver',
  },
  {
    count: 1000,
    tier: '1000_batteries',
    title: 'Gold Sustainability Leader — 1,000 Batteries Serviced',
    co2Kg: 15200,
    ewasteKg: 2800,
    subtitle: '1,000 Battery Restoration & Decarbonization Milestone',
    badge: 'Gold',
  },
  {
    count: 5000,
    tier: '5000_batteries',
    title: 'Platinum Planet Protector — 5,000 Batteries Serviced',
    co2Kg: 76000,
    ewasteKg: 14000,
    subtitle: '5,000 Battery Restoration & Zero-Waste Champion',
    badge: 'Platinum',
  },
  {
    count: 10000,
    tier: '10000_batteries',
    title: 'Diamond Zero-Waste Hero — 10,000 Batteries Serviced',
    co2Kg: 152000,
    ewasteKg: 28000,
    subtitle: '10,000 Battery Restoration & Industrial Decarbonization Leader',
    badge: 'Diamond',
  },
  {
    count: 20000,
    tier: '20000_batteries',
    title: 'Emerald Circular Vanguard — 20,000 Batteries Serviced',
    co2Kg: 304000,
    ewasteKg: 56000,
    subtitle: '20,000 Battery Restoration & Ultimate Sustainability Vanguard',
    badge: 'Emerald',
  },
];

function generateCertCode(clientName, milestoneCount) {
  const cleanClient = (clientName || 'CLIENT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `CERT-REFURB-${milestoneCount}-${cleanClient}-${year}-${rand}`;
}

async function findByClientId(clientId) {
  const { rows } = await db.query(
    `SELECT mc.*, c.name AS client_name, c.logo_path AS client_logo_path
     FROM milestone_certificates mc
     JOIN clients c ON c.id = mc.client_id
     WHERE mc.client_id = $1
     ORDER BY mc.milestone_count ASC`,
    [clientId]
  );
  return rows;
}

async function findAllCertificates({ clientId = null, search = '' } = {}) {
  let query = `
    SELECT mc.*, c.name AS client_name, c.logo_path AS client_logo_path
    FROM milestone_certificates mc
    JOIN clients c ON c.id = mc.client_id
    WHERE 1=1
  `;
  const params = [];

  if (clientId) {
    params.push(clientId);
    query += ` AND mc.client_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    query += ` AND (c.name ILIKE $${params.length} OR mc.certificate_code ILIKE $${params.length} OR mc.title ILIKE $${params.length})`;
  }

  query += ` ORDER BY mc.issued_at DESC`;

  const { rows } = await db.query(query, params);
  return rows;
}

async function findByCode(code) {
  const { rows } = await db.query(
    `SELECT mc.*, c.name AS client_name, c.logo_path AS client_logo_path
     FROM milestone_certificates mc
     JOIN clients c ON c.id = mc.client_id
     WHERE mc.certificate_code = $1`,
    [code]
  );
  return rows[0] || null;
}

async function acknowledge(certificateId, clientId) {
  const { rows } = await db.query(
    `UPDATE milestone_certificates
     SET acknowledged_at = NOW()
     WHERE id = $1 AND client_id = $2
     RETURNING *`,
    [certificateId, clientId]
  );
  return rows[0] || null;
}

async function getClientServicedBatteryCount(clientId, clientName) {
  // CTE matching client's batteries
  const { rows } = await db.query(
    `WITH client_b_ids AS (
       SELECT id FROM batteries WHERE client_id = $1
       UNION
       SELECT id FROM batteries WHERE client_name = $2
       UNION
       SELECT b.id FROM batteries b
       JOIN clients c ON c.id = $1
       WHERE c.prefix IS NOT NULL AND c.prefix <> '' AND b.battery_code LIKE c.prefix || '-%'
     )
     SELECT 
       COUNT(DISTINCT b.id) AS total_batteries,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('repaired', 'returned') OR EXISTS (SELECT 1 FROM repairs r WHERE r.battery_id = b.id)) AS serviced_count
     FROM client_b_ids cb
     JOIN batteries b ON b.id = cb.id`,
    [clientId, clientName || '']
  );

  return Number(rows[0]?.serviced_count || 0);
}

// Evaluates and issues any milestone certificates reached but not yet created
async function checkAndAwardMilestones(clientId, clientName) {
  const servicedCount = await getClientServicedBatteryCount(clientId, clientName);
  const existingCerts = await findByClientId(clientId);
  const existingCounts = new Set(existingCerts.map((c) => c.milestone_count));

  const newlyAwarded = [];

  for (const tier of MILESTONE_TIERS) {
    if (servicedCount >= tier.count && !existingCounts.has(tier.count)) {
      const code = generateCertCode(clientName, tier.count);
      const customNote = `Congratulations on servicing over ${tier.count.toLocaleString()} batteries with Refurbnics! Through refurbishing rather than replacing lithium-ion battery packs, you have prevented an estimated ${(tier.co2Kg / 1000).toFixed(1)} metric tons of CO2 emissions and saved valuable raw earth minerals.`;

      const { rows } = await db.query(
        `INSERT INTO milestone_certificates
         (client_id, milestone_tier, milestone_count, title, co2_saved_kg, ewaste_diverted_kg, certificate_code, custom_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (client_id, milestone_count) DO NOTHING
         RETURNING *`,
        [clientId, tier.tier, tier.count, tier.title, tier.co2Kg, tier.ewasteKg, code, customNote]
      );

      if (rows[0]) {
        newlyAwarded.push({
          ...rows[0],
          client_name: clientName,
        });
      }
    }
  }

  const allCerts = await findByClientId(clientId);
  const unacknowledged = allCerts.filter((c) => !c.acknowledged_at);

  return {
    servicedCount,
    allCerts,
    newlyAwarded,
    unacknowledged,
    milestoneTiers: MILESTONE_TIERS,
  };
}

module.exports = {
  MILESTONE_TIERS,
  findByClientId,
  findAllCertificates,
  findByCode,
  acknowledge,
  getClientServicedBatteryCount,
  checkAndAwardMilestones,
};
