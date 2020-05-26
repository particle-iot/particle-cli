// ------------
// Strobe an LED
// ------------

SYSTEM_MODE(SEMI_AUTOMATIC);

String name = "stroby";
String deviceID = System.deviceID();
String deviceShortID = deviceID.substring(0, 6);
int version = 42;
int blinkState = 0;
int led1 = D0; // DO for gen2, D7 for gen3

void setup() {
  pinMode(led1, OUTPUT);
  Particle.variable("name", &name, STRING);
  Particle.variable("version", &version, INT);
  Particle.variable("blinking", &blinkState, INT);
  Particle.function("check", check);
  Particle.function("stop", stop);
  Particle.function("start", start);
  Particle.function("toggle", toggleBlink);
  Particle.connect();
}

void loop(){
  if (blinkState == 0){
    return;
  }

  digitalWrite(led1, HIGH);
  Serial.printlnf("%s - active", deviceShortID.c_str());
  Particle.publish(deviceShortID, "active", 60, PUBLIC);
  Particle.publish("led", "ON", 60, PRIVATE);
  delay(500);
  digitalWrite(led1, LOW);
  Particle.publish("led", "OFF", 60, PRIVATE); 
  delay(500);
}

int start(String){
  blinkState = 1;
  Serial.printlnf("%s - start", deviceShortID.c_str());
  return blinkState;
}

int stop(String){
  blinkState = 0;
  Serial.printlnf("%s - stop", deviceShortID.c_str());
  return blinkState;
}

int toggleBlink(String){
  if (blinkState == 1){
    stop("");
  } else {
    start("");
  }
  return blinkState;
}

int check(String){
  return 200;
}


