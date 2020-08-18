#include "Particle_TEST_E2E_CLI_LIB.h"

Particle_TEST_E2E_CLI_LIB test = MYLIB(0);

void setup() {
  Particle.function("getX", getX);
}

void loop(){
}

int getX(String){
  uint8_t x = test.incr();
  return x;
}


