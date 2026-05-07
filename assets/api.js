// ============================================================
// api.js — ฟังก์ชันเรียก Google Apps Script API
// ============================================================

const API = {
  /**
   * เรียก Apps Script API กลาง
   * @param {string} action - ชื่อ action เช่น 'login', 'list_items'
   * @param {object} payload - ข้อมูลที่ส่งไป
   * @param {object} options - ตัวเลือกเพิ่มเติม
   * @returns {Promise<object>} - {ok, data} หรือ {ok: false, error}
   */
  async call(action, payload = {}, options = {}) {
    const { timeout = 30000, requireAuth = true } = options;

    // ── แนบ token อัตโนมัติ ──
    const body = { action, payload };
    if (requireAuth) {
      const session = Auth.getSession();
      if (session && session.token) {
        body.token = session.token;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script ไม่รับ application/json ตรงๆ ผ่าน CORS
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'follow', // Apps Script redirect หลัง deploy
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { ok: false, error: 'หมดเวลาเชื่อมต่อ กรุณาลองใหม่' };
      }

      console.error(`API Error [${action}]:`, err);
      return { ok: false, error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  },

  // ════════════════════════════════════════
  // Auth
  // ════════════════════════════════════════
  login(username, password) {
    return this.call('login', { username, password }, { requireAuth: false });
  },

  verifyToken(token) {
    return this.call('verify_token', { token });
  },

  // ════════════════════════════════════════
  // Items
  // ════════════════════════════════════════
  listItems(params = {}) {
    return this.call('list_items', params);
  },

  getItem(itemCode) {
    return this.call('get_item', { item_code: itemCode });
  },

  addItem(category, fields) {
    return this.call('add_item', { category, ...fields });
  },

  updateItem(itemCode, fields) {
    return this.call('update_item', { item_code: itemCode, ...fields });
  },

  deleteItem(itemCode) {
    return this.call('delete_item', { item_code: itemCode });
  },

  // ════════════════════════════════════════
  // Stock Operations
  // ════════════════════════════════════════
  withdraw(itemCode, qty, forWhom, jobRef, notes) {
    return this.call('withdraw', {
      item_code: itemCode,
      qty,
      for_whom: forWhom,
      job_ref: jobRef,
      notes,
    });
  },

  returnRental(itemCode, qty, returnDate, condition, notes) {
    return this.call('return_rental', {
      item_code: itemCode,
      qty,
      return_date: returnDate,
      condition,
      notes,
    });
  },

  restock(itemCode, qty, notes) {
    return this.call('restock', { item_code: itemCode, qty, notes });
  },

  assignAsset(assetCode, empId, empName) {
    return this.call('assign_asset', {
      asset_code: assetCode,
      emp_id: empId,
      emp_name: empName,
    });
  },

  // ════════════════════════════════════════
  // Transactions
  // ════════════════════════════════════════
  listTransactions(filters = {}) {
    return this.call('list_transactions', { filters });
  },

  // ════════════════════════════════════════
  // Alerts & Reports
  // ════════════════════════════════════════
  getAlerts() {
    return this.call('get_alerts', {});
  },

  getReport(reportType, params = {}) {
    return this.call('get_report', { report_type: reportType, ...params });
  },

  getDashboardSummary() {
    return this.call('get_dashboard_summary', {});
  },

  // ════════════════════════════════════════
  // Users (Admin only)
  // ════════════════════════════════════════
  listUsers() {
    return this.call('list_users', {});
  },

  addUser(userData) {
    return this.call('add_user', userData);
  },

  updateUser(userId, userData) {
    return this.call('update_user', { user_id: userId, ...userData });
  },

  resetPassword(userId, newPassword) {
    return this.call('reset_password', { user_id: userId, new_password: newPassword });
  },

  // ════════════════════════════════════════
  // Settings
  // ════════════════════════════════════════
  getSettings() {
    return this.call('get_settings', {});
  },

  updateSettings(settings) {
    return this.call('update_settings', settings);
  },

  // ════════════════════════════════════════
  // Scan / Lookup
  // ════════════════════════════════════════
  lookupBarcode(barcodeValue) {
    return this.call('lookup_barcode', { barcode_value: barcodeValue });
  },

  // ════════════════════════════════════════
  // Workers list (สำหรับ dropdown เบิกของ)
  // ════════════════════════════════════════
  listWorkers() {
    return this.call('list_workers', {});
  },
};
