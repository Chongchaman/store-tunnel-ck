# STORE TUNNEL CK - Store Management System

ระบบเว็บแอปพลิเคชันสำหรับจัดการสโตร์ไซต์งานก่อสร้างแบบ Mobile-first โดยใช้ Frontend เป็น HTML/Vanilla JS และ Backend เป็น Google Apps Script เชื่อมกับ Google Sheets

## โครงสร้างโปรเจกต์
- `index.html` - หน้า Login
- `dashboard.html` - หน้า Dashboard สรุปข้อมูล
- `items.html` - หน้ารายการของทั้งหมด (เช่า, ทรัพย์สิน, สิ้นเปลือง, แก๊ส)
- `item-detail.html` - หน้ารายละเอียดของและ QR Code
- `add-item.html` - หน้าเพิ่ม/แก้ไขรายการ (Dynamic form ตามประเภท)
- `withdraw.html` - หน้าเบิกของ
- `return.html` - หน้าคืนของเช่า
- `scan.html` - หน้าสแกน QR / Barcode
- `transactions.html` - หน้าประวัติการทำรายการ
- `reports.html` - หน้าสรุปรายงาน (Export Excel/PDF)
- `users.html` - หน้าจัดการผู้ใช้งานระบบ
- `settings.html` - หน้าตั้งค่าระบบ
- `Code.gs` - โค้ด Backend สำหรับนำไปใส่ใน Google Apps Script
- `assets/` - โฟลเดอร์เก็บไฟล์ CSS, รูปภาพ และ JS หลัก (api, auth, ui, app, config)

---

## 🚀 คู่มือการติดตั้ง (Deployment Guide)

### ขั้นตอนที่ 1: ตั้งค่า Database (Google Sheets)
1. ไปที่ [Google Sheets](https://sheets.new) และสร้างไฟล์ใหม่ ตั้งชื่อว่า **"Store Tunnel CK Database"**
2. ไปที่เมนู **ส่วนขยาย (Extensions)** > **Apps Script**
3. ลบโค้ดที่มีอยู่ทั้งหมดออก แล้วคัดลอกโค้ดจากไฟล์ `Code.gs` ในโปรเจกต์นี้ไปวางทั้งหมด
4. บันทึกไฟล์ (Ctrl+S)
5. ใน Apps Script ให้เลือกฟังก์ชัน `setupDatabase` จากแถบเมนูด้านบน (ข้างๆ ปุ่ม Run) แล้วกดปุ่ม **เรียกใช้ (Run)**
6. ระบบจะขอสิทธิ์เข้าถึง (Authorization Required) ให้กด Review Permissions -> เลือก Account -> Advanced -> Go to ... (unsafe) -> Allow
7. สคริปต์จะทำการสร้าง Tabs ต่างๆ ในชีตให้โดยอัตโนมัติ (Users, Items, Transactions, Settings) และสร้าง User `admin` (รหัสผ่าน `admin123`) ไว้ให้พร้อมใช้งาน

### ขั้นตอนที่ 2: Deploy Backend API
1. ในหน้า Apps Script ไปที่ปุ่มสีน้ำเงินมุมขวาบน **การทำให้ใช้งานได้ (Deploy)** > **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
2. คลิกที่รูปเฟืองตรง "เลือกประเภท" เลือก **เว็บแอป (Web app)**
3. ตั้งค่าดังนี้:
   - รายละเอียด: `v1.0` (หรืออะไรก็ได้)
   - ดำเนินการในฐานะ: **ฉัน (Me)**
   - ผู้มีสิทธิ์เข้าถึง: **ทุกคน (Anyone)**  *(สำคัญมาก ต้องเลือก Anyone เพื่อให้ Frontend เรียกใช้ API ได้)*
4. กด **การทำให้ใช้งานได้ (Deploy)**
5. คัดลอก **URL ของเว็บแอป (Web app URL)** ที่ลงท้ายด้วย `/exec` เก็บไว้ (ตัวอย่าง: `https://script.google.com/macros/s/AKfycbx.../exec`)

### ขั้นตอนที่ 3: เชื่อมต่อ Frontend กับ Backend
1. กลับมาที่โค้ดในเครื่องคอมพิวเตอร์ของคุณ
2. เปิดไฟล์ `assets/config.js`
3. ค้นหาบรรทัดที่เขียนว่า `API_URL: ''` (ประมาณบรรทัดที่ 4)
4. วาง URL ที่คัดลอกมาในขั้นตอนที่ 2 ลงไป 
   *(ตัวอย่าง: `API_URL: 'https://script.google.com/macros/s/AKfycbx.../exec'`)*
5. บันทึกไฟล์

### ขั้นตอนที่ 4: การใช้งานครั้งแรก
1. รันระบบ Frontend (แนะนำให้ใช้ Live Server extension ใน VS Code หรือ deploy ขึ้น GitHub Pages)
2. เมื่อเปิดหน้าเว็บมาจะเจอหน้า Login ให้เข้าสู่ระบบด้วย:
   - Username: **admin**
   - Password: **admin123**
3. แนะนำให้เข้าไปที่เมนู **จัดการผู้ใช้** เพื่อสร้าง Account ใหม่ของคุณเอง หรือเปลี่ยนรหัสผ่านทันที

---

## 🛠 การ Deploy ขึ้น GitHub Pages (เพื่อให้ใช้งานผ่านมือถือได้ทุกที่)
เนื่องจากโปรเจกต์ถูกออกแบบมาโดยใช้แค่ HTML/CSS/JS ธรรมดา คุณสามารถนำขึ้น GitHub Pages ได้ฟรี:
1. สร้าง Repository ใหม่ใน GitHub (ไม่ต้องติ๊ก Add README)
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น Repository
3. ไปที่แท็บ **Settings** ของ Repository
4. เลือกเมนู **Pages** ด้านซ้าย
5. ตรงหัวข้อ Build and deployment > Source ให้เลือก **Deploy from a branch**
6. ตรง Branch ให้เลือก `main` (หรือ `master`) แล้วกด Save
7. รอประมาณ 1-2 นาที GitHub จะแจ้ง URL ของเว็บคุณให้ (เช่น `https://yourusername.github.io/store-tunnel-ck/`)
8. นำ URL นั้นไปเปิดบนมือถือหรือบันทึกเป็น Bookmark ได้เลย!
