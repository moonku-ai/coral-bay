// Coral Bay — money and persistence: cash, the garage shop (buy cars and
// upgrades), the safehouse (heal + save), and localStorage save/load.
import { CAR_DEFS, SAVE_KEY, START_CASH } from './config.js';

export function createEconomy(G) {
  const save = G.save;
  if (typeof save.cash !== 'number') save.cash = START_CASH;
  if (!Array.isArray(save.completedMissions)) save.completedMissions = [];
  if (!Array.isArray(save.ownedCars)) save.ownedCars = ['coupe'];
  if (!save.upgrades) save.upgrades = {};
  if (typeof save.parcels !== 'number') save.parcels = 0;

  function addCash(amount, why) {
    save.cash = Math.max(0, save.cash + amount);
    if (why) G.hud.log(`$${amount >= 0 ? '+' : ''}${amount.toLocaleString()} — ${why}`);
    return save.cash;
  }

  function buyCar(key) {
    const def = CAR_DEFS[key];
    if (!def || save.ownedCars.includes(key)) return { ok: false, reason: 'already owned' };
    if (save.cash < def.price) return { ok: false, reason: 'not enough cash' };
    save.cash -= def.price;
    save.ownedCars.push(key);
    saveGame();
    return { ok: true, car: def.name };
  }

  function buyUpgrade(key, kind) {
    // kind: 'engine' (+top speed) or 'armor' (+health). Two levels each.
    const level = (save.upgrades[key] || {})[kind] || 0;
    if (level >= 2) return { ok: false, reason: 'max level' };
    const price = kind === 'engine' ? 2500 * (level + 1) : 1800 * (level + 1);
    if (save.cash < price) return { ok: false, reason: 'not enough cash' };
    save.cash -= price;
    save.upgrades[key] = { ...(save.upgrades[key] || {}), [kind]: level + 1 };
    saveGame();
    return { ok: true, level: level + 1 };
  }

  function applyUpgrades(vehicle) {
    const up = save.upgrades[vehicle.defKey] || {};
    if (up.engine) vehicle.def = { ...vehicle.def, top: vehicle.def.top + up.engine * 4 };
    if (up.armor) vehicle.health = 100 + up.armor * 50;
  }

  function saveGame() {
    try {
      const data = {
        cash: save.cash,
        completedMissions: save.completedMissions,
        ownedCars: save.ownedCars,
        upgrades: save.upgrades,
        parcels: save.parcels,
        player: { x: G.player.x, z: G.player.z, health: G.player.health },
        timeOfDay: G.effects.timeOfDay,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      save.cash = data.cash;
      save.completedMissions = data.completedMissions || [];
      save.ownedCars = data.ownedCars || ['coupe'];
      save.upgrades = data.upgrades || {};
      save.parcels = data.parcels || 0;
      if (data.player) {
        G.player.x = data.player.x; G.player.z = data.player.z;
        G.player.health = data.player.health ?? 100;
      }
      if (typeof data.timeOfDay === 'number') G.effects.timeOfDay = data.timeOfDay;
      return data;
    } catch { return null; }
  }

  function healAtSafehouse() {
    G.player.health = 100;
    if (G.player.inVehicle) G.player.inVehicle.health = 100;
    saveGame();
    G.hud.flash('Safehouse — healed and saved');
  }

  return { save, addCash, buyCar, buyUpgrade, applyUpgrades, saveGame, loadGame, healAtSafehouse };
}
