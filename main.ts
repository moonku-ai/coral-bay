// Coral Bay — the hand-in program for the make.fun "Make GTA 6" bounty.
// It runs on plain Node 22 with nothing installed. Its whole job is to
// gather the entry: copy the playable game and the screenshots into the
// output folder, then ask the vendored make.fun library to write the
// dossier that describes them. The grader runs this file twice and expects
// byte-identical output both times, so nothing here depends on the clock,
// the network, or anything outside this repository.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('./', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps below mirror the bounty gate: the scorer refuses an entry
// past them, so failing here early is the same verdict, sooner.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function handIn() {
  // Start from a clean slate so a stale file from an older run can never
  // leak into this entry.
  rmSync(join(destination, 'game'), { recursive: true, force: true });
  rmSync(join(destination, 'screenshots'), { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });

  copyTree(join(repoRoot, 'game'), join(destination, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(destination, 'screenshots'));
  } else {
    mkdirSync(join(destination, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(destination, DOSSIER_LIMITS);
  writeFileSync(join(destination, 'dossier.json'), dossier);
}

handIn();
