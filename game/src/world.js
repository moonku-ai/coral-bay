// Coral Bay — the city itself: a sun-soaked coastal town built from boxes,
// planes and canvas textures. Downtown towers, suburbs, beach, pier, marina
// and a coastal highway, all placed from one fixed seed so every load matches.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, pick, range } from './rng.js';

function windowTexture(rand, lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) for (let x = 4; x < 60; x += 10) {
    const on = rand() < (lit ? 0.75 : 0.45);
    g.fillStyle = on ? (rand() < 0.5 ? '#ffd98a' : '#9fd8ff') : '#10131a';
    g.fillRect(x, y, 7, 6);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function neonSignTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a14'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
  g.fillText(text, 128, 34);
  return new THREE.CanvasTexture(c);
}

export function buildWorld(scene) {
  const rand = mulberry32(7);
  const colliders = [];   // {x, z, hw, hd} axis-aligned boxes
  const lamps = [];       // lamp post heads (PointLight anchors at night)
  const neons = [];       // neon sign meshes, glow at night
  const houses = [];      // suburb houses (safehouse candidates)
  const roadPoints = [];  // grid intersections for traffic waypoints
  const buildings = new THREE.Group();
  const props = new THREE.Group();
  scene.add(buildings, props);

  const texDowntown = windowTexture(rand, false);
  const texNight = windowTexture(rand, true);

  // --- ground: grass/concrete east, sand west, ocean plane beyond ---
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size * 2, WORLD.size * 2), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, WORLD.size * 2),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(WORLD.beachX - 12, 0.02, 0);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(300, WORLD.size * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x1c6f9e }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(WORLD.waterX - 150, -0.4, 0);
  scene.add(ocean);

  // --- roads: grid every 64m, plus the coastal highway ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c84a });
  const n = Math.floor(WORLD.size / WORLD.roadGap);
  for (let i = -n; i <= n; i++) {
    const c = i * WORLD.roadGap;
    for (const [w, h, x, z] of [
      [WORLD.size * 2, WORLD.roadWidth, 0, c],
      [WORLD.roadWidth, WORLD.size * 2, c, 0],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, z);
      scene.add(r);
    }
    for (let j = -n; j <= n; j++) roadPoints.push({ x: i * WORLD.roadGap, z: j * WORLD.roadGap });
  }
  // centre dashes on the two main avenues
  for (let d = -300; d < 300; d += 16) {
    for (const [x, z, w, h] of [[d, 0, 6, 0.5], [0, d, 0.5, 6]]) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.06, z);
      scene.add(dash);
    }
  }
  // coastal highway along the sand
  const hwy = new THREE.Mesh(new THREE.PlaneGeometry(14, WORLD.size * 2),
    new THREE.MeshLambertMaterial({ color: 0x33333a }));
  hwy.rotation.x = -Math.PI / 2; hwy.position.set(WORLD.beachX + 6, 0.05, 0);
  scene.add(hwy);

  // --- buildings: downtown towers near centre, shops mid-ring, houses east ---
  const palette = [0x8a7f72, 0x6f7f8a, 0x9a8a6a, 0x7a6f8a, 0xa8907a, 0x5f6f7a];
  const signs = ['HOTEL CORAL', 'BANK', 'PIER CAFE', 'MARINA', 'TACOS', 'CINEMA', 'GARAGE', 'CLUB NEON'];
  let signIdx = 0;
  const landmarks = [[96, -96], [-96, 96], [224, 160]];
  for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
    // buildings sit at block centres (roads stay clear); the beach stays clear
    const bx = gx * WORLD.roadGap + WORLD.roadGap / 2;
    const bz = gz * WORLD.roadGap + WORLD.roadGap / 2;
    if (bx < WORLD.beachX + 20) continue; // keep the beach clear
    if (landmarks.some(([lx, lz]) => Math.hypot(bx - lx, bz - lz) < 30)) continue; // landmark plots stay clear
    const dc = Math.hypot(bx, bz);
    const isDowntown = dc < 150;
    const isSuburb = bx > 130;
    if (isSuburb) {
      // one low house per block, pastel walls + pyramid roof
      const w = range(rand, 10, 14), d = range(rand, 9, 12), h = range(rand, 4, 6);
      const col = pick(rand, [0xe8b4a0, 0xa0c8e8, 0xe8d8a0, 0xc8e8b4, 0xd8a0c8]);
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: col }));
      house.position.set(bx + range(rand, -8, 8), h / 2, bz + range(rand, -8, 8));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5, 4),
        new THREE.MeshLambertMaterial({ color: 0x8a4a3a }));
      roof.position.copy(house.position); roof.position.y = h + 1.7; roof.rotation.y = Math.PI / 4;
      buildings.add(house, roof);
      colliders.push({ x: house.position.x, z: house.position.z, hw: w / 2, hd: d / 2 });
      houses.push({ x: house.position.x, z: house.position.z });
      continue;
    }
    // 1-4 boxes per block
    const count = isDowntown ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const ox = range(rand, -16, 16), oz = range(rand, -16, 16);
      const w = range(rand, 14, 24), d = range(rand, 14, 24);
      const h = isDowntown ? range(rand, 30, 95) : range(rand, 8, 20);
      const mat = new THREE.MeshLambertMaterial({
        color: pick(rand, palette),
        map: h > 25 ? (rand() < 0.5 ? texDowntown : texNight) : null,
        emissive: 0x222222,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx + ox, h / 2, bz + oz);
      buildings.add(b);
      colliders.push({ x: b.position.x, z: b.position.z, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
      // neon sign on some mid/downtown buildings
      if (h > 15 && signIdx < signs.length && rand() < 0.6) {
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(22, 5.5),
          new THREE.MeshBasicMaterial({ map: neonSignTexture(signs[signIdx], pick(rand, ['#ff5ad8', '#4ad8ff', '#ffd84a', '#7dff6a'])), transparent: true }));
        sign.position.set(b.position.x, Math.min(h - 4, 24), b.position.z + d / 2 + 0.3);
        sign.userData.isNeon = true;
        buildings.add(sign); neons.push(sign); signIdx++;
      }
    }
  }

  // --- palm trees along the beach and avenues ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4f });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = 0.08; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 4), leafMat);
      leaf.position.set(Math.cos(i) * 1.4, 7.2, Math.sin(i) * 1.4);
      leaf.rotation.z = Math.cos(i) * 1.1; leaf.rotation.x = -Math.sin(i) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    props.add(g);
  }
  for (let z = -300; z <= 300; z += 28) { palm(WORLD.beachX - 4, z + range(rand, -6, 6)); if (rand() < 0.5) palm(-200, z); }
  for (let x = -180; x <= 240; x += 42) { if (rand() < 0.6) palm(x, 38); }

  // --- street lamps on avenue corners ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x303038 });
  for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
    if ((gx + gz) % 2 !== 0) continue;
    const x = gx * WORLD.roadGap + 8, z = gz * WORLD.roadGap + 8;
    if (x < WORLD.beachX + 10) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), poleMat);
    pole.position.set(x, 3, z); props.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    head.position.set(x, 6.2, z); head.userData.isLamp = true; props.add(head);
    lamps.push(head);
  }

  // --- pier: wooden deck into the ocean + marina boats ---
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 10), deckMat);
  pier.position.set(WORLD.waterX - 20, 0.6, WORLD.pierZ);
  scene.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), deckMat);
    post.position.set(WORLD.waterX - 52 + i * 9, -0.5, i % 2 ? 4.5 : -4.5);
    scene.add(post);
  }
  // docked boats (props; one drivable speedboat is spawned by vehicles.js)
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (let i = 0; i < 3; i++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 2.6), boatMat);
    hull.position.set(WORLD.waterX - 12 - i * 10, 0.1, 14 + i * 8);
    scene.add(hull);
  }

  // --- Coral Bank + Coral Hotel landmarks (mission anchors) ---
  function landmark(x, z, w, h, d, color, label) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, h / 2, z); buildings.add(m);
    colliders.push({ x, z, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(label, '#ffd84a'), transparent: true }));
    sign.position.set(x, h + 3, z + d / 2 + 0.3); sign.userData.isNeon = true;
    buildings.add(sign); neons.push(sign);
    return { x, z };
  }
  const bank = landmark(96, -96, 26, 16, 20, 0xd8c8a8, 'CORAL BANK');
  const hotel = landmark(-96, 96, 30, 42, 22, 0x8ab8d8, 'HOTEL CORAL');
  const garage = landmark(224, 160, 24, 10, 18, 0x9a8a7a, 'GARAGE');
  const safehouse = houses.length ? houses[0] : { x: 200, z: 200 };

  return {
    colliders, lamps, neons, houses, roadPoints,
    bank, hotel, garage, safehouse,
    marina: { x: WORLD.waterX - 20, z: 0 },
    spawn: { x: -180, z: 32, heading: Math.PI / 2 },
  };
}

// Circle-vs-AABB resolve used by player, cars and peds.
export function resolveColliders(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
    const cz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
      return true;
    }
  }
  return false;
}
