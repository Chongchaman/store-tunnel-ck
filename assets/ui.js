// ============================================================
// ui.js — Shared UI Components (Toast, Modal, Nav, Cards, etc.)
// ============================================================

const UI = {
  // ════════════════════════════════════════
  // Toast Notification
  // ════════════════════════════════════════
  showToast(message, type = 'info', duration = 3000) {
    const colors = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };

    // ลบ toast เดิม
    document.querySelectorAll('.stc-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'stc-toast';
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:12px 20px;background:${colors[type]};color:#fff;
        border-radius:12px;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.15);
        max-width:90vw;margin:0 auto;animation:slideUp .3s ease">
        <i data-lucide="${icons[type]}" style="width:20px;height:20px;flex-shrink:0"></i>
        <span>${message}</span>
      </div>`;
    toast.style.cssText = 'position:fixed;bottom:80px;left:0;right:0;z-index:9999;text-align:center;padding:0 16px';
    document.body.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, duration);
  },

  // ════════════════════════════════════════
  // Confirmation Modal
  // ════════════════════════════════════════
  showModal(title, message, onConfirm, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
    document.querySelectorAll('.stc-modal-overlay').forEach(m => m.remove());
    const overlay = document.createElement('div');
    overlay.className = 'stc-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1F2937">${title}</h3>
        <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.5">${message}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="stc-modal-cancel" style="padding:10px 20px;border-radius:10px;border:1px solid #E5E7EB;background:#fff;font-size:14px;font-weight:500;cursor:pointer;color:#6B7280">${cancelText}</button>
          <button class="stc-modal-confirm" style="padding:10px 20px;border-radius:10px;border:none;background:#EF4444;color:#fff;font-size:14px;font-weight:600;cursor:pointer">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.stc-modal-cancel').onclick = () => overlay.remove();
    overlay.querySelector('.stc-modal-confirm').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  },

  // ════════════════════════════════════════
  // Skeleton Loader
  // ════════════════════════════════════════
  showSkeleton(container, count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="skeleton-card"><div class="skeleton-line w-40"></div><div class="skeleton-line w-70"></div><div class="skeleton-line w-55"></div></div>`;
    }
    container.innerHTML = html;
  },

  hideSkeleton(container) {
    container.querySelectorAll('.skeleton-card').forEach(el => el.remove());
  },

  // ════════════════════════════════════════
  // Page Header
  // ════════════════════════════════════════
  renderHeader(title, showBack = true) {
    const user = Auth.getUser();
    return `
    <header class="page-header">
      <div class="header-left">
        ${showBack ? `<button onclick="history.back()" class="btn-icon"><i data-lucide="arrow-left"></i></button>` : ''}
        <h1 class="header-title">${title}</h1>
      </div>
      <div class="header-right">
        ${user ? `<span class="header-user">${user.full_name}</span>
        <button onclick="Auth.logout()" class="btn-icon" title="ออกจากระบบ"><i data-lucide="log-out"></i></button>` : ''}
      </div>
    </header>`;
  },

  // ════════════════════════════════════════
  // Bottom Navigation
  // ════════════════════════════════════════
  renderBottomNav(activePage = '') {
    const items = CONFIG.NAV_ITEMS;
    let html = '<nav class="bottom-nav">';
    items.forEach(item => {
      const isActive = activePage === item.id;
      if (item.fab) {
        html += `<a href="${item.href}" class="nav-item nav-fab" title="${item.label}">
          <div class="fab-circle"><i data-lucide="${item.icon}"></i></div>
          <span>${item.label}</span></a>`;
      } else {
        html += `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}" title="${item.label}">
          <i data-lucide="${item.icon}"></i><span>${item.label}</span></a>`;
      }
    });
    html += '</nav>';
    return html;
  },

  // ════════════════════════════════════════
  // Status Badge
  // ════════════════════════════════════════
  renderBadge(status) {
    const label = CONFIG.STATUS_LABELS[status] || status;
    const color = CONFIG.STATUS_COLORS[status] || '#6B7280';
    return `<span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30">${label}</span>`;
  },

  // ════════════════════════════════════════
  // Action Badge
  // ════════════════════════════════════════
  renderActionBadge(action) {
    const label = CONFIG.ACTION_LABELS[action] || action;
    const color = CONFIG.ACTION_COLORS[action] || '#6B7280';
    return `<span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30">${label}</span>`;
  },

  // ════════════════════════════════════════
  // Item Card (ใช้ในหน้า items.html)
  // ════════════════════════════════════════
  renderItemCard(item) {
    const catLabel = CONFIG.CATEGORY_LABELS[item.category] || item.category;
    const catColor = CONFIG.CATEGORY_COLORS[item.category] || '#6B7280';
    const statusHtml = item.status ? UI.renderBadge(item.status) : '';
    const qtyText = item.qty !== undefined ? `จำนวน: ${item.qty} ${item.unit || ''}` : '';

    return `
    <a href="item-detail.html?code=${encodeURIComponent(item.item_code)}" class="item-card md:hidden">
      <div class="item-card-img">
        ${item.photo_url ? `<img src="${item.photo_url}" alt="${item.name}" loading="lazy">` : `<i data-lucide="${CONFIG.CATEGORY_ICONS[item.category] || 'package'}"></i>`}
      </div>
      <div class="item-card-body">
        <div class="item-card-top">
          <span class="item-code">${item.item_code}</span>
          <span class="cat-badge" style="background:${catColor}15;color:${catColor}">${catLabel}</span>
        </div>
        <h3 class="item-name">${item.name}</h3>
        <div class="item-card-bottom">
          <span class="item-qty">${qtyText}</span>
          ${statusHtml}
        </div>
      </div>
    </a>`;
  },

  // ════════════════════════════════════════
  // Item Table Row (ใช้ในจอใหญ่)
  // ════════════════════════════════════════
  renderItemsTable(itemsList) {
    return `
    <div class="hidden md:block overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-400 uppercase">
            <th class="px-6 py-4">รหัส</th>
            <th class="px-6 py-4">ชื่อ</th>
            <th class="px-6 py-4">หมวดหมู่</th>
            <th class="px-6 py-4">จำนวนคงเหลือ</th>
            <th class="px-6 py-4">สถานะ</th>
            <th class="px-6 py-4 text-right">การจัดการ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-sm text-gray-700">
          ${itemsList.map(item => {
            const catLabel = CONFIG.CATEGORY_LABELS[item.category] || item.category;
            const catColor = CONFIG.CATEGORY_COLORS[item.category] || '#6B7280';
            const statusHtml = item.status ? UI.renderBadge(item.status) : '-';
            const qtyText = item.qty !== undefined ? `${item.qty} ${item.unit || ''}` : '-';

            return `
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 font-mono text-xs text-gray-500">${item.item_code}</td>
              <td class="px-6 py-4 font-semibold text-gray-800">${item.name}</td>
              <td class="px-6 py-4">
                <span class="cat-badge" style="background:${catColor}15;color:${catColor}">${catLabel}</span>
              </td>
              <td class="px-6 py-4 font-medium">${qtyText}</td>
              <td class="px-6 py-4">${statusHtml}</td>
              <td class="px-6 py-4 text-right">
                <a href="item-detail.html?code=${encodeURIComponent(item.item_code)}" class="text-primary hover:text-primary-dark font-bold">ดูรายละเอียด →</a>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // ════════════════════════════════════════
  // Empty State
  // ════════════════════════════════════════
  renderEmptyState(message = 'ไม่พบข้อมูล', ctaText = '', ctaHref = '') {
    return `
    <div class="empty-state">
      <i data-lucide="inbox" style="width:64px;height:64px;color:#D1D5DB"></i>
      <p>${message}</p>
      ${ctaText ? `<a href="${ctaHref}" class="btn btn-primary">${ctaText}</a>` : ''}
    </div>`;
  },

  // ════════════════════════════════════════
  // Format Helpers
  // ════════════════════════════════════════
  formatDate(dateStr) {
    if (!dateStr) return '-';
    return dayjs(dateStr).locale('th').format('D MMM BB');  // ใช้ plugin buddhistEra
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return dayjs(dateStr).locale('th').format('D MMM BB HH:mm');
  },

  formatNumber(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('th-TH');
  },

  formatCurrency(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
  },

  // ════════════════════════════════════════
  // Loading Button State
  // ════════════════════════════════════════
  setBtnLoading(btn, loading = true) {
    if (loading) {
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> กำลังดำเนินการ...';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.origText || btn.innerHTML;
      btn.disabled = false;
    }
  },

  // ════════════════════════════════════════
  // Desktop Sidebar
  // ════════════════════════════════════════
  renderDesktopSidebar(activePage = '') {
    const items = CONFIG.NAV_ITEMS;
    const user = Auth.getUser();
    
    let html = `
    <aside class="desktop-sidebar">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;padding-left:8px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FF6B35,#E55A2B);display:flex;align-items:center;justify-content:center">
          <i data-lucide="hard-hat" style="width:20px;height:20px;color:#fff"></i>
        </div>
        <div>
          <h2 style="font-size:14px;font-weight:700;color:#1F2937;line-height:1.2">STORE TUNNEL CK</h2>
          <span style="font-size:11px;color:#9CA3AF">${user ? user.role : ''}</span>
        </div>
      </div>
      <div style="flex:1">`;

    items.forEach(item => {
      const isActive = activePage === item.id;
      html += `
        <a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" title="${item.label}">
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </a>`;
    });

    html += `
      </div>
      <div style="border-top:1px solid #F3F4F6;padding-top:16px;margin-top:auto">
        <div style="display:flex;align-items:center;justify-content:between;gap:10px;padding:0 8px">
          <div style="min-width:0;flex:1">
            <p style="font-size:12px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user ? user.full_name : ''}</p>
            <p style="font-size:10px;color:#9CA3AF">${user ? '@'+user.username : ''}</p>
          </div>
          <button onclick="Auth.logout()" class="btn-icon" title="ออกจากระบบ" style="width:32px;height:32px"><i data-lucide="log-out" style="width:16px;height:16px"></i></button>
        </div>
      </div>
    </aside>`;
    return html;
  },

  // ════════════════════════════════════════
  // Init Page — เรียกทุกหน้า
  // ════════════════════════════════════════
  initPage(activePage) {
    // ใส่ Bottom Nav (สำหรับจอมือถือ)
    const navContainer = document.getElementById('bottom-nav');
    if (navContainer) {
      navContainer.innerHTML = this.renderBottomNav(activePage);
    }

    // ใส่ Desktop Sidebar (สำหรับจอคอม)
    let sidebarContainer = document.getElementById('desktop-sidebar-container');
    if (!sidebarContainer) {
      sidebarContainer = document.createElement('div');
      sidebarContainer.id = 'desktop-sidebar-container';
      document.body.prepend(sidebarContainer);
    }
    sidebarContainer.innerHTML = this.renderDesktopSidebar(activePage);

    // Init Lucide Icons
    if (window.lucide) lucide.createIcons();
  },
};
