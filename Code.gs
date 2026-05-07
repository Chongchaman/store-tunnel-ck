/**
 * STORE TUNNEL CK - Google Apps Script Backend
 * ทำหน้าที่เป็น REST API ให้กับ Frontend
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); // ใช้ ID ของไฟล์ปัจจุบัน
// หรือระบุ ID ตรงๆ เช่น const SPREADSHEET_ID = '1xyz...';

const TABS = {
  USERS: 'Users',
  ITEMS: 'Items',
  TRANSACTIONS: 'Transactions',
  SETTINGS: 'Settings'
};

// ─── MAIN ROUTER ───
function doPost(e) {
  // CORS Headers are managed by Google Apps Script natively when using ContentService
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return response({ ok: false, error: 'No payload provided' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    // Auth Guard
    let currentUser = null;
    if (action !== 'login') {
      currentUser = validateToken(payload.token);
      if (!currentUser) {
        return response({ ok: false, error: 'Unauthorized or token expired' });
      }
    }

    let resData;
    switch (action) {
      case 'login': resData = doLogin(payload.payload); break;
      case 'get_dashboard': resData = getDashboard(currentUser); break;
      case 'list_items': resData = listItems(payload.payload); break;
      case 'get_item': resData = getItem(payload.payload.item_code); break;
      case 'lookup_barcode': resData = lookupBarcode(payload.payload.barcode_value); break;
      case 'add_item': resData = addItem(payload.payload, currentUser); break;
      case 'update_item': resData = updateItem(payload.payload, currentUser); break;
      case 'withdraw': resData = processWithdraw(payload.payload, currentUser); break;
      case 'return_rental': resData = processReturn(payload.payload, currentUser); break;
      case 'list_transactions': resData = listTransactions(payload.payload, currentUser); break;
      case 'list_users': resData = listUsers(currentUser); break;
      case 'add_user': resData = addUser(payload.payload, currentUser); break;
      case 'update_user': resData = updateUser(payload.payload, currentUser); break;
      case 'get_settings': resData = getSettings(); break;
      case 'update_settings': resData = updateSettings(payload.payload, currentUser); break;
      case 'list_workers': resData = listWorkers(); break;
      case 'get_report': resData = generateReport(payload.payload, currentUser); break;
      case 'reset_password': resData = resetPassword(payload.payload, currentUser); break;
      default:
        return response({ ok: false, error: 'Unknown action: ' + action });
    }

    return response({ ok: true, data: resData });

  } catch (err) {
    return response({ ok: false, error: err.message, stack: err.stack });
  }
}

// Support preflight request
function doGet(e) {
  return ContentService.createTextOutput("STORE TUNNEL CK API is running. Use POST to interact.");
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── DATABASE UTILS ───
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found.`);
  }
  return sheet;
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = { _row: i + 1 }; // keep row number for updates
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
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

function generateId() {
  return Utilities.getUuid();
}

// ─── AUTHENTICATION ───
function doLogin({ username, password }) {
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => u.username === username && u.active === true);
  
  if (!user) throw new Error('ไม่พบผู้ใช้งานหรือถูกระงับ');
  
  const hashedPw = hashPassword(password);
  if (user.password_hash !== hashedPw) throw new Error('รหัสผ่านไม่ถูกต้อง');

  // Generate simple token
  const token = Utilities.getUuid();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7); // 7 days

  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  sheet.getRange(user._row, headers.indexOf('token') + 1).setValue(token);
  sheet.getRange(user._row, headers.indexOf('token_expiry') + 1).setValue(expiry.toISOString());

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }
  };
}

function validateToken(token) {
  if (!token) return null;
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => u.token === token && u.active === true);
  if (!user) return null;

  if (new Date(user.token_expiry) < new Date()) {
    return null; // Expired
  }

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role
  };
}

// ─── DASHBOARD ───
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
  const lowStockDays = settings.low_stock_alert_days || 7;
  const rentalDueDays = settings.rental_due_alert_days || 3;

  const alerts = [];
  const now = new Date();
  const dueThreshold = new Date(now.getTime() + (rentalDueDays * 24 * 60 * 60 * 1000));

  items.forEach(i => {
    // Check low stock for consumables
    if (i.category === 'consumable') {
      const qty = Number(i.qty) || 0;
      const reorder = Number(i.reorder_point) || 5;
      if (qty <= reorder) {
        alerts.push({ type: 'danger', message: `ของใกล้หมด: ${i.name} (เหลือ ${qty} ${i.unit})`, item_code: i.item_code });
      }
    }
    // Check overdue rentals
    if (i.category === 'rental' && i.due_date && i.status === 'in_stock') {
      const due = new Date(i.due_date);
      if (due < now) {
        alerts.push({ type: 'danger', message: `เลยกำหนดคืน: ${i.name}`, item_code: i.item_code });
      } else if (due <= dueThreshold) {
        alerts.push({ type: 'warning', message: `ใกล้กำหนดคืน: ${i.name} (${Utilities.formatDate(due, "GMT+7", "dd/MM/yyyy")})`, item_code: i.item_code });
      }
    }
  });

  return { summary, alerts };
}

// ─── ITEMS ───
function listItems({ category, search }) {
  let items = getSheetData(TABS.ITEMS);
  if (category) {
    items = items.filter(i => i.category === category);
  }
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(i => 
      String(i.name).toLowerCase().includes(s) || 
      String(i.item_code).toLowerCase().includes(s) ||
      String(i.barcode_value).toLowerCase().includes(s)
    );
  }
  // Sanitize for frontend
  return items.map(i => { delete i._row; return i; });
}

function getItem(itemCode) {
  const items = getSheetData(TABS.ITEMS);
  const item = items.find(i => String(i.item_code) === String(itemCode));
  if (!item) throw new Error('Item not found');
  delete item._row;
  return item;
}

function lookupBarcode(barcode) {
  const items = getSheetData(TABS.ITEMS);
  const item = items.find(i => String(i.barcode_value) === String(barcode) || String(i.item_code) === String(barcode));
  if (!item) throw new Error('Barcode not found');
  delete item._row;
  return item;
}

function addItem(payload, currentUser) {
  if (currentUser.role === 'Worker') throw new Error('Permission denied');
  
  const { category, item_data } = payload;
  const items = getSheetData(TABS.ITEMS);
  if (items.some(i => String(i.item_code) === String(item_data.item_code))) {
    throw new Error('รหัสซ้ำกับในระบบ');
  }

  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  const newRow = [];

  const data = {
    ...item_data,
    category,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  headers.forEach(h => {
    newRow.push(data[h] !== undefined ? data[h] : '');
  });
  
  sheet.appendRow(newRow);

  // Record Transaction if initial qty > 0
  if (data.qty && Number(data.qty) > 0) {
    recordTransaction({
      item_code: data.item_code,
      item_category: category,
      action: 'add',
      qty_before: 0,
      qty_change: Number(data.qty),
      qty_after: Number(data.qty),
      by_user: currentUser.full_name,
      notes: 'เพิ่มเข้าระบบครั้งแรก'
    });
  }

  return { success: true };
}

function updateItem(payload, currentUser) {
  if (currentUser.role === 'Worker') throw new Error('Permission denied');

  const { item_code, update_data } = payload;
  const items = getSheetData(TABS.ITEMS);
  const item = items.find(i => String(i.item_code) === String(item_code));
  if (!item) throw new Error('Item not found');

  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  
  update_data.updated_at = new Date().toISOString();

  let qtyChanged = false;
  let qtyBefore = Number(item.qty) || 0;
  let qtyAfter = qtyBefore;

  for (const key in update_data) {
    const colIndex = headers.indexOf(key);
    if (colIndex > -1) {
      sheet.getRange(item._row, colIndex + 1).setValue(update_data[key]);
      if (key === 'qty' && Number(update_data[key]) !== qtyBefore) {
        qtyChanged = true;
        qtyAfter = Number(update_data[key]);
      }
    }
  }

  if (qtyChanged) {
    recordTransaction({
      item_code: item.item_code,
      item_category: item.category,
      action: 'edit',
      qty_before: qtyBefore,
      qty_change: qtyAfter - qtyBefore,
      qty_after: qtyAfter,
      by_user: currentUser.full_name,
      notes: 'แก้ไขจำนวนแบบ Manual'
    });
  }

  return { success: true };
}

function processWithdraw(payload, currentUser) {
  const { item_code, qty, for_whom, job_ref, notes } = payload;
  const amount = Number(qty);
  if (amount <= 0) throw new Error('Invalid quantity');

  const items = getSheetData(TABS.ITEMS);
  const item = items.find(i => String(i.item_code) === String(item_code));
  if (!item) throw new Error('Item not found');

  const currentQty = Number(item.qty) || 0;
  if (amount > currentQty) throw new Error('จำนวนของไม่พอเบิก');

  const newQty = currentQty - amount;
  
  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  
  sheet.getRange(item._row, headers.indexOf('qty') + 1).setValue(newQty);
  sheet.getRange(item._row, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());

  // Update status if asset/gas went to 0
  if (item.category !== 'consumable' && newQty === 0) {
    sheet.getRange(item._row, headers.indexOf('status') + 1).setValue('out');
  }

  recordTransaction({
    item_code: item.item_code,
    item_category: item.category,
    action: 'withdraw',
    qty_before: currentQty,
    qty_change: -amount,
    qty_after: newQty,
    by_user: currentUser.full_name,
    for_whom,
    job_ref,
    notes
  });

  return { success: true, new_qty: newQty };
}

function processReturn(payload, currentUser) {
  const { item_code, qty, return_date, condition, notes } = payload;
  const amount = Number(qty);
  if (amount <= 0) throw new Error('Invalid quantity');

  const items = getSheetData(TABS.ITEMS);
  const item = items.find(i => String(i.item_code) === String(item_code));
  if (!item) throw new Error('Item not found');

  const currentQty = Number(item.qty) || 0;
  const newQty = currentQty + amount;

  const sheet = getSheet(TABS.ITEMS);
  const headers = getHeaders(TABS.ITEMS);
  
  sheet.getRange(item._row, headers.indexOf('qty') + 1).setValue(newQty);
  sheet.getRange(item._row, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());

  if (newQty > 0 && item.status === 'out') {
    sheet.getRange(item._row, headers.indexOf('status') + 1).setValue('in_stock');
  }

  recordTransaction({
    item_code: item.item_code,
    item_category: item.category,
    action: 'return',
    qty_before: currentQty,
    qty_change: amount,
    qty_after: newQty,
    by_user: currentUser.full_name,
    notes: `สภาพ: ${condition} | ${notes}`
  });

  return { success: true };
}

// ─── TRANSACTIONS ───
function recordTransaction(txData) {
  const sheet = getSheet(TABS.TRANSACTIONS);
  const headers = getHeaders(TABS.TRANSACTIONS);
  
  txData.tx_id = 'TX-' + Utilities.formatDate(new Date(), "GMT+7", "yyMMddHHmmss") + Math.floor(Math.random()*1000);
  txData.datetime = new Date().toISOString();

  const newRow = [];
  headers.forEach(h => {
    newRow.push(txData[h] !== undefined ? txData[h] : '');
  });
  
  sheet.appendRow(newRow);
}

function listTransactions(filters, currentUser) {
  let tx = getSheetData(TABS.TRANSACTIONS);
  
  if (filters.action) tx = tx.filter(t => t.action === filters.action);
  if (filters.category) tx = tx.filter(t => t.item_category === filters.category);
  if (filters.by_user) tx = tx.filter(t => t.by_user === filters.by_user);
  if (filters.from_date) tx = tx.filter(t => new Date(t.datetime) >= new Date(filters.from_date + 'T00:00:00Z'));
  if (filters.to_date) tx = tx.filter(t => new Date(t.datetime) <= new Date(filters.to_date + 'T23:59:59Z'));
  
  tx.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  if (filters.limit) tx = tx.slice(0, filters.limit);

  return tx.map(t => { delete t._row; return t; });
}

// ─── USERS ───
function listUsers(currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Admin only');
  const users = getSheetData(TABS.USERS);
  return users.map(u => {
    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      phone: u.phone,
      active: u.active
    };
  });
}

function addUser(payload, currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Admin only');
  
  const { userData } = payload;
  const users = getSheetData(TABS.USERS);
  if (users.some(u => String(u.username) === String(userData.username))) {
    throw new Error('Username already exists');
  }

  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  
  const data = {
    id: generateId(),
    username: userData.username,
    password_hash: hashPassword(userData.password),
    full_name: userData.full_name,
    role: userData.role || 'Worker',
    phone: userData.phone || '',
    active: true,
    created_at: new Date().toISOString()
  };

  const newRow = [];
  headers.forEach(h => {
    newRow.push(data[h] !== undefined ? data[h] : '');
  });
  
  sheet.appendRow(newRow);
  return { success: true };
}

function updateUser(payload, currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Admin only');
  
  const { user_id, updateData } = payload;
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => String(u.id) === String(user_id));
  if (!user) throw new Error('User not found');

  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  
  for (const key in updateData) {
    const colIndex = headers.indexOf(key);
    if (colIndex > -1) {
      sheet.getRange(user._row, colIndex + 1).setValue(updateData[key]);
    }
  }
  return { success: true };
}

function resetPassword(payload, currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Admin only');
  const { user_id, new_password } = payload;
  
  const users = getSheetData(TABS.USERS);
  const user = users.find(u => String(u.id) === String(user_id));
  if (!user) throw new Error('User not found');

  const sheet = getSheet(TABS.USERS);
  const headers = getHeaders(TABS.USERS);
  const hash = hashPassword(new_password);
  
  sheet.getRange(user._row, headers.indexOf('password_hash') + 1).setValue(hash);
  return { success: true };
}

function listWorkers() {
  const users = getSheetData(TABS.USERS);
  return users.filter(u => u.active === true).map(u => ({ full_name: u.full_name, username: u.username }));
}

// ─── SETTINGS ───
function getSettings() {
  const data = getSheetData(TABS.SETTINGS);
  const config = {};
  data.forEach(row => {
    config[row.key] = row.value;
  });
  return config;
}

function updateSettings(payload, currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Admin only');
  
  const { settings } = payload;
  const sheet = getSheet(TABS.SETTINGS);
  const data = getSheetData(TABS.SETTINGS);
  
  for (const key in settings) {
    const existing = data.find(r => r.key === key);
    if (existing) {
      sheet.getRange(existing._row, 2).setValue(settings[key]);
    } else {
      sheet.appendRow([key, settings[key]]);
      // refresh data so subsequent keys aren't missed if we ever need it
      data.push({ _row: sheet.getLastRow(), key: key, value: settings[key] });
    }
  }
  return { success: true };
}

// ─── REPORTS ───
function generateReport(payload, currentUser) {
  if (currentUser.role === 'Worker') throw new Error('Permission denied');
  
  const { report_type, params } = payload;
  const items = getSheetData(TABS.ITEMS);
  const tx = getSheetData(TABS.TRANSACTIONS);
  
  let headers = [];
  let rows = [];

  switch (report_type) {
    case 'stock_all':
      headers = ['รหัส', 'ประเภท', 'ชื่อ', 'คงเหลือ', 'หน่วย'];
      items.forEach(i => {
        rows.push([i.item_code, i.category, i.name, i.qty || 0, i.unit || '']);
      });
      break;
      
    case 'monthly_summary':
      const month = params.month || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");
      headers = ['วันเวลา', 'Action', 'รหัส', 'ชื่อ', 'จำนวน', 'โดย', 'ให้ใคร/งาน'];
      const mTx = tx.filter(t => t.datetime && t.datetime.startsWith(month));
      mTx.forEach(t => {
        const item = items.find(i => i.item_code === t.item_code);
        rows.push([
          Utilities.formatDate(new Date(t.datetime), "GMT+7", "dd/MM/yyyy HH:mm"),
          t.action,
          t.item_code,
          item ? item.name : '-',
          t.qty_change,
          t.by_user,
          (t.for_whom || '') + (t.job_ref ? ` (${t.job_ref})` : '')
        ]);
      });
      break;

    case 'overdue_rental':
      headers = ['รหัส', 'ชื่อ', 'จำนวน', 'กำหนดคืน', 'เกินมา (วัน)', 'ร้านเช่า'];
      const now = new Date();
      items.filter(i => i.category === 'rental' && i.status === 'in_stock' && i.due_date).forEach(i => {
        const due = new Date(i.due_date);
        if (due < now) {
          const daysOver = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          rows.push([i.item_code, i.name, i.qty, Utilities.formatDate(due, "GMT+7", "dd/MM/yyyy"), daysOver, i.supplier_company || '-']);
        }
      });
      break;

    case 'asset_by_person':
      headers = ['รหัส', 'ชื่อ', 'ผู้รับผิดชอบล่าสุด', 'วันที่เบิก'];
      const assetsOut = items.filter(i => i.category === 'asset' && i.status === 'out');
      assetsOut.forEach(i => {
        // Find last withdraw tx
        const lastTx = tx.filter(t => t.item_code === i.item_code && t.action === 'withdraw')
                         .sort((a,b) => new Date(b.datetime) - new Date(a.datetime))[0];
        
        rows.push([
          i.item_code, 
          i.name, 
          lastTx ? lastTx.for_whom || lastTx.by_user : 'ไม่ทราบ',
          lastTx ? Utilities.formatDate(new Date(lastTx.datetime), "GMT+7", "dd/MM/yyyy") : '-'
        ]);
      });
      break;

    case 'low_stock':
      headers = ['รหัส', 'ชื่อ', 'คงเหลือ', 'จุดสั่งซื้อ (Reorder)'];
      items.filter(i => i.category === 'consumable').forEach(i => {
        if (Number(i.qty) <= Number(i.reorder_point)) {
          rows.push([i.item_code, i.name, i.qty, i.reorder_point]);
        }
      });
      break;
  }

  return { headers, rows };
}

// ─── SETUP SCRIPT (Run this once) ───
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const schemas = {
    [TABS.USERS]: ['id', 'username', 'password_hash', 'full_name', 'role', 'phone', 'active', 'token', 'token_expiry', 'created_at'],
    [TABS.ITEMS]: ['item_code', 'category', 'name', 'unit', 'photo_url', 'barcode_value', 'qty', 'status', 'supplier_company', 'supplier_contact', 'rent_date', 'due_date', 'rate_per_day', 'asset_code', 'cost', 'price_per_unit', 'reorder_point', 'tank_code', 'gas_type', 'size', 'level', 'owner_company', 'notes', 'created_at', 'updated_at'],
    [TABS.TRANSACTIONS]: ['tx_id', 'datetime', 'item_code', 'item_category', 'action', 'qty_before', 'qty_change', 'qty_after', 'by_user', 'for_whom', 'job_ref', 'notes'],
    [TABS.SETTINGS]: ['key', 'value']
  };

  for (const [sheetName, columns] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Create default admin if not exists
  const usersSheet = ss.getSheetByName(TABS.USERS);
  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow([
      generateId(), 
      'admin', 
      hashPassword('admin123'), 
      'System Admin', 
      'Admin', 
      '', 
      true, 
      '', 
      '', 
      new Date().toISOString()
    ]);
  }
  
  // Default settings
  const settingsSheet = ss.getSheetByName(TABS.SETTINGS);
  if (settingsSheet.getLastRow() === 1) {
    settingsSheet.appendRow(['site_name', 'STORE TUNNEL CK']);
    settingsSheet.appendRow(['low_stock_alert_days', 7]);
    settingsSheet.appendRow(['rental_due_alert_days', 3]);
  }
}
