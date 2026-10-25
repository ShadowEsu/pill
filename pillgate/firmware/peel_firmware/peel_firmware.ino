/*
  PEEL-style optical dissolution tester  --  Arduino UNO Q (or UNO R3) firmware v1.0  (NO MOTOR)
  Cal Hacks 13.0  |  hardware lead: Aaron

  This version has NO motor / stirrer code. The cup is stirred by hand with a wooden stick.

  JOB OF THIS BOARD
    Be the clean, boring "sensor brain". Once per second it:
      1. turns every LED off and reads the two photoresistors  -> DARK (room light leaking in)
      2. lights each selected LED one at a time and reads both photoresistors -> LIGHT
      3. prints ONE line of CSV over USB (115200 baud)
    The laptop app does everything smart (curve, verdict, AI, recalls).
    Net signal for a colour = (B_a - dark_a).  Subtracting dark cancels room light.

  UNO Q NOTES (from Arduino's UNO Q datasheet - read before wiring):
    * All GPIO and analog pins are 3.3 V. A0-A5 are NOT 5 V tolerant (max ~3.6 V): power the LDR
      dividers from the 3V3 pin, never from 5V.
    * Blue/white LEDs need ~3 V, so they are wired "active-low": anode (long leg) -> 330 ohm -> 5V pin,
      cathode (short leg) -> Arduino pin. The pin SINKS the current: LOW = LED on, released = LED off.
    * Don't call pinMode() on the analog pins (it breaks analogRead on the UNO Q core).
    * Serial prints go to the IDE Serial Monitor (core >= 0.55: Serial is an alias of Monitor).

  >>> SETTINGS (edit, then Upload) <<<
*/
#define BOARD_UNO_Q      1           // 1 = Arduino UNO Q (3.3 V, 12-bit ADC)   0 = classic UNO R3 (5 V, 10-bit ADC)
#define LED_ACTIVE_LOW   BOARD_UNO_Q // 1 = LED anodes -> 330 ohm -> 5V pin, each cathode -> its pin (UNO Q)
                                     // 0 = each anode -> its pin, cathodes -> one resistor -> GND (UNO R3)
#define USE_THERMISTOR   0           // 1 only if you wired a 10k NTC on A2 (else tie A2 to GND)
#define DEFAULT_TEMP_C   NAN         // water temperature to log, e.g. 36.5 (or send K36.5 from the Serial Monitor)
#define DEFAULT_LEDS     0x0B        // LEDs used every sample: bit0=Blue bit1=White bit2=Green bit3=Red  (0x0B = Blue+White+Red)
                                     // Red is the "reference" colour: riboflavin barely absorbs red, so cloudiness shows on red but colour does not.
#define BOOT_LED_TEST    1           // 1 = after reset, flash blue, white, green, red for 0.4 s each (wiring check)

/*
  WIRING (see roadmap.md for the pictures)   VCC = 3V3 pin on the UNO Q (5V pin on an R3)
    A0  photoresistor A  (across the cup  = transmitted light)   VCC--LDR--A0--10k--GND
    A1  photoresistor B  (90 deg to beam  = scattered light)     VCC--LDR--A1--10k--GND
    A2  jumper to GND (no thermistor)  | thermistor node if USE_THERMISTOR 1:  VCC--10k--A2--NTC--GND
    D5 blue LED | D6 white LED | D7 green LED | D8 red LED | D9 not used
        UNO Q (active-low): long legs twisted together -> ONE 330 ohm -> 5V pin ; each short leg -> its pin
        UNO R3           : each long leg -> its pin ; short legs twisted together -> ONE 220 ohm -> GND
    D11/D12/D13 -> optional RGB status LED (each leg via 220 ohm)

  CSV (one line per second):  ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir
    The last column "stir" is always 0 in this version (kept so the app and older files still match).

  SERIAL COMMANDS  (optional - Serial Monitor: 115200 baud, line ending "Newline")
    ?          help
    L<chars>   LEDs used each sample, any of B W G R      e.g.  LBWR   LBW
    R<ms>      sample period 300..60000                    e.g.  R1000
    G<0|1>     CSV streaming off/on
    T          take ONE sample now and print it
    D<chars>   hold LEDs on (for aiming)                   e.g. DB    D = all off
    V<0|1>     live view: prints "live,adcA,adcB" 5x per second
    C<x>       status RGB LED: R G B Y(yellow) W(white) O(off)
    K<degC>    water temperature you read on a thermometer, e.g. K36.5
  Lines starting with '#' are comments. The CSV header line starts with "ms,".
*/

#include <Arduino.h>
#include <math.h>

#define FW_VERSION "1.1-nomotor"

#if BOARD_UNO_Q
  const uint8_t ADC_BITS = 12;      // 0..4095 over 0..3.3 V
#else
  const uint8_t ADC_BITS = 10;      // 0..1023 over 0..5 V
#endif
const float ADC_MAX = (float)((1UL << ADC_BITS) - 1);

// ----------------------------- PIN MAP --------------------------------------
const uint8_t PIN_LDR_A  = A0;   // transmitted light
const uint8_t PIN_LDR_B  = A1;   // scattered light
const uint8_t PIN_THERM  = A2;   // tie to GND if there is no thermistor

const uint8_t N_LED = 4;
const uint8_t LED_PINS[N_LED] = {5, 6, 7, 8};
const char    LED_IDS[N_LED]  = {'B', 'W', 'G', 'R'};

const uint8_t PIN_ST_R = 11, PIN_ST_G = 12, PIN_ST_B = 13;
const bool STATUS_COMMON_ANODE = false;   // true if your RGB LED's long leg goes to 3V3 (UNO Q) / 5V (R3)

// ----------------------------- TUNING ---------------------------------------
const uint8_t  N_AVG         = 128;      // ADC reads averaged per value
const uint16_t LED_SETTLE_MS = 180;      // CdS photoresistors are slow: wait after switching a LED
// v1.1: every reading is taken first and the line is printed ONCE at the end, so the time between LED switches is
// exactly the same every second (printing over the UNO Q's USB bridge takes a variable time). Photoresistors remember
// recent light for a while, so uneven timing showed up as noise (blue and red moving in opposite directions).
// White (the brightest) is read LAST so its after-glow never leaks into another colour's reading.
const uint8_t READ_ORDER[N_LED] = {0, 3, 2, 1};   // Blue, Red, Green, White

// Thermistor (only if USE_THERMISTOR 1; assumes 10k NTC, B=3950 - check YOUR part)
const float THERM_SERIES_R = 10000.0f;
const float THERM_R0       = 10000.0f;
const float THERM_BETA     = 3950.0f;

// ----------------------------- STATE ----------------------------------------
uint8_t       chMask       = DEFAULT_LEDS & 0x0F;   // bit0=B bit1=W bit2=G bit3=R
bool          streaming    = true;
bool          liveView     = false;
float         manualTemp   = DEFAULT_TEMP_C;
unsigned long samplePeriod = 1000;
unsigned long lastSample   = 0;
unsigned long lastLive     = 0;

char    cmdBuf[24];
uint8_t cmdLen = 0;

// ----------------------------- HELPERS --------------------------------------
float readAvg(uint8_t pin, uint8_t n) {
  analogRead(pin);                       // throw-away read: lets the ADC mux settle
  delayMicroseconds(200);
  uint32_t sum = 0;
  for (uint8_t i = 0; i < n; i++) sum += analogRead(pin);
  return (float)sum / (float)n;
}

void ledWrite(uint8_t i, bool on) {
#if LED_ACTIVE_LOW
  // Anode -> 330 ohm -> 5V pin, cathode -> this pin.  ON = pin driven LOW.  OFF = pin released (input, high-Z):
  // a 3.3 V "HIGH" would leave ~1.7 V across the LED, enough to make a red one glow and spoil the dark reading.
  if (on) { digitalWrite(LED_PINS[i], LOW); pinMode(LED_PINS[i], OUTPUT); }
  else    { pinMode(LED_PINS[i], INPUT); }
#else
  digitalWrite(LED_PINS[i], on ? HIGH : LOW);                             // active-high (UNO R3 wiring)
#endif
}

void allLedsOff() {
  for (uint8_t i = 0; i < N_LED; i++) ledWrite(i, false);
}

void statusWrite(bool r, bool g, bool b) {
  bool inv = STATUS_COMMON_ANODE;
  digitalWrite(PIN_ST_R, r != inv);
  digitalWrite(PIN_ST_G, g != inv);
  digitalWrite(PIN_ST_B, b != inv);
}

void setStatus(char c) {
  switch (c) {
    case 'R': statusWrite(1, 0, 0); break;
    case 'G': statusWrite(0, 1, 0); break;
    case 'B': statusWrite(0, 0, 1); break;
    case 'Y': statusWrite(1, 1, 0); break;
    case 'W': statusWrite(1, 1, 1); break;
    default:  statusWrite(0, 0, 0); break;
  }
}

float readTempC() {
  float adc = readAvg(PIN_THERM, 32);
  if (adc < 2.0f || adc > ADC_MAX - 2.0f) return NAN;   // open / shorted thermistor
  float r = THERM_SERIES_R * adc / (ADC_MAX - adc);      // VCC - Rseries - A2 - NTC - GND
  float invT = 1.0f / 298.15f + log(r / THERM_R0) / THERM_BETA;
  return 1.0f / invT - 273.15f;
}

float tempValue() {
#if USE_THERMISTOR
  return readTempC();
#else
  return manualTemp;                                     // DEFAULT_TEMP_C or whatever you typed with K, else nan
#endif
}

uint8_t maskFromChars(const char *s) {
  uint8_t m = 0;
  for (; *s; s++)
    for (uint8_t i = 0; i < N_LED; i++)
      if (toupper(*s) == LED_IDS[i]) m |= (1 << i);
  return m;
}

// ----------------------------- OUTPUT ---------------------------------------
void printHeader() {
  Serial.print(F("ms,dark_a,dark_b"));
  for (uint8_t i = 0; i < N_LED; i++)
    if (chMask & (1 << i)) {
      Serial.print(','); Serial.print(LED_IDS[i]); Serial.print(F("_a,"));
      Serial.print(LED_IDS[i]); Serial.print(F("_b"));
    }
  Serial.println(F(",temp_c,stir"));
}

void printHelp() {
  Serial.println(F("# PEEL firmware v" FW_VERSION "  commands: ? L<chars> R<ms> G<0|1> T D<chars> V<0|1> C<x> K<degC>"));
}

void takeSample() {
  unsigned long t0 = millis();
  float va[N_LED], vb[N_LED];

  allLedsOff();
  delay(LED_SETTLE_MS);
  float darkA = readAvg(PIN_LDR_A, N_AVG);
  float darkB = readAvg(PIN_LDR_B, N_AVG);

  for (uint8_t k = 0; k < N_LED; k++) {           // read in READ_ORDER, no printing in between
    uint8_t i = READ_ORDER[k];
    if (!(chMask & (1 << i))) continue;
    ledWrite(i, true);
    delay(LED_SETTLE_MS);
    va[i] = readAvg(PIN_LDR_A, N_AVG);
    vb[i] = readAvg(PIN_LDR_B, N_AVG);
    ledWrite(i, false);
  }

  Serial.print(t0); Serial.print(','); Serial.print(darkA, 2); Serial.print(','); Serial.print(darkB, 2);
  for (uint8_t i = 0; i < N_LED; i++) {           // print in the fixed column order B, W, G, R
    if (!(chMask & (1 << i))) continue;
    Serial.print(','); Serial.print(va[i], 2); Serial.print(','); Serial.print(vb[i], 2);
  }
  Serial.print(','); Serial.print(tempValue(), 2);
  Serial.println(F(",0"));                        // "stir" column: always 0 (no motor)

  if (millis() - t0 > samplePeriod) Serial.println(F("# WARN sample took longer than period - raise R or use fewer LEDs"));
}

// ----------------------------- COMMANDS -------------------------------------
void handleCommand(char *s) {
  char c = toupper(s[0]);
  char *arg = s + 1;
  switch (c) {
    case '?': printHelp(); break;
    case 'L': chMask = maskFromChars(arg); printHeader(); break;
    case 'R': samplePeriod = constrain(atol(arg), 300L, 60000L); break;
    case 'G': streaming = (atoi(arg) != 0); if (streaming) { liveView = false; printHeader(); } break;
    case 'T': takeSample(); break;
    case 'D': {
      streaming = false;
      allLedsOff();
      uint8_t m = maskFromChars(arg);
      for (uint8_t i = 0; i < N_LED; i++) if (m & (1 << i)) ledWrite(i, true);
      break;
    }
    case 'V': liveView = (atoi(arg) != 0); if (liveView) streaming = false; break;
    case 'C': setStatus(toupper(arg[0])); break;
    case 'K':
      manualTemp = atof(arg);
      Serial.print(F("# temp_c=")); Serial.println(manualTemp, 1);
      break;
    default: Serial.println(F("# ? unknown command"));
  }
}

void pollSerial() {
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (cmdLen > 0) { cmdBuf[cmdLen] = 0; handleCommand(cmdBuf); cmdLen = 0; }
    } else if (cmdLen < sizeof(cmdBuf) - 1) {
      cmdBuf[cmdLen++] = ch;
    }
  }
}

// ----------------------------- ARDUINO --------------------------------------
void setup() {
  Serial.begin(115200);
#if !LED_ACTIVE_LOW
  for (uint8_t i = 0; i < N_LED; i++) { digitalWrite(LED_PINS[i], LOW); pinMode(LED_PINS[i], OUTPUT); }
#endif
  allLedsOff();                     // start with every LED OFF
#if BOARD_UNO_Q
  analogReadResolution(ADC_BITS);   // NOTE: no pinMode() on A0-A2 on purpose
  delay(2500);                      // the Serial Monitor bridge starts after the Linux side is up: let the banner get through
#endif
  pinMode(PIN_ST_R, OUTPUT); pinMode(PIN_ST_G, OUTPUT); pinMode(PIN_ST_B, OUTPUT);
  setStatus('O');
  delay(300);
  Serial.println(F("# PEEL optical fingerprint firmware v" FW_VERSION));
  Serial.print(F("# build: board=")); Serial.print(BOARD_UNO_Q ? F("UNO_Q") : F("UNO_R3"));
  Serial.print(F(" thermistor=")); Serial.print(USE_THERMISTOR); Serial.print(F(" adc_bits=")); Serial.print(ADC_BITS);
  Serial.print(F(" adc_max=")); Serial.println((long)ADC_MAX);
  printHelp();
#if BOOT_LED_TEST
  Serial.println(F("# LED self-test: blue, white, green, red (0.4 s each; unused ones stay dark)"));
  for (uint8_t i = 0; i < N_LED; i++) { ledWrite(i, true); delay(400); ledWrite(i, false); delay(100); }
#endif
  printHeader();
  lastSample = millis();
}

void loop() {
  pollSerial();

  if (streaming && millis() - lastSample >= samplePeriod) {
    lastSample = millis();
    takeSample();
  }

  if (liveView && millis() - lastLive >= 200) {
    lastLive = millis();
    Serial.print(F("live,"));
    Serial.print(analogRead(PIN_LDR_A)); Serial.print(',');
    Serial.println(analogRead(PIN_LDR_B));
  }
}
