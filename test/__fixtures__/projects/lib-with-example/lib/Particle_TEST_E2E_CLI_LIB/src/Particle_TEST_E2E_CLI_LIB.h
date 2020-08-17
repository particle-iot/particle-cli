#ifndef _Particle_TEST_E2E_CLI_LIB_H_
#define _Particle_TEST_E2E_CLI_LIB_H_

class Particle_TEST_E2E_CLI_LIB {

    public:
        uint8_t x = 0;

        Particle_TEST_E2E_CLI_LIB(){};
        Particle_TEST_E2E_CLI_LIB(uint8_t xVal) : x(xVal){}

        uint8_t incr(){
            if (x > 255){
                x = 0;
            } else {
                x = x + 1;
            }
            return x;
        }

};

#endif

