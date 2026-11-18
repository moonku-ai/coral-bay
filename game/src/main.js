// Coral Bay — entry point: builds the scene, wires every system together
// and runs the frame loop. Played with keyboard and mouse, no network.
import * as THREE from 'three';
import { WORLD, MISSIONS, CAR_DEFS } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createVehicleSystem } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createEffects } from './effects.js';
import { createMissionSystem } from './missions.js';
import { createEconomy } from './economy.js';
import { createHud } from './hud.js';
import { applyShotPreset } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const autoTest = params.get('autotest') === '1';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8f2);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(-170, 8, 40);

const world = buildWorld(scene);
const input = createInput();
const audio = createAudio();
const effects = createEffects(scene, world);
const vehicles = createVehicleSystem(scene, world);
const traffic = createTraffic(scene, world, vehicles);
const playerSys = createPlayer(scene, world, world.spawn);
const police = createPolice(scene, world, vehicles, audio);

// The shared game object every system reads.
const G = {
  scene, camera, world, vehicles, traffic, police, audio, effects,
  player: playerSys.player, save: {}, started: false, paused: false,
  cameraMode: 'chase', over: false,
};
G.hud = createHud(G);
G.missions = createMissionSystem(scene, world, G);
G.economy = createEconomy(G);
G.save = G.economy.save;

const P = G.player;
const raycaster = new THREE.Raycaster();

// ---------- helpers ----------
function enterVehicle(v) {
  if (!v) return;
  P.inVehicle = v; v.isPlayer = true; v.parked = false;
  G.economy.applyUpgrades(v);
  playerSys.player.mesh.visible = false;
  if (!v.owned && !v.isPolice) {
    police.addCrime(15, 'car theft');
    G.hud.flash(`Stole a ${v.def.name} — the law noticed`);
  }
  audio.resume(); audio.startMusic();
}
function exitVehicle() {
  const v = P.inVehicle;
  if (!v) return;
  const side = v.x + Math.cos(v.heading) * 2.5;
  const sideZ = v.z - Math.sin(v.heading) * 2.5;
  P.x = side; P.z = sideZ; P.heading = v.heading;
  P.inVehicle = null; v.isPlayer = false; v.speed = 0;
  playerSys.player.mesh.visible = true;
}
function shoot() {
  audio.shot();
  audio.resume();
  const origin = new THREE.Vector3(P.x, 1.6, P.z);
  const dir = new THREE.Vector3(Math.sin(P.heading), 0, Math.cos(P.heading));
  raycaster.set(origin, dir);
  raycaster.far = 40;
  // find the nearest pedestrian or traffic car roughly in front
  let best = null, bd = 40;
  for (const ped of traffic.peds) {
    const dx = ped.x - P.x, dz = ped.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d < bd && (dx * dir.x + dz * dir.z) / Math.max(d, 0.001) > 0.93) { bd = d; best = { kind: 'ped', obj: ped }; }
  }
  for (const c of traffic.cars) {
    const dx = c.x - P.x, dz = c.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d < bd && (dx * dir.x + dz * dir.z) / Math.max(d, 0.001) > 0.93) { bd = d; best = { kind: 'car', obj: c }; }
  }
  effects.burst(P.x + dir.x * 2, 1.5, P.z + dir.z * 2, 0xffe94a, 6, 3);
  if (!best) return;
  if (best.kind === 'ped') {
    const ped = best.obj;
    ped.mesh.rotation.z = Math.PI / 2; ped.mesh.position.y = 0.3;
    ped.targetX = ped.x; ped.targetZ = ped.z; ped.speed = 0;
    effects.burst(ped.x, 1.2, ped.z, 0xff4040, 10, 3);
    traffic.scatter(ped.x, ped.z, 20);
    police.addCrime(20, 'shooting');
  } else {
    effects.burst(best.obj.x, 1, best.obj.z, 0xff8800, 12, 5);
    police.addCrime(10, 'shooting at traffic');
  }
}
function punch() {
  let hit = false;
  for (const ped of traffic.peds) {
    if (Math.hypot(ped.x - P.x, ped.z - P.z) < 2.2) {
      ped.mesh.rotation.z = Math.PI / 2; ped.mesh.position.y = 0.3;
      ped.speed = 0;
      traffic.scatter(ped.x, ped.z, 15);
      police.addCrime(10, 'assault');
      hit = true;
      break;
    }
  }
  if (!hit) audio.beep();
}
function gameOver(reason) {
  if (G.over) return;
  G.over = true;
  G.economy.addCash(-200, 'Hospital bill');
  document.getElementById('gameover-reason').textContent = reason === 'busted' ? 'Busted by the CBPD!' : 'Wasted — you wake up at the clinic.';
  G.hud.showScreen('gameover-screen');
  audio.setSiren(false);
}
function respawn() {
  G.over = false;
  P.health = 100; P.x = world.spawn.x; P.z = world.spawn.z;
  if (P.inVehicle) { P.inVehicle.isPlayer = false; P.inVehicle = null; }
  playerSys.player.mesh.visible = true;
  police.clearAll();
  G.hud.showScreen(null);
}

// ---------- screens ----------
function buildGarageScreen() {
  const list = document.getElementById('garage-list');
  list.innerHTML = '';
  for (const [key, def] of Object.entries(CAR_DEFS)) {
    if (key === 'police') continue;
    const owned = G.save.ownedCars.includes(key);
    const row = document.createElement('div');
    row.className = 'garage-row';
    row.innerHTML = `<b>${def.name}</b> — ${def.desc} · top ${def.top * 3.6 | 0} km/h` +
      (owned ? ' · <span style="color:#7dff6a">OWNED</span>' :
        ` · <button data-buy="${key}">Buy $${def.price.toLocaleString()}</button>`);
    list.appendChild(row);
  }
  list.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = () => {
      const r = G.economy.buyCar(b.dataset.buy);
      G.hud.flash(r.ok ? `Bought the ${r.car}! Find it parked around town.` : `Cannot buy: ${r.reason}`);
      if (r.ok) buildGarageScreen();
    };
  });
}
document.getElementById('start-btn').onclick = () => {
  audio.resume(); audio.startMusic();
  G.started = true;
  G.hud.showScreen(null);
  input.requestLock();
  const next = G.missions.nextMissionId();
  if (next) G.hud.flash(`Press M to start: ${G.missions.missionDef(next).name}`);
};
document.getElementById('resume-btn').onclick = () => { G.paused = false; G.hud.showScreen(null); };
document.getElementById('respawn-btn').onclick = respawn;
document.getElementById('choice-heist').onclick = () => { G.missions.chooseBranch(1); G.hud.showScreen(null); };
document.getElementById('choice-escort').onclick = () => { G.missions.chooseBranch(2); G.hud.showScreen(null); };
document.getElementById('garage-close').onclick = () => { G.paused = false; G.hud.showScreen(null); };

// ---------- per-frame input ----------
function handleKeys(dt) {
  if (input.pollPressed('KeyM')) {
    if (!G.missions.current) {
      const next = G.missions.nextMissionId();
      if (next) {
        if (next === 'M4') {
          G.missions.startMission('M4');
          G.hud.showScreen('choice-screen');
        } else {
          G.missions.startMission(next);
          G.hud.flash(`Mission started: ${G.missions.missionDef(next).name}`);
        }
      } else G.hud.flash('All story missions complete — free roam, taxi (T) and parcels await!');
    }
  }
  if (input.pollPressed('Digit1') && G.missions.choiceOpen) { G.missions.chooseBranch(1); G.hud.showScreen(null); }
  if (input.pollPressed('Digit2') && G.missions.choiceOpen) { G.missions.chooseBranch(2); G.hud.showScreen(null); }
  if (input.pollPressed('KeyT')) G.missions.startTaxi();
  if (input.pollPressed('KeyQ')) G.hud.flash('Radio: ' + audio.nextStation());
  if (input.pollPressed('KeyN')) audio.toggleMusic();
  if (input.pollPressed('Tab')) { G.hud.toggleBigMap(); }
  if (input.pollPressed('KeyG')) {
    if (!G.paused) { G.paused = true; buildGarageScreen(); G.hud.showScreen('garage-screen'); }
  }
  if (input.pollPressed('Escape') || input.pollPressed('KeyP')) {
    if (G.hud.bigMapOpen) { G.hud.toggleBigMap(); return; }
    G.paused = !G.paused;
    G.hud.showScreen(G.paused ? 'pause-screen' : null);
  }
  if (input.pollPressed('KeyE')) {
    if (P.inVehicle) exitVehicle();
    else {
      const v = vehicles.nearestVehicle(P.x, P.z, 5.5);
      if (v) enterVehicle(v);
    }
  }
  if (input.pollPressed('KeyH')) {
    if (Math.hypot(P.x - world.safehouse.x, P.z - world.safehouse.z) < 8) G.economy.healAtSafehouse();
  }
  if (input.pollPressed('KeyL')) {
    const d = G.economy.loadGame();
    G.hud.flash(d ? 'Save loaded' : 'No save found');
  }
}

// ---------- main loop ----------
let last = performance.now();
let frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.started && !G.paused && !G.over) {
    handleKeys(dt);
    const v = P.inVehicle;
    if (v) {
      if (G.shotCruise) v.speed = Math.max(v.speed, G.shotCruise); // screenshot staging: keep rolling
      vehicles.drive(v, input, dt, () => { audio.crash(); effects.burst(v.x, 1, v.z, 0xff8800, 10, 4); });
      vehicles.updateDamageSmoke(v, effects);
      audio.setEngine(Math.abs(v.speed) / v.def.top, true);
      playerSys.updateInVehicle(input, camera, dt, v, G.cameraMode === 'chase-wide');
      // collisions with traffic cars
      for (const c of traffic.cars) {
        if (Math.hypot(c.x - v.x, c.z - v.z) < 3.4 && Math.abs(v.speed) > 4) {
          v.speed *= 0.55; v.health -= 5; audio.crash();
          c.x += Math.sin(c.heading) * 2; c.z += Math.cos(c.heading) * 2;
        }
      }
      if (v.health <= 0) { effects.burst(v.x, 1.5, v.z, 0xff4400, 30, 8); exitVehicle(); gameOver('car destroyed'); }
    } else {
      audio.setEngine(0, false);
      playerSys.updateOnFoot(input, camera, dt, { onPunch: punch, onShoot: shoot, onArmToggle: (a) => G.hud.flash(a ? 'Pistol drawn — click to fire' : 'Pistol holstered') });
      if (P.health <= 0) gameOver('busted');
    }
    // safehouse auto-save radius
    if (Math.hypot(P.x - world.safehouse.x, P.z - world.safehouse.z) < 6 && P.health < 100) {
      P.health = Math.min(100, P.health + 10 * dt);
    }
    traffic.update(dt, P);
    police.update(dt, P, gameOver);
    G.missions.update(dt, P);
    effects.update(dt, P);
    G.hud.update();
    // mission list refresh (cheap, once a second)
    if (frames % 60 === 0) {
      G.hud.setMissionList(MISSIONS.filter((m) => !['M4A', 'M4B'].includes(m.id)).map((m) => ({
        name: m.name, done: G.missions.completed.has(m.id) || (m.id === 'M4' && (G.missions.completed.has('M4A') || G.missions.completed.has('M4B'))),
      })));
    }
  }
  renderer.render(scene, camera);
  frames++;
  if (frames === 5) window.__ready = true;
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- start / shot mode ----------
if (shotName) {
  applyShotPreset(G, shotName);
  // settle the chase for a few frames, then let the screenshot land
  setTimeout(() => { window.__shotReady = true; }, 2500);
} else if (autoTest) {
  G.started = true;
  G.hud.showScreen(null);
}

// ---------- debug / test API (used by the local flow test only) ----------
window.CoralBay = {
  G,
  state() {
    return {
      started: G.started, cash: G.save.cash,
      health: Math.round(P.health),
      wanted: police.wanted, heli: police.heliActive, cops: police.copCount,
      inVehicle: !!P.inVehicle, vehicle: P.inVehicle ? P.inVehicle.defKey : null,
      vehicleHealth: P.inVehicle ? Math.round(P.inVehicle.health) : null,
      mission: G.missions.current ? G.missions.current.def.id : null,
      missionStep: G.missions.current ? G.missions.current.step : null,
      timeLeft: G.missions.current ? Math.round(G.missions.current.timeLeft) : null,
      completed: [...G.missions.completed],
      parcels: G.save.parcels, ownedCars: [...G.save.ownedCars],
      timeOfDay: +effects.timeOfDay.toFixed(2), raining: effects.raining,
      x: +P.x.toFixed(1), z: +P.z.toFixed(1),
      trafficCars: traffic.cars.length, peds: traffic.peds.length,
    };
  },
  startMission(id) { return !!G.missions.startMission(id); },
  chooseBranch(n) { return G.missions.chooseBranch(n); },
  teleport(x, z) { P.x = x; P.z = z; if (P.inVehicle) { P.inVehicle.x = x; P.inVehicle.z = z; } },
  enterNearestVehicle() { const v = vehicles.nearestVehicle(P.x, P.z, 8); if (v) enterVehicle(v); return !!v; },
  enterBoat() { enterVehicle(vehicles.boat); return true; },
  setWanted(n) { police.setWanted(n); },
  setTime(t) { effects.timeOfDay = t; },
  setRaining(r) { effects.raining = r; },
  save() { return G.economy.saveGame(); },
  load() { return !!G.economy.loadGame(); },
  buyCar(k) { return G.economy.buyCar(k); },
  startTaxi() { return G.missions.startTaxi(); },
  press(code) { input.fakePress(code); },
  hold(code) { input.fakeDown(code); },
  release(code) { input.fakeUp(code); },
};
