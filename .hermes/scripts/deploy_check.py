#!/usr/bin/env python3
"""Check for new commits on GitHub main branch and deploy to Vercel if needed."""
import subprocess, json, os, time

PROJECT_DIR = r"D:\CODE\P_projects\protlife_app"
GIT_REPO = "phongprotvn-stack/protlife_app"
STATE_FILE = os.path.join(os.path.dirname(__file__), ".last_deploy_sha")
os.environ.setdefault("SHELL", "C:\\Program Files\\Git\\usr\\bin\\bash.exe")

os.chdir(PROJECT_DIR)

# Get latest commit SHA from GitHub
result = subprocess.run(
    ["git", "ls-remote", "https://github.com/phongprotvn-stack/protlife_app.git", "main"],
    capture_output=True, text=True, timeout=30
)

if result.returncode != 0:
    print("FAIL: git ls-remote failed")
    exit(1)

latest_sha = result.stdout.strip().split("\t")[0]
if not latest_sha:
    print("FAIL: no SHA from git ls-remote")
    exit(1)

print(f"Latest remote SHA: {latest_sha}")

# Read last deployed SHA
last_sha = ""
if os.path.exists(STATE_FILE):
    with open(STATE_FILE) as f:
        last_sha = f.read().strip()

if last_sha == latest_sha:
    print("No new commits. Skipping deploy.")
    exit(0)

print(f"New commit detected! Deploying...")

# Deploy to Vercel
result = subprocess.run(
    "npx vercel deploy --prod --prebuilt --yes",
    capture_output=True, text=True, timeout=180, cwd=PROJECT_DIR, shell=True
)

if result.returncode != 0:
    print(f"VERCEL DEPLOY FAILED:\n{result.stdout}\n{result.stderr}")
    exit(1)

# Save SHA
with open(STATE_FILE, "w") as f:
    f.write(latest_sha)

print(f"Deployed successfully! SHA: {latest_sha}")
