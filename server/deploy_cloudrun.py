"""
deploy_cloudrun.py — Deploy Node.js server to Google Cloud Run via Python
ใช้ Cloud Build + Cloud Run REST API กับ Service Account credentials
"""
import json, os, sys, time, zipfile, base64, io
import urllib.request, urllib.parse
import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account

# ── Config ──
PROJECT_ID   = "store-490402"
SERVICE_NAME = "store-tunnel-ck-api"
REGION       = "asia-southeast1"
SERVER_DIR   = r"B:\02.MRT Purple line Project\AI\store-tunnel-ck\server"
KEY_FILE     = r"B:\02.MRT Purple line Project\AI\store-tunnel-ck\store-490402-464c38c714a2.json"
SHEET_ID     = "1C5nxqCshPFE-f22DE4yb1USeU7LmzV__jwNLc2whaPM"

SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
]

def get_token():
    creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token

def api(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"HTTP {e.code}: {err[:500]}")
        return None

def zip_folder(folder_path):
    """Zip server folder (ยกเว้น node_modules, .env)"""
    buf = io.BytesIO()
    skip = {'.env', 'node_modules', '.git', '__pycache__', 'deploy.ps1', 'deploy_cloudrun.py'}
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(folder_path):
            # Skip excluded dirs
            dirs[:] = [d for d in dirs if d not in skip]
            for file in files:
                if file in skip:
                    continue
                filepath = os.path.join(root, file)
                arcname  = os.path.relpath(filepath, folder_path)
                print(f"  + {arcname}")
                zf.write(filepath, arcname)
    return buf.getvalue()

def enable_apis(token):
    print("[1/5] Enabling required APIs...")
    for api_name in ["run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com"]:
        url  = f"https://serviceusage.googleapis.com/v1/projects/{PROJECT_ID}/services/{api_name}:enable"
        resp = api("POST", url, {}, token)
        if resp:
            print(f"  ✅ {api_name}")
        else:
            print(f"  ⚠️  {api_name} (may already be enabled)")

def deploy_via_cloudbuild(token):
    """Upload source as zip to Cloud Build, build Docker, deploy to Cloud Run"""
    print("[2/5] Zipping source files...")
    zip_bytes = zip_folder(SERVER_DIR)
    zip_b64   = base64.b64encode(zip_bytes).decode()
    print(f"  📦 Zip size: {len(zip_bytes)//1024} KB")

    # Get GCS bucket for Cloud Build
    print("[3/5] Uploading to Cloud Build...")
    build_url = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds"

    # Build config — ใช้ pack (buildpacks) แทน Dockerfile
    cred_json_escaped = json.dumps(json.load(open(KEY_FILE))).replace('"', '\\"')

    build_body = {
        "source": {
            "storageSource": None  # จะเปลี่ยนเป็น inline source
        },
        "steps": [
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": ["build", "-t", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}", "."]
            }
        ],
        "images": [f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"],
    }

    # ใช้วิธี inline source (base64 zip)
    # Cloud Build รับ inline source ผ่าน StorageSource เท่านั้น
    # เราจะ upload ไป GCS ก่อน

    # Step 1: สร้าง GCS upload URL
    gcs_url  = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds:createBuildTrigger"
    
    # ใช้ Cloud Run Source deploy แทน — ส่ง zip โดยตรง
    upload_url_api = f"https://run.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/services"

    # Cloud Run v2 source deploy
    cr_url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services"

    print("[4/5] Getting Cloud Build upload URL...")
    upload_resp = api("GET", f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/sourceProviderConfigs", token=token)

    # ใช้ Cloud Build generate-upload-url
    gen_url  = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds:generateUploadUrl"
    gen_resp = api("POST", gen_url, {}, token)
    if not gen_resp:
        print("❌ Cannot get upload URL — enabling APIs first may be needed")
        return None
    
    upload_url     = gen_resp.get("uploadUrl") or gen_resp.get("upload_url")
    storage_source = gen_resp.get("storageSource") or gen_resp.get("storage_source") or {}
    print(f"  📡 Got upload URL")

    # Upload zip
    req = urllib.request.Request(
        upload_url, data=zip_bytes,
        headers={"Content-Type": "application/zip", "x-goog-content-length-range": "0,104857600"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as r:
        print(f"  ✅ Uploaded ({r.status})")

    # Trigger build + deploy
    print("[5/5] Triggering Cloud Build + Cloud Run deploy...")
    creds_env = json.dumps(json.load(open(KEY_FILE)))

    build_body = {
        "source": {"storageSource": storage_source},
        "steps": [
            {"name": "gcr.io/cloud-builders/docker",
             "args": ["build", "-t", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}", "."]},
        ],
        "images": [f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"],
    }
    build_resp = api("POST", build_url, build_body, token)
    if not build_resp:
        print("❌ Build failed to start")
        return None

    build_id = build_resp.get("metadata", {}).get("build", {}).get("id") or build_resp.get("name", "").split("/")[-1]
    print(f"  🔨 Build ID: {build_id}")

    # Poll build status
    print("  ⏳ Waiting for build to complete (3-5 min)...")
    for i in range(40):
        time.sleep(15)
        status_resp = api("GET", f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds/{build_id}", token=token)
        status = status_resp.get("status", "UNKNOWN") if status_resp else "UNKNOWN"
        print(f"     [{i*15}s] Build status: {status}")
        if status == "SUCCESS":
            break
        if status in ("FAILURE", "CANCELLED", "TIMEOUT"):
            print(f"❌ Build {status}")
            return None

    # Deploy to Cloud Run
    print("  🚀 Deploying to Cloud Run...")
    deploy_url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE_NAME}"

    service_body = {
        "template": {
            "containers": [{
                "image": f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}",
                "env": [
                    {"name": "SPREADSHEET_ID",           "value": SHEET_ID},
                    {"name": "GOOGLE_CREDENTIALS_JSON",  "value": creds_env},
                    {"name": "NODE_ENV",                 "value": "production"},
                ],
                "resources": {"limits": {"memory": "256Mi", "cpu": "1000m"}},
            }],
            "scaling": {"minInstanceCount": 0, "maxInstanceCount": 5},
        },
        "ingress": "INGRESS_TRAFFIC_ALL",
    }

    # Check if service exists
    existing = api("GET", deploy_url, token=token)
    if existing and "name" in existing:
        resp = api("PATCH", deploy_url, service_body, token)
    else:
        resp = api("POST", f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services?serviceId={SERVICE_NAME}", service_body, token)

    if not resp:
        print("❌ Deploy failed")
        return None

    # Allow unauthenticated
    iam_url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE_NAME}:setIamPolicy"
    api("POST", iam_url, {"policy": {"bindings": [{"role": "roles/run.invoker", "members": ["allUsers"]}]}}, token)

    print("\n✅ Deployment complete!")
    url_resp = api("GET", deploy_url, token=token)
    if url_resp:
        svc_url = url_resp.get("uri", "")
        print(f"🌐 Service URL: {svc_url}")
        return svc_url
    return None

if __name__ == "__main__":
    print("=" * 50)
    print("STORE TUNNEL CK — Cloud Run Deploy")
    print("=" * 50)
    print("Getting access token...")
    token = get_token()
    print(f"✅ Token obtained")
    
    enable_apis(token)
    url = deploy_via_cloudbuild(token)
    
    if url:
        print(f"\n🎉 SUCCESS!")
        print(f"API URL: {url}/api")
        print(f"\nNext: Update assets/config.js API_URL to:\n  '{url}/api'")
    else:
        print("\n❌ Deployment failed - check errors above")
