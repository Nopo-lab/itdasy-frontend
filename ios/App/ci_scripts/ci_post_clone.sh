#!/bin/bash

# [2026-05-04] Xcode Cloud Post-Clone Script for Itdasy (Capacitor)
# 이 스크립트는 Xcode Cloud 서버가 코드를 내려받은 직후 실행됩니다.

set -e # 에러 발생 시 즉시 중단

# CI_PRIMARY_REPOSITORY_PATH 는 git 레포지토리의 루트 경로입니다.
echo ">> CI_PRIMARY_REPOSITORY_PATH: $CI_PRIMARY_REPOSITORY_PATH"
cd "$CI_PRIMARY_REPOSITORY_PATH"

# 1. 웹 의존성 설치
echo ">> Installing npm dependencies..."
npm install

# 2. Capacitor 동기화 (이 과정에서 pod install 이 자동으로 실행됩니다)
echo ">> Syncing Capacitor with iOS..."
npx cap sync ios

echo ">> CI Post-Clone script finished successfully!"
