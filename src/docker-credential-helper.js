"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");
const readline = require("readline");

function getHostnameFromUrl(urlString) {
  try {
    if (!urlString.includes("://")) {
      // If no scheme, treat as host/path
      return urlString;
    }
    const u = new URL(urlString);
    return u.hostname;
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}
function runGetCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let inputData = "";

  rl.on("line", (line) => {
    inputData += line;
  });

  rl.on("close", () => {
    const urlString = inputData.trim();
    const host = getHostnameFromUrl(urlString);

    if (!host) {
      console.error("Invalid URL");
      process.exit(1);
    }

    if (!host.endsWith("particle.io")) {
      console.error(`unsupported host: ${host}`);
      process.exit(1);
    }

    const targetDomain = host.split(".").slice(1).join(".");
    const homeDir = os.homedir();
    const particleConfigDir = path.join(homeDir, ".particle");

    let files;
    try {
      files = fs.readdirSync(particleConfigDir);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }

    for (const file of files) {
      if (file.endsWith(".config.json")) {
        const filePath = path.join(particleConfigDir, file);
        let config;
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          config = JSON.parse(raw);
        } catch (err) {
          console.error(err.message);
          process.exit(1);
        }

        if (!config.apiUrl) {
          continue;
        }

        const apiHost = getHostnameFromUrl(config.apiUrl);
        if (!apiHost) continue;

        const apiDomain = apiHost.split(".").slice(1).join(".");
        if (apiDomain === targetDomain) {
          const dockerCreds = {
            ServerURL: urlString,
            Username: config.username,
            Secret: config.access_token,
          };

          process.stdout.write(JSON.stringify(dockerCreds));
          process.exit(0);
        }
      }
    }

    // No matching credentials found
    process.exit(0);
  });
}

// If this file is run directly, execute the command
if (require.main === module) {
  runGetCommand();
}

module.exports = { runGetCommand };
