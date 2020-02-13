// --------------
// Blank user app
// --------------
SYSTEM_MODE(SEMI_AUTOMATIC);

String name = "blank";
int version = 1;

void setup() {
  Particle.variable("name", &name, STRING);
  Particle.variable("version", &version, INT);
  Particle.function("check", check);
  Particle.connect();
}

void loop() {
  delay(500);
  Particle.publish("heartbeat", "ok", 60, PRIVATE);
}

int check(String){
  return 200;
}

