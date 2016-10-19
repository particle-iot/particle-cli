// GNU c string lib
#include <iostream>

// Stubs from Spark land
#define D7 7
typedef enum PinMode 
{
  OUTPUT,
  INPUT,
  INPUT_PULLUP,
  INPUT_PULLDOWN,
  AF_OUTPUT_PUSHPULL,	//Used internally for Alternate Function Output PushPull(TIM, UART, SPI etc)
  AF_OUTPUT_DRAIN,		//Used internally for Alternate Function Output Drain(I2C etc). External pullup resistors required.
  AN_INPUT  			//Used internally for ADC Input
} PinMode;

#include "uber-library-example.h"

int main()
{
  // TODO: Figure out how run the library's example code and do unit tests against it.
	// UberLibraryExample::Pin outputPin(D7);
  // outputPin.beginInPinMode(OUTPUT);
  // outputPin.modulateAtFrequency(300);
  // UberLibraryExample::Pin pin(D7);
	std::cout << "ok" << std::endl;
	return 0;
}
