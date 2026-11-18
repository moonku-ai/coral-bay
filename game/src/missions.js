// Coral Bay — missions and side work: six chained story jobs (one fork),
// taxi fares, a repeatable street race and ten hidden parcels.
// A mission is a list of steps; each step is a place, a chase, a timer or
// a trigger, and the engine advances it, pays out and unlocks the next job.
import * as THREE from 'three';
import { MISSIONS, HIDDEN_PACKAGES, PACKAGE_PAY, TAXI_FARE, WORLD } from './config.js';
import { mulberry32, range, clamp } from './rng.js';

export function createMissionSystem(scene, world, G) {
  const rand = mulberry32(77);
  const markerGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.35, 20);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.75 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 20, 1, true), beaconMat);
  marker.visible = false; beacon.visible = false;
  scene.add(marker, beacon);

  // hidden parcels: small glowing crates
  const parcels = [];
  const parcelSpots = [
    [-240, 120], [-180, -220], [64, 192], [128, -128], [256, 64],
    [-64, 256], [192, 256], [0, -256], [-256, -64], [256, -192],
  ];
  for (const [x, z] of parcelSpots) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x7dff6a }));
    m.position.set(x, 0.8, z);
    scene.add(m);
    parcels.push({ mesh: m, x, z, taken: false });
  }

  let current = null;   // active mission runtime
  let taxi = null;      // active taxi job
  let race = null;      // active street race
  let choiceOpen = false;
  const completed = new Set(G.save.completedMissions || []);

  function missionDef(id) { return MISSIONS.find((m) => m.id === id); }

  function setMarker(x, z, visible = true) {
    marker.position.set(x, 0.2, z);
    beacon.position.set(x, 13, z);
    marker.visible = visible; beacon.visible = visible;
  }
  function hideMarker() { marker.visible = false; beacon.visible = false; }

  function startMission(id) {
    const def = missionDef(id);
    if (!def || completed.has(id)) return null;
    current = { def, step: 0, timeLeft: def.timeLimit || 0, target: null, laps: 0, data: {} };
    choiceOpen = false;
    if (id === 'M1') {
      current.steps = [
        { type: 'goto', x: world.marina.x + 30, z: 0, text: 'Pick up the sealed crate at the marina' },
        { type: 'goto', x: world.hotel.x, z: world.hotel.z, text: 'Deliver the crate to the Coral Hotel' },
      ];
    } else if (id === 'M2') {
      current.steps = [
        { type: 'chase', text: 'Chase the rival courier and ram his car until he stops' },
      ];
      current.target = G.vehicles.addVehicle('muscle', -120, -40, 0, { parked: false });
      current.target.ai = { flee: true, speed: 26 };
    } else if (id === 'M3') {
      current.steps = [
        { type: 'stealth', x: -270, z: -30, text: 'Reach the manifest on the dock — avoid the searchlights' },
      ];
      current.guards = makeGuards();
    } else if (id === 'M4') {
      choiceOpen = true;
      current.steps = [{ type: 'choice', text: 'Choose: rob the Coral Bank (1) or escort Marco\u2019s truck (2)' }];
    } else if (id === 'M4A') {
      current.steps = [
        { type: 'goto', x: world.bank.x, z: world.bank.z, text: 'Reach Coral Bank and grab the vault cash' },
        { type: 'escape', text: 'Lose the police, then reach the safehouse' },
      ];
    } else if (id === 'M4B') {
      current.steps = [
        { type: 'escort', text: 'Escort Marco\u2019s truck across town — keep it alive' },
      ];
      current.target = G.vehicles.addVehicle('pickup', 0, 0, 0, { parked: false });
      current.target.ai = { route: true, speed: 16, path: [[0, 0], [128, 0], [128, 128], [256, 128]] };
      current.target.health = 100;
    } else if (id === 'M5') {
      current.steps = [{ type: 'race', laps: 3, text: 'Win the Coral Bay street circuit — 3 laps' }];
      current.rivals = spawnRivals();
      current.checkpoints = raceCircuit();
      current.laps = 0; current.cpIndex = 0;
    } else if (id === 'M6') {
      current.steps = [
        { type: 'goto', x: world.marina.x + 30, z: 0, text: 'Fight to the pier — reach the speedboat' },
        { type: 'boat', text: 'Board the speedboat and outrun the harbour patrol to open water' },
      ];
    }
    applyStep();
    G.hud.setObjective(current.steps[0].text);
    return current;
  }

  function makeGuards() {
    const guards = [];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
      const gx = -282 + i * 14, gz = -40 + i * 18;
      cone.position.set(gx, 7, gz);
      cone.rotation.x = Math.PI / 2.4;
      cone.userData.baseX = gx; cone.userData.baseZ = gz; cone.userData.phase = i * 2.1;
      scene.add(cone);
      guards.push({ cone, x: gx, z: gz });
    }
    return guards;
  }

  function raceCircuit() {
    return [
      { x: -192, z: 0 }, { x: -192, z: 192 }, { x: 0, z: 192 },
      { x: 192, z: 192 }, { x: 192, z: 0 }, { x: 192, z: -192 },
      { x: 0, z: -192 }, { x: -192, z: -192 },
    ];
  }

  function spawnRivals() {
    const rivals = [];
    const keys = ['sport', 'muscle', 'coupe'];
    keys.forEach((k, i) => {
      const v = G.vehicles.addVehicle(k, -180 + i * 6, 24 + i * 4, Math.PI / 2, { parked: false });
      v.ai = { race: true, speed: 24 + i, cp: 0 };
      v.raceProgress = 0;
      rivals.push(v);
    });
    return rivals;
  }

  function applyStep() {
    const s = current.steps[current.step];
    if (!s) return;
    if (s.type === 'goto' || s.type === 'stealth') setMarker(s.x, s.z);
    else if (s.type === 'escape') setMarker(world.safehouse.x, world.safehouse.z);
    else if (s.type === 'race' || s.type === 'boat') {
      const cp = current.checkpoints ? current.checkpoints[current.cpIndex] : null;
      if (cp) setMarker(cp.x, cp.z); else hideMarker();
    } else hideMarker();
    G.hud.setObjective(s.text);
  }

  function advanceStep() {
    current.step++;
    if (current.step >= current.steps.length) { completeMission(); return; }
    applyStep();
    G.audio.pickup();
  }

  function completeMission() {
    const def = current.def;
    if (def.pay > 0) {
      G.economy.addCash(def.pay, `Mission ${def.id} complete: ${def.name}`);
      G.audio.cash();
    }
    completed.add(def.id);
    G.save.completedMissions = [...completed];
    G.hud.flash(`MISSION COMPLETE — ${def.name}  +$${def.pay.toLocaleString()}`);
    cleanupMission();
    G.economy.saveGame();
    // unlock the next story job
    const order = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
    const idx = order.indexOf(def.id);
    const next = def.id === 'M4A' || def.id === 'M4B' ? 'M5' : order[idx + 1];
    if (next && !completed.has(next)) G.hud.flash(`New mission available: ${missionDef(next).name} — press M`);
    current = null;
    hideMarker();
  }

  function failMission(reason) {
    G.hud.flash(`MISSION FAILED — ${reason}`);
    G.audio.fail();
    cleanupMission();
    current = null;
    hideMarker();
  }

  function cleanupMission() {
    if (!current) return;
    if (current.guards) for (const g of current.guards) scene.remove(g.cone);
    if (current.rivals) for (const r of current.rivals) { scene.remove(r.mesh); }
    current = null;
  }

  function chooseBranch(which) {
    if (!current || current.def.id !== 'M4' || !choiceOpen) return false;
    cleanupMission();
    current = null;
    startMission(which === 1 ? 'M4A' : 'M4B');
    return true;
  }

  // --- taxi side job ---
  function startTaxi() {
    if (taxi || current) return false;
    const spots = [
      { x: -128, z: -128 }, { x: 128, z: 64 }, { x: 0, z: 192 }, { x: 192, z: -64 },
    ];
    const from = spots[Math.floor(Math.random() * spots.length)];
    const to = spots[Math.floor(Math.random() * spots.length)];
    taxi = { from, to, phase: 'pickup', timeLeft: 120 };
    setMarker(from.x, from.z);
    G.hud.setObjective('Taxi: pick up the passenger');
    G.hud.flash('Taxi job — pick up the passenger');
    return true;
  }

  function update(dt, player) {
    // marker pulse
    if (marker.visible) {
      const s = 1 + Math.sin(performance.now() * 0.005) * 0.12;
      marker.scale.set(s, 1, s);
      marker.rotation.y += dt;
    }
    // parcels
    for (const p of parcels) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.8 + Math.sin(performance.now() * 0.003 + p.x) * 0.15;
      if (Math.hypot(player.x - p.x, player.z - p.z) < 2.5) {
        p.taken = true; p.mesh.visible = false;
        G.economy.addCash(PACKAGE_PAY, 'Hidden parcel found');
        G.save.parcels = (G.save.parcels || 0) + 1;
        G.audio.pickup();
        G.hud.flash(`Hidden parcel found! +$${PACKAGE_PAY} (${G.save.parcels}/${HIDDEN_PACKAGES})`);
      }
    }
    // taxi
    if (taxi) {
      taxi.timeLeft -= dt;
      if (taxi.timeLeft <= 0) { taxi = null; hideMarker(); G.hud.setObjective(''); G.hud.flash('Taxi passenger gave up'); }
      else if (taxi.phase === 'pickup' && Math.hypot(player.x - taxi.from.x, player.z - taxi.from.z) < 4) {
        taxi.phase = 'drop'; setMarker(taxi.to.x, taxi.to.z);
        G.hud.setObjective('Taxi: drop the passenger off');
        G.audio.pickup();
      } else if (taxi.phase === 'drop' && Math.hypot(player.x - taxi.to.x, player.z - taxi.to.z) < 4) {
        G.economy.addCash(TAXI_FARE, 'Taxi fare');
        G.audio.cash();
        G.hud.flash(`Taxi fare paid +$${TAXI_FARE}`);
        taxi = null; hideMarker(); G.hud.setObjective(current ? current.steps[current.step].text : '');
      }
    }
    if (!current) return;
    const s = current.steps[current.step];
    if (!s) return;
    if (current.timeLeft > 0) {
      current.timeLeft -= dt;
      if (current.timeLeft <= 0) { failMission('Out of time'); return; }
    }
    const px = player.x, pz = player.z;
    if (s.type === 'goto') {
      if (Math.hypot(px - s.x, pz - s.z) < 5) {
        if (current.def.id === 'M4A' && current.step === 0) {
          G.economy.addCash(0, '');
          G.police.addCrime(60, 'bank robbery');
          G.hud.flash('Vault cash grabbed! Lose the cops and reach the safehouse');
          G.audio.cash();
        }
        advanceStep();
      }
    } else if (s.type === 'chase') {
      const t = current.target;
      if (t) {
        // fleeing courier drives away from the player
        const dx = t.x - px, dz = t.z - pz;
        const d = Math.hypot(dx, dz);
        t.heading = Math.atan2(dx, dz);
        t.speed = clamp(t.speed + 8 * dt, 0, 26);
        t.x += Math.sin(t.heading) * t.speed * dt;
        t.z += Math.cos(t.heading) * t.speed * dt;
        t.x = clamp(t.x, -300, 300); t.z = clamp(t.z, -300, 300);
        t.mesh.position.set(t.x, 0, t.z);
        t.mesh.rotation.y = t.heading;
        setMarker(t.x, t.z);
        // ramming the target damages it
        const pv = player.inVehicle;
        if (pv && Math.hypot(pv.x - t.x, pv.z - t.z) < 4) {
          t.health -= 30 * dt * 2;
          if (Math.random() < 0.1) G.effects.burst(t.x, 1, t.z, 0xff8800, 8, 4);
        }
        if (t.health <= 0) {
          G.police.addCrime(10, 'assault');
          advanceStep();
        }
      }
    } else if (s.type === 'stealth') {
      // guards sweep their cones; spotted = alarm
      for (const g of current.guards) {
        const ph = performance.now() * 0.0006 + g.cone.userData.phase;
        g.cone.rotation.y = Math.sin(ph) * 1.2;
        g.cone.rotation.x = Math.PI / 2.4;
        // cone tip world pos approx: guard pos + facing * 6
        const fx = g.x + Math.sin(g.cone.rotation.y) * 6;
        const fz = g.z + Math.cos(g.cone.rotation.y) * 6;
        if (Math.hypot(px - fx, pz - fz) < 4.5) {
          G.police.addCrime(25, 'spotted by guards');
          failMission('Spotted by the dock guards');
          return;
        }
      }
      if (Math.hypot(px - s.x, pz - s.z) < 5) advanceStep();
    } else if (s.type === 'choice') {
      // waiting on the 1 / 2 key; handled in main via chooseBranch
    } else if (s.type === 'escape') {
      if (G.police.wanted === 0 && Math.hypot(px - world.safehouse.x, pz - world.safehouse.z) < 6) advanceStep();
    } else if (s.type === 'race') {
      const cp = current.checkpoints[current.cpIndex];
      if (cp && Math.hypot(px - cp.x, pz - cp.z) < 8) {
        current.cpIndex++;
        if (current.cpIndex >= current.checkpoints.length) {
          current.cpIndex = 0; current.laps++;
          G.hud.flash(`Lap ${current.laps + 1}/3`);
          if (current.laps >= 3) {
            // did the player beat the rivals? rivals advance slowly on purpose
            advanceStep();
            return;
          }
        }
        const next = current.checkpoints[current.cpIndex];
        setMarker(next.x, next.z);
        G.audio.pickup();
      }
      // rivals cruise the circuit
      for (const r of current.rivals) {
        const cp = current.checkpoints[r.ai.cp % current.checkpoints.length];
        const dx = cp.x - r.x, dz = cp.z - r.z;
        r.heading = Math.atan2(dx, dz);
        r.speed = clamp(r.speed + 6 * dt, 0, r.ai.speed);
        r.x += Math.sin(r.heading) * r.speed * dt;
        r.z += Math.cos(r.heading) * r.speed * dt;
        r.mesh.position.set(r.x, 0, r.z);
        r.mesh.rotation.y = r.heading;
        if (Math.hypot(dx, dz) < 8) r.ai.cp++;
      }
    } else if (s.type === 'escort') {
      const t = current.target;
      // truck drives its route; rivals ram it
      const wp = t.ai.path[Math.min(t.ai.cp || 0, t.ai.path.length - 1)];
      const dx = wp[0] - t.x, dz = wp[1] - t.z;
      if (Math.hypot(dx, dz) < 8) {
        t.ai.cp = (t.ai.cp || 0) + 1;
        if (t.ai.cp >= t.ai.path.length) { advanceStep(); return; }
      }
      t.heading = Math.atan2(dx, dz);
      t.speed = clamp(t.speed + 5 * dt, 0, t.ai.speed);
      t.x += Math.sin(t.heading) * t.speed * dt;
      t.z += Math.cos(t.heading) * t.speed * dt;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
      setMarker(t.x, t.z);
      // ambient attackers: truck takes slow damage unless player stays near
      const near = Math.hypot(px - t.x, pz - t.z) < 25;
      t.health -= (near ? 0.4 : 2.2) * dt;
      if (t.health <= 0) { failMission('Marco\u2019s truck was destroyed'); return; }
      G.hud.setObjective(`Escort the truck — integrity ${Math.max(0, Math.round(t.health))}%`);
    } else if (s.type === 'boat') {
      if (player.inVehicle && player.inVehicle.isBoat) {
        // open water is far west of the pier; boarding alone is not enough
        if (player.inVehicle.x < -380) advanceStep();
      }
    }
  }

  return {
    get current() { return current; },
    get completed() { return completed; },
    get parcels() { return parcels; },
    get choiceOpen() { return choiceOpen; },
    get taxiActive() { return !!taxi; },
    missionDef, startMission, chooseBranch, startTaxi, update, failMission,
    nextMissionId() {
      const order = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
      for (const id of order) if (!completed.has(id)) return id;
      return null;
    },
  };
}
