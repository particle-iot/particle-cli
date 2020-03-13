// Demo app with a nested structure
#include "helper/h0.h"
#include "helper/h1.hpp"
#include "helper/h2.hxx"
#include "helper/h3.hh"

void setup() {
  if (DOIT_0) {
    Particle.function("test", testFn);
  }
  delay(1000);
  if (DOIT_1) {
    Particle.function("test", testFn);
  }
  delay(1000);
  if (DOIT_2) {
    Particle.function("test", testFn);
  }
  delay(1000);
  if (DOIT_3) {
    Particle.function("test", testFn);
  }
}

int testFn(String) {
  return 0;
}
