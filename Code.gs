/**
 * STORE TUNNEL CK - Google Apps Script Backend (FINAL VERSION)
 * ทำหน้าที่เป็น REST API ให้กับ Frontend
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); 

const TABS = {
  USERS: 'Users',
  ITEMS: 'Items',
  TRANSACTIONS: 'Transactions',
  SETTINGS: 'Settings'
};

// ─── MAIN ROUTER ───
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return response({ ok: false, error: 'No payload provided' });
    }

    const requestBody = JSON.parse(e.postData.contents);
    const action = requestBody.action;
    const payload = requestBody.payload || {};
    
    // Auth Guard
    let currentUser = null;
    if (action !== 'login') {
      currentUser = validateToken(requestBody.token);
      if (!currentUser) {
        return response({ ok: false, error: 'Unauthorized or token expired' });
      }
    }

    let resData;
    switch (action) {
      case 'login': resData = doLogin(payload); break;
      case 'verify_token': resData = { valid: !!currentUser }; break;
      case 'get_dashboard_summary': resData = getDashboard(currentUser); break;
      case 'get_alerts': resData = getDashboard(currentUser).alerts; break;
      case 'list_items': resData = listItems(payload); break;
      case 'get_item': resData = getItem(payload.item_code); break;
      case 'lookup_barcode': resData = lookupBarcode(payload.barcode_value); break;
      case 'add_item': resData = addItem(payload, currentUser); break;
      case 'update_item': resData = updateItem(payload, currentUser); break;
      case 'delete_item': resData = deleteItem(payload.item_code, currentUser); break;
      case 'withdraw': resData = processWithdraw(payload, currentUser); break;
      case 'return_rental': resData = processReturn(payload, currentUser); break;
      case 'restock': resData = processRestock(payload, currentUser); break;
      case 'assign_asset': resData = processAssignAsset(payload, currentUser); break;
      case 'list_transactions': resData = listTransactions(payload.filters || {}, currentUser); break;
      case 'list_users': resData = listUsers(currentUser); break;
      case 'add_user': resData = addUser(payload, currentUser); break;
      case 'update_user': resData = updateUser(payload, currentUser); break;
      case 'get_settings': resData = getSettings(); break;
      case 'update_settings': resData = updateSettings(payload, currentUser); break;
      case 'list_workers': resData = listWorkers(); break;
      case 'get_report': resData = generateReport(payload, currentUser); break;
      case 'reset_password': resData = resetPassword(payload, currentUser); break;
      default:
        return response({ ok: false, error: 'Unknown action: ' + action });
    }

    return response({ ok: true, data: resData });

  } catch (err) {
    return response({ ok: false, error: err.message, stack: err.stack });
  }
}

function doGet(e) {
  return ContentService.createTextOutput("STORE TUNNEL CK API is running.");
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── DATABASE UTILS ───
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet '${sheetName}' not found.`);
  return sheet;
}

function getSheetData(sheetName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'STORE_TUNNEL_DATA_' + sheetName;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }

  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = { _row: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      let val = data[i][j];
      // Convert Date objects to ISO string for consistent caching
      if (val instanceof Date) {
        val = val.toISOString();
      }
      obj[headers[j]] = val;
    }
    rows.push(obj);
  }
  
  try {
    const jsonStr = JSON.stringify(rows);
    if (jsonStr.length < 100000) { // Limit CacheService max 100KB
      cache.put(cacheKey, jsonStr, 600); // Cache 10 minutes
    }
  } catch(e) {}

  return rows;
}

function clearSheetCache(sheetName) {
  CacheService.getScriptCache().remove('STORE_TUNNEL_DATA_' + sheetName);
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  let hashStr = '';
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let hex = byte.toString(16);
    if (hex.length == 1) hex = '0' + hex;
    hashStr += hex;
  }
  return hashStr;
}

// ─── HANDLERS ───
function doLogin({ username, password }) {
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => u.username === username && u.active === true);
  if (!user) throw new Error('ไม่พบผู้ใช้งานหรือถูกระงับ');
  
  if (user.password_hash !== hashPassword(password)) throw new Error('รหัสผ่านไม่ถูกต้อง');

  const token = Utilities.getUuid();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  sheet.getRange(user._row, headers.indexOf('token') + 1).setValue(token);
  sheet.getRange(user._row, headers.indexOf('token_expiry') + 1).setValue(expiry.toISOString());

  clearSheetCache(TABS.USERS);
  return { token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } };
}

function validateToken(token) {
  if (!token) return null;
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => u.token === token && u.active === true);
  if (!user || new Date(user.token_expiry) < new Date()) return null;
  return { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
}

function getDashboard(currentUser) {
  const items = getSheetData(TABS.ITEMS);
  const summary = {
    rental_total: items.filter(i => i.category === 'rental').length,
    rental_in_stock: items.filter(i => i.category === 'rental' && i.status === 'in_stock').length,
    asset_total: items.filter(i => i.category === 'asset').length,
    consumable_types: items.filter(i => i.category === 'consumable').length,
    gas_total: items.filter(i => i.category === 'gas').length
  };
  const settings = getSettings();
  const alerts = [];
  const now = new Date();
  items.forEach(i => {
    if (i.category === 'consumable' && Number(i.qty) <= (Number(i.reorder_point) || 5)) {
      alerts.push({ type: 'danger', message: `ของใกล้หมด: ${i.name} (เหลือ ${i.qty})`, item_code: i.item_code });
    }
    if (i.category === 'rental' && i.due_date && i.status === 'in_stock' && new Date(i.due_date) < now) {
      alerts.push({ type: 'danger', message: `เลยกำหนดคืน: ${i.name}`, item_code: i.item_code });
    }
  });
  return { summary, alerts };
}

function listItems({ category, search }) {
  let items = getSheetData(TABS.ITEMS);
  if (category) items = items.filter(i => i.category === category);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(i => String(i.name).toLowerCase().includes(s) || String(i.item_code).toLowerCase().includes(s));
  }
  return items;
}

function getItem(itemCode) {
  const item = getSheetData(TABS.ITEMS).find(i => String(i.item_code) === String(itemCode));
  if (!item) throw new Error('Item not found');
  return item;
}

function lookupBarcode(barcode) {
  const item = getSheetData(TABS.ITEMS).find(i => String(i.barcode_value) === String(barcode) || String(i.item_code) === String(barcode));
  if (!item) throw new Error('ไม่พบข้อมูลบาร์โค้ดนี้ในระบบ');
  return item;
}

function addItem(item_data, currentUser) {
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  const newRow = headers.map(h => {
    if (h === 'created_at' || h === 'updated_at') return new Date().toISOString();
    return item_data[h] || '';
  });
  sheet.appendRow(newRow);
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function updateItem(update_data, currentUser) {
  const item = getSheetData(TABS.ITEMS).find(i => String(i.item_code) === String(update_data.item_code));
  if (!item) throw new Error('Item not found');
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  for (const key in update_data) {
    const idx = headers.indexOf(key);
    if (idx > -1) sheet.getRange(item._row, idx + 1).setValue(update_data[key]);
  }
  sheet.getRange(item._row, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function deleteItem(itemCode, currentUser) {
  const item = getSheetData(TABS.ITEMS).find(i => String(i.item_code) === String(itemCode));
  if (!item) throw new Error('Item not found');
  getSheet(TABS.ITEMS).deleteRow(item._row);
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function processWithdraw(payload, currentUser) {
  const item = getItem(payload.item_code);
  const newQty = (Number(item.qty) || 0) - Number(payload.qty);
  if (newQty < 0) throw new Error('จำนวนไม่พอเบิก');
  
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  sheet.getRange(item._row, headers.indexOf('qty') + 1).setValue(newQty);
  if (item.category !== 'consumable' && newQty === 0) sheet.getRange(item._row, headers.indexOf('status') + 1).setValue('out');
  
  recordTransaction({ ...payload, action: 'withdraw', qty_before: item.qty, qty_change: -payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function processReturn(payload, currentUser) {
  const item = getItem(payload.item_code);
  const newQty = (Number(item.qty) || 0) + Number(payload.qty);
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  sheet.getRange(item._row, headers.indexOf('qty') + 1).setValue(newQty);
  sheet.getRange(item._row, headers.indexOf('status') + 1).setValue('in_stock');
  
  recordTransaction({ ...payload, action: 'return', qty_before: item.qty, qty_change: payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function processRestock(payload, currentUser) {
  const item = getItem(payload.item_code);
  const newQty = (Number(item.qty) || 0) + Number(payload.qty);
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  sheet.getRange(item._row, headers.indexOf('qty') + 1).setValue(newQty);
  
  recordTransaction({ ...payload, action: 'restock', qty_before: item.qty, qty_change: payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function processAssignAsset(payload, currentUser) {
  const item = getItem(payload.asset_code);
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  sheet.getRange(item._row, headers.indexOf('status') + 1).setValue('assigned');
  
  recordTransaction({ item_code: payload.asset_code, action: 'assign', qty_before: 1, qty_change: 0, qty_after: 1, by_user: currentUser.full_name, for_whom: payload.emp_name, item_category: item.category });
  clearSheetCache(TABS.ITEMS);
  return { success: true };
}

function recordTransaction(tx) {
  const sheet = getSheet(TABS.TRANSACTIONS);
  const headers = getHeaders(TABS.TRANSACTIONS);
  const row = headers.map(h => {
    if (h === 'tx_id') return 'TX-' + Date.now();
    if (h === 'datetime') return new Date().toISOString();
    return tx[h] || '';
  });
  sheet.appendRow(row);
  clearSheetCache(TABS.TRANSACTIONS);
}

function listTransactions(filters) {
  let data = getSheetData(TABS.TRANSACTIONS);
  if (filters.action) data = data.filter(d => d.action === filters.action);
  return data.sort((a,b) => new Date(b.datetime) - new Date(a.datetime)).slice(0, 50);
}

function listUsers() { return getSheetData(TABS.USERS).map(u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, active: u.active })); }

function addUser(userData) {
  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  const row = headers.map(h => {
    if (h === 'id') return Utilities.getUuid();
    if (h === 'password_hash') return hashPassword(userData.password);
    if (h === 'active') return true;
    if (h === 'created_at') return new Date().toISOString();
    return userData[h] || '';
  });
  sheet.appendRow(row);
  clearSheetCache(TABS.USERS);
  return { success: true };
}

function getSettings() {
  const config = {};
  getSheetData(TABS.SETTINGS).forEach(r => config[r.key] = r.value);
  return config;
}

function updateSettings(settings) {
  const sheet = getSheet(TABS.SETTINGS);
  const data = getSheetData(TABS.SETTINGS);
  for (const key in settings) {
    const row = data.find(r => r.key === key);
    if (row) sheet.getRange(row._row, 2).setValue(settings[key]);
    else sheet.appendRow([key, settings[key]]);
  }
  clearSheetCache(TABS.SETTINGS);
  return { success: true };
}

function listWorkers() { return getSheetData(TABS.USERS).map(u => ({ full_name: u.full_name })); }

function generateReport(payload) { return { headers: ['รหัส', 'ชื่อ', 'คงเหลือ'], rows: getSheetData(TABS.ITEMS).map(i => [i.item_code, i.name, i.qty]) }; }

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schemas = {
    [TABS.USERS]: ['id', 'username', 'password_hash', 'full_name', 'role', 'phone', 'active', 'token', 'token_expiry', 'created_at'],
    [TABS.ITEMS]: ['item_code', 'category', 'name', 'unit', 'photo_url', 'barcode_value', 'qty', 'status', 'supplier_company', 'supplier_contact', 'rent_date', 'due_date', 'rate_per_day', 'asset_code', 'cost', 'price_per_unit', 'reorder_point', 'tank_code', 'gas_type', 'size', 'level', 'owner_company', 'notes', 'created_at', 'updated_at'],
    [TABS.TRANSACTIONS]: ['tx_id', 'datetime', 'item_code', 'item_category', 'action', 'qty_before', 'qty_change', 'qty_after', 'by_user', 'for_whom', 'job_ref', 'notes'],
    [TABS.SETTINGS]: ['key', 'value']
  };
  for (const [sheetName, columns] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
  }
  if (ss.getSheetByName(TABS.USERS).getLastRow() === 1) {
    ss.getSheetByName(TABS.USERS).appendRow([Utilities.getUuid(), 'admin', hashPassword('admin123'), 'System Admin', 'Admin', '', true, '', '', new Date().toISOString()]);
  }
}
