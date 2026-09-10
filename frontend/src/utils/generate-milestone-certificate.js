import jsPDF from 'jspdf';

/**
 * Generates an official, prestigious classic vector PDF Certificate of Sustainability & Circular Economy.
 * Uses Landscape A4 (841.89 pt x 595.28 pt) with classic gold-and-emerald ornamental borders,
 * distinguished typography, stat plaques, official verification seal, and signature block.
 */
export function generateMilestoneCertificatePDF(certificate, clientName) {
  // Landscape A4: 842 x 595 pt
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth(); // ~841.89
  const height = doc.internal.pageSize.getHeight(); // ~595.28

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

  // Palette
  const GOLD = [197, 148, 59];
  const DARK_GOLD = [148, 107, 34];
  const EMERALD_DARK = [15, 81, 50];
  const EMERALD = [16, 149, 93];
  const SLATE_DARK = [24, 30, 42];
  const SLATE_MUTED = [80, 93, 111];
  const BG_CREAM = [253, 252, 248];

  // 1. Full Background
  doc.setFillColor(...BG_CREAM);
  doc.rect(0, 0, width, height, 'F');

  // 2. Outer Ornamental Border
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(4);
  doc.rect(20, 20, width - 40, height - 40);

  // Inner Thin Border
  doc.setDrawColor(...DARK_GOLD);
  doc.setLineWidth(1);
  doc.rect(26, 26, width - 52, height - 52);

  // Inner Emerald Fine Line
  doc.setDrawColor(...EMERALD_DARK);
  doc.setLineWidth(0.75);
  doc.rect(32, 32, width - 64, height - 64);

  // 3. Corner Ornaments (Classic Geometric Flourishes)
  const drawCorner = (x, y, dx, dy) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(2);
    doc.line(x, y, x + dx * 28, y);
    doc.line(x, y, x, y + dy * 28);
    doc.setFillColor(...GOLD);
    doc.circle(x + dx * 8, y + dy * 8, 3.5, 'FD');
  };
  drawCorner(38, 38, 1, 1);
  drawCorner(width - 38, 38, -1, 1);
  drawCorner(38, height - 38, 1, -1);
  drawCorner(width - 38, height - 38, -1, -1);

  // 4. Header & Organization Title
  let y = 68;
  doc.setTextColor(...EMERALD_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REFURBNICS CIRCULAR LOGISTICS & BATTERY ENGINEERING', width / 2, y, { align: 'center' });

  y += 14;
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('— OFFICIAL GLOBAL SUSTAINABILITY ACCREDITATION —', width / 2, y, { align: 'center' });

  // 5. Main Certificate Title
  y += 38;
  doc.setTextColor(...DARK_GOLD);
  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.text('Certificate of Environmental Stewardship', width / 2, y, { align: 'center' });

  y += 26;
  doc.setTextColor(...SLATE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SUSTAINABILITY & CIRCULAR ECONOMY MILESTONE', width / 2, y, { align: 'center' });

  // Decorative Divider Line
  y += 12;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(width / 2 - 140, y, width / 2 + 140, y);
  doc.setFillColor(...GOLD);
  doc.circle(width / 2, y, 4, 'FD');

  // 6. Presentation Text
  y += 24;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text('This distinguished recognition is officially presented to', width / 2, y, { align: 'center' });

  // 7. Client Recipient Box & Name
  y += 18;
  const nameBoxWidth = 520;
  const nameBoxHeight = 44;
  doc.setFillColor(245, 248, 244);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.roundedRect((width - nameBoxWidth) / 2, y, nameBoxWidth, nameBoxHeight, 6, 6, 'FD');

  doc.setTextColor(...EMERALD_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(certClient, width / 2, y + 28, { align: 'center' });

  // 8. Citation Body
  y += 62;
  doc.setTextColor(...SLATE_DARK);
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  const citationText =
    `In recognition of outstanding leadership in zero-emission mobility and sustainable lifecycle management. ` +
    `Through partnering with Refurbnics to repair and circularize ${count.toLocaleString()} high-voltage lithium-ion battery packs, ` +
    `your organization has successfully preserved critical raw materials and prevented substantial industrial carbon emissions.`;

  const splitText = doc.splitTextToSize(citationText, 640);
  doc.text(splitText, width / 2, y, { align: 'center', lineHeightFactor: 1.4 });

  // 9. Eco Metric Impact Badges (3 Stat Boxes)
  y += 44;
  const cardW = 180;
  const cardH = 54;
  const gap = 24;
  const startX = (width - (cardW * 3 + gap * 2)) / 2;

  // Metric 1: CO2 Saved
  const box1X = startX;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(1);
  doc.roundedRect(box1X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(...EMERALD_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CO₂ EMISSIONS SAVED', box1X + cardW / 2, y + 15, { align: 'center' });
  doc.setFontSize(15);
  doc.text(`~${co2Tons} Metric Tons`, box1X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Decarbonization Impact', box1X + cardW / 2, y + 46, { align: 'center' });

  // Metric 2: E-Waste Diverted
  const box2X = startX + cardW + gap;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.roundedRect(box2X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('E-WASTE DIVERTED', box2X + cardW / 2, y + 15, { align: 'center' });
  doc.setFontSize(15);
  doc.text(`${ewasteKg} kg`, box2X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Landfill Toxic Avoidance', box2X + cardW / 2, y + 46, { align: 'center' });

  // Metric 3: Batteries Restored
  const box3X = startX + (cardW + gap) * 2;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(...DARK_GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(box3X, y, cardW, cardH, 5, 5, 'FD');

  doc.setTextColor(...DARK_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BATTERIES RESTORED', box3X + cardW / 2, y + 15, { align: 'center' });
  doc.setFontSize(15);
  doc.text(`${count.toLocaleString()} Units`, box3X + cardW / 2, y + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Circular Fleet Mileage', box3X + cardW / 2, y + 46, { align: 'center' });

  // 10. Footer Section with Seal, Certificate ID and Official Signature
  y += 72;

  // Left Column: Certificate ID & Date
  const leftX = 64;
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CERTIFICATE IDENTIFIER', leftX, y);
  doc.setTextColor(...SLATE_DARK);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text(certCode, leftX, y + 13);
  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Date of Issue: ${issueDate}`, leftX, y + 25);

  // Center: Official Gold Seal Badge
  const sealCenterX = width / 2;
  const sealCenterY = y + 10;
  doc.setFillColor(...GOLD);
  doc.setDrawColor(...DARK_GOLD);
  doc.setLineWidth(2);
  doc.circle(sealCenterX, sealCenterY, 26, 'FD');

  doc.setFillColor(...EMERALD_DARK);
  doc.circle(sealCenterX, sealCenterY, 21, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('OFFICIAL SEAL', sealCenterX, sealCenterY - 6, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('VERIFIED', sealCenterX, sealCenterY + 3, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('CIRCULAR ESG', sealCenterX, sealCenterY + 11, { align: 'center' });

  // Right Column: Official Signature
  const rightX = width - 64;
  doc.setTextColor(...SLATE_DARK);
  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.text('Refurbnics Operations & Engineering', rightX, y + 6, { align: 'right' });

  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.75);
  doc.line(rightX - 210, y + 12, rightX, y + 12);

  doc.setTextColor(...SLATE_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('AUTHORIZED SUSTAINABILITY SIGNATORY', rightX, y + 23, { align: 'right' });

  return doc;
}

/**
 * Directly downloads the certificate PDF with a clean formatted filename.
 */
export function downloadMilestoneCertificatePDF(certificate, clientName) {
  const doc = generateMilestoneCertificatePDF(certificate, clientName);
  const cleanName = (certificate.client_name || clientName || 'Client')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const count = certificate.milestone_count || 'milestone';
  const filename = `Refurbnics-Sustainability-Certificate-${cleanName}-${count}-batteries.pdf`;
  doc.save(filename);
}
