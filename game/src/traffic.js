// Coral Bay — ambient life: traffic cars looping the road grid and
// pedestrians strolling the sidewalks, both scattering from gunfire.
import * as THREE from 'three';
import { CAR_DEFS, WORLD } from './config.js';
import { mulberry32, pick, range, clamp } from './rng.js';
import { resolveColliders } from './world.js';
import { buildCarMesh } from './vehicles.js';

export function createTraffic(scene, world, vehicles) {
  const rand = mulberry32(33);
  const cars = [];
  const peds = [];
  const pedColors = [0xe84a6a, 0x4a8ae8, 0x8ae84a, 0xe8c84a, 0x9a4ae8, 0x4ad8d8];

  // --- traffic cars: pick a road, drive its length, turn at the end ---
  const keys = ['sedan', 'coupe', 'pickup', 'taxi', 'sedan'];
  for (let i = 0; i < 14; i++) {
    const key = keys[i % keys.length];
    const mesh = buildCarMesh(CAR_DEFS[key], { taxiSign: key === 'taxi' });
    const horizontal = rand() < 0.5;
    const road = Math.floor(range(rand, -4, 5)) * WORLD.roadGap;
    const x = horizontal ? range(rand, -280, 280) : road + (rand() < 0.5 ? 3 : -3);
    const z = horizontal ? road + (rand() < 0.5 ? 3 : -3) : range(rand, -280, 280);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    cars.push({
      mesh, x, z, horizontal, road,
      dir: rand() < 0.5 ? 1 : -1,
      speed: range(rand, 9, 15),
      heading: horizontal ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI),
      key,
    });
  }

  // --- pedestrians: capsule people with a walk cycle ---
  function makePed() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: pick(rand, pedColors) });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 3, 8), mat);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
    head.position.y = 1.95; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x2a2a33 }));
    legL.position.set(-0.14, 0.3, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
    g.userData.legs = [legL, legR];
    return g;
  }
  for (let i = 0; i < 26; i++) {
    const mesh = makePed();
    const x = range(rand, -280, 300), z = range(rand, -300, 300);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      heading: range(rand, 0, Math.PI * 2),
      speed: range(rand, 1.2, 2.4),
      targetX: x, targetZ: z, panic: 0, walkPhase: rand() * 6,
    });
  }

  function scatter(x, z, radius) {
    for (const p of peds) {
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.panic = 3;
        p.heading = Math.atan2(p.x - x, p.z - z) + range(rand, -0.5, 0.5);
      }
    }
  }

  function update(dt, playerPos) {
    for (const c of cars) {
      const sp = c.speed * dt;
      if (c.horizontal) {
        c.x += Math.sin(c.heading) * sp; c.z += Math.cos(c.heading) * sp;
        if (c.x > 300 || c.x < -300) { c.heading += Math.PI; c.dir *= -1; }
      } else {
        c.x += Math.sin(c.heading) * sp; c.z += Math.cos(c.heading) * sp;
        if (c.z > 300 || c.z < -300) { c.heading += Math.PI; c.dir *= -1; }
      }
      // slow down for the player vehicle ahead
      if (playerPos && Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 8) c.speed = Math.max(4, c.speed - 6 * dt);
      else c.speed = Math.min(15, c.speed + 3 * dt);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    for (const p of peds) {
      if (p.panic > 0) p.panic -= dt;
      const sp = (p.panic > 0 ? 5.5 : p.speed) * dt;
      if (Math.hypot(p.targetX - p.x, p.targetZ - p.z) < 2 || p.panic > 0) {
        if (p.panic <= 0) {
          p.targetX = clamp(p.x + range(rand, -50, 50), -300, 310);
          p.targetZ = clamp(p.z + range(rand, -50, 50), -300, 300);
        }
        p.heading = Math.atan2(p.targetX - p.x, p.targetZ - p.z);
      }
      p.x += Math.sin(p.heading) * sp;
      p.z += Math.cos(p.heading) * sp;
      p.x = clamp(p.x, -300, 310); p.z = clamp(p.z, -300, 300);
      resolveColliders(p, 0.5, world.colliders);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.walkPhase += dt * (p.panic > 0 ? 14 : 7);
      const s = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legs[0].rotation.x = s;
      p.mesh.userData.legs[1].rotation.x = -s;
    }
  }

  return { cars, peds, update, scatter };
}
