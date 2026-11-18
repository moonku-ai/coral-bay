// Coral Bay — screenshot presets. ?shot=cover|mission|coast|night stages the
// game (time of day, wanted level, mission, camera) and starts it without
// the start screen, so every screenshot is a real render of the live game.
export function applyShotPreset(G, name) {
  const P = G.player, V = G.vehicles;
  function putInCar(key, x, z, heading) {
    const v = V.addVehicle(key, x, z, heading, { parked: false });
    v.owned = true;
    P.inVehicle = v; v.isPlayer = true;
    P.x = x; P.z = z;
    return v;
  }
  if (name === 'cover') {
    // Sunset police chase WEST down the avenue toward the ocean: the sun,
    // the chase target, a cop and the heli all read in one frame.
    G.effects.timeOfDay = 18.4;
    G.effects.raining = false;
    const car = putInCar('sport', -120, 0, -Math.PI / 2);
    car.speed = 22;
    G.shotCruise = 22;
    G.police.setWanted(5);
    G.missions.startMission('M2');
    // a cop right behind the player for the chase read
    const cop = V.addVehicle('police', -95, 0, -Math.PI / 2, { police: true, parked: false });
    G.policeForce = cop;
    G.cameraMode = 'chase-wide';
  } else if (name === 'mission') {
    // Daytime delivery in progress downtown, minimap + objective visible.
    G.effects.timeOfDay = 10.5;
    G.effects.raining = false;
    const car = putInCar('coupe', -140, 0, -Math.PI / 2);
    car.speed = 12;
    G.shotCruise = 14;
    G.missions.startMission('M1');
    G.cameraMode = 'chase';
  } else if (name === 'coast') {
    // Coastal highway cruise in the muscle car, ocean on the left.
    G.effects.timeOfDay = 14.0;
    G.effects.raining = false;
    const car = putInCar('muscle', WORLD_BEACH + 6, -60, 0);
    car.speed = 26;
    G.shotCruise = 26;
    G.missions.startTaxi();
    G.cameraMode = 'chase';
  } else if (name === 'night') {
    // Neon night: player on foot, armed, cops closing in, rain falling.
    G.effects.timeOfDay = 22.2;
    G.effects.raining = true;
    P.x = 0; P.z = 0; P.heading = 0; // face south, toward the neon signs
    P.armed = true; P.gun.visible = true;
    G.police.setWanted(3);
    G.missions.startMission('M3');
    G.cameraMode = 'foot';
  }
  G.started = true;
  G.hud.showScreen(null);
}

import { WORLD } from './config.js';
const WORLD_BEACH = WORLD.beachX;
