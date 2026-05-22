// ============================================================
// app.js — Business Logic + Page Init Helpers
// ============================================================

const App = {
  // ════════════════════════════════════════
  // Dashboard
  // ════════════════════════════════════════
  async loadDashboard() {
    const summaryGrid = document.getElementById('summary-grid');
    const alertSection = document.getElementById('alert-section');

    UI.showSkeleton(summaryGrid, 4);

    // ดึงข้อมูลสรุป (ได้ทั้ง summary และ alerts มาพร้อมกัน)
    const res = await API.getDashboardSummary();
    if (!res.ok) {
      UI.showToast(res.error || 'โหลดข้อมูลไม่สำเร็จ', 'error');
      return;
    }

    const d = res.data;

    // render summary cards
    summaryGrid.innerHTML = `
      ${this.summaryCard('ของเช่า', d.summary?.rental_total || 0, 'package-check', CONFIG.CATEGORY_COLORS.rental)}
      ${this.summaryCard('ทรัพย์สิน', d.summary?.asset_total || 0, 'hard-hat', CONFIG.CATEGORY_COLORS.asset)}
      ${this.summaryCard('สิ้นเปลือง', d.summary?.consumable_types || 0, 'boxes', CONFIG.CATEGORY_COLORS.consumable)}
      ${this.summaryCard('ถังแก๊ส/ลม', d.summary?.gas_total || 0, 'cylinder', CONFIG.CATEGORY_COLORS.gas)}
    `;
    lucide.createIcons();

    // แสดง alerts จากข้อมูลที่ได้มาพร้อมกัน
    if (d.alerts && d.alerts.length > 0) {
      this.renderAlerts(alertSection, d.alerts);
    } else {
      alertSection.innerHTML = '';
    }
  },

  summaryCard(label, count, icon, color) {
    return `
    <div class="summary-card" style="border-left:4px solid ${color}">
      <div class="summary-icon" style="background:${color}15;color:${color}">
        <i data-lucide="${icon}"></i>
      </div>
      <div class="summary-info">
        <span class="summary-count">${UI.formatNumber(count)}</span>
        <span class="summary-label">${label}</span>
      </div>
    </div>`;
  },

  renderAlerts(container, alerts) {
    if (!alerts || alerts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const dangerCount  = alerts.filter(a => a.type === 'danger').length;
    const warningCount = alerts.filter(a => a.type !== 'danger').length;

    // แสดงแค่ banner สรุป + ปุ่มไปหน้า alerts.html
    container.innerHTML = `
      <a href="alerts.html" class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 hover:bg-red-100 transition-colors active:scale-95 transform duration-150">
        <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <i data-lucide="bell-ring" class="w-5 h-5 text-red-500"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-red-700">มีการแจ้งเตือน ${alerts.length} รายการ</p>
          <p class="text-xs text-red-400 mt-0.5">
            ${dangerCount > 0  ? `🔴 วิกฤต ${dangerCount} ` : ''}${warningCount > 0 ? `🟡 เฝ้าระวัง ${warningCount}` : ''}
          </p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-red-400 flex-shrink-0"></i>
      </a>`;
    lucide.createIcons();
  },

  // ════════════════════════════════════════
  // Items List
  // ════════════════════════════════════════
  async loadItems(category = '', search = '') {
    const container = document.getElementById('items-list');
    UI.showSkeleton(container, 4);

    const res = await API.listItems({ category, search });
    if (!res.ok) {
      container.innerHTML = UI.renderEmptyState(res.error || 'โหลดข้อมูลไม่สำเร็จ');
      lucide.createIcons();
      return;
    }

    if (!res.data || res.data.length === 0) {
      container.innerHTML = UI.renderEmptyState('ไม่พบรายการ', 'เพิ่มรายการใหม่', 'add-item.html');
      lucide.createIcons();
      return;
    }

    container.innerHTML = res.data.map(item => UI.renderItemCard(item)).join('');
    lucide.createIcons();
  },

  // ════════════════════════════════════════
  // Item Detail
  // ════════════════════════════════════════
  async loadItemDetail(itemCode) {
    const container = document.getElementById('item-detail');
    UI.showSkeleton(container, 2);

    const res = await API.getItem(itemCode);
    if (!res.ok) {
      container.innerHTML = UI.renderEmptyState(res.error || 'ไม่พบรายการนี้');
      lucide.createIcons();
      return;
    }

    const item = res.data;
    this.renderItemDetail(container, item);
  },

  renderItemDetail(container, item) {
    const catLabel = CONFIG.CATEGORY_LABELS[item.category] || item.category;
    const canEdit = Auth.canAccess('edit_item');
    const canDelete = Auth.canAccess('delete_item');
    const canWithdraw = Auth.canAccess('withdraw');

    let detailFields = '';
    // ฟิลด์ตามประเภท
    if (item.category === 'rental') {
      detailFields = `
        <div class="detail-row"><span>จำนวน</span><span>${item.qty || 0} ${item.unit || ''}</span></div>
        <div class="detail-row"><span>บริษัทผู้ให้เช่า</span><span>${item.supplier_company || '-'}</span></div>
        <div class="detail-row"><span>ผู้ติดต่อ</span><span>${item.supplier_contact || '-'}</span></div>
        <div class="detail-row"><span>วันเช่า</span><span>${UI.formatDate(item.rent_date)}</span></div>
        <div class="detail-row"><span>ครบกำหนดคืน</span><span>${UI.formatDate(item.due_date)}</span></div>
        <div class="detail-row"><span>ค่าเช่า/วัน</span><span>${UI.formatCurrency(item.rate_per_day)}</span></div>
        <div class="detail-row"><span>สถานะ</span><span>${UI.renderBadge(item.status)}</span></div>`;
    } else if (item.category === 'asset') {
      detailFields = `
        <div class="detail-row"><span>รหัสทรัพย์สิน</span><span>${item.asset_code || '-'}</span></div>
        <div class="detail-row"><span>ผู้รับผิดชอบ</span><span>${item.assigned_to_name || '-'}</span></div>
        <div class="detail-row"><span>วันมอบหมาย</span><span>${UI.formatDate(item.assign_date)}</span></div>
        <div class="detail-row"><span>ราคาทุน</span><span>${UI.formatCurrency(item.cost)}</span></div>
        <div class="detail-row"><span>สถานะ</span><span>${UI.renderBadge(item.status)}</span></div>`;
    } else if (item.category === 'consumable') {
      detailFields = `
        <div class="detail-row"><span>จำนวนคงเหลือ</span><span>${item.qty || 0} ${item.unit || ''}</span></div>
        <div class="detail-row"><span>ราคา/หน่วย</span><span>${UI.formatCurrency(item.price_per_unit)}</span></div>
        <div class="detail-row"><span>จุดสั่งซื้อ</span><span>${item.reorder_point || '-'}</span></div>`;
    } else if (item.category === 'gas') {
      detailFields = `
        <div class="detail-row"><span>จำนวนคงเหลือ</span><span>${item.qty || 0} ${item.unit || ''}</span></div>
        <div class="detail-row"><span>รหัสถัง</span><span>${item.tank_code || '-'}</span></div>
        <div class="detail-row"><span>ชนิดแก๊ส</span><span>${CONFIG.GAS_TYPES[item.gas_type] || item.gas_type}</span></div>
        <div class="detail-row"><span>ขนาด</span><span>${item.size || '-'}</span></div>
        <div class="detail-row"><span>ระดับ</span><span>${CONFIG.GAS_LEVELS[item.level] || item.level}</span></div>
        <div class="detail-row"><span>จุดสั่งซื้อ</span><span>${item.reorder_point || '-'}</span></div>
        <div class="detail-row"><span>บริษัทเจ้าของ</span><span>${item.owner_company || '-'}</span></div>
        <div class="detail-row"><span>สถานะ</span><span>${UI.renderBadge(item.status)}</span></div>`;
    }

    container.innerHTML = `
      <div class="detail-header">
        ${item.photo_url ? `<img src="${item.photo_url}" alt="${item.name}" class="detail-photo">` : 
          `<div class="detail-photo-placeholder"><i data-lucide="${CONFIG.CATEGORY_ICONS[item.category] || 'package'}"></i></div>`}
        <div>
          <span class="cat-badge" style="background:${CONFIG.CATEGORY_COLORS[item.category]}15;color:${CONFIG.CATEGORY_COLORS[item.category]}">${catLabel}</span>
          <h2 class="detail-name">${item.name}</h2>
          <p class="detail-code">${item.item_code}</p>
        </div>
      </div>

      <div class="detail-qr" id="qr-container"></div>

      <div class="detail-fields">${detailFields}</div>

      ${item.notes ? `<div class="detail-notes"><strong>หมายเหตุ:</strong> ${item.notes}</div>` : ''}

      <div class="detail-actions">
        ${canEdit ? `<a href="add-item.html?edit=${encodeURIComponent(item.item_code)}" class="btn btn-secondary"><i data-lucide="edit-3"></i> แก้ไข</a>` : ''}
        ${canEdit && ['consumable','gas','rental'].includes(item.category) ? `<button onclick="App.showAdjustQtyModal('${item.item_code}', ${item.qty || 0})" class="btn btn-warning" style="background:#F59E0B;color:white;border:none;"><i data-lucide="sliders"></i> ปรับยอด</button>` : ''}
        ${canWithdraw && ['rental','consumable','gas'].includes(item.category) ? `<a href="withdraw.html?code=${encodeURIComponent(item.item_code)}" class="btn btn-primary"><i data-lucide="package-minus"></i> เบิก</a>` : ''}
        ${canEdit && ['consumable','gas'].includes(item.category) ? `<a href="restock.html?code=${encodeURIComponent(item.item_code)}" class="btn btn-success" style="background:#10B981;color:white;border:none;"><i data-lucide="package-plus"></i> รับเข้า (Restock)</a>` : ''}
        ${canWithdraw && item.category === 'asset' ? `<button onclick="App.showAssignModal('${item.item_code}')" class="btn btn-primary"><i data-lucide="user-plus"></i> มอบหมาย</button>` : ''}
        ${canWithdraw && ((item.category === 'rental' && item.status === 'out') || (item.category === 'asset' && item.status === 'assigned')) ? `<a href="return.html?code=${encodeURIComponent(item.item_code)}" class="btn btn-success"><i data-lucide="package-plus"></i> คืนของ</a>` : ''}
        ${canDelete ? `<button onclick="App.confirmDelete('${item.item_code}')" class="btn btn-danger"><i data-lucide="trash-2"></i> ลบ</button>` : ''}
      </div>

      <div class="detail-history" id="item-history">
        <h3 class="section-title"><i data-lucide="history"></i> ประวัติล่าสุด</h3>
        <div id="history-list"></div>
      </div>`;

    lucide.createIcons();

    // Generate QR
    if (window.QRCode) {
      new QRCode(document.getElementById('qr-container'), {
        text: item.barcode_value || item.item_code,
        width: 180, height: 180,
        colorDark: '#1F2937', colorLight: '#ffffff',
      });
    }

    // โหลดประวัติ
    this.loadItemHistory(item.item_code);
  },

  async loadItemHistory(itemCode) {
    const container = document.getElementById('history-list');
    const res = await API.listTransactions({ item_code: itemCode, limit: 5 });
    if (!res.ok || !res.data || res.data.length === 0) {
      container.innerHTML = '<p class="text-muted">ยังไม่มีประวัติ</p>';
      return;
    }
    container.innerHTML = res.data.map(tx => `
      <div class="tx-row">
        <div class="tx-info">
          ${UI.renderActionBadge(tx.action)}
          <span class="tx-detail">${tx.notes || ''} ${tx.for_whom ? '→ ' + tx.for_whom : ''}</span>
        </div>
        <div class="tx-meta">
          <span>${tx.qty_change ? (tx.qty_change > 0 ? '+' : '') + tx.qty_change : ''}</span>
          <span class="tx-date">${UI.formatDateTime(tx.datetime)}</span>
        </div>
      </div>`).join('');
  },

  // ════════════════════════════════════════
  // Adjust Qty Modal
  // ════════════════════════════════════════
  showAdjustQtyModal(itemCode, currentQty) {
    const overlay = document.createElement('div');
    overlay.className = 'stc-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:100%">
        <h3 style="margin:0 0 16px;font-size:18px;font-weight:700">ปรับปรุงยอดจำนวน</h3>
        <p style="margin-bottom:12px;font-size:14px;color:#666">รหัส: ${itemCode}</p>
        <div class="form-group">
          <label>จำนวนคงเหลือปัจจุบัน</label>
          <input type="number" id="adjust-qty-val" class="form-input" value="${currentQty}" min="0">
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" onclick="this.closest('.stc-modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary" id="adjust-confirm-btn">บันทึก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#adjust-confirm-btn').onclick = async () => {
      const btn = overlay.querySelector('#adjust-confirm-btn');
      UI.setBtnLoading(btn, true);
      const newQty = document.getElementById('adjust-qty-val').value;
      const res = await API.updateItem(itemCode, { qty: Number(newQty) });
      if (res.ok) { 
        UI.showToast('ปรับปรุงยอดสำเร็จ', 'success'); 
        overlay.remove(); 
        App.loadItemDetail(itemCode); 
      } else { 
        UI.showToast(res.error || 'ไม่สำเร็จ', 'error'); 
        UI.setBtnLoading(btn, false);
      }
    };
  },

  // ════════════════════════════════════════
  // Delete Confirmation
  // ════════════════════════════════════════
  confirmDelete(itemCode) {
    UI.showModal('ยืนยันการลบ', `ต้องการลบรายการ ${itemCode} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`, async () => {
      const res = await API.deleteItem(itemCode);
      if (res.ok) {
        UI.showToast('ลบรายการสำเร็จ', 'success');
        setTimeout(() => window.location.href = 'items.html', 1000);
      } else {
        UI.showToast(res.error || 'ลบไม่สำเร็จ', 'error');
      }
    }, 'ลบ');
  },

  // ════════════════════════════════════════
  // Assign Asset Modal
  // ════════════════════════════════════════
  showAssignModal(assetCode) {
    const overlay = document.createElement('div');
    overlay.className = 'stc-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%">
        <h3 style="margin:0 0 16px;font-size:18px;font-weight:700">มอบหมายทรัพย์สิน</h3>
        <div class="form-group"><label>รหัสพนักงาน</label><input type="text" id="assign-emp-id" class="form-input" placeholder="เช่น EMP001"></div>
        <div class="form-group"><label>ชื่อผู้รับ</label><input type="text" id="assign-emp-name" class="form-input" placeholder="ชื่อ-นามสกุล"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" onclick="this.closest('.stc-modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary" id="assign-confirm-btn">มอบหมาย</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#assign-confirm-btn').onclick = async () => {
      const empId = document.getElementById('assign-emp-id').value.trim();
      const empName = document.getElementById('assign-emp-name').value.trim();
      if (!empId || !empName) { UI.showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }
      const res = await API.assignAsset(assetCode, empId, empName);
      if (res.ok) { UI.showToast('มอบหมายสำเร็จ', 'success'); overlay.remove(); location.reload(); }
      else { UI.showToast(res.error || 'ไม่สำเร็จ', 'error'); }
    };
  },

  // ════════════════════════════════════════
  // URL Params Helper
  // ════════════════════════════════════════
  getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  },
};
