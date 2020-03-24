// ------------
// Strobe an LED
// ------------
SYSTEM_MODE(SEMI_AUTOMATIC);

String deviceID = System.deviceID();
String appName = "stroby";
int appVersion = 42;
int blinkState = 0;
int led1 = D7;

void setup() {
  pinMode(led1, OUTPUT);
  Particle.variable("name", &appName, STRING);
  Particle.variable("version", &appVersion, INT);
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
  Particle.publish("led", "ON", 60, PRIVATE);
  delay(500);
  digitalWrite(led1, LOW);
  Particle.publish("led", "OFF", 60, PRIVATE);
  delay(500);
  Particle.publish(deviceID.substring(0, 6), "active", 60, PUBLIC);
}

int start(String){
  blinkState = 1;
  return blinkState;
}

int stop(String){
  blinkState = 0;
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

