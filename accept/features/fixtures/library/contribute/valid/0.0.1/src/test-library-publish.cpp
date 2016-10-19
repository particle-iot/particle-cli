// NOTE/NUANCE: When including WITHIN a library, no sub-dir prefix is needed.
#include "uber-library-example.h"

// Constructor
UberLibraryExample::Pin::Pin(int _number)
{
  number = _number;
  state = LOW;
}

// Initializers that should be called in the `setup()` function
void UberLibraryExample::Pin::beginInPinMode(PinMode _pinMode)
{
  pinMode(number, _pinMode); 
}

// Main API functions that the library provides
// typically called in `loop()` or `setup()` functions
void UberLibraryExample::Pin::modulateAtFrequency(int _ms)
{
  setHigh();
  delay(_ms);
  setLow();
  delay(_ms);
}

// Getters
int UberLibraryExample::Pin::getNumber()
{
  return number;
}
bool UberLibraryExample::Pin::getState()
{
  return state;
}
bool UberLibraryExample::Pin::getMode()
{
  return mode;
}
bool UberLibraryExample::Pin::isHigh()
{
  return state == HIGH ? true : false;
}

// Setters
void UberLibraryExample::Pin::setHigh()
{
  state = HIGH;
  setActualPinState();
}
void UberLibraryExample::Pin::setLow()
{
  state = LOW;
  setActualPinState();
}
void UberLibraryExample::Pin::setActualPinState()
{
  digitalWrite(number, state);
}
