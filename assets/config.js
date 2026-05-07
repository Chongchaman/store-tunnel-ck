// ============================================================
// config.js — ค่าคงที่ของระบบ + URL ของ Apps Script
// ============================================================

const CONFIG = {
  // ── Google Apps Script URL (เปลี่ยนหลัง Deploy) ──
  API_URL: 'https://script.google.com/macros/s/AKfycbzMyU20yu_2wxXbvgeYlpysFlexeeq43_qreAXIUnH3bLCA424WMCg36j_X6hb-RSzj/exec',

  // ── ข้อมูลไซต์ ──
  APP_NAME: 'STORE TUNNEL CK',
  APP_SUBTITLE: 'ระบบจัดการสโตร์ไซต์งานก่อสร้าง',

  // ── Design Tokens ──
  COLORS: {
    primary: '#FF6B35',
    primaryDark: '#E55A2B',
    primaryLight: '#FF8F66',
    secondary: '#1E40AF',
    secondaryLight: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    gray: '#6B7280',
    grayLight: '#F3F4F6',
    white: '#FFFFFF',
    dark: '#1F2937',
  },

  // ── Session ──
  TOKEN_KEY: 'stc_session',
  TOKEN_EXPIRY_DAYS: 7,

  // ── Roles ──
  ROLES: {
    ADMIN: 'Admin',
    STORE: 'Store',
    WORKER: 'Worker',
  },

  // ── Item Categories ──
  CATEGORIES: {
    RENTAL: 'rental',
    ASSET: 'asset',
    CONSUMABLE: 'consumable',
    GAS: 'gas',
  },

  CATEGORY_LABELS: {
    rental: 'ของเช่า',
    asset: 'ทรัพย์สิน',
    consumable: 'สิ้นเปลือง',
    gas: 'ถังแก๊ส/ลม',
  },

  CATEGORY_ICONS: {
    rental: 'package-check',
    asset: 'hard-hat',
    consumable: 'boxes',
    gas: 'cylinder',
  },

  CATEGORY_COLORS: {
    rental: '#3B82F6',
    asset: '#8B5CF6',
    consumable: '#10B981',
    gas: '#F59E0B',
  },

  // ── Rental Statuses ──
  RENTAL_STATUSES: {
    IN_STOCK: 'in_stock',
    OUT: 'out',
    RETURNED: 'returned',
    OVERDUE: 'overdue',
  },

  // ── Asset Statuses ──
  ASSET_STATUSES: {
    ASSIGNED: 'assigned',
    AVAILABLE: 'available',
    LOST: 'lost',
    DAMAGED: 'damaged',
  },

  // ── Gas Types ──
  GAS_TYPES: {
    air: 'ลมอัด',
    oxygen: 'ออกซิเจน',
    lpg: 'LPG',
    acetylene: 'อะเซทิลีน',
    argon: 'อาร์กอน',
    co2: 'CO₂',
    other: 'อื่นๆ',
  },

  // ── Gas Levels ──
  GAS_LEVELS: {
    full: 'เต็ม',
    in_use: 'กำลังใช้',
    empty: 'หมด',
  },

  // ── Tank/Gas Statuses ──
  GAS_STATUSES: {
    in_stock: 'ในสโตร์',
    out: 'ส่งออก',
    returned: 'คืนแล้ว',
  },

  // ── Transaction Actions ──
  ACTIONS: {
    ADD: 'add',
    WITHDRAW: 'withdraw',
    RETURN: 'return',
    EDIT: 'edit',
    DELETE: 'delete',
    RESTOCK: 'restock',
    ASSIGN: 'assign',
  },

  ACTION_LABELS: {
    add: 'เพิ่ม',
    withdraw: 'เบิก',
    return: 'คืน',
    edit: 'แก้ไข',
    delete: 'ลบ',
    restock: 'เติม',
    assign: 'มอบหมาย',
  },

  ACTION_COLORS: {
    add: '#10B981',
    withdraw: '#EF4444',
    return: '#3B82F6',
    edit: '#F59E0B',
    delete: '#6B7280',
    restock: '#8B5CF6',
    assign: '#EC4899',
  },

  // ── Status Labels (ภาษาไทย) ──
  STATUS_LABELS: {
    in_stock: 'ในสต็อก',
    out: 'ส่งออก',
    returned: 'คืนแล้ว',
    overdue: 'เกินกำหนด',
    assigned: 'มอบหมายแล้ว',
    available: 'พร้อมใช้',
    lost: 'สูญหาย',
    damaged: 'ชำรุด',
  },

  STATUS_COLORS: {
    in_stock: '#10B981',
    out: '#F59E0B',
    returned: '#3B82F6',
    overdue: '#EF4444',
    assigned: '#8B5CF6',
    available: '#10B981',
    lost: '#EF4444',
    damaged: '#F97316',
  },

  // ── Bottom Nav Items ──
  NAV_ITEMS: [
    { id: 'home', icon: 'home', label: 'หน้าหลัก', href: 'dashboard.html' },
    { id: 'items', icon: 'package', label: 'รายการ', href: 'items.html' },
    { id: 'scan', icon: 'scan-line', label: 'สแกน', href: 'scan.html', fab: true },
    { id: 'history', icon: 'history', label: 'ประวัติ', href: 'transactions.html' },
    { id: 'profile', icon: 'user', label: 'โปรไฟล์', href: 'settings.html' },
  ],

  // ── Defaults ──
  DEFAULT_REORDER_POINT: 5,
  DEFAULT_RENTAL_DUE_ALERT_DAYS: 3,
  LOW_STOCK_ALERT_DAYS: 7,
  PAGE_SIZE: 20,
};

// ── ป้องกันการแก้ไข config ──
Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.ROLES);
Object.freeze(CONFIG.CATEGORIES);
