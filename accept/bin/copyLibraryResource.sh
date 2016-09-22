#!/bin/bash
# copies the library resource directory in argument $1 to directory $2

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SRC=`node $DIR/libraryResources.js`
cp -r $SRC/$1 $2