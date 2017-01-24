// Demo app with a nested structure
#include "helper/helper.h"

void setup() {
  if (DOIT) {
    Particle.function("test", testFn);
  }
}

int testFn(String) {
  return 0;
}
