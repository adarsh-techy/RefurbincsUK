const { Readable } = require('stream');
const ExcelJS = require('exceljs');

// Reads an RFID assignment spreadsheet (.xlsx or .csv): one row per battery
// with its tag. Header names are matched loosely so a sheet exported from a
// tag printer or typed by hand both work.
const HEADER_ALIASES = {
  batteryCode: ['battery number', 'battery_number', 'battery no', 'battery no.', 'battery id', 'battery_id', 'battery code', 'battery_code', 'battery', 'code'],
  rfidTag: ['rfid tag', 'rfid_tag', 'rfid', 'tag', 'tag id', 'tag_id', 'epc', 'uid', 'tag uid', 'rfid uid'],
  clientName: ['client name', 'client_name', 'client', 'customer', 'customer name', 'fleet client'],
};

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase();
}

// Exact alias first; otherwise any header mentioning "battery" is the battery
// column and any mentioning rfid / tag / epc / uid is the tag column — so
// "Battery Numbers", "RFID Tag ID", "Tag No." etc. all work without the user
// having to rename columns.
function matchField(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return undefined;
  const exact = Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field].includes(normalized));
  if (exact) return exact;
  const letters = normalized.replace(/[^a-z]/g, '');
  if (letters.includes('battery')) return 'batteryCode';
  if (/rfid|tag|epc|uid/.test(letters)) return 'rfidTag';
  if (/client|customer/.test(letters)) return 'clientName';
  return undefined;
}

// Cell values from exceljs can be rich objects (hyperlinks, formulas)
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((r) => r.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
  }
  return String(value);
}

// Tags are stored as upper-case alphanumerics only: readers report the same
// UID with colons, spaces or lower-case hex depending on the device.
function normalizeTag(value) {
  return cellText(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

// Excel saves CSV with ';' (and some tools with tabs) depending on the
// computer's locale; sniff the header line so those files parse too.
function sniffDelimiter(buffer) {
  const head = buffer.toString('utf8', 0, Math.min(buffer.length, 4096)).split(/\r?\n/)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of head) if (ch in counts) counts[ch] += 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

async function loadWorksheet(buffer, filename) {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename || '')) {
    // strip a UTF-8 BOM so the first header doesn't start with an invisible char
    const clean = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer;
    await workbook.csv.read(Readable.from(clean), { parserOptions: { delimiter: sniffDelimiter(clean) } });
  } else {
    await workbook.xlsx.load(buffer);
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('File has no readable sheet');
  return worksheet;
}

// Returns [{ rowNumber, batteryCode, rfidTag, error? }]. Blank rows are
// skipped; a row missing either value is kept with `error` so the page can
// show it rather than silently dropping it.
async function parseRfidSheet(buffer, filename) {
  const worksheet = await loadWorksheet(buffer, filename);

  const columnFields = {};
  const seenHeaders = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    seenHeaders.push(cellText(cell.value).trim());
    const field = matchField(cell.value);
    // first matching column wins if a header repeats
    if (field && !Object.values(columnFields).includes(field)) columnFields[colNumber] = field;
  });

  const found = new Set(Object.values(columnFields));
  const missing = ['batteryCode', 'rfidTag'].filter((f) => !found.has(f));
  if (missing.length) {
    const need = missing.map((f) => (f === 'batteryCode' ? 'a "Battery Number" column' : 'an "RFID Tag" column')).join(' and ');
    throw new Error(
      `Could not find ${need} in the first row. Headers found: ${seenHeaders.filter(Boolean).map((h) => `"${h}"`).join(', ') || 'none'}.`
    );
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    row.eachCell((cell, colNumber) => {
      const field = columnFields[colNumber];
      if (field) record[field] = cell.value;
    });
    const batteryCode = cellText(record.batteryCode).trim().toUpperCase();
    const rfidTag = normalizeTag(record.rfidTag);
    const clientName = cellText(record.clientName).trim(); // required (or picked on the page); checked against the battery's client
    if (!batteryCode && !rfidTag) return; // blank line
    const entry = { rowNumber, batteryCode, rfidTag, clientName: clientName || null };
    if (!batteryCode) entry.error = 'Battery number is empty';
    else if (!rfidTag) entry.error = 'RFID tag is empty';
    else if (rfidTag.length < 4 || rfidTag.length > 64) entry.error = 'RFID tag must be 4–64 characters';
    rows.push(entry);
  });
  return rows;
}

module.exports = { parseRfidSheet, normalizeTag };
