// Coral Bay — shared tuning, story data and vehicle catalogue.
// One small file every other module reads: no scene code lives here.
export const WORLD = {
  size: 640,            // playable square, metres
  roadGap: 64,          // city block pitch
  roadWidth: 12,
  beachX: -252,         // sand starts west of here
  waterX: -292,         // ocean starts west of here
  pierZ: 0,
};

export const CAR_DEFS = {
  coupe:   { name: 'Marlin Coupe',  color: 0xd8382c, top: 34, accel: 16, grip: 2.6, price: 0,     desc: 'Starter coupe' },
  sedan:   { name: 'Bayline Sedan', color: 0x2c6fd8, top: 30, accel: 13, grip: 2.4, price: 1500,  desc: 'Comfy four-door' },
  taxi:    { name: 'Coral Cab',     color: 0xf2c200, top: 29, accel: 12, grip: 2.3, price: 2200,  desc: 'City taxi' },
  muscle:  { name: 'Tide Runner',   color: 0x7a2cd8, top: 38, accel: 19, grip: 2.2, price: 6000,  desc: 'V8 muscle' },
  pickup:  { name: 'Dune Hauler',   color: 0x3f8f4f, top: 31, accel: 14, grip: 2.5, price: 3500,  desc: 'Work pickup' },
  sport:   { name: 'Solaris GT',    color: 0xf2f2f2, top: 44, accel: 23, grip: 3.0, price: 12000, desc: 'Supercar' },
  police:  { name: 'CBPD Interceptor', color: 0x1a1a1a, top: 36, accel: 18, grip: 2.8, price: 0, desc: 'Police cruiser' },
};

export const RADIO_STATIONS = [
  { name: 'Coral FM 88.1 — Sunset Pop', root: 60, scale: [0, 2, 4, 7, 9], tempo: 112, wave: 'triangle' },
  { name: 'Bay Bass 101.5 — Night Drive', root: 45, scale: [0, 3, 5, 7, 10], tempo: 96, wave: 'sawtooth' },
];

// The story: Rae Marlowe, ex-courier, owes a debt in Coral Bay. Delia Voss
// runs the docks; Marco Hale runs the streets. Six chained jobs, one fork.
export const MISSIONS = [
  { id: 'M1', name: 'First Delivery', giver: 'Delia Voss',
    brief: 'Pick up the sealed crate at the marina and drop it at the Coral Hotel before the clock runs out.',
    pay: 1200, kind: 'delivery', timeLimit: 150 },
  { id: 'M2', name: 'Hot Pursuit', giver: 'Delia Voss',
    brief: 'A rival courier stole Delia\u2019s ledger. Chase his car down the coastal highway and ram it until he stops.',
    pay: 2500, kind: 'chase', timeLimit: 180 },
  { id: 'M3', name: 'Quiet Inlet', giver: 'Delia Voss',
    brief: 'On foot, slip past the dock guards\u2019 searchlights and photograph the smugglers\u2019 manifest. Stay out of the cones.',
    pay: 3000, kind: 'stealth', timeLimit: 240 },
  { id: 'M4', name: 'The Fork in the Road', giver: 'Marco Hale',
    brief: 'Marco offers two jobs. Pick one: rob the Coral Bank vault, or escort his truck through a rival ambush.',
    pay: 0, kind: 'choice', timeLimit: 0 },
  { id: 'M4A', name: 'The Coral Heist', giver: 'Marco Hale',
    brief: 'Grab the vault cash at Coral Bank, then lose a four-star police response and reach the safehouse.',
    pay: 8000, kind: 'heist', timeLimit: 300 },
  { id: 'M4B', name: 'The Long Way Home', giver: 'Marco Hale',
    brief: 'Escort Marco\u2019s armoured truck across town while rival crews try to ram it off the road. Keep it alive.',
    pay: 6500, kind: 'escort', timeLimit: 300 },
  { id: 'M5', name: 'Street Kings', giver: 'Rae Marlowe',
    brief: 'Three laps of the Coral Bay street circuit against three rivals. Win it and the streets are yours.',
    pay: 6000, kind: 'race', timeLimit: 420 },
  { id: 'M6', name: 'The Last Tide', giver: 'Delia Voss',
    brief: 'Finale: fight through the pier ambush, steal the speedboat and outrun the harbour patrol to open water.',
    pay: 15000, kind: 'finale', timeLimit: 360 },
];

export const HIDDEN_PACKAGES = 10;   // collectible parcels hidden around the city
export const PACKAGE_PAY = 500;
export const TAXI_FARE = 350;
export const SAVE_KEY = 'coral-bay-save-v1';
export const START_CASH = 500;
