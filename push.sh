#!/usr/bin/env bash
# Usage: bash push.sh
# Edit GITHUB_USERNAME and GITHUB_REPO before running.

GITHUB_USERNAME="KavyadharshiniM06"
GITHUB_REPO="PrivilegeGuardian"

set -e

echo "==> Initialising git..."
git init
git add .
git commit -m "feat: PrivilegeGuardian SIEM v2.0 — full stack, FAANG-level"

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}.git"

echo "==> Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Pushed to https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}"
