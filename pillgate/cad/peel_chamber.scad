// ============================================================================
//  PEEL-style optical dissolution chamber  --  parametric OpenSCAD
//  Cal Hacks 13.0 | hardware lead: Aaron
//
//  What it is
//    A dark, light-tight "well" that a clear cup drops into.
//      * LED pod  (one side)  : up to 5 LEDs (blue, white, green, red, IR) shine into a
//                               white MIXING CAVITY, then through a DIFFUSER plate, so the
//                               light enters the cup as one soft, even glow.
//      * LDR "A"  (opposite)  : photoresistor straight across the cup = TRANSMITTED light.
//      * LDR "B"  (90 deg)    : photoresistor on the side            = SCATTERED light
//                               (a dissolving tablet clouds the water and scatters light).
//      * Lid                  : overlapping skirt + plug = light trap, motor tower for the
//                               paddle stirrer, thermistor hole.
//
//  HOW TO USE
//    1. MEASURE YOUR CUP and edit the "MEASURE THESE" block (cup_d is the big one).
//    2. In OpenSCAD set  part = "body" / "lid" / "lid_dc" / "paddle" / "coupler" / "diffuser" / "all"
//       (or use the pre-rendered STLs in this folder).
//         "lid"     = PLAIN lid, no motor (LEAN BUILD: you swirl the cup by hand)   <- default
//         "lid_dc"  = lid with a DC-motor tower; also print "paddle" + "coupler"
//         A 28BYJ-48 stepper lid is NOT modelled (shaft is off-centre; measure yours first).
//    3. Print BLACK filament, 3+ perimeters, 20% infill, no supports needed (see README notes).
//
//  All numbers are millimetres.  Everything here is a first guess - test-fit, then tweak.
// ============================================================================

$fn = 72;
part = "all";   // "body" | "lid" | "lid_dc" | "paddle" | "coupler" | "diffuser" | "plate" | "all"
                // "plate" = body + plain lid side by side; "plate_full" = plate + 3 cup shim rings (ONE print, black filament)
stirrer = "none";   // only used by part="all": "none" (plain lid) or "dc" (motor lid + paddle + coupler)

// ------------------------- MEASURE THESE ------------------------------------
cup_d        = 62;    // OUTSIDE diameter of your clear cup at beam height (calipers / ruler)
clear        = 1.0;   // radial gap between cup and well (cup must drop in easily)
well_h       = 74;    // depth of the well = CUP HEIGHT + 12  (the lid plug dips 8 mm into the well, +4 mm air).  74 -> cup max ~62 mm tall
beam_z       = 28;    // height of light beam above the well floor (water must cover this!)
motor_w      = 15.8;  // DC motor body width  (common "130" hobby motor = 15.4)
motor_l      = 20.8;  // DC motor body length (common "130" hobby motor = 20.4)
motor_h      = 25.5;  // DC motor body height (common "130" hobby motor = 25)
rod_d        = 3.0;   // stir rod = BBQ skewer / dowel / carbon rod diameter
shaft_d      = 2.0;   // motor shaft diameter
boss_d       = 7.5;   // hole for the round bearing bump around the shaft of a '130' motor (lets the motor sit flat)
ldr_d        = 5.4;   // photoresistor head diameter (5 mm GL5528 -> 5.4 hole)
led_hole     = 5.2;   // 5 mm LED hole (3 mm LEDs: use 3.2)

// ------------------------- STRUCTURE ----------------------------------------
wall         = 3.0;
floor_t      = 4.0;
well_d       = cup_d + 2*clear;
Rw           = well_d/2;           // well radius
Ro           = Rw + wall;          // body outer radius
body_h       = floor_t + well_h;
axis_z       = floor_t + beam_z;   // beam centre height (absolute)

// LED pod
led_w        = 30;     // pod outer width
led_h        = 30;     // pod outer height
led_depth    = 26;     // how far the pod sticks out of the body
cav_w        = 24;     // mixing cavity width/height
win_w        = 16;     // window (light exit) width/height
diff_t       = 1.4;    // diffuser slot thickness (plate printed at 0.8, or use paper/tape)
led_pitch    = 8;      // distance between LED holes

// LDR bosses
ldr_boss_d   = 14;
ldr_boss_len = 6;      // how far the boss sticks out of the body wall

// Lid
lid_wall     = 2.4;
lid_plate    = 3.0;
skirt_h      = 8;      // skirt AND plug depth (both stand on the build plate)
lid_fit      = 0.5;    // skirt clearance around the body

// Paddle
paddle_r     = 18;
paddle_hub_d = 9;
paddle_hub_h = 10;
paddle_blade_h = 10;
paddle_t     = 1.6;
coupler_h    = 14;
coupler_d    = 9;

// ---- derived stir-rod length (printed in the console) ----
plug_bottom_abs = body_h - skirt_h;
coupler_top_abs = plug_bottom_abs - 0.5;
coupler_bot_abs = coupler_top_abs - coupler_h;
rod_top_abs     = coupler_bot_abs + 8;                    // rod sits 8 mm into coupler
paddle_hub_bot  = floor_t + 2 + 5;                        // 2 mm cup base + 5 mm gap
rod_bottom_abs  = paddle_hub_bot + 8;                     // rod sits 8 mm into hub
if (stirrer == "dc") echo(str("STIR ROD LENGTH = ", rod_top_abs - rod_bottom_abs, " mm (cut a bit long, trim to fit)"));
echo(str("BEAM CENTRE is ", beam_z, " mm above the well floor. Fill water to at least ", beam_z + 12, " mm above the cup floor."));

// =============================== BODY =======================================
module pod_outer(depth, w, h) {
    // block that sticks out of the wall, hulled down to the floor so it prints without supports
    hull() {
        translate([Ro-8, -w/2, axis_z-h/2]) cube([depth+8, w, h]);
        translate([Ro-8, -w/2, 0])          cube([depth+8, w, 0.5]);
    }
}

module led_pod_cuts() {
    // mixing cavity
    translate([Ro+2, -cav_w/2, axis_z-cav_w/2]) cube([led_depth-5, cav_w, cav_w]);
    // window into the well
    translate([Rw-1, -win_w/2, axis_z-win_w/2]) cube([(Ro+2)-(Rw-1)+0.01, win_w, win_w]);
    // diffuser slot (open at the top of the pod so the plate slides in from above)
    translate([Ro+0.3, -(win_w+10)/2, axis_z-11]) cube([diff_t, win_w+10, 11+led_h/2+1]);
    // LED holes through the back wall : centre + 4 around it
    for (p = [[0,0],[led_pitch,0],[-led_pitch,0],[0,led_pitch],[0,-led_pitch]])
        translate([Ro+led_depth-4.5, p[0], axis_z+p[1]]) rotate([0,90,0])
            cylinder(d=led_hole, h=8);
}

module ldr_boss_solid() {
    hull() {
        translate([Ro-8, 0, axis_z]) rotate([0,90,0]) cylinder(d=ldr_boss_d, h=8+ldr_boss_len);
        translate([Ro-8, -ldr_boss_d/2, 0]) cube([8+ldr_boss_len, ldr_boss_d, 0.5]);
    }
}

module ldr_boss_cuts() {
    // pocket: LDR is pushed in from INSIDE the well, legs go out the back
    translate([Rw-1, 0, axis_z]) rotate([0,90,0])
        cylinder(d=ldr_d, h=(Ro+ldr_boss_len-3)-(Rw-1));
    // two leg holes
    for (s = [-1.8, 1.8])
        translate([Ro+ldr_boss_len-4, s, axis_z]) rotate([0,90,0]) cylinder(d=1.7, h=6);
}

module body() {
    difference() {
        union() {
            cylinder(r=Ro, h=body_h);
            rotate([0,0,180]) pod_outer(led_depth, led_w, led_h);                         // LED pod  (-X)
            rotate([0,0,0])   ldr_boss_solid();                                           // LDR A    (+X) transmitted
            rotate([0,0,90])  ldr_boss_solid();                                           // LDR B    (+Y) scattered
        }
        translate([0,0,floor_t]) cylinder(r=Rw, h=well_h+1);                              // the well
        rotate([0,0,180]) led_pod_cuts();
        rotate([0,0,0])   ldr_boss_cuts();
        rotate([0,0,90])  ldr_boss_cuts();
    }
}

// =============================== LID ========================================
// printed in USE orientation: skirt + plug stand on the bed, plate on top, motor tower on top
module lid(motor = true) {
    tower_w = motor_w + 4;
    tower_l = motor_l + 4;
    tower_top = skirt_h + lid_plate + 20;           // tower rises 20 mm above the plate
    pocket_floor = 2;                                // 2 mm floor under the motor (shaft hole)
    difference() {
        union() {
            // plate
            translate([0,0,skirt_h]) cylinder(r=Ro+lid_fit+lid_wall, h=lid_plate);
            // skirt (outer light trap)
            difference() {
                cylinder(r=Ro+lid_fit+lid_wall, h=skirt_h);
                translate([0,0,-0.1]) cylinder(r=Ro+lid_fit, h=skirt_h+0.2);
            }
            // plug (solid so it prints without bridging; enters the well)
            cylinder(r=Rw-0.6, h=skirt_h);
            // motor tower (DC-motor lid only)
            if (motor) translate([-tower_w/2, -tower_l/2, skirt_h]) cube([tower_w, tower_l, tower_top-skirt_h]);
        }
        if (motor) {
            // motor pocket from top, down to pocket_floor
            translate([-motor_w/2, -motor_l/2, pocket_floor]) cube([motor_w, motor_l, tower_top]);
            // shaft hole
            translate([0,0,-0.1]) cylinder(d=boss_d, h=pocket_floor+0.3);
            // motor wire slot (side of tower, near top)
            translate([-3, -tower_l, tower_top-10]) cube([6, tower_l, 8]);
        }
        // probe hole (thermometer / thermistor) through plate + plug - tape over it when unused
        translate([0, -(Rw-12), -0.1]) cylinder(d=3.6, h=skirt_h+lid_plate+0.2);
    }
}

// =============================== PADDLE / COUPLER ===========================
module paddle() {
    difference() {
        union() {
            cylinder(d=paddle_hub_d, h=paddle_hub_h);
            for (a = [0, 90, 180, 270])
                rotate([0,0,a]) translate([0, -paddle_t/2, 0])
                    cube([paddle_r, paddle_t, paddle_blade_h]);
        }
        translate([0,0,paddle_hub_h-8]) cylinder(d=rod_d+0.3, h=8.1);   // rod socket from the top
    }
}

module coupler() {
    difference() {
        cylinder(d=coupler_d, h=coupler_h);
        translate([0,0,-0.1])           cylinder(d=rod_d+0.3, h=8.1);       // rod end (bottom)
        translate([0,0,coupler_h-6.5])  cylinder(d=shaft_d+0.15, h=6.6);    // motor shaft (top)
    }
}

module diffuser() {
    // thin plate: print in WHITE or natural PLA (or use 2 layers of baking paper / frosted tape)
    cube([win_w+9.4, 0.8, 11+led_h/2+2]);
}

// =============================== CUP SHIM RINGS =============================
// Low rings that sit on the well floor around the BASE of a cup that is narrower than the well, so it stays centred.
// Pick the ring the cup sits snugly in (check at ~12 mm above the cup's base).  Height stays below the light window.
shim_ids = [58, 64, 70];     // ring inner diameters, mm
shim_h   = 12;
module shim(id) {
    difference() {
        cylinder(d = well_d - 0.8, h = shim_h);
        translate([0,0,-0.1]) cylinder(d = id, h = shim_h + 0.2);
    }
}

// =============================== SELECT =====================================
if (part == "body")          body();
else if (part == "lid")      lid(false);
else if (part == "lid_dc")   lid(true);
else if (part == "paddle")   paddle();
else if (part == "coupler")  coupler();
else if (part == "diffuser") diffuser();
else if (part == "plate_full") {
    // everything needed, one print: body + plain lid + 3 shim rings
    body();
    translate([Ro + 6 + 8 + (Ro + lid_fit + lid_wall), 0, 0]) lid(false);
    for (i = [0:len(shim_ids)-1])
        translate([-(Ro + led_depth) + (well_d - 0.8)/2 + i*((well_d - 0.8) + 3), -(Ro + 4 + well_d/2) - 10, 0]) shim(shim_ids[i]);
}
else if (part == "plate_stirrer") {
    // second print: motor lid + paddle + 2 couplers (one spare)
    lid(true);
    translate([Ro + lid_fit + lid_wall + 6 + paddle_r, 0, 0]) paddle();
    translate([Ro + lid_fit + lid_wall + 6 + 2*paddle_r + 8, -8, 0]) coupler();
    translate([Ro + lid_fit + lid_wall + 6 + 2*paddle_r + 8,  8, 0]) coupler();
}
else if (part == "plate") {
    body();
    translate([Ro + 6 + 8 + (Ro + lid_fit + lid_wall), 0, 0]) lid(false);
}
else {
    body();
    translate([Ro*2+30, 0, 0]) lid(stirrer == "dc");
    if (stirrer == "dc") {
        translate([0, Ro*2+20, 0]) paddle();
        translate([30, Ro*2+20, 0]) coupler();
    }
    translate([60, Ro*2+20, 0]) diffuser();
}
