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
void performUSBCommands(Stream& stream) {
  switch (stream.read()) {
    case 'l': enterListenMode(); break;
    case 'd': enterDFUMode(); break;
    case 'a': performAntennaCommand(stream); break;
    case 'i': performIPCommand(stream); break;
    default: break; // ignore unknown characters
  }
}

// Reads one character to select which antenna to use
// i for internal
// e for external
void performAntennaCommand(Stream& stream) {
  char mode;
  if (stream.readBytes(&mode, 1)) {
    WLanSelectAntenna_TypeDef antenna;
    switch (mode) {
      case 'i': antenna = ANT_INTERNAL; break;
      case 'e': antenna = ANT_EXTERNAL; break;
    }
    selectAntenna(antenna);
  }
}

// Reads one character to select which IP configuration to use
// d for dynamic using DHCP
// s for static
void performIPCommand(Stream& stream) {
  char mode;
  if (stream.readBytes(&mode, 1)) {
    switch (mode) {
      case 'd': useDynamicIP(); break;
      case 's': performStaticIPCommand(stream); break;
    }
  }
}

// For static IP configuration, reads four integers in sequence that
// represent the device IP address, netmask, gateway and DNS IP address.
// See https://docs.particle.io/reference/firmware/photon/#ipaddress
void performStaticIPCommand(Stream& stream) {
  IPAddress myAddress((uint32_t) stream.parseInt());
  IPAddress netmask((uint32_t) stream.parseInt());
  IPAddress gateway((uint32_t) stream.parseInt());
  IPAddress dns((uint32_t) stream.parseInt());

  useStaticIP(myAddress, netmask, gateway, dns);
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

