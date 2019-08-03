#ifndef _UBER_LIBRARY_EXAMPLE
#define _UBER_LIBRARY_EXAMPLE

// Make library cross-compatiable
// with Arduino, GNU C++ for tests, and Spark.
//#if defined(ARDUINO) && ARDUINO >= 100
//#include "Arduino.h"
//#elif defined(SPARK)
//#include "application.h"
//#endif

// TEMPORARY UNTIL the stuff that supports the code above is deployed to the build IDE
#include "application.h"
namespace UberLibraryExample
{
  class Pin
  {
    private:
      int number;
      int mode;
      bool state;
    public:
      Pin(int _number);
      void beginInPinMode(PinMode _pinMode);
      void modulateAtFrequency(int _ms);
      int getNumber();
      bool getState();
      bool getMode();
      bool isHigh();
      void setHigh();
      void setLow();
      void setActualPinState();
  };
}

#endif
