import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { sortedBatteryCodes } from '../components/client/sorting/sort-utils';

// Sort group → .xlsx, the mobile twin of handleExportExcel on the web
// ClientBatterySortPage: one sheet named after the group (Excel-safe, max 31
// chars), a single "Battery ID" column 20 wide, file "<group name>.xlsx".
// Written as base64 to the cache folder and handed to the share sheet.

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';


export async function exportSortGroup(group) {
  // loaded on first use, not at app start
  const XLSX = require('xlsx');
  const codes = sortedBatteryCodes(group?.batteries); // ascending battery number
  if (codes.length === 0) throw new Error('This group has no batteries to export yet.');

  const worksheet = XLSX.utils.json_to_sheet(codes.map((code) => ({ 'Battery ID': code })));
  worksheet['!cols'] = [{ wch: 20 }];
  const workbook = XLSX.utils.book_new();
  const sheetName = (group.name || 'Sorted Batteries').replace(/[:\\/?*[\]]/g, '_').trim().slice(0, 31) || 'Batteries';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeName = (group.name || 'Sorted_Batteries').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Sorted_Batteries';
  const file = new File(Paths.cache, `${safeName}.xlsx`);
  file.create({ overwrite: true }); // replaces an earlier export of the same group
  file.write(XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }), { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. File saved at ${file.uri}`);
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: `Export ${group.name || 'sort group'}` });
}
