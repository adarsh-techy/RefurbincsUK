import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

// Loaded on first use, not at app start: keeps startup light and keeps a
// problem in a print / export library from affecting launch (e.g. in Expo Go).
const loadPrint = () => require('expo-print');

// Milestone certificate PDF — the mobile twin of the web
// utils/generate-milestone-certificate.js (jsPDF). Same two A4-landscape
// pages, drawn as HTML/SVG at the same point coordinates and turned into a
// PDF by expo-print:
//   page 1  tier-themed certificate: borders, corner flourishes, title,
//           client plaque, citation, CEO signature block, foil seal, registry
//   page 2  "Section 2" material & chemical recovery table for the packs

export const TIER_CONFIGS = {
  Bronze: { badge: 'Bronze', count: 100, primaryRgb: [180, 105, 40], secondaryRgb: [220, 155, 95], darkRgb: [120, 65, 20], bgRgb: [254, 251, 246], ribbonRgb: [160, 82, 45], ribbonDarkRgb: [100, 45, 15], sealTitle: 'BRONZE SEAL' },
  Silver: { badge: 'Silver', count: 500, primaryRgb: [100, 116, 139], secondaryRgb: [180, 195, 210], darkRgb: [51, 65, 85], bgRgb: [248, 250, 252], ribbonRgb: [71, 85, 105], ribbonDarkRgb: [30, 41, 59], sealTitle: 'SILVER SEAL' },
  Gold: { badge: 'Gold', count: 1000, primaryRgb: [184, 134, 45], secondaryRgb: [224, 185, 108], darkRgb: [138, 98, 28], bgRgb: [254, 253, 249], ribbonRgb: [26, 75, 140], ribbonDarkRgb: [16, 48, 92], sealTitle: 'GOLD SEAL' },
  Platinum: { badge: 'Platinum', count: 5000, primaryRgb: [99, 102, 241], secondaryRgb: [165, 180, 252], darkRgb: [67, 56, 202], bgRgb: [250, 250, 255], ribbonRgb: [79, 70, 229], ribbonDarkRgb: [49, 46, 129], sealTitle: 'PLATINUM' },
  Diamond: { badge: 'Diamond', count: 10000, primaryRgb: [6, 182, 212], secondaryRgb: [103, 232, 249], darkRgb: [14, 116, 144], bgRgb: [246, 254, 254], ribbonRgb: [8, 145, 178], ribbonDarkRgb: [8, 51, 68], sealTitle: 'DIAMOND' },
  Emerald: { badge: 'Emerald', count: 20000, primaryRgb: [5, 150, 105], secondaryRgb: [110, 231, 183], darkRgb: [6, 78, 59], bgRgb: [244, 253, 248], ribbonRgb: [4, 120, 87], ribbonDarkRgb: [2, 44, 34], sealTitle: 'EMERALD' },
};

const BATTERY_COMPOSITION_DATA = [
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

// A4 landscape in points — the same page jsPDF uses on the web
const W = 841.89;
const H = 595.28;

// Hermes-safe formatting (no reliance on Intl locale data)
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function materialBreakdown(batteryCount) {
  const count = Number(batteryCount) || 100;
  return BATTERY_COMPOSITION_DATA.map((item) => {
    const totalKg = item.unitKg * count;
    let formattedAmount;
    if (totalKg >= 1000) formattedAmount = `${(totalKg / 1000).toFixed(2)} Tons`;
    else if (totalKg >= 10) {
      const [int, dec] = totalKg.toFixed(1).split('.');
      formattedAmount = `${thousands(int)}.${dec} kg`;
    } else formattedAmount = `${totalKg.toFixed(2)} kg`;
    return { ...item, formattedAmount };
  });
}

// jsPDF places text by its baseline; an absolutely positioned line box of
// `size` height has its baseline ~0.8 of the way down.
function text(y, size, content, { font = 'sans', bold = false, italic = false, color = [0, 0, 0], spacing = 0, x = null, align = 'center', width = null } = {}) {
  const family = font === 'serif' ? "'Times New Roman', Times, serif" : font === 'mono' ? "'Courier New', Courier, monospace" : 'Helvetica, Arial, sans-serif';
  const top = y - size * 0.8;
  const pos = x == null
    ? `left:0;width:${W}pt;text-align:center;`
    : align === 'center'
      ? `left:${x - (width || 300) / 2}pt;width:${width || 300}pt;text-align:center;`
      : `left:${x}pt;${width ? `width:${width}pt;` : ''}text-align:left;`;
  return `<div style="position:absolute;top:${top}pt;${pos}font-family:${family};font-size:${size}pt;line-height:${size}pt;${bold ? 'font-weight:bold;' : ''}${italic ? 'font-style:italic;' : ''}color:${rgb(color)};letter-spacing:${spacing}pt;white-space:nowrap;">${content}</div>`;
}

function flourish(x, y, dx, dy, t) {
  const P = rgb(t.primaryRgb); const S = rgb(t.secondaryRgb); const D = rgb(t.darkRgb);
  return `
    <line x1="${x}" y1="${y}" x2="${x + dx * 36}" y2="${y}" stroke="${P}" stroke-width="2"/>
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y + dy * 36}" stroke="${P}" stroke-width="2"/>
    <line x1="${x + dx * 6}" y1="${y + dy * 6}" x2="${x + dx * 28}" y2="${y + dy * 6}" stroke="${S}" stroke-width="1"/>
    <line x1="${x + dx * 6}" y1="${y + dy * 6}" x2="${x + dx * 6}" y2="${y + dy * 28}" stroke="${S}" stroke-width="1"/>
    <circle cx="${x + dx * 12}" cy="${y + dy * 12}" r="4" fill="${D}" stroke="${S}" stroke-width="1"/>
    <circle cx="${x + dx * 12}" cy="${y + dy * 12}" r="2" fill="${S}"/>`;
}

export function buildCertificateHtml(certificate, clientName) {
  const tier = getTierForCertificate(certificate);
  const count = Number(certificate.milestone_count || tier.count);
  const certClient = esc((certificate.client_name || clientName || 'Valued Enterprise Partner').toUpperCase());
  const certCode = esc(certificate.certificate_code || `CERT-REFURB-${count}-2026`);
  const P = tier.primaryRgb; const S = tier.secondaryRgb; const D = tier.darkRgb;
  const SLATE_DEEP = [18, 24, 38]; const SLATE_BODY = [51, 65, 85]; const SLATE_MUTED = [100, 116, 139];

  // page 1 vector art (same coordinates as the jsPDF drawing)
  let guilloche = '';
  for (let i = 40; i < W - 40; i += 48) guilloche += `<line x1="${i}" y1="40" x2="${W - 40}" y2="${H - i * 0.7}" stroke="${rgb(P)}" stroke-width="0.35"/>`;
  const sealX = W - 110 - 80;
  const footY = 327; // y after the citation block in the web layout
  const sealY = footY + 2;
  let dots = '';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    dots += `<circle cx="${sealX + Math.cos(a) * 27}" cy="${sealY + Math.sin(a) * 27}" r="2.2" fill="${rgb(S)}" stroke="${rgb(D)}" stroke-width="1.5"/>`;
  }
  const tri = (pts) => `<polygon points="${pts}" fill="${rgb(tier.ribbonRgb)}" stroke="${rgb(tier.ribbonDarkRgb)}" stroke-width="0.5"/>`;
  const page1Svg = `
    <svg width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">
      <rect x="0" y="0" width="${W}" height="${H}" fill="${rgb(tier.bgRgb)}"/>
      ${guilloche}
      <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${rgb(P)}" stroke-width="5"/>
      <rect x="23" y="23" width="${W - 46}" height="${H - 46}" fill="none" stroke="${rgb(S)}" stroke-width="1"/>
      <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${rgb(D)}" stroke-width="2.5"/>
      <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${rgb(P)}" stroke-width="0.75"/>
      ${flourish(42, 42, 1, 1, tier)}${flourish(W - 42, 42, -1, 1, tier)}${flourish(42, H - 42, 1, -1, tier)}${flourish(W - 42, H - 42, -1, -1, tier)}
      <line x1="${W / 2 - 170}" y1="146" x2="${W / 2 - 25}" y2="146" stroke="${rgb(P)}" stroke-width="1.5"/>
      <line x1="${W / 2 + 25}" y1="146" x2="${W / 2 + 170}" y2="146" stroke="${rgb(P)}" stroke-width="1.5"/>
      <circle cx="${W / 2}" cy="146" r="4.5" fill="${rgb(P)}"/><circle cx="${W / 2 - 12}" cy="146" r="2.5" fill="${rgb(P)}"/><circle cx="${W / 2 + 12}" cy="146" r="2.5" fill="${rgb(P)}"/>
      <rect x="${(W - 540) / 2}" y="184" width="540" height="44" rx="6" fill="#fff" stroke="${rgb(P)}" stroke-width="1.5"/>
      <rect x="${(W - 540) / 2 + 3}" y="187" width="534" height="38" rx="4" fill="none" stroke="${rgb(S)}" stroke-width="0.75"/>
      <line x1="110" y1="${footY + 7}" x2="270" y2="${footY + 7}" stroke="${rgb(SLATE_MUTED)}" stroke-width="0.75"/>
      ${tri(`${sealX - 14},${sealY + 8} ${sealX - 6},${sealY + 30} ${sealX - 20},${sealY + 27}`)}
      ${tri(`${sealX + 14},${sealY + 8} ${sealX + 6},${sealY + 30} ${sealX + 20},${sealY + 27}`)}
      <circle cx="${sealX}" cy="${sealY}" r="25" fill="${rgb(P)}" stroke="${rgb(D)}" stroke-width="1.5"/>
      ${dots}
      <circle cx="${sealX}" cy="${sealY}" r="20" fill="${rgb(S)}" stroke="${rgb(D)}" stroke-width="1.5"/>
      <circle cx="${sealX}" cy="${sealY}" r="16.5" fill="${rgb(D)}"/>
    </svg>`;

  const citation = `For exceptional leadership in decarbonized urban mobility and zero-waste battery lifecycle governance. `
    + `By reaching the ${tier.badge} milestone threshold and restoring, testing, and re-commissioning ${thousands(count)} high-voltage battery modules, `
    + `your enterprise has directly mitigated hazardous lithium contamination, extended valuable cell life, and significantly reduced global greenhouse emissions.`;

  const page1 = `
    <section class="page">
      ${page1Svg}
      ${text(62, 13, 'REFURBNICS CIRCULAR LOGISTICS &amp; BATTERY ENGINEERING', { bold: true, color: D, spacing: 1.5 })}
      ${text(75, 8.5, `— ${tier.badge.toUpperCase()} TIER • GLOBAL BATTERY DECARBONIZATION REGISTRY —`, { bold: true, color: P, spacing: 2 })}
      ${text(109, 16, `Official ${tier.badge} Certificate of Environmental Stewardship`, { font: 'serif', italic: true, color: P })}
      ${text(135, 22, 'SUSTAINABILITY &amp; CIRCULAR ECONOMY ACHIEVEMENT', { bold: true, color: SLATE_DEEP, spacing: 0.8 })}
      ${text(168, 12, `This distinguished ${tier.badge} milestone accreditation is solemnly presented to`, { font: 'serif', italic: true, color: SLATE_MUTED })}
      ${text(212, 20, certClient, { bold: true, color: D, spacing: 1 })}
      <div style="position:absolute;top:${252 - 12 * 0.8}pt;left:${(W - 680) / 2}pt;width:680pt;text-align:center;font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:18pt;color:${rgb(SLATE_BODY)};">${esc(citation)}</div>
      ${text(footY + 2, 16, 'Chief Executive Officer', { font: 'serif', italic: true, color: SLATE_DEEP, x: 190, width: 240 })}
      ${text(footY + 16, 7.5, 'CHIEF EXECUTIVE OFFICER', { bold: true, color: SLATE_MUTED, x: 190, width: 240 })}
      ${text(footY + 24, 6.5, 'Refurbnics International Ltd', { color: SLATE_MUTED, x: 190, width: 240 })}
      ${text(sealY - 6, 5, tier.sealTitle, { bold: true, color: [255, 255, 255], spacing: 0.5, x: sealX, width: 60 })}
      ${text(sealY + 1, 6.5, '★ VERIFIED ★', { bold: true, color: [255, 255, 255], x: sealX, width: 60 })}
      ${text(sealY + 7, 4.5, 'CIRCULAR ESG', { bold: true, color: [255, 255, 255], spacing: 0.5, x: sealX, width: 60 })}
      ${text(H - 20, 7.5, `Official Registry Code: ${certCode}   •   Tier: ${tier.badge}   •   SHA-256 Tamper-Evident Digital ESG Record`, { font: 'mono', bold: true, color: SLATE_MUTED })}
    </section>`;

  // page 2 — material & chemical recovery table
  const rows = materialBreakdown(count).map((item, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : 'rgb(245,247,250)'}">
        <td style="font-weight:bold;color:${rgb(SLATE_DEEP)}">${esc(item.nameEn)}</td>
        <td style="font-family:'Courier New',Courier,monospace;font-weight:bold;color:${rgb(SLATE_BODY)}">${esc(item.formula)}</td>
        <td style="color:${rgb(SLATE_BODY)}">${esc(item.casNo)}</td>
        <td style="color:${rgb(SLATE_BODY)}">${esc(item.weightPct)}</td>
        <td style="font-weight:bold;color:${rgb(D)}">${esc(item.formattedAmount)}</td>
        <td style="font-size:7pt;color:${rgb(SLATE_BODY)}">${esc(item.role)}</td>
      </tr>`).join('');

  const page2 = `
    <section class="page">
      <svg width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">
        <rect x="0" y="0" width="${W}" height="${H}" fill="${rgb(tier.bgRgb)}"/>
        <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${rgb(P)}" stroke-width="4"/>
        <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="${rgb(D)}" stroke-width="1"/>
        <line x1="${W / 2 - 200}" y1="68" x2="${W / 2 + 200}" y2="68" stroke="${rgb(P)}" stroke-width="1"/>
      </svg>
      ${text(46, 14, 'SECTION 2. COMPOSITION &amp; MATERIAL INFORMATION', { bold: true, color: D, spacing: 1 })}
      ${text(60, 8.5, `MATERIAL &amp; CHEMICAL RECOVERY AUDIT FOR ${thousands(count)} HIGH-VOLTAGE BATTERY PACKS`, { bold: true, color: P, spacing: 1.5 })}
      <table style="position:absolute;top:84pt;left:36pt;width:${W - 72}pt;">
        <colgroup><col style="width:160pt"/><col style="width:160pt"/><col style="width:80pt"/><col style="width:85pt"/><col style="width:124pt"/><col style="width:160pt"/></colgroup>
        <thead><tr style="background:${rgb(P)}">
          <th>Chemical Composition</th><th>Chemical Formula</th><th>CAS No.</th><th>Weight (%)</th><th>Recovered (${thousands(count)} Packs)</th><th>Battery Component Role</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="position:absolute;top:${84 + 22.5 + 14 * 20.5 + 12 - 7.5 * 0.8}pt;left:40pt;font-size:7.5pt;line-height:10pt;color:${rgb(SLATE_MUTED)};">
        * Certified Material Breakdown: 100% of high-voltage cells serviced by Refurbnics adhere to ISO 14001, RoHS, and EU Battery Passport standards.<br/>
        Lithium, Nickel, Copper, and rare earth components undergo audited recovery and life-extension, preventing toxic leachate in accordance with ESG directives.
      </div>
      ${text(H - 24, 8, `Official Registry Code: ${certCode}   •   Page 2 of 2: Material &amp; Chemical Composition Appendix`, { font: 'mono', bold: true, color: SLATE_MUTED })}
    </section>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; }
  .page { position: relative; width: ${W}pt; height: ${H}pt; overflow: hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  table { border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
  th { color: #fff; font-weight: bold; font-size: 8pt; text-align: left; height: 22.5pt; padding: 0 6pt; }
  td { height: 20.5pt; padding: 0 6pt; border: 0.5pt solid rgb(220,226,235); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body>${page1}${page2}</body></html>`;
}

export function certificateFileName(certificate, clientName) {
  const tier = getTierForCertificate(certificate);
  const cleanName = (certificate.client_name || clientName || 'Client').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const count = certificate.milestone_count || tier.count;
  return `Refurbnics-${tier.badge}-Certificate-${cleanName}-${count}-batteries.pdf`;
}

// Opens the system print dialog (printer, or "Save as PDF").
export async function printCertificate(certificate, clientName) {
  await loadPrint().printAsync({ html: buildCertificateHtml(certificate, clientName), orientation: loadPrint().Orientation.landscape });
}

// Builds the PDF under the same file name the web download uses and opens
// the share sheet (save to Files, WhatsApp, email…).
export async function shareCertificate(certificate, clientName) {
  const { uri } = await loadPrint().printToFileAsync({ html: buildCertificateHtml(certificate, clientName), width: W, height: H });
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, certificateFileName(certificate, clientName));
    await new File(uri).copy(named, { overwrite: true });
    shareUri = named.uri;
  } catch {
    // keep the generated name if the copy fails
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. PDF saved at ${shareUri}`);
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: certificate.title || 'Milestone certificate' });
}
