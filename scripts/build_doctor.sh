#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLI=$DIR/..

for platform in core photon p1 electron; do
  node $CLI/bin/particle.js compile $platform $CLI/binaries/doctor.ino --saveTo $CLI/binaries/${platform}_doctor.bin
done
