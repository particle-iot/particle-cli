// ------------
// Strobe an LED
// ------------
String name = "stroby";
int version = 42;
int blinkState = 0;
int led1 = D7;

void setup() {
  pinMode(led1, OUTPUT);
  Particle.variable("name", &name, STRING);
  Particle.variable("version", &version, INT);
  Particle.variable("blinking", &blinkState, INT);
  Particle.function("check", check);
  Particle.function("stop", stop);
  Particle.function("start", start);
  Particle.function("toggle", toggleBlink);
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

