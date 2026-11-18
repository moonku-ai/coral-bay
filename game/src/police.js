// Coral Bay — the Coral Bay Police Department: a 0–5 wanted level, cruisers
// that chase and ram, roadblocks at 3+, spike strips at 4, and a helicopter
// with a spotlight at 5. Wanted decays when the player stays out of sight.
import * as THREE from 'three';
import { CAR_DEFS } from './config.js';
import { clamp, range } from './rng.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(scene, world, vehicles, audio) {
  const cops = [];
  const roadblocks = [];
  const spikes = [];
  let heli = null, heliLight = null, heliAngle = 0;
  let wanted = 0;
  let heat = 0;          // 0..100, drives wanted changes
  let decayTimer = 0;
  let spawnTimer = 0;
  let roadblockTimer = 0;
  let spikeTimer = 0;

  function wantedTarget() { return clamp(Math.floor(heat / 20), 0, 5); }

  function addCrime(amount, reason) {
    heat = clamp(heat + amount, 0, 100);
    const t = wantedTarget();
    if (t > wanted) {
      wanted = t;
      spawnTimer = 0; // fresh heat brings fresh cops, at once
      if (audio) audio.setSiren(wanted >= 2);
    }
    return { wanted, reason };
  }

  let spawnAttempts = 0;
  function spawnCop(px, pz) {
    spawnAttempts++;
    if (cops.length >= 2 + wanted * 2) return;
    const ang = range(Math.random, 0, Math.PI * 2);
    const x = px + Math.sin(ang) * 55, z = pz + Math.cos(ang) * 55;
    const mesh = buildCarMesh(CAR_DEFS.police, { police: true });
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    cops.push({ mesh, x, z, heading: Math.atan2(px - x, pz - z), speed: 0, health: 60 });
    vehicles.trafficCars.push({ mesh, x, z, isCop: true });
  }

  function spawnRoadblock(px, pz, heading) {
    if (roadblocks.length >= 2) return;
    const fx = px + Math.sin(heading) * 45, fz = pz + Math.cos(heading) * 45;
    const group = new THREE.Group();
    for (const off of [-4, 4]) {
      const m = buildCarMesh(CAR_DEFS.police, { police: true });
      m.position.set(off, 0, 0);
      m.rotation.y = Math.PI / 2;
      group.add(m);
    }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    barrier.position.y = 0.8; group.add(barrier);
    group.position.set(fx, 0, fz);
    group.rotation.y = heading;
    scene.add(group);
    roadblocks.push({ group, x: fx, z: fz, life: 25 });
  }

  function spawnSpikes(px, pz, heading) {
    if (spikes.length >= 2) return;
    const fx = px + Math.sin(heading) * 40, fz = pz + Math.cos(heading) * 40;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x888888 }));
    strip.position.set(fx, 0.15, fz);
    strip.rotation.y = heading;
    scene.add(strip);
    spikes.push({ mesh: strip, x: fx, z: fz, life: 20 });
  }

  function spawnHeli() {
    if (heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    body.position.y = 0; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    tail.position.set(0, 0.2, -4); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1; rotor.userData.isRotor = true; g.add(rotor);
    heliLight = new THREE.SpotLight(0xfff2b0, 60, 90, 0.35, 0.5, 1.2);
    heliLight.position.set(0, -1, 0);
    const target = new THREE.Object3D();
    g.add(target); heliLight.target = target;
    g.add(heliLight);
    g.position.set(0, 55, 0);
    scene.add(g);
    heli = g;
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli); heli = null; heliLight = null;
  }

  function update(dt, player, onBusted) {
    // wanted decay when calm
    decayTimer += dt;
    if (decayTimer > 4) {
      decayTimer = 0;
      if (wanted > 0 && cops.length === 0) heat = Math.max(0, heat - 8);
      else if (wanted > 0) heat = Math.max(0, heat - 2);
      const t = wantedTarget();
      if (t < wanted) {
        wanted = t;
        if (wanted < 2 && audio) audio.setSiren(false);
        if (wanted === 0) { removeHeli(); }
      }
    }
    // spawn cops to match wanted level
    spawnTimer -= dt;
    if (wanted > 0 && spawnTimer <= 0) {
      spawnTimer = 2.5;
      spawnCop(player.x, player.z);
    }
    // roadblocks + spikes at higher wanted
    roadblockTimer -= dt;
    if (wanted >= 3 && roadblockTimer <= 0) {
      roadblockTimer = 18;
      spawnRoadblock(player.x, player.z, player.inVehicle ? player.inVehicle.heading : player.heading);
    }
    spikeTimer -= dt;
    if (wanted >= 4 && spikeTimer <= 0) {
      spikeTimer = 22;
      spawnSpikes(player.x, player.z, player.inVehicle ? player.inVehicle.heading : player.heading);
    }
    // heli at wanted 5
    if (wanted >= 5) spawnHeli(); else if (wanted < 5) removeHeli();

    // cop AI: chase and ram
    for (let i = cops.length - 1; i >= 0; i--) {
      const c = cops[i];
      const dx = player.x - c.x, dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      dh = ((dh + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      c.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
      c.speed = clamp(c.speed + (d > 12 ? 14 : 4) * dt, 0, 34);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // ram damage + bust check
      if (d < 3.2) {
        c.speed *= 0.4;
        if (player.inVehicle) {
          player.inVehicle.health -= 4;
          if (player.inVehicle.health <= 0 && onBusted) onBusted('car destroyed');
        } else {
          player.health -= 6;
          if (player.health <= 0 && onBusted) onBusted('busted');
        }
        // bounce the cop off
        c.x -= Math.sin(c.heading) * 2; c.z -= Math.cos(c.heading) * 2;
      }
      // cops give up far away / despawn when wanted drops
      if (wanted === 0 || d > 260) {
        scene.remove(c.mesh);
        cops.splice(i, 1);
      }
    }
    // roadblock / spike lifetime
    for (let i = roadblocks.length - 1; i >= 0; i--) {
      roadblocks[i].life -= dt;
      if (roadblocks[i].life <= 0 || wanted < 3) { scene.remove(roadblocks[i].group); roadblocks.splice(i, 1); }
    }
    for (let i = spikes.length - 1; i >= 0; i--) {
      const s = spikes[i];
      s.life -= dt;
      if (player.inVehicle && Math.hypot(player.inVehicle.x - s.x, player.inVehicle.z - s.z) < 4.5) {
        player.inVehicle.health -= 25;
        player.inVehicle.speed *= 0.35;
        scene.remove(s.mesh); spikes.splice(i, 1); continue;
      }
      if (s.life <= 0 || wanted < 4) { scene.remove(s.mesh); spikes.splice(i, 1); }
    }
    // heli circles the player, spotlight tracking
    if (heli) {
      heliAngle += dt * 0.35;
      heli.position.set(
        player.x + Math.sin(heliAngle) * 22,
        52 + Math.sin(heliAngle * 2) * 3,
        player.z + Math.cos(heliAngle) * 22);
      heli.rotation.y = Math.atan2(player.x - heli.position.x, player.z - heli.position.z);
      heli.children.forEach((ch) => { if (ch.userData.isRotor) ch.rotation.y += dt * 22; });
      if (heliLight) heliLight.target.position.set(player.x - heli.position.x, -52, player.z - heli.position.z);
    }
    // lightbar flash
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    for (const c of cops) {
      c.mesh.traverse((o) => { if (o.userData.isLightbar) o.material.color.setHex(flash ? 0xff2244 : 0x2244ff); });
    }
  }

  function clearAll() {
    for (const c of cops) scene.remove(c.mesh);
    cops.length = 0;
    for (const r of roadblocks) scene.remove(r.group);
    roadblocks.length = 0;
    for (const s of spikes) scene.remove(s.mesh);
    spikes.length = 0;
    removeHeli();
    wanted = 0; heat = 0;
    if (audio) audio.setSiren(false);
  }

  return {
    get wanted() { return wanted; },
    get copCount() { return cops.length; },
    get spawnAttempts() { return spawnAttempts; },
    get spawnTimer() { return +spawnTimer.toFixed(2); },
    get heliActive() { return !!heli; },
    addCrime, update, clearAll,
    setWanted(n) { wanted = clamp(n, 0, 5); heat = wanted * 20 + 5; spawnTimer = 0; if (audio) audio.setSiren(wanted >= 2); },
  };
}
