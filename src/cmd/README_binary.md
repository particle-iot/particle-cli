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
TODO: Add example
```

2. Inspecting a binary file with baked-in asset dependencies

```
TODO: Add example
```

3. Inspecting a zip file

```
TODO: Add example
```

