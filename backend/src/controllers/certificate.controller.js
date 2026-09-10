const certificateModel = require('../models/certificate.model');
const clientModel = require('../models/client.model');

function isClientRole(role) {
  return role === 'client' || role === 'recycle_client';
}

async function getMyMilestones(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(404).json({ message: 'Client profile not found.' });
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
    const { id } = req.params;
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(404).json({ message: 'Client profile not found.' });
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
    const [allCerts, clients] = await Promise.all([
      certificateModel.findAllCertificates({
        clientId: clientId ? Number(clientId) : null,
        search,
      }),
      clientModel.findAll(),
    ]);

    // Compute milestone progress for each client
    const clientProgress = await Promise.all(
      clients.map(async (c) => {
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

module.exports = {
  getMyMilestones,
  acknowledgeCertificate,
  listAdmin,
  getByCode,
};
