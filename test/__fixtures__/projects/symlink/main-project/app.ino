#include "shared/sub_dir/helper.h"
// Demo app with an include that points to a symlink

void setup() {
  if (DOIT) {
    Particle.function("test", testFn);
  }
}

int testFn(String) {
  return 0;
}
