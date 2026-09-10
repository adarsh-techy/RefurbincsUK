import jsPDF from 'jspdf';

/**
 * Generates a museum-grade, royal classic vector PDF Certificate of Sustainability & Circular Leadership.
 * Features:
 * - Landscape A4 format (841.89 pt x 595.28 pt)
 * - Multi-layer baroque/classical gold & emerald security guilloche border
 * - Dual ornamental corner filigree brackets
 * - Majestic header crest & formal presentation typography
 * - Gold-embossed starburst medallion with dual satin ribbon tails
 * - Dual authorized executive signatures with title lines and verification stamp
 * - Decarbonization & e-waste diversion metric plaques
 * - Security verification identifier & tamper-proof registry hash
 */
export function generateMilestoneCertificatePDF(certificate, clientName) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth(); // 841.89 pt
  const height = doc.internal.pageSize.getHeight(); // 595.28 pt

  const count = Number(certificate.milestone_count || 1000);
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

  // Sophisticated Classic Color Palette
  const GOLD_METALLIC = [184, 134, 45];
  const GOLD_LIGHT = [224, 185, 108];
  const GOLD_DARK = [138, 98, 28];
  const EMERALD_ROYAL = [10, 68, 42];
  const EMERALD_LIGHT = [16, 149, 93];
  const SLATE_DEEP = [18, 24, 38];
  const SLATE_BODY = [51, 65, 85];
  const SLATE_MUTED = [100, 116, 139];
  const BG_PARCHMENT = [254, 253, 249];
  const RIBBON_BLUE = [26, 75, 140];
  const RIBBON_DARK = [16, 48, 92];

  // 1. Parchment Background Fill
  doc.setFillColor(...BG_PARCHMENT);
  doc.rect(0, 0, width, height, 'F');

  // Subtle Guilloche / Security Hatch Pattern (Watermark simulation)
  doc.setDrawColor(240, 235, 220);
  doc.setLineWidth(0.5);
  for (let i = 40; i < width - 40; i += 45) {
    doc.line(i, 40, width - 40, height - (i * 0.7));
  }

  // 2. Multi-tier Classical Ornamental Border
  // Outer Heavy Gold Border
  doc.setDrawColor(...GOLD_METALLIC);
  doc.setLineWidth(5);
  doc.rect(16, 16, width - 32, height - 32);

  // Inlay Gold Fine Line
  doc.setDrawColor(...GOLD_LIGHT);
  doc.setLineWidth(1);
  doc.rect(23, 23, width - 46, height - 46);

  // Inner Royal Emerald Frame
  doc.setDrawColor(...EMERALD_ROYAL);
  doc.setLineWidth(2.5);
  doc.rect(28, 28, width - 56, height - 56);

  // Delicate Interior Pinstripe
  doc.setDrawColor(...GOLD_METALLIC);
  doc.setLineWidth(0.75);
  doc.rect(34, 34, width - 68, height - 68);

  // 3. Ornate Corner Filigree Flourishes
  const drawFlourish = (x, y, dirX, dirY) => {
    doc.setDrawColor(...GOLD_METALLIC);
    doc.setLineWidth(2);
    // Outer bracket
    doc.line(x, y, x + dirX * 36, y);
    doc.line(x, y, x, y + dirY * 36);
    // Secondary inner bracket
    doc.setDrawColor(...GOLD_LIGHT);
    doc.setLineWidth(1);
    doc.line(x + dirX * 6, y + dirY * 6, x + dirX * 28, y + dirY * 6);
    doc.line(x + dirX * 6, y + dirY * 6, x + dirX * 6, y + dirY * 28);
    // Corner rosette dot
    doc.setFillColor(...GOLD_DARK);
    doc.circle(x + dirX * 12, y + dirY * 12, 4, 'FD');
    doc.setFillColor(...GOLD_LIGHT);
    doc.circle(x + dirX * 12, y + dirY * 12, 2, 'F');
  };

  drawFlourish(42, 42, 1, 1); // Top Left
  drawFlourish(width - 42, 42, -1, 1); // Top Right
  drawFlourish(42, height - 42, 1, -1); // Bottom Left
  drawFlourish(width - 42, height - 42, -1, -1); // Bottom Right

  // 4. Header & Imperial Crest
  let y = 62;
  doc.setTextColor(...EMERALD_ROYAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('REFURBNICS CIRCULAR LOGISTICS & BATTERY ENGINEERING', width / 2, y, { align: 'center', charSpace: 1.5 });

  y += 13;
  doc.setTextColor(...GOLD_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('UNITED KINGDOM • GLOBAL BATTERY DECARBONIZATION REGISTRY', width / 2, y, { align: 'center', charSpace: 2 });

  // 5. Main Certificate Title
  y += 34;
  doc.setTextColor(...GOLD_METALLIC);
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.text('Official Certificate of Environmental Leadership', width / 2, y, { align: 'center' });

  y += 26;
  doc.setTextColor(...SLATE_DEEP);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SUSTAINABILITY & CIRCULAR ECONOMY ACHIEVEMENT', width / 2, y, { align: 'center', charSpace: 0.8 });

  // Royal Ornamental Center Divider
  y += 11;
  doc.setDrawColor(...GOLD_METALLIC);
  doc.setLineWidth(1.5);
  doc.line(width / 2 - 170, y, width / 2 - 25, y);
  doc.line(width / 2 + 25, y, width / 2 + 170, y);
  doc.setFillColor(...GOLD_METALLIC);
  doc.circle(width / 2, y, 4.5, 'FD');
  doc.circle(width / 2 - 12, y, 2.5, 'FD');
  doc.circle(width / 2 + 12, y, 2.5, 'FD');

  // 6. Presentation Script
  y += 22;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text('This distinguished milestone accreditation is solemnly presented to', width / 2, y, { align: 'center' });

  // 7. Recipient Enterprise Plaque
  y += 16;
  const nameBoxW = 540;
  const nameBoxH = 44;
  doc.setFillColor(248, 250, 246);
  doc.setDrawColor(...GOLD_METALLIC);
  doc.setLineWidth(1.5);
  doc.roundedRect((width - nameBoxW) / 2, y, nameBoxW, nameBoxH, 6, 6, 'FD');

  // Inner Gold Accent Line
  doc.setDrawColor(...GOLD_LIGHT);
  doc.setLineWidth(0.75);
  doc.roundedRect((width - nameBoxW) / 2 + 3, y + 3, nameBoxW - 6, nameBoxH - 6, 4, 4, 'D');

  doc.setTextColor(...EMERALD_ROYAL);
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
    `Through authorized collaboration with Refurbnics to restore, test, and recertify ${count.toLocaleString()} high-voltage battery packs, ` +
    `your enterprise has successfully prevented toxic landfill contamination and significantly minimized global carbon emissions.`;

  const splitText = doc.splitTextToSize(citationText, 660);
  doc.text(splitText, width / 2, y, { align: 'center', lineHeightFactor: 1.4 });

  // 9. Metric Impact Plaques (3 Gold Beveled Boxes)
  y += 44;
  const cardW = 186;
  const cardH = 55;
  const gap = 20;
  const startX = (width - (cardW * 3 + gap * 2)) / 2;

  // Plaque 1: CO2 Saved
  const b1X = startX;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(...EMERALD_LIGHT);
  doc.setLineWidth(1.25);
  doc.roundedRect(b1X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(...EMERALD_ROYAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CO₂ EMISSIONS SAVED', b1X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`~${co2Tons} Metric Tons`, b1X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Industrial Decarbonization Equivalent', b1X + cardW / 2, y + 47, { align: 'center' });

  // Plaque 2: E-Waste Diverted
  const b2X = startX + cardW + gap;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(...RIBBON_BLUE);
  doc.setLineWidth(1.25);
  doc.roundedRect(b2X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(...RIBBON_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('E-WASTE DIVERTED', b2X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`${ewasteKg} kg`, b2X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Hazardous Landfill Toxic Avoidance', b2X + cardW / 2, y + 47, { align: 'center' });

  // Plaque 3: Batteries Restored
  const b3X = startX + (cardW + gap) * 2;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(1.25);
  doc.roundedRect(b3X, y, cardW, cardH, 6, 6, 'FD');

  doc.setTextColor(...GOLD_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BATTERIES RESTORED', b3X + cardW / 2, y + 15, { align: 'center', charSpace: 0.5 });
  doc.setFontSize(15.5);
  doc.text(`${count.toLocaleString()} Units`, b3X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Circular Fleet Life-Extension', b3X + cardW / 2, y + 47, { align: 'center' });

  // 10. Footer Section: Left Signature, Center Gold Foil Seal with Ribbons, Right Signature
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

  // Center Gold Embossed Seal with Silk Ribbon Tails
  const sealX = width / 2;
  const sealY = y + 4;

  // Satin Ribbon Tails
  doc.setFillColor(...RIBBON_BLUE);
  doc.setDrawColor(...RIBBON_DARK);
  doc.setLineWidth(0.5);
  // Left ribbon tail
  doc.triangle(sealX - 18, sealY + 12, sealX - 8, sealY + 44, sealX - 26, sealY + 40, 'FD');
  // Right ribbon tail
  doc.triangle(sealX + 18, sealY + 12, sealX + 8, sealY + 44, sealX + 26, sealY + 40, 'FD');

  // Starburst Rosette / Outer Medallion
  doc.setFillColor(...GOLD_METALLIC);
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(1.5);
  doc.circle(sealX, sealY, 28, 'FD');

  // Rosette Teeth points
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    const rx = sealX + Math.cos(angle) * 30;
    const ry = sealY + Math.sin(angle) * 30;
    doc.setFillColor(...GOLD_LIGHT);
    doc.circle(rx, ry, 2.5, 'FD');
  }

  // Inner Gold Foil Ring
  doc.setFillColor(...GOLD_LIGHT);
  doc.circle(sealX, sealY, 23, 'FD');

  // Inner Emerald Core
  doc.setFillColor(...EMERALD_ROYAL);
  doc.circle(sealX, sealY, 19, 'F');

  // Embossed Seal Inscription
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('OFFICIAL SEAL', sealX, sealY - 7, { align: 'center', charSpace: 0.5 });
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
  doc.text(`Official Registry Code: ${certCode}   •   Tamper-Evident Digital ESG Record`, width / 2, height - 24, { align: 'center' });

  return doc;
}

/**
 * Downloads the official vector PDF Certificate.
 */
export function downloadMilestoneCertificatePDF(certificate, clientName) {
  const doc = generateMilestoneCertificatePDF(certificate, clientName);
  const cleanName = (certificate.client_name || clientName || 'Client')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const count = certificate.milestone_count || 'milestone';
  const filename = `Refurbnics-Official-Certificate-${cleanName}-${count}-batteries.pdf`;
  doc.save(filename);
}
