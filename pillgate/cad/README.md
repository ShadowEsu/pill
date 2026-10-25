# Chamber CAD: what was printed

`peel_plate_complete.stl` is the plate that was printed for the station (ASCII STL, 7,220 triangles). Measured by
grouping triangles into connected shells (shared vertices) and taking each shell's bounding box and radii. All
sizes in mm.

| Part | Size (mm) | Count |
| --- | --- | --- |
| Chamber body (cylinder + LED box + 2 photoresistor holders, one shell) | cylinder Ø84 × 84 tall; well Ø78, floor 4; footprint 116 × 90 | 1 |
| LED box (on the body, opposite the in-line holder) | 30 wide × 26 out of the wall × 47 tall (hulled to the floor); LED holes on the outer wall, beam centre 32 above the plate (28 above the well floor) | 1 |
| Photoresistor holders (in line, and at 90°) | 14 wide × 6 out of the wall × 39 tall, rounded top | 2 |
| Flat lid (skirt + plug, one hole) | Ø89.8 × 11 (8 skirt + 3 plate); plug Ø76.8; one Ø3.6 hole 27 off centre | 1 |
| Cup shim rings | Ø77.2 × 12; bores Ø58, Ø64, Ø70 | 3 |

Not on this plate: the diffuser plate (`peel_diffuser.stl`) and the stirrer parts (`part = "lid_dc"`, `paddle`,
`coupler` in the SCAD; not built).

The print is larger than the defaults now in `peel_chamber.scad` (`cup_d = 62`, `well_h = 74` give a Ø70 × 78 body).
The measured body matches `cup_d = 76`, `well_h = 80`. The site's drawings (`pill-site/src/station.js`, `art.js`,
`story.js`) use the measured sizes.
