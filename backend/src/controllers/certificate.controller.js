const certificateModel = require('../models/certificate.model');
const clientModel = require('../models/client.model');

function isClientRole(role) {
  return role === 'client' || role === 'recycle_client';
}

async function getMyMilestones(req, res, next) {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Milestone certificates are exclusively for fleet clients.' });
    }
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(404).json({ message: 'Fleet client profile not found.' });
    }

    const result = await certificateModel.checkAndAwardMilestones(client.id, client.name);
    res.json({
      client,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function acknowledgeCertificate(req, res, next) {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Milestone certificates are exclusively for fleet clients.' });
    }
    const { id } = req.params;
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(404).json({ message: 'Fleet client profile not found.' });
    }

    const acknowledged = await certificateModel.acknowledge(Number(id), client.id);
    res.json({ success: true, certificate: acknowledged });
  } catch (err) {
    next(err);
  }
}

async function listAdmin(req, res, next) {
  try {
    const { clientId, search } = req.query;
    const [allCerts, allClients] = await Promise.all([
      certificateModel.findAllCertificates({
        clientId: clientId ? Number(clientId) : null,
        search,
      }),
      clientModel.findAll(),
    ]);

    // Only fleet clients (exclude recycle_client role)
    const fleetClients = allClients.filter((c) => c.user_role !== 'recycle_client');

    // Compute milestone progress for each fleet client
    const clientProgress = await Promise.all(
      fleetClients.map(async (c) => {
        const servicedCount = await certificateModel.getClientServicedBatteryCount(c.id, c.name);
        const certs = allCerts.filter((cert) => cert.client_id === c.id);
        const nextTier = certificateModel.MILESTONE_TIERS.find((t) => t.count > servicedCount) || null;
        return {
          clientId: c.id,
          clientName: c.name,
          logoPath: c.logo_path,
          servicedCount,
          certificatesCount: certs.length,
          certificates: certs,
          nextTier,
        };
      })
    );

    // Total CO2 saved across all clients
    const totalServicedAll = clientProgress.reduce((sum, c) => sum + c.servicedCount, 0);
    const totalCo2SavedKg = totalServicedAll * 15.2; // 15.2 kg per battery
    const totalEwasteDivertedKg = totalServicedAll * 2.8;

    res.json({
      certificates: allCerts,
      clientProgress,
      milestoneTiers: certificateModel.MILESTONE_TIERS,
      stats: {
        totalCertificatesIssued: allCerts.length,
        totalServicedAll,
        totalCo2SavedKg: Math.round(totalCo2SavedKg),
        totalEwasteDivertedKg: Math.round(totalEwasteDivertedKg),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getByCode(req, res, next) {
  try {
    const { code } = req.params;
    const cert = await certificateModel.findByCode(code);
    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found or invalid certificate code.' });
    }
    res.json(cert);
  } catch (err) {
    next(err);
  }
}

async function getClientMilestoneDetailAdmin(req, res, next) {
  try {
    const { clientId } = req.params;
    const client = await clientModel.findById(Number(clientId));
    if (!client) {
      return res.status(404).json({ message: 'Fleet client not found.' });
    }

    const servicedCount = await certificateModel.getClientServicedBatteryCount(client.id, client.name);
    const certificates = await certificateModel.findByClientId(client.id);
    const nextTier = certificateModel.MILESTONE_TIERS.find((t) => t.count > servicedCount) || null;

    // Fetch recent serviced batteries for this client
    const { rows: recentBatteries } = await require('../config/db').query(
      `WITH client_b_ids AS (
         SELECT b.id, b.battery_code, b.serial_number, b.status, b.created_at
         FROM batteries b
         JOIN truck_intakes ti ON ti.id = b.truck_intake_id
         WHERE ti.client_id = $1
         UNION
         SELECT b.id, b.battery_code, b.serial_number, b.status, b.created_at
         FROM batteries b
         WHERE lower(b.client_name) = lower($2)
       )
       SELECT b.*,
              last_repair.repaired_at AS last_repaired_at
       FROM client_b_ids b
       LEFT JOIN LATERAL (
         SELECT r.repaired_at
         FROM repairs r
         WHERE r.battery_id = b.id
         ORDER BY r.repaired_at DESC
         LIMIT 1
       ) last_repair ON true
       ORDER BY COALESCE(last_repair.repaired_at, b.created_at) DESC
       LIMIT 10`,
      [client.id, client.name]
    );

    const totalCo2SavedKg = Math.round(servicedCount * 15.2);
    const totalEwasteDivertedKg = Math.round(servicedCount * 2.8);

    res.json({
      client,
      servicedCount,
      totalCo2SavedKg,
      totalEwasteDivertedKg,
      certificates,
      nextTier,
      milestoneTiers: certificateModel.MILESTONE_TIERS,
      recentBatteries,
    });
  } catch (err) {
    next(err);
  }
}

async function evaluateClientAdmin(req, res, next) {
  try {
    const { clientId } = req.params;
    const client = await clientModel.findById(Number(clientId));
    if (!client) {
      return res.status(404).json({ message: 'Fleet client not found.' });
    }

    const result = await certificateModel.checkAndAwardMilestones(client.id, client.name);
    res.json({
      success: true,
      client,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyMilestones,
  acknowledgeCertificate,
  listAdmin,
  getClientMilestoneDetailAdmin,
  evaluateClientAdmin,
  getByCode,
};
