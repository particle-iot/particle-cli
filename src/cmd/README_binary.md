# binary.js

## Overview

`binary.js` is a command module in the `particle-cli` tool that provides functionality related to inspecting binary files and/or bundles that may contain binary files and assets.

## Usage

To use the `binary.js` command module, you can run the following commands:

- `particle binary inspect <.bin file>`: Inspects a binary file and displays detailed information such as filename, crc, prefixInfo, suffixInfo, and other relevant metadata.

- `particle binary inspect <.bin file with baked-in dependencies>`: Inspects a binary file and displays detailed information such as filename, crc, prefixInfo, suffixInfo, and other relevant metadata such as TLV of the (asset) files.

- `particle binary inspect <.zip file>`: Extracts and inspects contents from the zip file

## Command-Line Options

- `--verbose` or `-v`: Increases how much logging to display

- `--quiet` or `-q`: Decreases how much logging to display

## Examples

1. Inspecting a binary file such as tinker.bin:

```
particle binary inspect p2_app.bin 

> particle-cli@3.10.2 start
> node ./src/index.js binary inspect /path/to/p2_app.bin

p2_app.bin
 CRC is ok (6e2abf80)
 Compiled for p2
 This is an application module number 1 at version 6
 It depends on a system module number 1 at version 5302
```

2. Inspecting a zip file whose app firmware has baked-in asset dependencies:

```
$ npm start -- binary inspect /path/to/bundle.zip 

> particle-cli@3.10.2 start
> node ./src/index.js binary inspect /path/to/bundle.zip

app.bin
 CRC is ok (7fa30408)
 Compiled for argon
 This is an application module number 2 at version 6
 It is firmware for product id 12 at version 3
 It depends on a system module number 1 at version 4006
It depends on assets:
 cat.txt (hash b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)
 house.txt (hash a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)
 water.txt (hash 3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591)
```

