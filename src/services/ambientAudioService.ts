// Offline Ambient Soundscape Generator using Web Audio API
// No external audio files or internet required - 100% synthesized locally!

export type SoundscapeType = "rain" | "waves" | "campfire" | "wind" | "whitenoise";

class AmbientAudioService {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType | null = null;
  private isPlaying: boolean = false;
  private masterGain: GainNode | null = null;
  private volume: number = 0.4;
  private activeNodes: (AudioNode | number)[] = []; // AudioNodes and interval IDs

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getStatus(): { isPlaying: boolean; type: SoundscapeType | null; volume: number } {
    return {
      isPlaying: this.isPlaying,
      type: this.currentType,
      volume: this.volume,
    };
  }

  public stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.currentType = null;

    // Clear any timers
    this.activeNodes.forEach((item) => {
      if (typeof item === "number") {
        window.clearInterval(item);
      } else {
        try {
          if ("stop" in item && typeof (item as AudioScheduledSourceNode).stop === "function") {
            (item as AudioScheduledSourceNode).stop();
          }
          item.disconnect();
        } catch {
          // ignore already stopped
        }
      }
    });
    this.activeNodes = [];

    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.disconnect();
      } catch {
        // ignore
      }
      this.masterGain = null;
    }
  }

  public play(type: SoundscapeType) {
    this.stop();
    this.initContext();
    if (!this.ctx) return;

    this.isPlaying = true;
    this.currentType = type;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    switch (type) {
      case "rain":
        this.startRain();
        break;
      case "waves":
        this.startWaves();
        break;
      case "campfire":
        this.startCampfire();
        break;
      case "wind":
        this.startWind();
        break;
      case "whitenoise":
        this.startWhiteNoise();
        break;
    }
  }

  private createNoiseBuffer(seconds: number = 5): AudioBuffer {
    if (!this.ctx) throw new Error("No AudioContext");
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise approximation for a warmer, natural sound
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain compensation
    }
    return buffer;
  }

  private startRain() {
    if (!this.ctx || !this.masterGain) return;

    // Steady rain sound via low-pass filtered pink noise
    const noiseBuffer = this.createNoiseBuffer(5);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noiseSource.start();

    this.activeNodes.push(noiseSource, filter, gain);

    // Random raindrops: sporadic high-frequency filtered clicks
    const dropInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || !this.isPlaying) return;
      try {
        const osc = this.ctx.createOscillator();
        const dropGain = this.ctx.createGain();
        const dropFilter = this.ctx.createBiquadFilter();

        dropFilter.type = "bandpass";
        dropFilter.frequency.setValueAtTime(2000 + Math.random() * 3000, this.ctx.currentTime);
        dropFilter.Q.setValueAtTime(8, this.ctx.currentTime);

        const freq = 1200 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, this.ctx.currentTime + 0.04);

        dropGain.gain.setValueAtTime(0.02 + Math.random() * 0.03, this.ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);

        osc.connect(dropFilter);
        dropFilter.connect(dropGain);
        dropGain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch {
        // ignore
      }
    }, 120);

    this.activeNodes.push(dropInterval);
  }

  private startWaves() {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer(6);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const waveGain = this.ctx.createGain();
    waveGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

    // LFO to slowly swell and recede like waves crashing (period ~ 6 seconds)
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.16, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    noiseSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.masterGain);

    noiseSource.start();
    lfo.start();

    this.activeNodes.push(noiseSource, filter, waveGain, lfo, lfoGain);
  }

  private startCampfire() {
    if (!this.ctx || !this.masterGain) return;

    // Warm ambient rumble
    const noiseBuffer = this.createNoiseBuffer(5);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noiseSource.start();

    this.activeNodes.push(noiseSource, filter, gain);

    // Random crackles and pops
    const crackleInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || !this.isPlaying) return;
      if (Math.random() > 0.4) {
        try {
          const osc = this.ctx.createOscillator();
          const pGain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(600 + Math.random() * 1200, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.03);

          pGain.gain.setValueAtTime(0.04 + Math.random() * 0.06, this.ctx.currentTime);
          pGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);

          osc.connect(pGain);
          pGain.connect(this.masterGain);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.04);
        } catch {
          // ignore
        }
      }
    }, 180);

    this.activeNodes.push(crackleInterval);
  }

  private startWind() {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer(6);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    // Slow modulating frequency for wind gusts
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(250, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start();
    lfo.start();

    this.activeNodes.push(noiseSource, filter, gain, lfo, lfoGain);
  }

  private startWhiteNoise() {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer(5);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noiseSource.start();

    this.activeNodes.push(noiseSource, filter, gain);
  }
}

export const ambientAudioService = new AmbientAudioService();
