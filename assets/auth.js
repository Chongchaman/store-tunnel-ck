// ============================================================
// auth.js — ระบบ Login / Session / Permission Guard
// ============================================================

const Auth = {
  /**
   * Login — ส่ง username + password ไป verify กับ backend
   * @returns {Promise<{ok, data?, error?}>}
   */
  async login(username, password) {
    const result = await API.login(username, password);
    if (result.ok && result.data) {
      // เก็บ session ลง localStorage
      const session = {
        token: result.data.token,
        user: result.data.user,
        loginAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CONFIG.TOKEN_EXPIRY_DAYS * 86400000).toISOString(),
      };
      localStorage.setItem(CONFIG.TOKEN_KEY, JSON.stringify(session));
    }
    return result;
  },

  /**
   * Logout — ล้าง session + redirect ไปหน้า login
   */
  logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    window.location.href = 'index.html';
  },

  /**
   * ดึง session ปัจจุบัน
   * @returns {object|null} - {token, user: {id, username, full_name, role}, loginAt, expiresAt}
   */
  getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.TOKEN_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);

      // ตรวจสอบ token หมดอายุ
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      return null;
    }
  },

  /**
   * ดึงข้อมูล user จาก session
   * @returns {object|null}
   */
  getUser() {
    const session = this.getSession();
    return session ? session.user : null;
  },

  /**
   * ตรวจสอบ role
   * @param {string} role - 'Admin', 'Store', 'Worker'
   * @returns {boolean}
   */
  isRole(role) {
    const user = this.getUser();
    return user ? user.role === role : false;
  },

  /**
   * ตรวจสอบว่า user มี role อยู่ใน list ที่อนุญาตหรือไม่
   * @param {string[]} allowedRoles
   * @returns {boolean}
   */
  hasRole(allowedRoles) {
    const user = this.getUser();
    return user ? allowedRoles.includes(user.role) : false;
  },

  /**
   * Guard — บังคับ login ก่อนเข้าหน้า
   * ถ้าไม่มี session หรือ role ไม่ตรง → redirect ไป login
   * @param {string[]} allowedRoles - role ที่อนุญาต (default: ทุก role)
   */
  requireAuth(allowedRoles = ['Admin', 'Store', 'Worker']) {
    const session = this.getSession();

    if (!session) {
      window.location.href = 'index.html';
      return false;
    }

    if (!allowedRoles.includes(session.user.role)) {
      UI.showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
      window.location.href = 'dashboard.html';
      return false;
    }

    return true;
  },

  /**
   * ตรวจสอบว่ามี session อยู่แล้วหรือยัง (ใช้ในหน้า login)
   * ถ้ามี → redirect ไป dashboard
   * @returns {boolean} true ถ้ามี session
   */
  checkExistingSession() {
    const session = this.getSession();
    if (session) {
      window.location.href = 'dashboard.html';
      return true;
    }
    return false;
  },

  /**
   * Permission check — ดูว่า user ทำ action นี้ได้ไหม
   * @param {string} feature - เช่น 'add_item', 'withdraw', 'manage_users'
   * @returns {boolean}
   */
  canAccess(feature) {
    const user = this.getUser();
    if (!user) return false;

    const { role } = user;
    const permissions = {
      view_items:       ['Admin', 'Store', 'Worker'],
      search_scan:      ['Admin', 'Store', 'Worker'],
      add_item:         ['Admin', 'Store'],
      edit_item:        ['Admin', 'Store'],
      delete_item:      ['Admin', 'Store'],
      withdraw:         ['Admin', 'Store'],
      return_rental:    ['Admin', 'Store'],
      view_transactions:['Admin', 'Store', 'Worker'],
      reports:          ['Admin', 'Store'],
      manage_users:     ['Admin'],
      settings:         ['Admin'],
    };

    const allowed = permissions[feature];
    return allowed ? allowed.includes(role) : false;
  },
};
