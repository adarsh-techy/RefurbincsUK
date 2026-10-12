// The 14-element battery composition used by the certificate "Technical
// Annex" / "Section 2 Composition Audit" — same rows, per-pack masses and
// formatting as the web utils/generate-milestone-certificate.js
// (calculateMaterialBreakdown).

export const BATTERY_COMPOSITION_DATA = [
  { nameEn: 'Metal Oxide (proprietary) Iron', formula: 'Li(NiCoMn)O2', casNo: '182442-95-1', weightPct: '20-60%', unitKg: 1.6, role: 'Active Cathode Material (NMC/Iron)' },
  { nameEn: 'Styrene-Butadiene-Rubber', formula: '(C8H8.C4H6)x', casNo: '9003-55-8', weightPct: '< 1%', unitKg: 0.03, role: 'Electrode Binder' },
  { nameEn: 'Vinyl silicone oil', formula: 'CH2CH[Si(CH3)2O]nSi(CH3)2CH=CH2', casNo: '68083-19-2', weightPct: '6-13%', unitKg: 0.38, role: 'Thermal Silicone Sealant' },
  { nameEn: 'Quartz Powder', formula: 'SiO2', casNo: '7631-86-9', weightPct: '13-18%', unitKg: 0.62, role: 'Thermal & Structural Filler' },
  { nameEn: 'Graphite (C)', formula: 'C', casNo: '7780-42-5', weightPct: '8.9%', unitKg: 0.356, role: 'Anode Active Material' },
  { nameEn: 'Electrolyte (proprietary)', formula: '/', casNo: '21324-40-3', weightPct: '0.6%', unitKg: 0.024, role: 'Ionic Conduction Solution' },
  { nameEn: 'Ethylene carbonate', formula: 'C3H4O3', casNo: '96-49-1', weightPct: '1.3%', unitKg: 0.052, role: 'Organic Electrolyte Solvent' },
  { nameEn: 'Ethyl methyl carbonate', formula: 'C4H8O3', casNo: '623-53-0', weightPct: '0.5%', unitKg: 0.02, role: 'Electrolyte Co-Solvent' },
  { nameEn: 'Polypropylene', formula: 'C22H42O3', casNo: '9003-07-0', weightPct: '1.25%', unitKg: 0.05, role: 'Separator Membrane & Casing' },
  { nameEn: 'Dimethyl carbonate', formula: 'C3H6O3', casNo: '616-38-6', weightPct: '2.8%', unitKg: 0.112, role: 'Electrolyte Solvent' },
  { nameEn: 'PVDF', formula: '[-CH2-CF2-]n', casNo: '24937-79-9', weightPct: '0.25%', unitKg: 0.01, role: 'Fluoropolymer Cathode Binder' },
  { nameEn: 'Nickel', formula: 'Ni', casNo: '7440-02-0', weightPct: '4%', unitKg: 0.16, role: 'Cathode Current Collector & Tabs' },
  { nameEn: 'Copper Foil', formula: 'Cu', casNo: '7440-50-8', weightPct: '4%', unitKg: 0.16, role: 'Anode Current Collector Foil' },
  { nameEn: 'Iron', formula: 'Fe', casNo: '7439-89-6', weightPct: '6%', unitKg: 0.24, role: 'Structural Enclosure & Shell' },
];

export function calculateMaterialBreakdown(batteryCount = 100) {
  const count = Number(batteryCount) || 100;
  return BATTERY_COMPOSITION_DATA.map((item) => {
    const totalKg = item.unitKg * count;
    let formattedAmount;
    if (totalKg >= 1000) formattedAmount = `${(totalKg / 1000).toFixed(2)} Tons`;
    else if (totalKg >= 10) formattedAmount = `${totalKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
    else formattedAmount = `${totalKg.toFixed(2)} kg`;
    return { ...item, totalKg, formattedAmount };
  });
}
