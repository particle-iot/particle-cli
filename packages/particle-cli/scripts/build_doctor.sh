#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLI=$DIR/..

for platform in core photon p1 electron; do
  node $CLI/dist/index.js compile $platform $CLI/assets/binaries/doctor.ino --saveTo $CLI/assets/binaries/${platform}_doctor.bin
done
