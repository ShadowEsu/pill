# pill_uno: station firmware for an Arduino Uno

The firmware measures and streams. It decides nothing: no verdicts and no curve thresholds, only hardware faults (SOFTWARE-PLAN §1). The run state machine, the plateau/timeout rule and the absorbance math live in the pay service (`pill/pay/src/station.ts`). The verdict comes from the app's rules (`pill/web/src/lib/rules.ts`).

## Flash

```sh
cd ~/calhacks-13
arduino-cli compile --fqbn arduino:avr:uno firmware/pill_uno
arduino-cli upload -p /dev/cu.usbmodem* --fqbn arduino:avr:uno firmware/pill_uno
arduino-cli monitor -p /dev/cu.usbmodem* -c baudrate=115200   # optional: watch the lines, type D B S X 1 2 R
```

Close the monitor before you start the pay service, because only one program can hold the port. Clone boards with a CH340 chip show up as `/dev/cu.usbserial-*`; use that path instead.

Build options are `#define`s at the top of the sketch. You can also pass them on the command line:

```sh
arduino-cli compile --fqbn arduino:avr:uno --build-property "compiler.cpp.extra_flags=-DUSE_OLED=1" firmware/pill_uno
arduino-cli compile --fqbn arduino:avr:uno --build-property "compiler.cpp.extra_flags=-DUSE_DS18B20=1" firmware/pill_uno
```

| option | default | effect |
|---|---|---|
| `USE_OLED` | 0 | SSD1306 on I2C (0x3C) shows the state, the fault and adc0 |
| `OLED_HEIGHT` | 32 | 128×32 frame buffer (512 B). A 128×64 buffer (1 KB) does not fit next to this sketch in the Uno's 2 KB RAM. A 64-row panel driven in 32-row mode shows stretched text. |
| `USE_DS18B20` | 0 | DS18B20 on D2 replaces the 10 k NTC on A2 |

Compile sizes (arduino-cli 1.5.1, core arduino:avr 1.8.8):

| build | flash | RAM (globals) |
|---|---|---|
| default (NTC, no OLED) | 8698 B (26 %) | 761 B (37 %) |
| `USE_OLED=1` | 21236 B (65 %) | 1101 B (53 %), plus 512 B heap for the frame |
| `USE_DS18B20=1` | 10602 B (32 %) | 808 B (39 %) |

## Pin table

| Uno pin | part | wiring |
|---|---|---|
| A0 | inline CdS photoresistor (0°, behind blue filter) | 5 V → LDR → **A0** → 10 kΩ → GND (more light = more counts) |
| A1 | 90° CdS photoresistor (behind green filter) | 5 V → LDR → **A1** → 10 kΩ → GND (more glow = more counts) |
| A2 | 10 kΩ NTC thermistor, B = 3950 (default) | 5 V → 10 kΩ fixed → **A2** → NTC → GND |
| D2 | DS18B20 data (only with `USE_DS18B20=1`) | DQ → **D2**, 4.7 kΩ from D2 to 5 V, VDD 5 V, GND |
| D3 | lid switch (tilt switch or microswitch) | **D3** → switch → GND; internal pull-up; closed lid = LOW |
| D4 | ULN2003 IN1 | 28BYJ-48 through the ULN2003 board |
| D5 | ULN2003 IN2 | |
| D6 | ULN2003 IN3 | |
| D7 | ULN2003 IN4 | |
| D9 | blue LED (~465 nm) | **D9** → 220 Ω → LED anode, cathode → GND |
| D10 | white LED | **D10** → 220 Ω → LED anode, cathode → GND |
| A4 / A5 | SSD1306 SDA / SCL (only with `USE_OLED=1`) | VCC 5 V (or 3.3 V per module), GND |
| 5 V / GND | ULN2003 + motor | Feed the ULN2003 from a separate 5 V supply (≥ 300 mA) with its GND tied to the Uno's GND. If it runs from the Uno's 5 V pin, the motor can sag USB power and trip BROWNOUT. |

## Wiring in words

- **Light path.** Tape the blue LED and the inline LDR on the outside of the container across one corner (path about 1.5 cm), 2 cm above the bottom. Put a piece of blue transparent plastic over the inline LDR so the green riboflavin glow does not reach it. Tape the second LDR on the adjacent face at the same height, 90° from the beam, behind a strip of green bottle plastic: it reads the glow, which only riboflavin produces. Cover all three with black tape and keep the whole box dark. Each LDR is the top half of a divider with a 10 kΩ resistor to GND. If the clear-water reading (blank) sits above ~900, use a smaller resistor (4.7 kΩ). If it sits below ~300, use a larger one (22 kΩ). Aim for blank0 between 500 and 850.
- **White LED.** Optional, on D10. Command `2` selects it instead of blue for the sweep.
- **Thermistor.** The NTC tip goes in the water in a sealed sleeve (heat-shrink or cling film), with the 10 kΩ fixed resistor on the 5 V side.
- **Lid.** Mount a microswitch so the closed lid presses it. A tilt switch works if it is mounted so it is closed (conducting) with the lid down.
- **Paddle.** The 28BYJ-48 plugs into the ULN2003 board, and IN1–IN4 go to D4–D7. The firmware drives it at 12 rpm, which is steady and repeatable (the run needs the same speed every time, not USP speed).

## Serial contract (115200 baud, one JSON line per second, `\n`-terminated)

Boot prints one hello line:

```json
{"v":1,"hello":"pill_uno","adc_max":1023,"fw":"0.1"}
```

Then one line per sweep (SOFTWARE-PLAN §2 field names, Uno scales):

```json
{"v":1,"seq":63,"src":"real","state":"running","t":63.0,"led":"blue","adc0":468,"adc90":101,"temp_c":24.6,"paddle":12,"dark":[9,6],"blank":[728,93],"fault":null}
```

| field | Uno meaning |
|---|---|
| `adc0`, `adc90` | 24-sample means, **0–1023** (`adc_max` in the hello). Dark is not subtracted. |
| `dark` | `[adc0, adc90]` with both LEDs off, taken at the start of every sweep |
| `blank` | `[adc0, adc90]` latched by `B` from the last sweep; `null` until then |
| `led` | the LED lit during this sweep: `"blue"` or `"white"`. It is pulsed only while reading (riboflavin is light-sensitive). |
| `temp_c` | NTC B-value equation (B 3950, R0 10 kΩ at 25 °C), one decimal |
| `paddle` | commanded stepper speed in rpm (12 when on, 0 off). The ESP32 contract's 0–255 PWM duty does not apply to a stepper; the bridge only checks `> 0`. |
| `t` | seconds since `S`, one decimal; 0 when not running |
| `state` | echo of the last command (`idle`, `dark`, `blank`, `running`). The pay service owns the real state machine. |
| `src` | always `"real"` |

One sweep, every 1000 ms: LEDs off → dark (24 samples each of A0 and A1, interleaved) → selected LED on → settle 30 ms → reading (24 samples each) → LED off → temperature (24 samples of A2).

Commands are single bytes. Anything else, including `\r` and `\n`, is ignored.

| byte | effect |
|---|---|
| `D` | take a dark (and a full sweep) now; state `dark` |
| `B` | latch `blank` from the last sweep; state `blank` |
| `S` | paddle on, t = 0; state `running` |
| `X` | paddle off (coils released); state `idle` |
| `1` / `2` | blue / white LED for the sweeps |
| `R` | reset: clears blank, t, seq and pending faults, paddle off, blue LED, state `idle` |

Faults (hardware only, first match wins, one per line; `null` when none):

| fault | condition (10-bit) |
|---|---|
| `BROWNOUT` | reset cause was brown-out (BORF), reported once on the first line after boot |
| `LID_OPEN` | D3 reads HIGH (switch open), or dark0 > 100 (light leak; 400 on 12-bit) |
| `THERM_OPEN` | A2 mean < 5 or > 1018 (NTC shorted or open); DS18B20 build: sensor not found |
| `TEMP_RANGE` | temperature < 15.0 or > 40.0 °C |
| `ADC_SAT` | adc0 or adc90 ≥ 1000 (4000 on 12-bit) |
| `LED_DEAD` | a blank exists and blank0 − dark0 < 75 (300 on 12-bit) |

BROWNOUT detection reads MCUSR and the copy that optiboot leaves in r2. If the bootloader on a clone clears the flags without passing them on, a brown-out reset is not reported. It shows up only as a new hello line, which the bridge treats as a reset mid-run.

## Paddle trade-off (non-blocking stepping)

`Stepper::step(n)` blocks until all n steps are done, and at 12 rpm one revolution takes 5 s. To keep the 1 Hz sweep, the loop issues **one step per 2441 µs** (`STEP_US`). It also services the stepper between every `analogRead` (~112 µs each) and during the 30 ms LED settle. The JSON line is written only as fast as the 64-byte TX buffer frees, so `Serial` never blocks. Costs:

- The paddle jitters by up to ~0.25 ms per step during a sweep. That is about 1 % of the step period, and the average speed is unchanged.
- With `USE_OLED=1`, the I2C frame transfer (~13 ms at 128×32) pauses the paddle once a second, about five missed steps per revolution-second (~1 %).
- When the paddle stops, the coils are de-energised, so the motor does not hold position (it does not need to).

## How the run uses it

The pay service sends `R 1 D`, reads 3 dark lines, then 10 blank lines (CV(adc0) < 2 %, up to 3 tries), then sends `B`. After that it sends `S` and streams until the plateau (20-s slope of A below ε after 60 s) or the timeout (180 s). See the "Station" section in `pill/pay/README.md`.
