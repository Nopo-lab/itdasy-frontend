#!/usr/bin/env python3
"""PostToolUse(Edit|Write) 훅 — 기능 파일을 고치면 APP_FEATURE_INDEX.md 갱신을 리마인드.

발동 조건(둘 다 만족):
  1) 편집 대상이 '기능 코드' 파일 (js/**·app-*.js·백엔드 routers/services/models)
  2) 그 파일이 인덱스에 이름으로 등장 (= 인덱스가 추적하는 파일)
문서(.md)·테스트·설정 편집엔 발동 안 함(소음 방지).
"""
import json
import os
import re
import sys

INDEX_REL = ".ai/APP_FEATURE_INDEX.md"


def is_feature_file(path: str) -> bool:
    base = os.path.basename(path)
    if not (path.endswith(".js") or path.endswith(".py")):
        return False
    if "/__tests__/" in path or base.endswith(".test.js") or base.startswith("test_"):
        return False
    if "/node_modules/" in path:
        return False
    # 프론트 기능 코드
    if "/js/" in path or re.match(r"app-.*\.js$", base):
        return True
    # 백엔드 기능 코드
    if re.search(r"/backend/(routers|services|models)", path) or base == "models.py":
        return True
    return False


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    ti = data.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("path") or ""
    if not path or not is_feature_file(path):
        return 0

    cwd = data.get("cwd") or os.getcwd()
    index_path = os.path.join(cwd, INDEX_REL)
    base = os.path.basename(path)

    # 인덱스가 이미 이 파일을 추적하면 "갱신 확인", 아니면 "신규 등록" 안내
    tracked = False
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            tracked = base in f.read()
    except Exception:
        # 인덱스를 못 읽어도 리마인드는 함
        pass

    if tracked:
        msg = f"📇 방금 `{base}` 수정함 — 기능/동작이 바뀌었으면 {INDEX_REL} 의 해당 항목도 한 줄 갱신할 것."
    else:
        msg = f"📇 `{base}` 는 {INDEX_REL} 에 아직 없음 — 새 기능 파일이면 알맞은 도메인 섹션에 한 줄 추가할 것."
    print(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
