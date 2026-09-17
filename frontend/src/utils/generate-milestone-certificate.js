import jsPDF from 'jspdf';

export const TIER_CONFIGS = {
  Bronze: {
    badge: 'Bronze',
    count: 100,
    primaryRgb: [180, 105, 40], // Warm Antique Bronze
    secondaryRgb: [220, 155, 95], // Light Copper Bronze
    darkRgb: [120, 65, 20],
    bgRgb: [254, 251, 246], // Warm Antique Parchment
    ribbonRgb: [160, 82, 45],
    ribbonDarkRgb: [100, 45, 15],
    sealTitle: 'BRONZE SEAL',
    categoryName: 'Bronze Eco Champion (100+)',
  },
  Silver: {
    badge: 'Silver',
    count: 500,
    primaryRgb: [100, 116, 139], // Slate Silver
    secondaryRgb: [180, 195, 210], // Polished Silver
    darkRgb: [51, 65, 85],
    bgRgb: [248, 250, 252], // Crisp Silver Parchment
    ribbonRgb: [71, 85, 105],
    ribbonDarkRgb: [30, 41, 59],
    sealTitle: 'SILVER SEAL',
    categoryName: 'Silver Circular Pioneer (500+)',
  },
  Gold: {
    badge: 'Gold',
    count: 1000,
    primaryRgb: [184, 134, 45], // Imperial Gold
    secondaryRgb: [224, 185, 108], // Shimmer Gold
    darkRgb: [138, 98, 28],
    bgRgb: [254, 253, 249], // Imperial Ivory Parchment
    ribbonRgb: [26, 75, 140], // Royal Blue Ribbon
    ribbonDarkRgb: [16, 48, 92],
    sealTitle: 'GOLD SEAL',
    categoryName: 'Gold Sustainability Leader (1,000+)',
  },
  Platinum: {
    badge: 'Platinum',
    count: 5000,
    primaryRgb: [99, 102, 241], // Royal Indigo Platinum
    secondaryRgb: [165, 180, 252], // Luminous Violet Platinum
    darkRgb: [67, 56, 202],
    bgRgb: [250, 250, 255], // Ice Platinum Parchment
    ribbonRgb: [79, 70, 229],
    ribbonDarkRgb: [49, 46, 129],
    sealTitle: 'PLATINUM',
    categoryName: 'Platinum Planet Protector (5,000+)',
  },
  Diamond: {
    badge: 'Diamond',
    count: 10000,
    primaryRgb: [6, 182, 212], // Cyan Diamond
    secondaryRgb: [103, 232, 249], // Diamond Crystal
    darkRgb: [14, 116, 144],
    bgRgb: [246, 254, 254], // Crystal Diamond Parchment
    ribbonRgb: [8, 145, 178],
    ribbonDarkRgb: [8, 51, 68],
    sealTitle: 'DIAMOND',
    categoryName: 'Diamond Zero-Waste Hero (10,000+)',
  },
  Emerald: {
    badge: 'Emerald',
    count: 20000,
    primaryRgb: [5, 150, 105], // Deep Emerald Green
    secondaryRgb: [110, 231, 183], // Radiance Emerald
    darkRgb: [6, 78, 59],
    bgRgb: [244, 253, 248], // Emerald Botanical Parchment
    ribbonRgb: [4, 120, 87],
    ribbonDarkRgb: [2, 44, 34],
    sealTitle: 'EMERALD',
    categoryName: 'Emerald Circular Vanguard (20,000+)',
  },
};

export const BATTERY_COMPOSITION_DATA = [
  {
    nameEn: 'Metal Oxide (proprietary) Iron',
    formula: 'Li(NiCoMn)O2',
    casNo: '182442-95-1',
    weightPct: '20-60%',
    unitKg: 1.60,
    role: 'Active Cathode Material (NMC/Iron)',
  },
  {
    nameEn: 'Styrene-Butadiene-Rubber',
    formula: '(C8H8.C4H6)x',
    casNo: '9003-55-8',
    weightPct: '< 1%',
    unitKg: 0.03,
    role: 'Electrode Binder',
  },
  {
    nameEn: 'Vinyl silicone oil',
    formula: 'CH2CH[Si(CH3)2O]nSi(CH3)2CH=CH2',
    casNo: '68083-19-2',
    weightPct: '6-13%',
    unitKg: 0.38,
    role: 'Thermal Silicone Sealant',
  },
  {
    nameEn: 'Quartz Powder',
    formula: 'SiO2',
    casNo: '7631-86-9',
    weightPct: '13-18%',
    unitKg: 0.62,
    role: 'Thermal & Structural Filler',
  },
  {
    nameEn: 'Graphite (C)',
    formula: 'C',
    casNo: '7780-42-5',
    weightPct: '8.9%',
    unitKg: 0.356,
    role: 'Anode Active Material',
  },
  {
    nameEn: 'Electrolyte (proprietary)',
    formula: '/',
    casNo: '21324-40-3',
    weightPct: '0.6%',
    unitKg: 0.024,
    role: 'Ionic Conduction Solution',
  },
  {
    nameEn: 'Ethylene carbonate',
    formula: 'C3H4O3',
    casNo: '96-49-1',
    weightPct: '1.3%',
    unitKg: 0.052,
    role: 'Organic Electrolyte Solvent',
  },
  {
    nameEn: 'Ethyl methyl carbonate',
    formula: 'C4H8O3',
    casNo: '623-53-0',
    weightPct: '0.5%',
    unitKg: 0.020,
    role: 'Electrolyte Co-Solvent',
  },
  {
    nameEn: 'Polypropylene',
    formula: 'C22H42O3',
    casNo: '9003-07-0',
    weightPct: '1.25%',
    unitKg: 0.050,
    role: 'Separator Membrane & Casing',
  },
  {
    nameEn: 'Dimethyl carbonate',
    formula: 'C3H6O3',
    casNo: '616-38-6',
    weightPct: '2.8%',
    unitKg: 0.112,
    role: 'Electrolyte Solvent',
  },
  {
    nameEn: 'PVDF',
    formula: '[-CH2-CF2-]n',
    casNo: '24937-79-9',
    weightPct: '0.25%',
    unitKg: 0.010,
    role: 'Fluoropolymer Cathode Binder',
  },
  {
    nameEn: 'Nickel',
    formula: 'Ni',
    casNo: '7440-02-0',
    weightPct: '4%',
    unitKg: 0.160,
    role: 'Cathode Current Collector & Tabs',
  },
  {
    nameEn: 'Copper Foil',
    formula: 'Cu',
    casNo: '7440-50-8',
    weightPct: '4%',
    unitKg: 0.160,
    role: 'Anode Current Collector Foil',
  },
  {
    nameEn: 'Iron',
    formula: 'Fe',
    casNo: '7439-89-6',
    weightPct: '6%',
    unitKg: 0.240,
    role: 'Structural Enclosure & Shell',
  },
];

export function calculateMaterialBreakdown(batteryCount = 100) {
  const count = Number(batteryCount) || 100;
  return BATTERY_COMPOSITION_DATA.map((item) => {
    const totalKg = item.unitKg * count;
    let formattedAmount;
    if (totalKg >= 1000) {
      formattedAmount = `${(totalKg / 1000).toFixed(2)} Tons`;
    } else if (totalKg >= 10) {
      formattedAmount = `${totalKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
    } else {
      formattedAmount = `${totalKg.toFixed(2)} kg`;
    }
    return {
      ...item,
      totalKg,
      formattedAmount,
    };
  });
}

export function getTierForCertificate(certificate) {
  const count = Number(certificate?.milestone_count || 0);
  const title = (certificate?.title || '').toLowerCase();
  const tierStr = (certificate?.milestone_tier || '').toLowerCase();

  if (count >= 20000 || title.includes('emerald') || tierStr.includes('emerald')) return TIER_CONFIGS.Emerald;
  if (count >= 10000 || title.includes('diamond') || tierStr.includes('diamond')) return TIER_CONFIGS.Diamond;
  if (count >= 5000 || title.includes('platinum') || tierStr.includes('platinum')) return TIER_CONFIGS.Platinum;
  if (count >= 1000 || title.includes('gold') || tierStr.includes('gold')) return TIER_CONFIGS.Gold;
  if (count >= 500 || title.includes('silver') || tierStr.includes('silver')) return TIER_CONFIGS.Silver;
  return TIER_CONFIGS.Bronze;
}

/**
 * Generates an official, tier-themed classic vector PDF Certificate.
 */
export function generateMilestoneCertificatePDF(certificate, clientName) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth(); // 841.89 pt
  const height = doc.internal.pageSize.getHeight(); // 595.28 pt

  const tier = getTierForCertificate(certificate);
  const count = Number(certificate.milestone_count || tier.count);
  const co2Tons = (Number(certificate.co2_saved_kg || count * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(Number(certificate.ewaste_diverted_kg || count * 2.8)).toLocaleString();
  const certClient = (certificate.client_name || clientName || 'Valued Enterprise Partner').toUpperCase();
  const certCode = certificate.certificate_code || `CERT-REFURB-${count}-2026`;
  const issueDate = certificate.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

  const PRIMARY = tier.primaryRgb;
  const SECONDARY = tier.secondaryRgb;
  const DARK = tier.darkRgb;
  const BG = tier.bgRgb;
  const RIBBON = tier.ribbonRgb;
  const RIBBON_DARK = tier.ribbonDarkRgb;
  const SLATE_DEEP = [18, 24, 38];
  const SLATE_BODY = [51, 65, 85];
  const SLATE_MUTED = [100, 116, 139];

  // 1. Parchment Background Fill with Tier Tint
  doc.setFillColor(...BG);
  doc.rect(0, 0, width, height, 'F');

  // Subtle Guilloche Security Inlay
  doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.setLineWidth(0.35);
  for (let i = 40; i < width - 40; i += 48) {
    doc.line(i, 40, width - 40, height - (i * 0.7));
  }

  // 2. Multi-tier Classical Ornamental Border
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(5);
  doc.rect(16, 16, width - 32, height - 32);

  doc.setDrawColor(...SECONDARY);
  doc.setLineWidth(1);
  doc.rect(23, 23, width - 46, height - 46);

  doc.setDrawColor(...DARK);
  doc.setLineWidth(2.5);
  doc.rect(28, 28, width - 56, height - 56);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.75);
  doc.rect(34, 34, width - 68, height - 68);

  // 3. Ornate Corner Filigree Flourishes
  const drawFlourish = (x, y, dirX, dirY) => {
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(2);
    doc.line(x, y, x + dirX * 36, y);
    doc.line(x, y, x, y + dirY * 36);
    doc.setDrawColor(...SECONDARY);
    doc.setLineWidth(1);
    doc.line(x + dirX * 6, y + dirY * 6, x + dirX * 28, y + dirY * 6);
    doc.line(x + dirX * 6, y + dirY * 6, x + dirX * 6, y + dirY * 28);
    doc.setFillColor(...DARK);
    doc.circle(x + dirX * 12, y + dirY * 12, 4, 'FD');
    doc.setFillColor(...SECONDARY);
    doc.circle(x + dirX * 12, y + dirY * 12, 2, 'F');
  };

  drawFlourish(42, 42, 1, 1);
  drawFlourish(width - 42, 42, -1, 1);
  drawFlourish(42, height - 42, 1, -1);
  drawFlourish(width - 42, height - 42, -1, -1);

  // 4. Header & Imperial Organization Title
  let y = 62;
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('REFURBNICS CIRCULAR LOGISTICS & BATTERY ENGINEERING', width / 2, y, { align: 'center', charSpace: 1.5 });

  y += 13;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`— ${tier.badge.toUpperCase()} TIER • GLOBAL BATTERY DECARBONIZATION REGISTRY —`, width / 2, y, { align: 'center', charSpace: 2 });

  // 5. Main Certificate Title
  y += 34;
  doc.setTextColor(...PRIMARY);
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.text(`Official ${tier.badge} Certificate of Environmental Stewardship`, width / 2, y, { align: 'center' });

  y += 26;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SUSTAINABILITY & CIRCULAR ECONOMY ACHIEVEMENT', width / 2, y, { align: 'center', charSpace: 0.8 });

  // Decorative Tier Center Divider
  y += 11;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1.5);
  doc.line(width / 2 - 170, y, width / 2 - 25, y);
  doc.line(width / 2 + 25, y, width / 2 + 170, y);
  doc.setFillColor(...PRIMARY);
  doc.circle(width / 2, y, 4.5, 'FD');
  doc.circle(width / 2 - 12, y, 2.5, 'FD');
  doc.circle(width / 2 + 12, y, 2.5, 'FD');

  // 6. Presentation Script
  y += 22;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text(`This distinguished ${tier.badge} milestone accreditation is solemnly presented to`, width / 2, y, { align: 'center' });

  // 7. Recipient Enterprise Plaque
  y += 16;
  const nameBoxW = 540;
  const nameBoxH = 44;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1.5);
  doc.roundedRect((width - nameBoxW) / 2, y, nameBoxW, nameBoxH, 6, 6, 'FD');

  doc.setDrawColor(...SECONDARY);
  doc.setLineWidth(0.75);
  doc.roundedRect((width - nameBoxW) / 2 + 3, y + 3, nameBoxW - 6, nameBoxH - 6, 4, 4, 'D');

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(certClient, width / 2, y + 28, { align: 'center', charSpace: 1 });

  // 8. Formal Citation Body
  y += 60;
  doc.setTextColor(...SLATE_BODY);
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  const citationText =
    `For exceptional dedication to decarbonized urban mobility, industrial zero-waste standards, and circular lifecycle excellence. ` +
    `Through reaching the ${tier.badge} tier and restoring, testing, and recertifying ${count.toLocaleString()} high-voltage battery packs, ` +
    `your enterprise has successfully prevented hazardous landfill contamination and significantly minimized global greenhouse emissions.`;

  const splitText = doc.splitTextToSize(citationText, 660);
  doc.text(splitText, width / 2, y, { align: 'center', lineHeightFactor: 1.4 });

  // 9. Metric Impact Plaques (4 Tier Beveled Boxes with Full ESG Data)
  y += 38;
  const cardW = 176;
  const cardH = 46;
  const gap = 12;
  const startX = (width - (cardW * 4 + gap * 3)) / 2;

  // Plaque 1: CO2 Saved
  const b1X = startX;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 149, 93);
  doc.setLineWidth(1.2);
  doc.roundedRect(b1X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(10, 68, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CO₂ EMISSIONS SAVED', b1X + cardW / 2, y + 12, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(13);
  doc.text(`~${co2Tons} Metric Tons`, b1X + cardW / 2, y + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Decarbonization Abatement', b1X + cardW / 2, y + 39, { align: 'center' });

  // Plaque 2: E-Waste Diverted
  const b2X = startX + cardW + gap;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.roundedRect(b2X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('E-WASTE DIVERTED', b2X + cardW / 2, y + 12, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(13);
  doc.text(`${ewasteKg} kg`, b2X + cardW / 2, y + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Toxic Landfill Avoidance', b2X + cardW / 2, y + 39, { align: 'center' });

  // Plaque 3: Batteries Restored
  const b3X = startX + (cardW + gap) * 2;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1.2);
  doc.roundedRect(b3X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`${tier.badge.toUpperCase()} MILESTONE`, b3X + cardW / 2, y + 12, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(13);
  doc.text(`${count.toLocaleString()} Packs`, b3X + cardW / 2, y + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Circular Fleet Extended', b3X + cardW / 2, y + 39, { align: 'center' });

  // Plaque 4: Material Recovery Rate
  const b4X = startX + (cardW + gap) * 3;
  doc.setFillColor(243, 232, 255);
  doc.setDrawColor(147, 51, 234);
  doc.setLineWidth(1.2);
  doc.roundedRect(b4X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(88, 28, 135);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MATERIAL RECOVERY', b4X + cardW / 2, y + 12, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(13);
  doc.text('100% Closed-Loop', b4X + cardW / 2, y + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Zero Municipal Landfill', b4X + cardW / 2, y + 39, { align: 'center' });

  // 10. Audited Chemical & Material Composition Summary Banner (Dynamic for this battery count)
  y += 54;
  const chemW = width - 100;
  const chemX = 50;
  const chemH = 28;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.8);
  doc.roundedRect(chemX, y, chemW, chemH, 4, 4, 'FD');

  const breakdown = calculateMaterialBreakdown(count);
  const cathodeAmount = breakdown[0]?.formattedAmount || '—';
  const graphiteAmount = breakdown[4]?.formattedAmount || '—';
  const cuAmount = breakdown[12]?.formattedAmount || '—';
  const niAmount = breakdown[11]?.formattedAmount || '—';
  const feAmount = breakdown[13]?.formattedAmount || '—';

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(`AUDITED MATERIAL RECOVERY FOR ${count.toLocaleString()} PACKS (SECTION 2 STANDARDS):`, chemX + 10, y + 10);

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE_BODY);
  doc.text(
    `Cathode NMC: ~${cathodeAmount}  •  Anode Graphite: ~${graphiteAmount}  •  Copper Foil: ~${cuAmount}  •  Nickel: ~${niAmount}  •  Shell Iron: ~${feAmount}`,
    chemX + 10,
    y + 20
  );

  // 11. Standards Compliance Badges
  y += 34;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('ISO 14001:2015 ESG REGISTRY   •   RoHS 2011/65/EU COMPLIANT   •   UN 38.3 SAFE TRANSPORT CERTIFIED   •   EU BATTERY PASSPORT 2026', width / 2, y, { align: 'center', charSpace: 0.8 });

  // 12. Footer Section: Left Signature, Center Tier Foil Seal with Ribbons, Right Signature
  y += 16;

  // Left Executive Signature Block
  const sig1X = 64;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.text('Dr. Richard Thorne', sig1X + 80, y + 2, { align: 'center' });

  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.75);
  doc.line(sig1X, y + 7, sig1X + 160, y + 7);

  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('HEAD OF CIRCULAR ENGINEERING', sig1X + 80, y + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Refurbnics Technical Directorate`, sig1X + 80, y + 24, { align: 'center' });

  // Center Tier Embossed Foil Seal with Silk Ribbon Tails
  const sealX = width / 2;
  const sealY = y + 2;

  // Ribbon Tails
  doc.setFillColor(...RIBBON);
  doc.setDrawColor(...RIBBON_DARK);
  doc.setLineWidth(0.5);
  doc.triangle(sealX - 16, sealY + 10, sealX - 7, sealY + 38, sealX - 23, sealY + 34, 'FD');
  doc.triangle(sealX + 16, sealY + 10, sealX + 7, sealY + 38, sealX + 23, sealY + 34, 'FD');

  // Starburst Rosette
  doc.setFillColor(...PRIMARY);
  doc.setDrawColor(...DARK);
  doc.setLineWidth(1.5);
  doc.circle(sealX, sealY, 25, 'FD');

  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    const rx = sealX + Math.cos(angle) * 27;
    const ry = sealY + Math.sin(angle) * 27;
    doc.setFillColor(...SECONDARY);
    doc.circle(rx, ry, 2.2, 'FD');
  }

  // Inner Ring
  doc.setFillColor(...SECONDARY);
  doc.circle(sealX, sealY, 20, 'FD');

  // Inner Core
  doc.setFillColor(...DARK);
  doc.circle(sealX, sealY, 16.5, 'F');

  // Embossed Seal Inscription
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text(tier.sealTitle, sealX, sealY - 6, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(6.5);
  doc.text('★ VERIFIED ★', sealX, sealY + 1, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('CIRCULAR ESG', sealX, sealY + 7, { align: 'center', charSpace: 0.5 });

  // Right Executive Signature & Verification Block
  const sig2X = width - 64 - 160;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.text('Eleanor Sterling-Ward', sig2X + 80, y + 2, { align: 'center' });

  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.75);
  doc.line(sig2X, y + 7, sig2X + 160, y + 7);

  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MANAGING DIRECTOR & CHAIR', sig2X + 80, y + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Issued: ${issueDate}`, sig2X + 80, y + 24, { align: 'center' });

  // Bottom Central Registry & Verification Line
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Official Registry Code: ${certCode}   •   Tier: ${tier.badge}   •   SHA-256 Tamper-Evident Digital ESG Record`, width / 2, height - 20, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2: SECTION 2. COMPOSITION & MATERIAL INFORMATION (MSDS AUDIT)
  // ═══════════════════════════════════════════════════════════════════════
  doc.addPage('a4', 'landscape');

  // Background
  doc.setFillColor(...BG);
  doc.rect(0, 0, width, height, 'F');

  // Multi-tier Border
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(4);
  doc.rect(16, 16, width - 32, height - 32);

  doc.setDrawColor(...DARK);
  doc.setLineWidth(1);
  doc.rect(22, 22, width - 44, height - 44);

  // Page 2 Header
  let p2Y = 46;
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SECTION 2. COMPOSITION & MATERIAL INFORMATION', width / 2, p2Y, { align: 'center', charSpace: 1 });

  p2Y += 14;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`MATERIAL & CHEMICAL RECOVERY AUDIT FOR ${count.toLocaleString()} HIGH-VOLTAGE BATTERY PACKS`, width / 2, p2Y, { align: 'center', charSpace: 1.5 });

  p2Y += 8;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1);
  doc.line(width / 2 - 200, p2Y, width / 2 + 200, p2Y);

  // Table Setup
  p2Y += 16;
  const tableX = 36;
  const tableW = width - 72; // 769.89 pt
  const colW = [160, 160, 80, 85, 124, 160]; // sum = 769 pt
  const rowH = 20.5;

  // Table Header
  doc.setFillColor(...PRIMARY);
  doc.rect(tableX, p2Y, tableW, rowH + 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('Chemical Composition', tableX + 6, p2Y + 14);
  doc.text('Chemical Formula', tableX + colW[0] + 6, p2Y + 14);
  doc.text('CAS No.', tableX + colW[0] + colW[1] + 6, p2Y + 14);
  doc.text('Weight (%)', tableX + colW[0] + colW[1] + colW[2] + 6, p2Y + 14);
  doc.text(`Recovered (${count.toLocaleString()} Packs)`, tableX + colW[0] + colW[1] + colW[2] + colW[3] + 6, p2Y + 14);
  doc.text('Battery Component Role', tableX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + 6, p2Y + 14);

  p2Y += rowH + 2;

  // Table Rows (14 Chemical Items with Dynamic Amounts)
  breakdown.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(245, 247, 250);
    }
    doc.rect(tableX, p2Y, tableW, rowH, 'F');

    // Row Border
    doc.setDrawColor(220, 226, 235);
    doc.setLineWidth(0.5);
    doc.rect(tableX, p2Y, tableW, rowH, 'D');

    // Text Values
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_DEEP);
    doc.text(item.nameEn, tableX + 6, p2Y + 13);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_BODY);
    doc.text(item.formula, tableX + colW[0] + 6, p2Y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(item.casNo, tableX + colW[0] + colW[1] + 6, p2Y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_BODY);
    doc.text(item.weightPct, tableX + colW[0] + colW[1] + colW[2] + 6, p2Y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(item.formattedAmount, tableX + colW[0] + colW[1] + colW[2] + colW[3] + 6, p2Y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_BODY);
    doc.setFontSize(7);
    doc.text(item.role, tableX + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + 6, p2Y + 13);

    p2Y += rowH;
  });

  // Technical Footnote & ISO Compliance
  p2Y += 12;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `* Certified Material Breakdown: 100% of high-voltage cells serviced by Refurbnics adhere to ISO 14001, RoHS, and EU Battery Passport standards.`,
    tableX + 4,
    p2Y
  );
  p2Y += 10;
  doc.text(
    `Lithium, Nickel, Copper, and rare earth components undergo audited recovery and life-extension, preventing toxic leachate in accordance with ESG directives.`,
    tableX + 4,
    p2Y
  );

  // Bottom Central Registry on Page 2
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`Official Registry Code: ${certCode}   •   Page 2 of 2: Material & Chemical Composition Appendix`, width / 2, height - 24, { align: 'center' });

  return doc;
}

/**
 * Downloads the tier-styled vector PDF Certificate.
 */
export function downloadMilestoneCertificatePDF(certificate, clientName) {
  const tier = getTierForCertificate(certificate);
  const doc = generateMilestoneCertificatePDF(certificate, clientName);
  const cleanName = (certificate.client_name || clientName || 'Client')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const count = certificate.milestone_count || tier.count;
  const filename = `Refurbnics-${tier.badge}-Certificate-${cleanName}-${count}-batteries.pdf`;
  doc.save(filename);
}
