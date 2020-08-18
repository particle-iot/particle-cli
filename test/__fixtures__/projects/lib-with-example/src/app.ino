#include "Particle_TEST_E2E_CLI_LIB.h"

SYSTEM_MODE(SEMI_AUTOMATIC);

int version = 1;
String name = "lib-with-example";
String deviceID = System.deviceID();
String deviceShortID = deviceID.substring(0, 6);
Particle_TEST_E2E_CLI_LIB test = Particle_TEST_E2E_CLI_LIB(0);

void setup() {
  Particle.variable("name", &name, STRING);
  Particle.variable("version", &version, INT);
  Particle.function("check", check);
  Particle.function("report", report);
  Particle.connect();
}

void loop(){
}

int check(String){
  return 200;
}

int report(String){
  uint8_t x = test.incr();
  return x;
}

