import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync(new URL('../src/outlaw-vehicle.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

for (const name of ['WHEEL_FL','RIM_FL','HUB_FL','WHEEL_FR','RIM_FR','HUB_FR','WHEEL_RL','RIM_RL','HUB_RL','WHEEL_RR','RIM_RR','HUB_RR']) {
  assert.match(moduleSource, new RegExp(name));
}
assert.match(moduleSource, /after-clearance-accepted/);
assert.match(moduleSource, /Outlaw_Complete_Clearance_TEXTURED\.glb/);
assert.match(moduleSource, /createCharacterController/);
assert.match(moduleSource, /computedMovement/);
assert.match(moduleSource, /wheelSpin \+= \(speed \/ WHEEL_RADIUS\)/);
assert.match(moduleSource, /smoothSteer \* MAX_STEER/);
assert.match(moduleSource, /handlingDonor: 'Valar05\/long-haul'/);
assert.match(moduleSource, /cockpitAndExteriorSameScene: true/);
assert.match(moduleSource, /WHEELBASE = 3\.528/);
assert.match(moduleSource, /DRIFT_GRIP_RESPONSE = 5\.5/);
assert.match(moduleSource, /OUTLAW_STEERING_WHEEL/);
assert.match(moduleSource, /cameraMode === 'cockpit'/);
assert.match(mainSource, /createOutlawVehicle/);
assert.match(mainSource, /OUTLAW_VEHICLE_MODE/);
assert.match(mainSource, /vehicle=outlaw|URL_PARAMS\.get\('vehicle'\)/);
assert.match(mainSource, /viewState: player/);
assert.match(mainSource, /vehicleCamera/);
assert.match(mainSource, /KeyC/);
assert.match(html, /src\/main\.js\?v=0\.8\.220/);
console.log('Outlaw cockpit + Long Haul vehicle contract: PASS');
