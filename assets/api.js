// ============================================================
// api.js — ฟังก์ชันเรียก Google Apps Script API
// [OPTIMIZED] — warmup ping + localStorage cache 5 นาที
// ============================================================

const _READ_ACTIONS  = ['list_items','get_item','get_alerts','get_dashboard_summary','get_settings','list_workers'];
const _WRITE_ACTIONS = ['add_item','update_item','delete_item','withdraw','return_rental','restock','assign_asset'];
const _CACHE_TTL_MS  = 5 * 60 * 1000; // 5 นาที

function _cacheKey(action, payload) {
  return `apicache_${action}_${JSON.stringify(payload)}`;
}

function _clearAllCache() {
  Object.keys(localStorage).filter(k => k.startsWith('apicache_')).forEach(k => localStorage.removeItem(k));
}

// เรียกตอน page โหลด เพื่อ wake-up Apps Script ไว้ก่อน
function warmupAPI() {
  fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'ping' })
  }).catch(() => {});
}

const API = {
  async call(action, payload = {}, options = {}) {
    const { timeout = 30000, requireAuth = true } = options;
    const key = _cacheKey(action, payload);

    // คืนจาก cache ถ้าเป็น read action และยังไม่หมดอายุ
    if (_READ_ACTIONS.includes(action)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const { data, ts } = JSON.parse(raw);
          if (Date.now() - ts < _CACHE_TTL_MS) return { ok: true, data };
        }
      } catch(e) {}
    }

    const body = { action, payload };
    if (requireAuth) {
      const session = Auth.getSession();
      if (session?.token) body.token = session.token;
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      // เก็บ cache สำหรับ read
      if (_READ_ACTIONS.includes(action) && result.ok) {
        try { localStorage.setItem(key, JSON.stringify({ data: result.data, ts: Date.now() })); } catch(e) {}
      }
      // เคลียร์ cache เมื่อ write สำเร็จ
      if (_WRITE_ACTIONS.includes(action) && result.ok) _clearAllCache();

      return result;

    } catch (err) {
      clearTimeout(tid);
      if (err.name === 'AbortError') return { ok: false, error: 'หมดเวลาเชื่อมต่อ กรุณาลองใหม่' };
      console.error(`API Error [${action}]:`, err);
      return { ok: false, error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  },

  login(u, p)          { return this.call('login', { username: u, password: p }, { requireAuth: false }); },
  verifyToken(t)       { return this.call('verify_token', { token: t }); },
  listItems(p = {})    { return this.call('list_items', p); },
  getItem(code)        { return this.call('get_item', { item_code: code }); },
  addItem(cat, fields) { return this.call('add_item', { category: cat, ...fields }); },
  updateItem(code, f)  { return this.call('update_item', { item_code: code, ...f }); },
  deleteItem(code)     { return this.call('delete_item', { item_code: code }); },
  withdraw(code, qty, forWhom, jobRef, notes) { return this.call('withdraw', { item_code: code, qty, for_whom: forWhom, job_ref: jobRef, notes }); },
  returnRental(code, qty, date, cond, notes) { return this.call('return_rental', { item_code: code, qty, return_date: date, condition: cond, notes }); },
  restock(code, qty, notes)      { return this.call('restock', { item_code: code, qty, notes }); },
  assignAsset(code, empId, name) { return this.call('assign_asset', { asset_code: code, emp_id: empId, emp_name: name }); },
  listTransactions(f = {})       { return this.call('list_transactions', { filters: f }); },
  getAlerts()                    { return this.call('get_alerts', {}); },
  getReport(type, p = {})        { return this.call('get_report', { report_type: type, ...p }); },
  getDashboardSummary()          { return this.call('get_dashboard_summary', {}); },
  listUsers()                    { return this.call('list_users', {}); },
  addUser(d)                     { return this.call('add_user', d); },
  updateUser(id, d)              { return this.call('update_user', { user_id: id, ...d }); },
  resetPassword(id, pw)          { return this.call('reset_password', { user_id: id, new_password: pw }); },
  getSettings()                  { return this.call('get_settings', {}); },
  updateSettings(s)              { return this.call('update_settings', s); },
  lookupBarcode(v)               { return this.call('lookup_barcode', { barcode_value: v }); },
  listWorkers()                  { return this.call('list_workers', {}); },
};

// Warmup ทุกหน้าที่โหลด
document.addEventListener('DOMContentLoaded', warmupAPI);
