# ============================================================
# deploy.ps1 — Deploy Node.js server ขึ้น Google Cloud Run
# ============================================================

$PROJECT_ID  = "store-490402"
$SERVICE     = "store-tunnel-ck-api"
$REGION      = "asia-southeast1"
$KEY_FILE    = "B:\02.MRT Purple line Project\AI\store-tunnel-ck\store-490402-464c38c714a2.json"
$SERVER_DIR  = "B:\02.MRT Purple line Project\AI\store-tunnel-ck\server"
$SHEET_ID    = "1C5nxqCshPFE-f22DE4yb1USeU7LmzV__jwNLc2whaPM"

Write-Host "=== STORE TUNNEL CK — Cloud Run Deploy ===" -ForegroundColor Cyan

# 1. Auth ด้วย Service Account
Write-Host "[1/5] Authenticating with service account..." -ForegroundColor Yellow
gcloud auth activate-service-account --key-file="$KEY_FILE"

# 2. ตั้ง project
Write-Host "[2/5] Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# 3. เปิด APIs ที่ต้องการ
Write-Host "[3/5] Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 4. Deploy (Cloud Build จะ build Docker image ให้อัตโนมัติ)
Write-Host "[4/5] Deploying to Cloud Run (region: $REGION)..." -ForegroundColor Yellow
gcloud run deploy $SERVICE `
  --source="$SERVER_DIR" `
  --region=$REGION `
  --platform=managed `
  --allow-unauthenticated `
  --set-env-vars="SPREADSHEET_ID=$SHEET_ID" `
  --set-secrets="GOOGLE_CREDENTIALS_JSON=store-credentials:latest" `
  --memory=256Mi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=5 `
  --timeout=30 `
  --project=$PROJECT_ID

Write-Host "[5/5] Done! Getting service URL..." -ForegroundColor Yellow
gcloud run services describe $SERVICE --region=$REGION --format="value(status.url)"
