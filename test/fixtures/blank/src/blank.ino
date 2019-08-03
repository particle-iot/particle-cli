// --------------
// Blank user app
// --------------
String name = "blank";
int version = 1;

void setup() {
  Particle.variable("name", &name, STRING);
  Particle.variable("version", &version, INT);
  Particle.function("check", check);
}

void loop() {
  delay(500);
  Particle.publish("heartbeat", "ok", 60, PRIVATE);
}

int check(String){
  return 200;
}

