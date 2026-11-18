// Coral Bay — atmosphere: a full day/night cycle with sun, moon, neon and
// lamps, rain weather, and the particle puffs for smoke, splashes and shots.
import * as THREE from 'three';
import { mulberry32, range, clamp, lerp } from './rng.js';

export function createEffects(scene, world) {
  const rand = mulberry32(55);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8090a8, 0.7));
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0.25);
  moon.position.set(-80, 140, -40);
  scene.add(moon);

  // rain: one reusable points cloud, toggled on/off
  const RAIN_N = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = range(rand, -60, 60);
    rainPos[i * 3 + 1] = range(rand, 0, 40);
    rainPos[i * 3 + 2] = range(rand, -60, 60);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x9fc8e8, size: 0.35, transparent: true, opacity: 0.7,
  }));
  rain.visible = false;
  scene.add(rain);

  // burst particles (muzzle flash, crash, splash)
  const puffs = [];
  function burst(x, y, z, color, count = 14, speed = 6) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel.push(new THREE.Vector3(range(rand, -1, 1) * speed, range(rand, 0, 1) * speed, range(rand, -1, 1) * speed));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 0.9 }));
    scene.add(pts);
    puffs.push({ pts, vel, life: 0.7 });
  }

  // smoke emitters attached to damaged vehicles
  const smokes = [];
  function attachSmoke(parent) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(24 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x555555, size: 1.1, transparent: true, opacity: 0.55 }));
    pts.position.y = 1.2;
    parent.add(pts);
    const s = { pts, parent, phase: 0 };
    smokes.push(s);
    return s;
  }
  function detachSmoke(s) {
    const i = smokes.indexOf(s);
    if (i >= 0) smokes.splice(i, 1);
    s.parent.remove(s.pts);
  }

  let timeOfDay = 10.5; // hours; 10:30 morning by default
  let raining = false;
  let rainTimer = 45;

  function skyColorFor(t) {
    // returns {sky, sunColor, sunI, ambient} for hour t
    if (t < 5 || t >= 21) return { sky: 0x0b1026, sun: 0x8aa8ff, sunI: 0.25, amb: 0.35, night: true };
    if (t < 7) { const k = (t - 5) / 2; return { sky: new THREE.Color(0x0b1026).lerp(new THREE.Color(0xffb37a), k), sun: 0xffb37a, sunI: lerp(0.25, 1.4, k), amb: lerp(0.35, 0.6, k), night: k < 0.5 }; }
    if (t < 17) return { sky: 0x7ec8f2, sun: 0xfff2d8, sunI: 2.2, amb: 0.7, night: false };
    if (t < 19.5) { const k = (t - 17) / 2.5; return { sky: new THREE.Color(0x7ec8f2).lerp(new THREE.Color(0xff7a4a), k), sun: 0xff8a4a, sunI: lerp(2.2, 1.5, k), amb: lerp(0.7, 0.55, k), night: false, sunset: true }; }
    const k = (t - 19.5) / 1.5;
    return { sky: new THREE.Color(0xff7a4a).lerp(new THREE.Color(0x0b1026), k), sun: 0xff7a4a, sunI: lerp(1.1, 0.25, k), amb: lerp(0.5, 0.35, k), night: k > 0.5 };
  }

  function update(dt, playerPos) {
    timeOfDay = (timeOfDay + dt / 240) % 24; // a full day every 4 minutes
    const s = skyColorFor(timeOfDay);
    scene.background = s.sky instanceof THREE.Color ? s.sky : new THREE.Color(s.sky);
    sun.color.setHex(s.sun); sun.intensity = s.sunI;
    const ang = ((timeOfDay - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(ang) * 160, Math.sin(ang) * 180 + 20, 60);
    moon.intensity = s.night ? 0.5 : 0.05;
    scene.traverse((o) => {
      if (o.userData.isLamp) o.material.color.setHex(s.night ? 0xffe9a8 : 0x666666);
      if (o.userData.isNeon) o.material.color.setHex(0xffffff);
    });
    // rain comes and goes
    rainTimer -= dt;
    if (rainTimer <= 0) {
      rainTimer = range(rand, 40, 90);
      raining = !raining;
      rain.visible = raining;
    }
    if (raining) {
      rain.position.set(playerPos.x, 0, playerPos.z);
      const arr = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        arr[i * 3 + 1] -= dt * 28;
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 40;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // bursts
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dt;
      const arr = p.pts.geometry.attributes.position.array;
      for (let j = 0; j < p.vel.length; j++) {
        arr[j * 3] += p.vel[j].x * dt;
        arr[j * 3 + 1] += p.vel[j].y * dt;
        arr[j * 3 + 2] += p.vel[j].z * dt;
        p.vel[j].y -= 4 * dt;
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
      p.pts.material.opacity = Math.max(0, p.life / 0.7);
      if (p.life <= 0) { scene.remove(p.pts); puffs.splice(i, 1); }
    }
    // smoke columns
    for (const sm of smokes) {
      sm.phase += dt;
      const arr = sm.pts.geometry.attributes.position.array;
      for (let j = 0; j < 24; j++) {
        const t = (sm.phase * 0.7 + j / 24) % 1;
        arr[j * 3] = Math.sin(j * 7.3) * 0.4 * t;
        arr[j * 3 + 1] = t * 4;
        arr[j * 3 + 2] = Math.cos(j * 5.1) * 0.4 * t;
      }
      sm.pts.geometry.attributes.position.needsUpdate = true;
    }
    return s;
  }

  return {
    update, burst, attachSmoke, detachSmoke,
    get timeOfDay() { return timeOfDay; },
    set timeOfDay(t) { timeOfDay = t; },
    get raining() { return raining; },
    set raining(r) { raining = r; rain.visible = r; },
    get isNight() { return timeOfDay < 5.5 || timeOfDay >= 20; },
    get isSunset() { return timeOfDay >= 17 && timeOfDay < 19.5; },
  };
}
