// A special firmware to allow the Device Doctor to get and set special
// device settings like IP address and antenna
// Compile by running scripts/build_doctor.sh

SYSTEM_MODE(MANUAL);

void setup() {
  setupUSB();
}

void loop() {
  performUSBCommands(Serial);
}

/** USB Serial command parsing and dispatching **/

void setupUSB() {
  Serial.begin();
}

// Reads one character to pick a command to execute
// l for listening mode
// d for DFU mode
// a for antenna selection
// i for IP configuration
// p for SSID prefix
// e for clear EEPROM
void performUSBCommands(Stream& stream) {
  switch (stream.read()) {
    case 'l': performListenModeCommand(stream); break;
    case 'd': performDFUModeCommand(stream); break;
    case 'a': performAntennaCommand(stream); break;
    case 'i': performIPCommand(stream); break;
    case 'p': performSoftAPPrefixCommand(stream); break;
    case 'c': performClearCredentialsCommand(stream); break;
    case 'e': performClearEEPROMCommand(stream); break;
    default: break; // ignore unknown characters
  }
}

// Goes straight to Listen mode
void performListenModeCommand(Stream& stream) {
  enterListenMode();
  stream.println("Entering listen mode");
}
// Goes straight to DFU mode
void performDFUModeCommand(Stream& stream) {
  enterDFUMode();
  stream.println("Entering DFU mode");
}

// Reads one character to select which antenna to use
// i for internal
// e for external
void performAntennaCommand(Stream& stream) {
  char mode;
  if (stream.readBytes(&mode, 1)) {
    WLanSelectAntenna_TypeDef antenna;
    const char *message;
    switch (mode) {
      case 'i':
        antenna = ANT_INTERNAL;
        message = "Internal";
        break;
      case 'e':
        antenna = ANT_EXTERNAL;
        message = "External";
        break;
      default:
        return;
    }
    selectAntenna(antenna);
    stream.printlnf("Switched antenna to %s", message);
  }
}

// Reads one character to select which IP configuration to use
// d for dynamic using DHCP
// s for static
void performIPCommand(Stream& stream) {
  char mode;
  if (stream.readBytes(&mode, 1)) {
    switch (mode) {
      case 'd':
        useDynamicIP();
        stream.println("Switched to dynamic IP");
        break;
      case 's':
        if (performStaticIPCommand(stream)) {
          stream.println("Switched to static IP");
        }
        break;
    }
  }
}

// For static IP configuration, reads four integers in sequence that
// represent the device IP address, netmask, gateway and DNS IP address.
// See https://docs.particle.io/reference/firmware/photon/#ipaddress
bool performStaticIPCommand(Stream& stream) {
  IPAddress myAddress((uint32_t) stream.parseInt());
  IPAddress netmask((uint32_t) stream.parseInt());
  IPAddress gateway((uint32_t) stream.parseInt());
  IPAddress dns((uint32_t) stream.parseInt());

  if (myAddress && netmask && gateway && dns) {
    useStaticIP(myAddress, netmask, gateway, dns);
    return true;
  } else {
    return false;
  }
}

// For Wi-Fi devices with SoftAP prefix, change or reset the prefix for
// the SSID name
// Reads a string until the end of line.
// If the string is empty, the default prefix will be reset
void performSoftAPPrefixCommand(Stream& stream) {
  String prefix = stream.readStringUntil('\n').trim();
  setSoftAPPrefix(prefix.c_str());
  stream.printlnf("Switched SoftAP prefix to %s", prefix.length() ? prefix.c_str() : "default");
}

// Clear the Wi-Fi networks
void performClearCredentialsCommand(Stream& stream) {
  clearCredentials();
  stream.printlnf("Cleared Wi-Fi credentials");
}

// Clear all the data stored in EEPROM
void performClearEEPROMCommand(Stream& stream) {
  clearEEPROM();
  stream.printlnf("Cleared EEPROM data");
}

/** Commands implementation **/

void enterListenMode() {
#if Wiring_WiFi
  WiFi.listen();
#elif Wiring_Cellular
  Cellular.listen();
#endif
}

void enterDFUMode() {
  System.dfu();
}

void selectAntenna(WLanSelectAntenna_TypeDef antenna) {
#if Wiring_WiFi && PLATFORM_ID != 0
  WiFi.selectAntenna(antenna);
#endif
}

void useDynamicIP() {
#if Wiring_WiFi
  WiFi.useDynamicIP();
#endif
}

void useStaticIP(IPAddress myAddress, IPAddress netmask, IPAddress gateway, IPAddress dns) {
#if Wiring_WiFi
  WiFi.setStaticIP(myAddress, netmask, gateway, dns);
  WiFi.useStaticIP();
#endif
}

void setSoftAPPrefix(const char* prefix) {
#if Wiring_WiFi && PLATFORM_ID != 0
  System.set(SYSTEM_CONFIG_SOFTAP_PREFIX, prefix);
#endif
}

void clearCredentials() {
#if Wiring_WiFi
  WiFi.clearCredentials();
#endif
}

void clearEEPROM() {
  EEPROM.clear();
}
