#!/usr/bin/env bash
set -e

# Define platforms
declare -A platforms
platforms[macos-x64]="https://github.com/serialport/node-serialport/releases/download/%40serialport%2Fbindings%409.2.8/bindings-v9.2.8-electron-v89-darwin-x64.tar.gz node16-macos-x64"
platforms[macos-arm64]="https://github.com/serialport/node-serialport/releases/download/%40serialport%2Fbindings%409.2.8/bindings-v9.2.8-electron-v89-darwin-x64.tar.gz node16-macos-arm64"
platforms[win-x64]="https://github.com/serialport/node-serialport/releases/download/%40serialport%2Fbindings%409.2.8/bindings-v9.2.8-electron-v89-win32-x64.tar.gz node16-win-x64"
platforms[linux-x64]="https://github.com/serialport/node-serialport/releases/download/%40serialport%2Fbindings%409.2.8/bindings-v9.2.8-electron-v89-linux-x64.tar.gz node16-linux-x64"

# Function to download, extract and replace bindings.node
download_and_replace_bindings() {
  local url=$1
  local target=$2
  local temp_dir="temp_bindings"

  echo "Downloading bindings for ${target}..."
  mkdir -p "${temp_dir}" && cd "${temp_dir}"
  echo "Downloading ${url}..."
  curl -L "${url}" | tar -xz


  echo "Replacing bindings.node for ${target}..."
  mv build/Release/bindings.node ../../node_modules/@serialport/bindings/build/Release/bindings.node
  cd .. && rm -rf "${temp_dir}"
}

# Main loop to process each platform
for platform in "${!platforms[@]}"; do
  IFS=' ' read -r -a platform_info <<< "${platforms[$platform]}"
  url="${platform_info[0]}"
  pkg_target="${platform_info[1]}"

  echo "Processing $platform..."
  download_and_replace_bindings "${url}" "${platform}"
  echo "Packaging for ${pkg_target}..."
  cd ..
  ./node_modules/.bin/pkg . --targets "${pkg_target}" -o "build/particle-cli-${platform}"
  cd scripts
done

echo "Packaging completed."
