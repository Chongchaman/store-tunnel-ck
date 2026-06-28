// ============================================================
// services/sheets.js — Google Sheets API v4 wrapper
// แทน getSheetData / getSheet / clearSheetCache ของ GAS
// ============================================================
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TABS = {
  USERS:        'Users',
  ITEMS:        'Items',
  TRANSACTIONS: 'Transactions',
  SETTINGS:     'Settings',
};

// ── Auth ──
function getAuth() {
  // ใช้ Service Account credentials จาก environment variable
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// ── In-memory Cache (แทน CacheService ของ GAS) ──
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 นาที

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.data;
}
function _cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }
function _cacheClear(key)     { _cache.delete(key); }
function _cacheClearAll()     { _cache.clear(); }

// ── Read sheet as array of objects ──
async function getSheetData(sheetName) {
  const cacheKey = 'STC_' + sheetName;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) { _cacheSet(cacheKey, []); return []; }

  const headers = rows[0];
  const data = rows.slice(1).map((row, idx) => {
    const obj = { _row: idx + 2 }; // 1-indexed, header is row 1
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });

  _cacheSet(cacheKey, data);
  return data;
}

// ── Update a single cell ──
async function updateCell(sheetName, rowIndex, colIndex, value) {
  const sheets = getSheetsClient();
  const colLetter = colToLetter(colIndex);
  const range = `${sheetName}!${colLetter}${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// ── Update multiple cells in one batch ──
async function batchUpdate(sheetName, updates) {
  // updates: [{ row, col, value }, ...]
  const sheets = getSheetsClient();
  const data = updates.map(u => ({
    range: `${sheetName}!${colToLetter(u.col)}${u.row}`,
    values: [[u.value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// ── Append a row ──
async function appendRow(sheetName, values) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

// ── Append multiple rows ──
async function appendRows(sheetName, rowsArray) {
  if (!rowsArray.length) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rowsArray },
  });
}

// ── Delete a row ──
async function deleteRow(sheetName, rowIndex) {
  const sheets = getSheetsClient();
  // Get sheet ID first
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet '${sheetName}' not found`);
  const sheetId = sheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-indexed
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

// ── Get headers of a sheet ──
async function getHeaders(sheetName) {
  const data = await getSheetData(sheetName);
  if (!data.length) return [];
  return Object.keys(data[0]).filter(k => k !== '_row');
}

// ── Clear cache ──
function clearCache(sheetName)  { _cacheClear('STC_' + sheetName); }
function clearAllCache()        { _cacheClearAll(); }

// ── Utility: column index (1-based) → letter ──
function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

module.exports = {
  TABS,
  getSheetData,
  updateCell,
  batchUpdate,
  appendRow,
  appendRows,
  deleteRow,
  getHeaders,
  clearCache,
  clearAllCache,
  colToLetter,
};
