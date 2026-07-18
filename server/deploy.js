const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'store-490402';
const SERVICE_NAME = 'store-tunnel-ck-api';
const REGION = 'asia-southeast1';
const SHEET_ID = '1C5nxqCshPFE-f22DE4yb1USeU7LmzV__jwNLc2whaPM';

// อ่าน JSON Key
const keyPath = 'C:\\Users\\sitth\\sa-key.json';
if (!fs.existsSync(keyPath)) {
  console.error(`❌ ไม่พบไฟล์ key ที่: ${keyPath}`);
  process.exit(1);
}
const rawKey = fs.readFileSync(keyPath, 'utf8').trim();
// แปลง JSON Key เป็น Base64 เพื่อเลี่ยงปัญหาเครื่องหมาย comma (,) ถูกมองเป็นตัวแยก env
const keyContent = Buffer.from(rawKey).toString('base64');

console.log('🚀 กำลังเริ่ม Deploy "store-tunnel-ck-api" ไปที่ Cloud Run...');

const args = [
  'run', 'deploy', SERVICE_NAME,
  '--source', '.',
  '--region', REGION,
  '--project', PROJECT_ID,
  '--platform', 'managed',
  '--allow-unauthenticated',
  '--set-env-vars', `SPREADSHEET_ID=${SHEET_ID},GOOGLE_CREDENTIALS_JSON=${keyContent}`,
  '--memory', '256Mi',
  '--cpu', '1',
  '--min-instances', '0',
  '--max-instances', '3',
  '--timeout', '30'
];

const result = spawnSync('gcloud', args, { 
  stdio: 'inherit',
  shell: true,
  env: { 
    ...process.env,
    // อัปเดต PATH ให้ gcloud รันได้ชัวร์ๆ
    PATH: process.env.PATH + ';C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin;C:\\Program Files\\Google\\Cloud SDK\\google-cloud-sdk\\bin;C:\\Users\\sitth\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin'
  }
});

if (result.status === 0) {
  console.log('🎉 Deploy สำเร็จเรียบร้อยแล้ว!');
} else {
  console.error('❌ Deploy ล้มเหลว โปรดดู error ด้านบน');
  process.exit(result.status || 1);
}
