// All sound is synthesised with WebAudio — no audio files, no network. A low
// engine drone that follows speed, a two-tone police siren, gunshots and
// explosions from filtered noise, and a quiet bassline that keeps the bay moving.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(duration);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Ignore audio failures.
    }
  }

  // A lazy bassline in A minor: root notes with a little walk, one note a beat.
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];

  return {
    /** Call from any user gesture: browsers only allow audio after one. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setEngine(speedRatio, driving) {
      if (!ensure()) return;
      const target = muted ? 0 : driving ? 0.045 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 165, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenTimer) {
        let high = false;
        sirenTimer = window.setInterval(() => {
          if (muted) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 960 : 690, ctx.currentTime, 0.05);
        }, 420);
        sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
      } else if (!on && sirenTimer) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const freq = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (freq > 0) blip(freq, 0.34, 'square', 0.05);
        if (musicStep % 4 === 0) blip(220, 0.1, 'sine', 0.02);
      }, 210);
    },
    shot() {
      noiseBurst(0.14, 0.5, 2400);
      blip(190, 0.09, 'square', 0.16, 70);
    },
    explosion() {
      noiseBurst(0.8, 0.7, 700);
      blip(120, 0.7, 'sine', 0.5, 32);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.2);
      window.setTimeout(() => blip(990, 0.16, 'sine', 0.2), 90);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.22, 'triangle', 0.22), i * 110);
      });
    },
    hit() {
      blip(140, 0.12, 'sawtooth', 0.2, 60);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
