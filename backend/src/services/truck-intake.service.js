const truckIntakeModel = require('../models/truck-intake.model');
const batteryModel = require('../models/battery.model');
const serviceModel = require('../models/service.model');

// Creates one truck intake record plus a uniquely-coded battery row for each
// brand-new battery delivered (batteryCount), and attaches any already-
// tracked batteries scanned in by their existing QR code (scannedBatteryIds)
// — batteries returning for another repair round. A returning battery keeps
// its original truck_intake_id (and full history); this only adds a new
// battery_visits row for it. Shared by the manual "create" form and the bulk
// Excel/spreadsheet import so both paths generate battery codes the same way
// (the import path never has scanned batteries).
async function createIntakeWithBatteries({
  truckNumber,
  driverName,
  batteryCount,
  clientId,
  scannedBatteryIds = [],
}) {
  // Validate every scanned battery up front, before creating anything, so a
  // bad scan doesn't leave a half-created intake behind. Fetched in one
  // batched query rather than one findById per scanned battery.
  const foundBatteries = await batteryModel.findByIds(scannedBatteryIds);
  const foundById = new Map(foundBatteries.map((b) => [b.id, b]));
  const scannedBatteries = scannedBatteryIds.map((id) => {
    const battery = foundById.get(id);
    if (!battery) {
      const err = new Error('One of the scanned batteries could not be found.');
      err.status = 400;
      throw err;
    }
    if (battery.status === 'unserviceable') {
      const err = new Error(
        `Battery ${battery.battery_code} was declared unserviceable — it can't come in again.`
      );
      err.status = 400;
      throw err;
    }
    if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(battery.status)) {
      const err = new Error(
        `Battery ${battery.battery_code} hasn't been returned to the client yet — it can't come in again.`
      );
      err.status = 400;
      throw err;
    }
    return battery;
  });

  const totalCount = Number(batteryCount || 0) + scannedBatteries.length;
  const intake = await truckIntakeModel.create({
    truckNumber,
    driverName,
    batteryCount: totalCount,
    clientId,
  });

  const newCodes = [];
  for (let i = 1; i <= Number(batteryCount || 0); i += 1) {
    newCodes.push(`BAT-${intake.id}-${String(i).padStart(3, '0')}`);
  }
  const newBatteries = await batteryModel.createMany(newCodes, intake.id);
  const revisitedBatteries = await batteryModel.addVisitMany(
    scannedBatteries.map((b) => b.id),
    intake.id
  );

  const allBatteries = [...newBatteries, ...revisitedBatteries];
  const allBatteryIds = allBatteries.map((b) => b.id);

  if (allBatteryIds.length > 0) {
    try {
      await serviceModel.applyMandatoryServicesToBatteries(allBatteryIds, {
        notes: `Mandatory Intake Service Fee (Truck Intake #${intake.id})`,
      });
    } catch (svcErr) {
      console.error('Error auto-applying mandatory services on truck intake:', svcErr);
    }
  }

  return { intake, batteries: allBatteries };
}

module.exports = { createIntakeWithBatteries };
