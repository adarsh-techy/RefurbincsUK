import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCodeCore from 'qrcode/lib/core/qrcode';
import SvgRenderer from 'qrcode/lib/renderer/svg-tag';

// QR sheet for printing — the mobile twin of the web utils/generate-qr-sheet.js:
// an A4 grid, `columns` across x 9 down (45 per page at the default 5), one QR
// code per battery with its Battery ID underneath, spilling onto more pages
// when there are more codes than fit. Built as HTML (inline SVG QR codes, no
// canvas) and turned into a PDF / sent to a printer by expo-print.
//
// Each QR encodes the battery's web detail-page URL, like the web sheet, when
// EXPO_PUBLIC_WEB_URL is set (e.g. https://your-site.vercel.app); otherwise
// just the battery code. Both scan fine in the app (utils/extract-battery-code).

export const ROWS = 9;
export const DEFAULT_COLUMNS = 5;
export const MAX_SHEET_CODES = 2000; // keeps the HTML → PDF step comfortable on a phone
const BATTERY_NUMBER_DIGITS = 7;

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || '').trim().replace(/\/+$/, '');

// A4 in points, same margins / label space as the web jsPDF sheet
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 24;
const LABEL_SPACE = 16;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function qrSvg(text) {
  return SvgRenderer.render(QRCodeCore.create(String(text), { errorCorrectionLevel: 'M' }), { margin: 1 });
}

export function qrContentFor(batteryCode) {
  return WEB_URL ? `${WEB_URL}/batteries/${encodeURIComponent(batteryCode)}` : batteryCode;
}

// Battery IDs for a numbered range of a client prefix — the same codes the
// generator writes (PREFIX-NNNNNNN, wider once the number needs it).
export function codesInRange(prefix, from, to) {
  const start = Math.max(1, Math.floor(Number(from) || 1));
  const end = Math.max(start, Math.floor(Number(to) || start));
  const padLen = Math.max(BATTERY_NUMBER_DIGITS, String(end).length);
  const codes = [];
  for (let n = start; n <= end; n += 1) codes.push(`${prefix}-${String(n).padStart(padLen, '0')}`);
  return codes;
}

export function buildQrSheetHtml(codes, columns = DEFAULT_COLUMNS) {
  const cols = Math.max(1, Math.min(8, Math.floor(Number(columns) || DEFAULT_COLUMNS)));
  const perPage = cols * ROWS;
  const cellW = (PAGE_W - MARGIN * 2) / cols;
  const cellH = (PAGE_H - MARGIN * 2) / ROWS;
  const qrSize = Math.min(cellW, cellH - LABEL_SPACE) - 12;

  const pages = [];
  for (let i = 0; i < codes.length; i += perPage) {
    const cells = codes.slice(i, i + perPage).map((code) => `
      <div class="cell">
        <div class="qr">${qrSvg(qrContentFor(code))}</div>
        <div class="label">${escapeHtml(code)}</div>
      </div>`).join('');
    pages.push(`<section class="page">${cells}</section>`);
  }

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: ${MARGIN}pt; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Helvetica, Arial, sans-serif; color: #282828; }
  .page { display: grid; grid-template-columns: repeat(${cols}, ${cellW}pt); grid-auto-rows: ${cellH}pt;
          width: ${PAGE_W - MARGIN * 2}pt; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .cell { display: flex; flex-direction: column; align-items: center; padding-top: 6pt; overflow: hidden; }
  .qr { width: ${qrSize}pt; height: ${qrSize}pt; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .label { margin-top: 3pt; font-size: 8pt; text-align: center; max-width: ${cellW - 8}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head>
<body>${pages.join('')}</body></html>`;
}

function checkSize(codes) {
  if (!codes.length) throw new Error('No battery IDs to print.');
  if (codes.length > MAX_SHEET_CODES) {
    throw new Error(`That's ${codes.length.toLocaleString()} QR codes — print at most ${MAX_SHEET_CODES.toLocaleString()} at a time (split the range).`);
  }
}

// Opens the system print dialog (printer, or "Save as PDF").
export async function printQrSheet(codes, columns = DEFAULT_COLUMNS) {
  checkSize(codes);
  await Print.printAsync({ html: buildQrSheetHtml(codes, columns) });
}

// Builds the PDF and opens the share sheet (WhatsApp, email, Drive, …).
export async function shareQrSheet(codes, columns = DEFAULT_COLUMNS) {
  checkSize(codes);
  const { uri } = await Print.printToFileAsync({ html: buildQrSheetHtml(codes, columns), width: PAGE_W, height: PAGE_H });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. PDF saved at ${uri}`);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `QR sheet ${codes[0]} – ${codes[codes.length - 1]}`,
  });
}
