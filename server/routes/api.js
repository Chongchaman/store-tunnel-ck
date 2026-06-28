// ============================================================
// routes/api.js — Main Router (แทน doPost switch ของ GAS)
// ============================================================
const crypto  = require('crypto');
const { TABS, getSheetData, updateCell, batchUpdate,
        appendRow, appendRows, deleteRow, getHeaders, clearCache } = require('../services/sheets');

// ── Helpers ──
function ok(res, data)    { res.json({ ok: true, data }); }
function fail(res, msg)   { res.json({ ok: false, error: msg }); }
function hashPw(pw)       { return crypto.createHash('sha256').update(pw).digest('hex'); }
function uid()            { return 'TX-' + Date.now() + Math.floor(Math.random() * 1000); }
function nowISO()         { return new Date().toISOString(); }

// ── Auth Middleware ──
async function validateToken(token) {
  if (!token) return null;
  const users = await getSheetData(TABS.USERS);
  const user  = users.find(u => u.token === token && u.active === 'TRUE' || u.active === true);
  if (!user) return null;
  if (user.token_expiry && new Date(user.token_expiry) < new Date()) return null;
  return { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
}

// ── Main Handler ──
module.exports = async (req, res) => {
  try {
    const body    = req.body;
    const action  = body?.action;
    const payload = body?.payload || {};

    if (!action) return fail(res, 'No action provided');

    let currentUser = null;
    if (action !== 'login') {
      currentUser = await validateToken(body.token);
      if (!currentUser) return fail(res, 'Unauthorized or token expired');
    }

    switch (action) {
      case 'login':               return ok(res, await doLogin(payload));
      case 'verify_token':        return ok(res, { valid: !!currentUser });
      case 'get_dashboard_summary': return ok(res, await getDashboard());
      case 'get_alerts':          return ok(res, (await getDashboard()).alerts);
      case 'list_items':          return ok(res, await listItems(payload));
      case 'get_item':            return ok(res, await getItem(payload.item_code));
      case 'lookup_barcode':      return ok(res, await lookupBarcode(payload.barcode_value));
      case 'add_item':            return ok(res, await addItem(payload, currentUser));
      case 'update_item':         return ok(res, await updateItem(payload, currentUser));
      case 'delete_item':         return ok(res, await deleteItemFn(payload.item_code, currentUser));
      case 'withdraw':            return ok(res, await processWithdraw(payload, currentUser));
      case 'withdraw_batch':      return ok(res, await processWithdrawBatch(payload, currentUser));
      case 'return_rental':       return ok(res, await processReturn(payload, currentUser));
      case 'restock':             return ok(res, await processRestock(payload, currentUser));
      case 'assign_asset':        return ok(res, await processAssignAsset(payload, currentUser));
      case 'list_transactions':   return ok(res, await listTransactions(payload.filters || {}));
      case 'list_users':          return ok(res, await listUsers());
      case 'add_user':            return ok(res, await addUser(payload));
      case 'update_user':         return ok(res, await updateUser(payload));
      case 'get_settings':        return ok(res, await getSettings());
      case 'update_settings':     return ok(res, await updateSettings(payload));
      case 'list_workers':        return ok(res, await listWorkers());
      case 'get_worker_holdings': return ok(res, await getWorkerHoldings());
      case 'get_report':          return ok(res, await generateReport(payload));
      case 'reset_password':      return ok(res, await resetPassword(payload, currentUser));
      default: return fail(res, 'Unknown action: ' + action);
    }
  } catch (err) {
    console.error('[API Error]', err);
    res.json({ ok: false, error: err.message });
  }
};

// ══════════════════════════════════════════════════════════════
// HANDLERS (ตรงกับ GAS ทุก function)
// ══════════════════════════════════════════════════════════════

async function doLogin({ username, password }) {
  const users = await getSheetData(TABS.USERS);
  const user  = users.find(u => u.username === username && (u.active === true || u.active === 'TRUE'));
  if (!user) throw new Error('ไม่พบผู้ใช้งานหรือถูกระงับ');
  if (user.password_hash !== hashPw(password)) throw new Error('รหัสผ่านไม่ถูกต้อง');

  const token  = crypto.randomUUID();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  const headers = await getHeaders(TABS.USERS);
  await updateCell(TABS.USERS, user._row, headers.indexOf('token') + 1, token);
  await updateCell(TABS.USERS, user._row, headers.indexOf('token_expiry') + 1, expiry.toISOString());
  clearCache(TABS.USERS);

  return { token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } };
}

async function getDashboard() {
  const items = await getSheetData(TABS.ITEMS);
  const summary = {
    rental_total:      items.filter(i => i.category === 'rental').length,
    rental_in_stock:   items.filter(i => i.category === 'rental' && i.status === 'in_stock').length,
    asset_total:       items.filter(i => i.category === 'asset').length,
    consumable_types:  items.filter(i => i.category === 'consumable').length,
    gas_total:         items.filter(i => i.category === 'gas').length,
  };
  const alerts = [];
  const now    = new Date();
  items.forEach(i => {
    if (['consumable', 'gas'].includes(i.category)) {
      let threshold = Number(i.reorder_point);
      if (isNaN(threshold)) threshold = i.category === 'consumable' ? 5 : 0;
      if (Number(i.qty) <= threshold) {
        alerts.push({ type: 'danger', message: `ของใกล้หมด: ${i.name} (เหลือ ${i.qty} ${i.unit || ''})`, item_code: i.item_code });
      }
    }
    if (i.category === 'rental' && i.due_date && i.status === 'in_stock' && new Date(i.due_date) < now) {
      alerts.push({ type: 'danger', message: `เลยกำหนดคืน: ${i.name}`, item_code: i.item_code });
    }
  });
  return { summary, alerts };
}

async function listItems({ category, search } = {}) {
  let items = await getSheetData(TABS.ITEMS);
  if (category) items = items.filter(i => i.category === category);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(i => String(i.name).toLowerCase().includes(s) || String(i.item_code).toLowerCase().includes(s));
  }
  return items;
}

async function getItem(itemCode) {
  const items = await getSheetData(TABS.ITEMS);
  const item  = items.find(i => String(i.item_code) === String(itemCode));
  if (!item) throw new Error('Item not found');
  return item;
}

async function lookupBarcode(barcode) {
  const items = await getSheetData(TABS.ITEMS);
  const item  = items.find(i => String(i.barcode_value) === String(barcode) || String(i.item_code) === String(barcode));
  if (!item) throw new Error('ไม่พบข้อมูลบาร์โค้ดนี้ในระบบ');
  return item;
}

async function addItem(data) {
  const headers = await getHeaders(TABS.ITEMS);
  const row = headers.map(h => {
    if (h === 'created_at' || h === 'updated_at') return nowISO();
    return data[h] !== undefined ? data[h] : '';
  });
  await appendRow(TABS.ITEMS, row);
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function updateItem(data) {
  const item    = await getItem(data.item_code);
  const headers = await getHeaders(TABS.ITEMS);
  const updates = [];
  for (const key in data) {
    const idx = headers.indexOf(key);
    if (idx > -1) updates.push({ row: item._row, col: idx + 1, value: data[key] });
  }
  const updIdx = headers.indexOf('updated_at');
  if (updIdx > -1) updates.push({ row: item._row, col: updIdx + 1, value: nowISO() });
  await batchUpdate(TABS.ITEMS, updates);
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function deleteItemFn(itemCode) {
  const item = await getItem(itemCode);
  await deleteRow(TABS.ITEMS, item._row);
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function recordTransaction(tx) {
  const headers = await getHeaders(TABS.TRANSACTIONS);
  const row = headers.map(h => {
    if (h === 'tx_id')    return uid();
    if (h === 'datetime') return nowISO();
    return tx[h] !== undefined ? tx[h] : '';
  });
  await appendRow(TABS.TRANSACTIONS, row);
  clearCache(TABS.TRANSACTIONS);
}

async function processWithdraw(payload, currentUser) {
  const item    = await getItem(payload.item_code);
  const headers = await getHeaders(TABS.ITEMS);

  if (item.category === 'asset') {
    if (item.status === 'assigned' || item.status === 'out') throw new Error('ทรัพย์สินนี้ถูกเบิก/ใช้งานอยู่');
    await updateCell(TABS.ITEMS, item._row, headers.indexOf('status') + 1, 'assigned');
    await recordTransaction({ ...payload, action: 'assign', qty_before: 1, qty_change: 0, qty_after: 1, by_user: currentUser.full_name, item_category: item.category });
  } else {
    const newQty = (Number(item.qty) || 0) - Number(payload.qty);
    if (newQty < 0) throw new Error('จำนวนไม่พอเบิก');
    const updates = [{ row: item._row, col: headers.indexOf('qty') + 1, value: newQty }];
    if (item.category !== 'consumable' && newQty === 0)
      updates.push({ row: item._row, col: headers.indexOf('status') + 1, value: 'out' });
    await batchUpdate(TABS.ITEMS, updates);
    await recordTransaction({ ...payload, action: 'withdraw', qty_before: item.qty, qty_change: -payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  }
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function processWithdrawBatch(payload, currentUser) {
  const allItems  = await getSheetData(TABS.ITEMS);
  const headers   = await getHeaders(TABS.ITEMS);
  const itemUpdates = [];
  const txRows      = [];
  const txHeaders   = await getHeaders(TABS.TRANSACTIONS);
  const nowStr      = nowISO();

  for (const req of payload.items) {
    const item = allItems.find(i => String(i.item_code) === String(req.item_code));
    if (!item) throw new Error(`ไม่พบรายการ ${req.item_code}`);

    if (item.category === 'asset') {
      if (item.status === 'assigned' || item.status === 'out') throw new Error(`ทรัพย์สิน ${item.name} ถูกเบิกไปแล้ว`);
      itemUpdates.push({ row: item._row, col: headers.indexOf('status') + 1, value: 'assigned' });
      txRows.push(txHeaders.map(h => {
        if (h === 'tx_id')    return uid();
        if (h === 'datetime') return nowStr;
        const tx = { item_code: item.item_code, action: 'assign', qty_before: 1, qty_change: 0, qty_after: 1, by_user: currentUser.full_name, for_whom: payload.for_whom, job_ref: payload.job_ref, notes: payload.notes, item_category: item.category };
        return tx[h] || '';
      }));
    } else {
      const newQty = (Number(item.qty) || 0) - Number(req.qty);
      if (newQty < 0) throw new Error(`ยอดคงเหลือไม่พอสำหรับ ${item.name}`);
      itemUpdates.push({ row: item._row, col: headers.indexOf('qty') + 1, value: newQty });
      if (item.category !== 'consumable' && newQty === 0)
        itemUpdates.push({ row: item._row, col: headers.indexOf('status') + 1, value: 'out' });
      txRows.push(txHeaders.map(h => {
        if (h === 'tx_id')    return uid();
        if (h === 'datetime') return nowStr;
        const tx = { item_code: item.item_code, action: 'withdraw', qty_before: item.qty, qty_change: -req.qty, qty_after: newQty, by_user: currentUser.full_name, for_whom: payload.for_whom, job_ref: payload.job_ref, notes: payload.notes, item_category: item.category };
        return tx[h] || '';
      }));
    }
  }

  await batchUpdate(TABS.ITEMS, itemUpdates);
  await appendRows(TABS.TRANSACTIONS, txRows);
  clearCache(TABS.ITEMS);
  clearCache(TABS.TRANSACTIONS);
  return { success: true };
}

async function processReturn(payload, currentUser) {
  const item    = await getItem(payload.item_code);
  const headers = await getHeaders(TABS.ITEMS);

  if (item.category === 'asset') {
    await updateCell(TABS.ITEMS, item._row, headers.indexOf('status') + 1, 'available');
    await recordTransaction({ ...payload, action: 'return', qty_before: 1, qty_change: 0, qty_after: 1, by_user: currentUser.full_name, item_category: item.category });
  } else {
    const newQty = (Number(item.qty) || 0) + Number(payload.qty);
    await batchUpdate(TABS.ITEMS, [
      { row: item._row, col: headers.indexOf('qty') + 1,    value: newQty },
      { row: item._row, col: headers.indexOf('status') + 1, value: 'in_stock' },
    ]);
    await recordTransaction({ ...payload, action: 'return', qty_before: item.qty, qty_change: payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  }
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function processRestock(payload, currentUser) {
  const item    = await getItem(payload.item_code);
  const headers = await getHeaders(TABS.ITEMS);
  const newQty  = (Number(item.qty) || 0) + Number(payload.qty);
  await batchUpdate(TABS.ITEMS, [
    { row: item._row, col: headers.indexOf('qty') + 1,    value: newQty },
    { row: item._row, col: headers.indexOf('status') + 1, value: 'in_stock' },
  ]);
  await recordTransaction({ ...payload, action: 'restock', qty_before: item.qty, qty_change: payload.qty, qty_after: newQty, by_user: currentUser.full_name, item_category: item.category });
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function processAssignAsset(payload, currentUser) {
  const item    = await getItem(payload.asset_code);
  const headers = await getHeaders(TABS.ITEMS);
  await updateCell(TABS.ITEMS, item._row, headers.indexOf('status') + 1, 'assigned');
  await recordTransaction({ item_code: payload.asset_code, action: 'assign', qty_before: 1, qty_change: 0, qty_after: 1, by_user: currentUser.full_name, for_whom: payload.emp_name, item_category: item.category });
  clearCache(TABS.ITEMS);
  return { success: true };
}

async function listTransactions(filters = {}) {
  let data = await getSheetData(TABS.TRANSACTIONS);
  if (filters.action)    data = data.filter(d => d.action === filters.action);
  if (filters.item_code) data = data.filter(d => String(d.item_code) === String(filters.item_code));
  if (filters.from_date) data = data.filter(d => d.datetime && d.datetime >= filters.from_date);
  if (filters.to_date)   data = data.filter(d => d.datetime && d.datetime.slice(0,10) <= filters.to_date);
  if (filters.category)  data = data.filter(d => d.item_category === filters.category);
  if (filters.by_user)   data = data.filter(d => d.by_user === filters.by_user);

  const sorted = data.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const limit  = filters.limit ? Number(filters.limit) : 50;
  const sliced = sorted.slice(0, limit);

  // Join item_name
  const items   = await getSheetData(TABS.ITEMS);
  const itemMap = {};
  items.forEach(i => { itemMap[String(i.item_code)] = i.name || ''; });
  return sliced.map(tx => ({ ...tx, item_name: itemMap[String(tx.item_code)] || '' }));
}

async function getWorkerHoldings() {
  const items = await getSheetData(TABS.ITEMS);
  const txs   = await getSheetData(TABS.TRANSACTIONS);
  const result = {};

  const sortedTxs = [...txs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  items.forEach(item => {
    if ((item.category === 'asset' && item.status === 'assigned') ||
        (item.category === 'rental' && item.status === 'out')) {
      const lastTx = sortedTxs.find(t => String(t.item_code) === String(item.item_code) && (t.action === 'assign' || t.action === 'withdraw'));
      const worker = (lastTx && lastTx.for_whom) ? lastTx.for_whom : 'ไม่ระบุชื่อ';
      if (!result[worker]) result[worker] = [];
      result[worker].push(item);
    }
  });

  return Object.keys(result).sort().map(w => ({ worker_name: w, items: result[w] }));
}

async function listUsers() {
  const users = await getSheetData(TABS.USERS);
  return users.map(u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, active: u.active }));
}

async function addUser(data) {
  const headers = await getHeaders(TABS.USERS);
  const row = headers.map(h => {
    if (h === 'id')            return crypto.randomUUID();
    if (h === 'password_hash') return hashPw(data.password);
    if (h === 'active')        return 'TRUE';
    if (h === 'created_at')    return nowISO();
    return data[h] || '';
  });
  await appendRow(TABS.USERS, row);
  clearCache(TABS.USERS);
  return { success: true };
}

async function updateUser(data) {
  const users   = await getSheetData(TABS.USERS);
  const user    = users.find(u => u.id === data.user_id || u.username === data.username);
  if (!user) throw new Error('User not found');
  const headers = await getHeaders(TABS.USERS);
  const updates = [];
  for (const key in data) {
    if (key === 'user_id') continue;
    const idx = headers.indexOf(key);
    if (idx > -1) updates.push({ row: user._row, col: idx + 1, value: data[key] });
  }
  await batchUpdate(TABS.USERS, updates);
  clearCache(TABS.USERS);
  return { success: true };
}

async function resetPassword({ user_id, new_password }, currentUser) {
  if (currentUser.role !== 'Admin') throw new Error('Permission denied');
  const users   = await getSheetData(TABS.USERS);
  const user    = users.find(u => u.id === user_id);
  if (!user) throw new Error('User not found');
  const headers = await getHeaders(TABS.USERS);
  await updateCell(TABS.USERS, user._row, headers.indexOf('password_hash') + 1, hashPw(new_password));
  clearCache(TABS.USERS);
  return { success: true };
}

async function getSettings() {
  const rows   = await getSheetData(TABS.SETTINGS);
  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });
  return config;
}

async function updateSettings(settings) {
  const rows = await getSheetData(TABS.SETTINGS);
  for (const key in settings) {
    const row = rows.find(r => r.key === key);
    if (row) {
      await updateCell(TABS.SETTINGS, row._row, 2, settings[key]);
    } else {
      await appendRow(TABS.SETTINGS, [key, settings[key]]);
    }
  }
  clearCache(TABS.SETTINGS);
  return { success: true };
}

async function listWorkers() {
  const users = await getSheetData(TABS.USERS);
  return users.map(u => ({ full_name: u.full_name }));
}

async function generateReport(payload) {
  const type   = payload.report_type;
  const items  = await getSheetData(TABS.ITEMS);
  const txs    = await getSheetData(TABS.TRANSACTIONS);
  const catMap = { asset: 'ทรัพย์สิน', consumable: 'สิ้นเปลือง', gas: 'ลม/แก๊ส', rental: 'ของเช่า' };

  if (type === 'asset_by_person') {
    const sortedTxs = [...txs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    const result = {};
    items.forEach(item => {
      if ((item.category === 'asset' && item.status === 'assigned') || (item.category === 'rental' && item.status === 'out')) {
        const lastTx = sortedTxs.find(t => String(t.item_code) === String(item.item_code) && (t.action === 'assign' || t.action === 'withdraw'));
        const worker = (lastTx && lastTx.for_whom) ? lastTx.for_whom : 'ไม่ระบุชื่อ';
        if (!result[worker]) result[worker] = [];
        result[worker].push(item);
      }
    });
    const rows = [];
    Object.keys(result).sort().forEach(w => result[w].forEach(i => rows.push([w, i.item_code, i.name, catMap[i.category] || i.category])));
    return { headers: ['ผู้รับผิดชอบ / ช่าง', 'รหัสสินค้า', 'ชื่อรายการ', 'ประเภท'], rows };
  }

  if (type === 'stock_all') {
    return { headers: ['รหัส', 'ชื่อ', 'หมวดหมู่', 'คงเหลือ', 'หน่วย'], rows: items.map(i => [i.item_code, i.name, catMap[i.category] || i.category, i.qty || 0, i.unit || '']) };
  }

  if (type === 'low_stock') {
    const rows = items.filter(i => ['consumable', 'gas'].includes(i.category) && (Number(i.qty) || 0) <= (Number(i.reorder_point) || 0)).map(i => [i.item_code, i.name, i.qty || 0, i.reorder_point || 0]);
    return { headers: ['รหัส', 'ชื่อ', 'คงเหลือ', 'จุดสั่งซื้อ'], rows };
  }

  if (type === 'monthly_summary') {
    const month = payload.month || new Date().toISOString().slice(0, 7);
    const rows = txs.filter(t => t.datetime && t.datetime.startsWith(month)).map(t => [t.datetime.split('T')[0], t.action, t.item_code, t.qty_change, t.by_user, t.for_whom || '']);
    return { headers: ['วันที่', 'ประเภทรายการ', 'รหัส', 'จำนวน', 'ผู้ทำรายการ', 'ช่าง'], rows };
  }

  if (type === 'overdue_rental') {
    const today = new Date().toISOString().split('T')[0];
    const rows  = items.filter(i => i.category === 'rental' && i.status === 'out' && i.due_date && i.due_date < today).map(i => [i.item_code, i.name, i.qty || 0, i.rent_date || '', i.due_date || '']);
    return { headers: ['รหัส', 'ชื่อ', 'จำนวน', 'วันเช่า', 'ครบกำหนด'], rows };
  }

  return { headers: ['รหัส', 'ชื่อ', 'คงเหลือ'], rows: items.map(i => [i.item_code, i.name, i.qty]) };
}
