// Shared loader for ISCTE's real room catalog (docs/ISCTE-Typology-Rooms.xls,
// 'Salas' sheet) — used by both importIsteDataset.ts (the real-data import)
// and generate-large-schedule.ts (a synthetic, scale-controlled dataset that
// borrows real ISCTE rooms instead of made-up ones), so both stay in sync
// with a single real-catalog reader.
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import type { RawRoom } from '../types/scheduleJson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOMS_XLS = join(__dirname, '../../../docs/ISCTE-Typology-Rooms.xls');

export const padded = (prefix: string, i: number, width: number): string =>
  `${prefix}${String(i + 1).padStart(width, '0')}`;

export type Row = readonly string[];

export function readSheetRows(path: string, sheetName: string): Row[] {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in ${path} (found: ${workbook.SheetNames.join(', ')})`);
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as Row[];
}

// Resolves column indices by header name rather than hardcoded position, so
// a reordered export doesn't silently scramble the mapping.
export function headerIndex(header: Row, name: string): number {
  const idx = header.indexOf(name);
  if (idx === -1) {
    throw new Error(`Expected column '${name}' not found in export header`);
  }
  return idx;
}

export function loadIsteRoomCatalog(): { rooms: RawRoom[]; roomIdByName: Map<string, string> } {
  const rows = readSheetRows(ROOMS_XLS, 'Salas');
  const header = rows[0]!;
  const iBuilding = headerIndex(header, 'Edifício');
  const iName = headerIndex(header, 'Nome sala');
  const iActive = headerIndex(header, 'Activa');
  const iCapacity = headerIndex(header, 'Capacidade Normal');

  const rooms: RawRoom[] = [];
  const roomIdByName = new Map<string, string>();

  for (const row of rows.slice(1)) {
    const name = row[iName]?.trim();
    if (!name || row[iActive]?.toLowerCase() !== 'true') continue;
    const id = padded('RM_', rooms.length, 4);
    rooms.push({
      id,
      name,
      capacity: Number(row[iCapacity]) || 0,
      building: row[iBuilding]?.trim() || 'Unknown',
    });
    roomIdByName.set(name, id);
  }

  return { rooms, roomIdByName };
}
