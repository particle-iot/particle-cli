// IMPORTANT: When including a library in a firmware app, a sub dir prefix is needed
// before the particular .h file.
#include "uber-library-example.h"

// Initialize objects from the lib; be sure not to call anything
// that requires hardware be initialized here, put those in setup()
UberLibraryExample::Pin outputPin(D7);

void setup() {
  // Call functions on initialized library objects that require hardware
  // to be wired up correct and available.
  outputPin.beginInPinMode(OUTPUT);
}

void loop() {
  // Use the library's initialized objects and functions
  outputPin.modulateAtFrequency(50);
}
