// Coral Bay — all sound is synthesised with WebAudio. No audio files:
// two generative radio stations, an engine hum, sirens and one-shot SFX.
import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let station = 0, musicOn = true, stepTimer = null, step = 0;
  let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    } catch { return false; }
    return true;
  }
  function resume() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function blip(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function startRadio() {
    if (!ensure() || stepTimer) return;
    stepTimer = setInterval(() => {
      if (!musicOn || !ctx) return;
      const st = RADIO_STATIONS[station];
      const beat = 60 / st.tempo / 2; // eighth notes
      const scale = st.scale;
      const degree = [0, 2, 1, 3, 0, 4, 2, 1][step % 8];
      const note = st.root + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
      // bass on the beat, sparkle melody off it
      const t = ctx.currentTime;
      const bass = ctx.createOscillator(), bg = ctx.createGain();
      bass.type = st.wave; bass.frequency.value = midiToFreq(st.root - 12 + (step % 4 === 0 ? 0 : 7));
      bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.10, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.8);
      bass.connect(bg); bg.connect(musicGain); bass.start(t); bass.stop(t + beat * 2);
      if (step % 2 === 0) {
        const mel = ctx.createOscillator(), mg = ctx.createGain();
        mel.type = 'sine'; mel.frequency.value = midiToFreq(note + 12);
        mg.gain.setValueAtTime(0.0001, t); mg.gain.linearRampToValueAtTime(0.08, t + 0.01);
        mg.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.4);
        mel.connect(mg); mg.connect(musicGain); mel.start(t); mel.stop(t + beat * 1.5);
      }
      step++;
    }, 60 / RADIO_STATIONS[station].tempo / 2 * 1000);
  }

  return {
    resume, ensure,
    get stationName() { return RADIO_STATIONS[station].name; },
    get musicOn() { return musicOn; },
    nextStation() {
      station = (station + 1) % RADIO_STATIONS.length;
      if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
      startRadio();
      return RADIO_STATIONS[station].name;
    },
    startMusic() { startRadio(); },
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    setEngine(rpm01, on) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500;
        engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      const target = on ? 0.05 + rpm01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + rpm01 * 160, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.04;
        sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.6;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 350;
        sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 750;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); sirenLfo.start();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenLfo.stop(); } catch {}
        sirenOsc = null; sirenLfo = null;
      }
    },
    shot() { blip(900, 0.12, 'square', 0.25, 0, 120); blip(160, 0.09, 'sawtooth', 0.2, 0, 60); },
    crash() { blip(120, 0.3, 'sawtooth', 0.3, 0, 40); blip(60, 0.25, 'square', 0.2, 0.02, 30); },
    pickup() { blip(660, 0.1, 'sine', 0.25); blip(990, 0.16, 'sine', 0.25, 0.09); },
    cash() { blip(880, 0.08, 'sine', 0.2); blip(1174, 0.08, 'sine', 0.2, 0.08); blip(1568, 0.14, 'sine', 0.22, 0.16); },
    fail() { blip(220, 0.25, 'sawtooth', 0.2, 0, 110); },
    beep() { blip(1200, 0.06, 'sine', 0.18); },
    horn() { blip(370, 0.25, 'square', 0.15); blip(466, 0.25, 'square', 0.12, 0.02); },
    splash() { blip(300, 0.4, 'sine', 0.2, 0, 90); },
  };
}
