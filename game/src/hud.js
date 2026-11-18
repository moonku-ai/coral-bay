// Coral Bay — the HUD: cash, health, armor, wanted stars, mission tracker,
// speedometer, radio name, clock, minimap and big map, toast messages and
// the start / pause / garage / game-over screens.
import { WORLD } from './config.js';

export function createHud(G) {
  const root = document.getElementById('hud');
  const el = {};
  for (const id of ['cash', 'health', 'armor', 'stars', 'objective', 'speed', 'radio',
    'clock', 'toast', 'log', 'minimap', 'wanted-label', 'mission-list']) {
    el[id] = document.getElementById(id);
  }
  const mapCanvas = el.minimap;
  const mapCtx = mapCanvas.getContext('2d');
  let bigMapOpen = false;
  let toastTimer = null;
  const logLines = [];

  function flash(text, ms = 4200) {
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, ms);
  }
  function log(text) {
    logLines.unshift(text);
    if (logLines.length > 4) logLines.pop();
    el.log.innerHTML = logLines.map((l) => `<div>${l}</div>`).join('');
  }
  function setObjective(text) { el.objective.textContent = text || ''; }
  function setMissionList(items) {
    el['mission-list'].innerHTML = items.map((m) =>
      `<div class="mi ${m.done ? 'done' : ''}">${m.done ? '✓' : '○'} ${m.name}</div>`).join('');
  }

  function drawMinimap() {
    const W = mapCanvas.width, H = mapCanvas.height;
    const scale = W / (WORLD.size * 2 + 80);
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    mapCtx.fillStyle = 'rgba(10, 20, 30, 0.85)';
    mapCtx.fillRect(0, 0, W, H);
    // ocean + sand
    mapCtx.fillStyle = '#1c6f9e';
    mapCtx.fillRect(0, 0, (W / 2 + WORLD.waterX * scale), H);
    mapCtx.fillStyle = '#e8d29a';
    mapCtx.fillRect(W / 2 + WORLD.waterX * scale, 0, (WORLD.beachX - WORLD.waterX) * scale, H);
    // roads
    mapCtx.strokeStyle = '#888888'; mapCtx.lineWidth = 2;
    const n = Math.floor(WORLD.size / WORLD.roadGap);
    for (let i = -n; i <= n; i++) {
      const c = i * WORLD.roadGap;
      const [x1, y1] = toMap(c, -WORLD.size); const [x2, y2] = toMap(c, WORLD.size);
      mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
      const [x3, y3] = toMap(-WORLD.size, c); const [x4, y4] = toMap(WORLD.size, c);
      mapCtx.beginPath(); mapCtx.moveTo(x3, y3); mapCtx.lineTo(x4, y4); mapCtx.stroke();
    }
    // parcels
    mapCtx.fillStyle = '#7dff6a';
    for (const p of G.missions.parcels) {
      if (p.taken) continue;
      const [x, y] = toMap(p.x, p.z);
      mapCtx.fillRect(x - 2, y - 2, 4, 4);
    }
    // mission marker
    const cur = G.missions.current;
    if (cur) {
      const s = cur.steps[cur.step];
      const tx = s && (s.x ?? (cur.target ? cur.target.x : null));
      const tz = s && (s.z ?? (cur.target ? cur.target.z : null));
      if (tx != null) {
        const [x, y] = toMap(tx, tz);
        mapCtx.fillStyle = '#ffd84a';
        mapCtx.beginPath(); mapCtx.arc(x, y, 5, 0, Math.PI * 2); mapCtx.fill();
      }
    }
    // police blips
    mapCtx.fillStyle = '#4a8aff';
    // player arrow
    const [px, py] = toMap(G.player.x, G.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(G.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(-5, 6); mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
    // north tick
    mapCtx.fillStyle = '#ffffff'; mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', W / 2 - 4, 12);
  }

  function update() {
    el.cash.textContent = '$' + Math.round(G.save.cash).toLocaleString();
    el.health.textContent = '♥ ' + Math.max(0, Math.round(G.player.health));
    el.health.style.color = G.player.health < 30 ? '#ff5a5a' : '#7dff6a';
    el.armor.textContent = '🛡 ' + Math.max(0, Math.round(G.player.armor || 0));
    const w = G.police.wanted;
    el.stars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    el.stars.style.color = w >= 4 ? '#ff4040' : '#ffd84a';
    el['wanted-label'].textContent = w === 0 ? '' : w >= 5 ? 'HELICOPTER PURSUIT' : w >= 3 ? 'ROADBLOCKS ACTIVE' : 'POLICE PURSUIT';
    const v = G.player.inVehicle;
    el.speed.textContent = v ? Math.round(Math.abs(v.speed) * 3.6) + ' km/h' : '';
    el.radio.textContent = '♪ ' + G.audio.stationName;
    const t = G.effects.timeOfDay;
    const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
    el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` + (G.effects.raining ? ' 🌧' : G.effects.isNight ? ' 🌙' : ' ☀');
    drawMinimap();
  }

  function showScreen(id) {
    for (const s of ['start-screen', 'pause-screen', 'garage-screen', 'gameover-screen', 'choice-screen']) {
      const n = document.getElementById(s);
      if (n) n.style.display = s === id ? 'flex' : 'none';
    }
    root.style.display = id === 'start-screen' || id === 'gameover-screen' ? 'none' : 'block';
  }

  return {
    flash, log, setObjective, setMissionList, update, showScreen,
    get bigMapOpen() { return bigMapOpen; },
    toggleBigMap() {
      bigMapOpen = !bigMapOpen;
      const bm = document.getElementById('bigmap');
      bm.style.display = bigMapOpen ? 'block' : 'none';
      if (bigMapOpen) drawBigMap();
    },
    el,
  };

  function drawBigMap() {
    const c = document.getElementById('bigmap-canvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const scale = W / (WORLD.size * 2 + 80);
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    ctx.fillStyle = '#0a1420'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c6f9e'; ctx.fillRect(0, 0, W / 2 + WORLD.waterX * scale, H);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(W / 2 + WORLD.waterX * scale, 0, (WORLD.beachX - WORLD.waterX) * scale, H);
    ctx.strokeStyle = '#999999'; ctx.lineWidth = 3;
    const n = Math.floor(WORLD.size / WORLD.roadGap);
    for (let i = -n; i <= n; i++) {
      const cc = i * WORLD.roadGap;
      const [x1, y1] = toMap(cc, -WORLD.size); const [x2, y2] = toMap(cc, WORLD.size);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-WORLD.size, cc); const [x4, y4] = toMap(WORLD.size, cc);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif';
    const labels = [
      ['DOWNTOWN', 0, 0],
      ['CORAL BANK', G.world.bank.x, G.world.bank.z],
      ['HOTEL CORAL', G.world.hotel.x, G.world.hotel.z],
      ['MARINA', -300, 0], ['PIER', -320, 0],
      ['GARAGE', G.world.garage.x, G.world.garage.z],
      ['SAFEHOUSE', G.world.safehouse.x, G.world.safehouse.z], ['BEACH', -270, 150],
    ];
    for (const [t, x, z] of labels) {
      const [mx, my] = toMap(x, z);
      ctx.fillText(t, mx + 6, my - 6);
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
    }
    const [px, py] = toMap(G.player.x, G.player.z);
    ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText('YOU', px + 10, py);
  }
}
