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

  // 9. Metric Impact Plaques (3 Tier Beveled Boxes)
  y += 44;
  const cardW = 186;
  const cardH = 55;
  const gap = 20;
  const startX = (width - (cardW * 3 + gap * 2)) / 2;

  // Plaque 1: CO2 Saved
  const b1X = startX;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 149, 93);
  doc.setLineWidth(1.25);
  doc.roundedRect(b1X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(10, 68, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CO₂ EMISSIONS SAVED', b1X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`~${co2Tons} Metric Tons`, b1X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Decarbonization Equivalent', b1X + cardW / 2, y + 47, { align: 'center' });

  // Plaque 2: E-Waste Diverted
  const b2X = startX + cardW + gap;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.25);
  doc.roundedRect(b2X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('E-WASTE DIVERTED', b2X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`${ewasteKg} kg`, b2X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Landfill Toxic Avoidance', b2X + cardW / 2, y + 47, { align: 'center' });

  // Plaque 3: Batteries Restored
  const b3X = startX + (cardW + gap) * 2;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1.25);
  doc.roundedRect(b3X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${tier.badge.toUpperCase()} MILESTONE`, b3X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`${count.toLocaleString()} Units`, b3X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Circular Fleet Mileage', b3X + cardW / 2, y + 47, { align: 'center' });

  // 10. Footer Section: Left Signature, Center Tier Foil Seal with Ribbons, Right Signature
  y += 74;

  // Left Executive Signature Block
  const sig1X = 64;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.text('Dr. Richard Thorne', sig1X + 80, y + 2, { align: 'center' });

  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.75);
  doc.line(sig1X, y + 8, sig1X + 160, y + 8);

  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('HEAD OF CIRCULAR ENGINEERING', sig1X + 80, y + 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Refurbnics Technical Directorate`, sig1X + 80, y + 27, { align: 'center' });

  // Center Tier Embossed Foil Seal with Silk Ribbon Tails
  const sealX = width / 2;
  const sealY = y + 4;

  // Ribbon Tails
  doc.setFillColor(...RIBBON);
  doc.setDrawColor(...RIBBON_DARK);
  doc.setLineWidth(0.5);
  doc.triangle(sealX - 18, sealY + 12, sealX - 8, sealY + 44, sealX - 26, sealY + 40, 'FD');
  doc.triangle(sealX + 18, sealY + 12, sealX + 8, sealY + 44, sealX + 26, sealY + 40, 'FD');

  // Starburst Rosette
  doc.setFillColor(...PRIMARY);
  doc.setDrawColor(...DARK);
  doc.setLineWidth(1.5);
  doc.circle(sealX, sealY, 28, 'FD');

  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    const rx = sealX + Math.cos(angle) * 30;
    const ry = sealY + Math.sin(angle) * 30;
    doc.setFillColor(...SECONDARY);
    doc.circle(rx, ry, 2.5, 'FD');
  }

  // Inner Ring
  doc.setFillColor(...SECONDARY);
  doc.circle(sealX, sealY, 23, 'FD');

  // Inner Core
  doc.setFillColor(...DARK);
  doc.circle(sealX, sealY, 19, 'F');

  // Embossed Seal Inscription
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text(tier.sealTitle, sealX, sealY - 7, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(7.5);
  doc.text('★ VERIFIED ★', sealX, sealY + 1, { align: 'center' });
  doc.setFontSize(5);
  doc.text('CIRCULAR ESG', sealX, sealY + 8, { align: 'center', charSpace: 0.5 });

  // Right Executive Signature & Verification Block
  const sig2X = width - 64 - 160;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.text('Eleanor Sterling-Ward', sig2X + 80, y + 2, { align: 'center' });

  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.75);
  doc.line(sig2X, y + 8, sig2X + 160, y + 8);

  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MANAGING DIRECTOR & CHAIR', sig2X + 80, y + 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Issued: ${issueDate}`, sig2X + 80, y + 27, { align: 'center' });

  // Bottom Central Registry & Verification Line
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`Official Registry Code: ${certCode}   •   Tier: ${tier.badge}   •   Tamper-Evident Digital ESG Record`, width / 2, height - 24, { align: 'center' });

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
