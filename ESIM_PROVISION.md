# Provision a blank eSIM

### Pre-req

1. Input JSON (A JSON file that has a list of EIDs and their respective RSP URLs)
2. Output JSON (A blank file to store logs)
3. lpa tool (lpa tool binary - differently built for mac and windows)
4. binaries (A folder with the user binaries)

## Setup

### Local setup on computer

Put your files in this structure (for example)

```

```

### Device Setup 

1. Connect your device(s) to the computer
2. Run this command
```
particle.js esim provision --input /path/to/input.json --output /path/to/output.json --lpa /path/to/lpa-tool --binaries /path/to/binaries --bulk true
```

### Expected Outcome
First, the device(s) are flashed. Once the download process starts on a given device, device will turn its LED into yellow. If the download passes, LED turns green. If the download failed, LED turns red.

### Notes and Warnings
