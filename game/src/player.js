// Coral Bay — Rae Marlowe on foot: WASD movement, third-person camera,
// punching and shooting, entering and leaving cars and boats.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, angleLerp } from './rng.js';
import { resolveColliders } from './world.js';

export function createPlayer(scene, world, spawn) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 3, 10), jacket);
  body.position.y = 1.1; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 2.0; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0e }));
  hair.position.y = 2.05; g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x22304a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.17), legMat);
  legL.position.set(-0.15, 0.32, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat);
  armL.position.set(-0.5, 1.25, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.5; g.add(armR);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  scene.add(g);

  // simple pistol in the right hand, visible when armed
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.5, 1.05, 0.25); gun.visible = false; g.add(gun);

  const player = {
    mesh: g, gun,
    x: spawn.x, z: spawn.z, heading: spawn.heading,
    health: 100, armor: 0, walkPhase: 0,
    inVehicle: null, armed: false, punchCooldown: 0, shootCooldown: 0,
  };

  function updateOnFoot(input, camera, dt, callbacks) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 8.5 : 4.6;
    const fwd = input.axis('KeyS', 'KeyW');
    const strafe = input.axis('KeyA', 'KeyD');
    // camera-relative movement (camera yaw follows the player heading)
    const cy = player.heading;
    const mx = Math.sin(cy) * fwd + Math.cos(cy) * strafe;
    const mz = Math.cos(cy) * fwd - Math.sin(cy) * strafe;
    const moving = Math.abs(mx) + Math.abs(mz) > 0.01;
    if (moving) {
      const len = Math.hypot(mx, mz);
      player.x += (mx / len) * speed * dt;
      player.z += (mz / len) * speed * dt;
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * (run ? 13 : 8);
    }
    player.x = clamp(player.x, -WORLD.size, WORLD.size);
    player.z = clamp(player.z, -WORLD.size, WORLD.size);
    // No swimming — except the pier corridor (|z| < 7) which is walkable deck.
    const shore = Math.abs(player.z) < 7 ? -352 : WORLD.waterX + 2;
    if (player.x < shore) player.x = shore;
    resolveColliders(player, 0.6, world.colliders);
    const s = moving ? Math.sin(player.walkPhase) * 0.55 : 0;
    g.userData.legs[0].rotation.x = s;
    g.userData.legs[1].rotation.x = -s;
    g.userData.arms[0].rotation.x = -s * 0.7;
    g.userData.arms[1].rotation.x = s * 0.7;
    g.position.set(player.x, 0, player.z);
    g.rotation.y = player.heading;
    // mouse steers the heading when pointer-locked
    const m = input.consumeMouse();
    if (input.locked) player.heading -= m.dx * 0.0035;
    // punch / shoot
    player.punchCooldown -= dt; player.shootCooldown -= dt;
    if (input.pollPressed('KeyF') && player.punchCooldown <= 0) {
      player.punchCooldown = 0.45;
      if (callbacks.onPunch) callbacks.onPunch();
    }
    if (input.mouseDown && player.armed && player.shootCooldown <= 0) {
      player.shootCooldown = 0.22;
      if (callbacks.onShoot) callbacks.onShoot();
    }
    if (input.pollPressed('KeyR')) {
      player.armed = !player.armed;
      gun.visible = player.armed;
      if (callbacks.onArmToggle) callbacks.onArmToggle(player.armed);
    }
    // third-person camera
    const camDist = 7.5, camH = 3.4;
    const tx = player.x - Math.sin(player.heading) * camDist;
    const tz = player.z - Math.cos(player.heading) * camDist;
    camera.position.lerp(new THREE.Vector3(tx, camH, tz), 1 - Math.pow(0.001, dt));
    camera.lookAt(player.x, 1.6, player.z);
  }

  function updateInVehicle(input, camera, dt, vehicle, wide = false) {
    // chase camera behind the car / boat
    const back = vehicle.isBoat ? 12 : (wide ? 16 : 10.5);
    const h = vehicle.isBoat ? 5 : (wide ? 6 : 4.2);
    const tx = vehicle.x - Math.sin(vehicle.heading) * back;
    const tz = vehicle.z - Math.cos(vehicle.heading) * back;
    camera.position.lerp(new THREE.Vector3(tx, h, tz), 1 - Math.pow(0.0005, dt));
    camera.lookAt(vehicle.x + Math.sin(vehicle.heading) * 6, 1.2, vehicle.z + Math.cos(vehicle.heading) * 6);
    player.x = vehicle.x; player.z = vehicle.z;
    g.position.set(vehicle.x, -3, vehicle.z); // hide the on-foot mesh under the car
  }

  return { player, updateOnFoot, updateInVehicle };
}
