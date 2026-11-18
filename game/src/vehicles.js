// Coral Bay — vehicles: low-poly cars built from boxes, arcade driving,
// car-jacking, damage smoke and a drivable speedboat for the finale.
import * as THREE from 'three';
import { CAR_DEFS, WORLD } from './config.js';
import { mulberry32, range, clamp, angleLerp } from './rng.js';
import { resolveColliders } from './world.js';

export function buildCarMesh(def, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.18, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z);
    g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), headMat);
    h.position.set(x, 0.72, 2.22); g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.1), tailMat);
    t.position.set(x, 0.72, -2.22); g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    bar.position.set(0, 1.55, -0.2); bar.userData.isLightbar = true; g.add(bar);
    const bar2 = bar.clone(); bar2.material = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    bar2.position.x = 0; bar2.scale.x = 0.5; bar2.position.set(0.3, 1.55, -0.2);
    g.add(bar2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  if (opts.taxiSign) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe94a }));
    sign.position.set(0, 1.56, -0.2); g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export function buildBoatMesh() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 7.5),
    new THREE.MeshLambertMaterial({ color: 0xe84a3a }));
  hull.position.y = 0.5; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 5.5),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  deck.position.y = 1.1; g.add(deck);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  motor.position.set(0, 0.9, -3.8); g.add(motor);
  return g;
}

export function createVehicleSystem(scene, world) {
  const rand = mulberry32(21);
  const vehicles = [];   // drivable / stealable cars
  const trafficCars = []; // AI cars (owned by traffic.js, listed here for collisions)

  function addVehicle(defKey, x, z, heading, opts = {}) {
    const def = CAR_DEFS[defKey];
    const mesh = buildCarMesh(def, opts);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const v = {
      defKey, def, mesh, x, z, heading, speed: 0, steer: 0,
      health: 100, smoke: null, isPlayer: false, isPolice: !!opts.police,
      isBoat: false, parked: opts.parked !== false, ai: null,
    };
    vehicles.push(v);
    return v;
  }

  // Parked cars scattered on roads (stealable) + a few owned-by-player garage slots
  const parkSpots = [];
  for (let i = 0; i < 26; i++) {
    const gx = Math.floor(range(rand, -4, 5)) * WORLD.roadGap;
    const gz = Math.floor(range(rand, -4, 5)) * WORLD.roadGap;
    const along = rand() < 0.5;
    const x = along ? gx + range(rand, -20, 20) : gx + 8;
    const z = along ? gz + 8 : gz + range(rand, -20, 20);
    if (x < WORLD.beachX + 14) continue;
    parkSpots.push({ x, z, heading: along ? 0 : Math.PI / 2 });
  }
  const parkKeys = ['coupe', 'sedan', 'pickup', 'taxi', 'sedan', 'coupe', 'muscle', 'pickup'];
  parkSpots.forEach((s, i) => {
    addVehicle(parkKeys[i % parkKeys.length], s.x, s.z, s.heading, { parked: true, taxiSign: parkKeys[i % parkKeys.length] === 'taxi' });
  });
  // player's starter coupe near spawn
  const starter = addVehicle('coupe', world.spawn.x + 6, world.spawn.z + 4, Math.PI / 2, { parked: true });
  starter.owned = true;

  // drivable speedboat moored at the pier
  const boatMesh = buildBoatMesh();
  boatMesh.position.set(world.marina.x - 8, 0.1, 4);
  scene.add(boatMesh);
  const boat = {
    defKey: 'boat', def: { name: 'Tide Skipper', top: 30, accel: 14, grip: 2.0 },
    mesh: boatMesh, x: world.marina.x - 8, z: 4, heading: -Math.PI / 2,
    speed: 0, steer: 0, health: 100, isPlayer: false, isBoat: true, parked: true,
  };
  vehicles.push(boat);

  function drive(v, input, dt, onCrash) {
    const def = v.def;
    const throttle = input.axis('KeyS', 'KeyW');
    const steerIn = input.axis('KeyA', 'KeyD');
    const handbrake = input.down('Space');
    if (throttle > 0) v.speed += def.accel * dt * (v.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) v.speed -= def.accel * 0.9 * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
    if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
    v.speed = clamp(v.speed, -12, def.top * (v.health < 40 ? 0.65 : 1));
    const turn = steerIn * def.grip * dt * clamp(Math.abs(v.speed) / 8, 0, 1) * (v.speed < 0 ? -1 : 1);
    v.heading += turn;
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    // world bounds + building collision
    v.x = clamp(v.x, -WORLD.size, WORLD.size);
    v.z = clamp(v.z, -WORLD.size, WORLD.size);
    const hit = resolveColliders(v, 1.6, world.colliders);
    if (hit && Math.abs(v.speed) > 6) {
      v.speed *= -0.25; v.health -= 6;
      if (onCrash) onCrash();
    }
    // water: cars stop at the shoreline (the pier corridor |z| < 7 stays drivable to the dock)
    const shore = Math.abs(v.z) < 7 ? -352 : WORLD.waterX + 2;
    if (!v.isBoat && v.x < shore) { v.x = shore; v.speed *= 0.4; }
    if (v.isBoat) {
      if (v.x > WORLD.waterX + 4) { v.x = WORLD.waterX + 4; v.speed *= 0.5; }
      v.mesh.position.y = 0.1 + Math.sin(performance.now() * 0.002) * 0.12;
    }
    v.mesh.position.set(v.x, v.isBoat ? v.mesh.position.y : 0, v.z);
    v.mesh.rotation.y = v.heading;
    v.mesh.rotation.z = -turn * 2.2;
    if (v.mesh.userData.wheels) {
      for (const w of v.mesh.userData.wheels) w.rotation.x += v.speed * dt * 2;
    }
  }

  function nearestVehicle(x, z, maxD = 5) {
    let best = null, bd = maxD;
    for (const v of vehicles) {
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  return {
    vehicles, trafficCars, starter, boat,
    addVehicle, drive, nearestVehicle,
    updateDamageSmoke(v, effects) {
      if (v.health < 55 && !v.smoke) v.smoke = effects.attachSmoke(v.mesh);
      if (v.health >= 55 && v.smoke) { effects.detachSmoke(v.smoke); v.smoke = null; }
    },
  };
}
