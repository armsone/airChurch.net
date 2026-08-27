#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h:h}"
source_dir="$project_dir/tools/AirChurchRegistrar"
bundle="$source_dir/build/에어처치 교회 등록기.app"

mkdir -p "$bundle/Contents/MacOS"
cp "$source_dir/Info.plist" "$bundle/Contents/Info.plist"
swiftc -parse-as-library \
  -o "$bundle/Contents/MacOS/AirChurchRegistrar" \
  "$source_dir/AirChurchRegistrar.swift" \
  -framework SwiftUI -framework AppKit
codesign --force --deep --sign - "$bundle"

if [[ "${1:-}" == "--install" ]]; then
  ditto "$bundle" "/Users/armsone/Desktop/에어처치 교회 등록기.app"
fi

echo "$bundle"
