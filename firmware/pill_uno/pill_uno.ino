// pill_uno: Pill station firmware for an Arduino Uno (ATmega328P, 5 V, 10-bit ADC).
// It measures and streams. It decides nothing: no verdicts, no curve thresholds; only hardware faults (SOFTWARE-PLAN §1).
// One JSON line per second at 115200 baud (SOFTWARE-PLAN §2), counts on the Uno's 0-1023 scale (`adc_max` in the hello line).
// Pin table, wiring and the serial contract: README.md next to this file.
#include <Arduino.h>
#include <Stepper.h>
#include <avr/io.h>

#ifndef USE_OLED
#define USE_OLED 0       // 1 = SSD1306 on I2C (A4 SDA, A5 SCL) at 0x3C shows state + adc0
#endif
#ifndef OLED_HEIGHT
#define OLED_HEIGHT 32   // 128x32 frame buffer = 512 B of heap; a 128x64 frame (1 KB) does not fit next to this sketch
#endif
#ifndef USE_DS18B20
#define USE_DS18B20 0    // 1 = DS18B20 on D2 (OneWire) instead of the 10 k NTC on A2
#endif

#if USE_OLED
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#endif
#if USE_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
#endif

// ---- pins ----
const uint8_t PIN_INLINE = A0;     // CdS photoresistor at 0° (behind blue filter), high side of a divider
const uint8_t PIN_GLOW90 = A1;     // CdS photoresistor at 90° (behind green filter), high side of a divider
const uint8_t PIN_THERM = A2;      // 10 k NTC to GND, 10 k fixed to 5 V
const uint8_t PIN_ONEWIRE = 2;     // DS18B20 data (only when USE_DS18B20)
const uint8_t PIN_LID = 3;         // lid switch to GND, INPUT_PULLUP: LOW = closed
const uint8_t PIN_IN1 = 4, PIN_IN2 = 5, PIN_IN3 = 6, PIN_IN4 = 7;  // ULN2003 IN1..IN4
const uint8_t PIN_LED_BLUE = 9;    // blue LED (~465 nm) via 220 R
const uint8_t PIN_LED_WHITE = 10;  // white LED via 220 R

// ---- timing and hardware-fault limits (10-bit scale) ----
const uint32_t SWEEP_MS = 1000;
const uint8_t SETTLE_MS = 30;
const uint8_t NSAMP = 24;          // 24-sample mean per reading
const int DARK_LID_MAX = 100;      // dark0 above this = light leak = LID_OPEN (400 on the 12-bit contract)
const int ADC_SAT_MIN = 1000;      // either channel at/above = ADC_SAT (4000 on 12-bit)
const int LED_MIN_SPAN = 75;       // blank0 - dark0 below this = LED_DEAD (300 on 12-bit)
const int THERM_LO = 5, THERM_HI = 1018;  // NTC divider rails = THERM_OPEN (short / open)
const int TEMP_MIN_C10 = 150, TEMP_MAX_C10 = 400;  // TEMP_RANGE outside 15.0-40.0 °C

// ---- stepper: 28BYJ-48 is 2048 steps/rev in full-step mode; the library wants the coil order IN1, IN3, IN2, IN4 ----
const int STEPS_PER_REV = 2048;
const uint8_t PADDLE_RPM = 12;
const uint32_t STEP_US = 60UL * 1000UL * 1000UL / STEPS_PER_REV / PADDLE_RPM;  // 2441 us
Stepper paddle(STEPS_PER_REV, PIN_IN1, PIN_IN3, PIN_IN2, PIN_IN4);

#if USE_OLED
Adafruit_SSD1306 oled(128, OLED_HEIGHT, &Wire, -1);
bool oledOk = false;
#endif
#if USE_DS18B20
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature ds(&oneWire);
#endif

// ---- reset cause: optiboot passes MCUSR in r2 before clearing it; without a bootloader MCUSR is still set ----
uint8_t bootFlags __attribute__((section(".noinit")));
void captureBootFlags(void) __attribute__((naked, used, section(".init0")));
void captureBootFlags(void) { __asm__ __volatile__("sts %0, r2\n" : "=m"(bootFlags) :); }

// ---- run state (echo only; the backend owns the real state machine) ----
enum StateEcho : uint8_t { ST_IDLE, ST_DARK, ST_BLANK, ST_RUNNING };
const char *const STATE_NAMES[] = {"idle", "dark", "blank", "running"};
StateEcho state = ST_IDLE;
bool paddleOn = false;
bool useWhite = false;
bool brownoutPending = false;
bool haveBlank = false;
uint32_t seq = 0;
uint32_t t0Ms = 0;
uint32_t lastSweepMs = 0;
uint32_t lastStepUs = 0;
bool sweepNow = false;

int dark0 = 0, dark90 = 0, adc0 = 0, adc90 = 0, blank0 = 0, blank90 = 0;
int thermRaw = 512;
int tempC10 = 0;   // tenths of °C

// ---- non-blocking line output: the line goes out as the TX buffer frees, so the paddle keeps stepping ----
char line[232];
uint8_t lineLen = 0, linePos = 0;

void serviceStepper() {
  if (!paddleOn) return;
  uint32_t now = micros();
  if (now - lastStepUs >= STEP_US) {
    lastStepUs = now;
    paddle.step(1);  // returns at once: the library's own step delay has already elapsed
  }
}

void serviceOutput() {
  while (linePos < lineLen && Serial.availableForWrite() > 0) Serial.write(line[linePos++]);
}

// Busy wait that keeps the paddle and the serial line moving.
void waitMs(uint16_t ms) {
  uint32_t start = millis();
  while (millis() - start < ms) { serviceStepper(); serviceOutput(); }
}

// 24-sample means of both LDR channels, interleaved, servicing the stepper between conversions (~112 us each).
void readPair(int &a0, int &a90) {
  uint32_t s0 = 0, s90 = 0;
  for (uint8_t i = 0; i < NSAMP; i++) {
    s0 += analogRead(PIN_INLINE);
    serviceStepper();
    s90 += analogRead(PIN_GLOW90);
    serviceStepper();
  }
  a0 = (int)((s0 + NSAMP / 2) / NSAMP);
  a90 = (int)((s90 + NSAMP / 2) / NSAMP);
}

void ledsOff() { digitalWrite(PIN_LED_BLUE, LOW); digitalWrite(PIN_LED_WHITE, LOW); }

void paddleStop() {
  paddleOn = false;
  // de-energise the coils so the ULN2003 and the motor do not sit warm between runs
  digitalWrite(PIN_IN1, LOW); digitalWrite(PIN_IN2, LOW); digitalWrite(PIN_IN3, LOW); digitalWrite(PIN_IN4, LOW);
}

void readTemperature() {
#if USE_DS18B20
  float c = ds.getTempCByIndex(0);       // last finished conversion (requested one sweep ago)
  ds.requestTemperatures();              // async: setWaitForConversion(false) in setup
  if (c == DEVICE_DISCONNECTED_C) { thermRaw = 0; tempC10 = 0; return; }
  thermRaw = 512;                        // no divider: THERM_OPEN comes from the disconnected reading above
  tempC10 = (int)(c * 10.0f + (c >= 0 ? 0.5f : -0.5f));
#else
  uint32_t s = 0;
  for (uint8_t i = 0; i < NSAMP; i++) { s += analogRead(PIN_THERM); serviceStepper(); }
  thermRaw = (int)((s + NSAMP / 2) / NSAMP);
  if (thermRaw < THERM_LO || thermRaw > THERM_HI) { tempC10 = 0; return; }
  // NTC on the low side: R = 10k * adc / (1023 - adc); B-value equation, B = 3950, R0 = 10 k at 25 °C
  float r = 10000.0f * thermRaw / (1023.0f - thermRaw);
  float invT = 1.0f / 298.15f + log(r / 10000.0f) / 3950.0f;
  float c = 1.0f / invT - 273.15f;
  tempC10 = (int)(c * 10.0f + (c >= 0 ? 0.5f : -0.5f));
#endif
}

void sweep() {
  ledsOff();
  readPair(dark0, dark90);                                   // dark before every sweep
  uint8_t pin = useWhite ? PIN_LED_WHITE : PIN_LED_BLUE;
  digitalWrite(pin, HIGH);                                   // pulsed only while reading (riboflavin is light-sensitive)
  waitMs(SETTLE_MS);
  readPair(adc0, adc90);
  ledsOff();
  readTemperature();
}

// Hardware faults only, first match wins. BROWNOUT is reported once, on the first line after boot.
const char *fault() {
  if (brownoutPending) { brownoutPending = false; return "BROWNOUT"; }
  if (digitalRead(PIN_LID) == HIGH || dark0 > DARK_LID_MAX) return "LID_OPEN";
#if USE_DS18B20
  if (thermRaw == 0) return "THERM_OPEN";
#else
  if (thermRaw < THERM_LO || thermRaw > THERM_HI) return "THERM_OPEN";
#endif
  if (tempC10 < TEMP_MIN_C10 || tempC10 > TEMP_MAX_C10) return "TEMP_RANGE";
  if (adc0 >= ADC_SAT_MIN || adc90 >= ADC_SAT_MIN) return "ADC_SAT";
  if (haveBlank && blank0 - dark0 < LED_MIN_SPAN) return "LED_DEAD";
  return nullptr;
}

// Fixed-point tenths → "-12.3" without float printf (AVR snprintf has no %f).
void tenths(char *out, size_t n, long v) {
  bool neg = v < 0;
  if (neg) v = -v;
  snprintf(out, n, "%s%ld.%ld", neg ? "-" : "", v / 10, v % 10);
}

void emit() {
  char tBuf[12], cBuf[10], blankBuf[20], faultBuf[16];
  uint32_t tMs = state == ST_RUNNING ? millis() - t0Ms : 0;
  tenths(tBuf, sizeof tBuf, (long)(tMs / 100));
  tenths(cBuf, sizeof cBuf, tempC10);
  if (haveBlank) snprintf(blankBuf, sizeof blankBuf, "[%d,%d]", blank0, blank90);
  else strcpy(blankBuf, "null");
  const char *f = fault();
  if (f) snprintf(faultBuf, sizeof faultBuf, "\"%s\"", f);
  else strcpy(faultBuf, "null");
  int n = snprintf(line, sizeof line,
                   "{\"v\":1,\"seq\":%lu,\"src\":\"real\",\"state\":\"%s\",\"t\":%s,\"led\":\"%s\",\"adc0\":%d,\"adc90\":%d,"
                   "\"temp_c\":%s,\"paddle\":%u,\"dark\":[%d,%d],\"blank\":%s,\"fault\":%s}\n",
                   (unsigned long)seq++, STATE_NAMES[state], tBuf, useWhite ? "white" : "blue", adc0, adc90,
                   cBuf, paddleOn ? PADDLE_RPM : 0, dark0, dark90, blankBuf, faultBuf);
  lineLen = (uint8_t)min(n, (int)sizeof line - 1);
  linePos = 0;
#if USE_OLED
  if (oledOk) {
    // row 0 (size 1): state and fault; rows 12-27 (size 2): the inline reading
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.print(STATE_NAMES[state]);
    oled.print(' ');
    oled.print(f ? f : "ok");
    oled.setTextSize(2);
    oled.setCursor(0, 12);
    oled.print(F("A0 "));
    oled.print(adc0);
    oled.display();  // blocking I2C transfer (~13 ms at 128x32) once a second: the paddle pauses that long
  }
#endif
}

void command(char c) {
  switch (c) {
    case 'D': state = ST_DARK; sweepNow = true; break;                       // fresh dark (and reading) now
    case 'B': blank0 = adc0; blank90 = adc90; haveBlank = true; state = ST_BLANK; break;  // latch from the last sweep
    case 'S': paddleOn = true; lastStepUs = micros(); t0Ms = millis(); state = ST_RUNNING; break;
    case 'X': paddleStop(); state = ST_IDLE; break;
    case '1': useWhite = false; break;
    case '2': useWhite = true; break;
    case 'R': paddleStop(); haveBlank = false; blank0 = blank90 = 0; seq = 0; t0Ms = 0; brownoutPending = false;
              useWhite = false; state = ST_IDLE; break;
    default: break;  // \r, \n and anything else are ignored
  }
}

void setup() {
  uint8_t flags = MCUSR | bootFlags;
  MCUSR = 0;
  brownoutPending = (flags & _BV(BORF)) != 0;

  pinMode(PIN_LED_BLUE, OUTPUT);
  pinMode(PIN_LED_WHITE, OUTPUT);
  ledsOff();
  pinMode(PIN_LID, INPUT_PULLUP);
  pinMode(PIN_IN1, OUTPUT); pinMode(PIN_IN2, OUTPUT); pinMode(PIN_IN3, OUTPUT); pinMode(PIN_IN4, OUTPUT);
  paddle.setSpeed(PADDLE_RPM);
  paddleStop();

  Serial.begin(115200);
#if USE_DS18B20
  ds.begin();
  ds.setResolution(10);
  ds.setWaitForConversion(false);
  ds.requestTemperatures();
#endif
#if USE_OLED
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (oledOk) { oled.setTextColor(SSD1306_WHITE); oled.clearDisplay(); oled.display(); }
#endif
  Serial.println(F("{\"v\":1,\"hello\":\"pill_uno\",\"adc_max\":1023,\"fw\":\"0.1\"}"));
  lastSweepMs = millis() - SWEEP_MS;  // first sweep right away
}

void loop() {
  while (Serial.available() > 0) command((char)Serial.read());
  serviceStepper();
  serviceOutput();
  uint32_t now = millis();
  if (sweepNow || now - lastSweepMs >= SWEEP_MS) {
    // a new line only once the previous one has fully left, so lines never interleave
    if (linePos < lineLen) return;
    sweepNow = false;
    lastSweepMs = now;
    sweep();
    emit();
  }
}
