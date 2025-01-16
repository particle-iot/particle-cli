# Provision a blank eSIM

### Pre-req

1. Input JSON (A JSON file that has a list of EIDs and their respective RSP URLs)
2. Output (Folder where output logs will be stored. Defaults to `esim_loading_logs` if not set)
3. lpa tool (lpa tool binary - differently built for mac and windows)
4. binaries (Folder with the user binaries)

## Setup

### Local folder setup on computer

Put your files in this structure (for example)

```
/kigen-resources
├── /binaries
│   ├── esim-firmware-b5som.bin
│   ├── esim-firmware-msom.bin
├── input.json
├── custom_output_folder/
├── lpa
│   ├── mac
│   ├── ├── lpa
│   ├── windows
│   ├── ├── lpa.exe
```

### Device Setup 

1. Connect your device(s) to the computer
2. Run this command
```
particle.js esim provision --input /path/to/input.json --lpa /path/to/lpa-tool --binary /path/to/binaries --bulk true
```

### Expected Outcome
First, the device(s) are flashed. Once the download process starts on a given device, device will turn its LED into yellow. If the download worked, LED turns green. If the download failed, LED turns red.
