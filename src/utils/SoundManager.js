/**
 * SoundManager - procedural audio for the Neuro-Chain
 * Uses Web Audio API to generate sci-fi UI sounds without external assets
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    
    // Lazy init on first user interaction to comply with autoplay policies
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Default volume
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      console.log('SoundManager initialized');
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      // Smooth fade to avoid clicks
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.enabled ? 0.3 : 0, now + 0.1);
    }
    return this.enabled;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Hover: High, short, tech blip
  playHover() {
    if (!this.enabled || !this.initialized) return;
    this.resume();
    
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Click: Meaningful selection sound
  playClick() {
    if (!this.enabled || !this.initialized) return;
    this.resume();
    
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Ambience: Deep, procedural space drone
  startAmbience() {
    if (!this.enabled || !this.initialized || this.ambienceStarted) return;
    
    const t = this.ctx.currentTime;
    this.ambienceStarted = true;

    // 1. Deep Fundamental (Macro)
    this.osc1 = this.ctx.createOscillator();
    this.gain1 = this.ctx.createGain();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(40, t);
    this.gain1.gain.setValueAtTime(0, t);
    this.gain1.gain.linearRampToValueAtTime(0.08, t + 4); // Slow swell
    
    // 2. Mid Texture (Micro)
    this.osc2 = this.ctx.createOscillator();
    this.gain2 = this.ctx.createGain();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(80, t);
    this.gain2.gain.setValueAtTime(0, t);
    this.gain2.gain.linearRampToValueAtTime(0.04, t + 6);

    // 3. LFO (Breathing effect)
    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();
    this.lfo.frequency.setValueAtTime(0.2, t); // Very slow breath
    this.lfoGain.gain.setValueAtTime(5, t); // Range of 5Hz
    
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.osc1.frequency);
    this.lfoGain.connect(this.osc2.frequency);

    this.osc1.connect(this.gain1);
    this.osc2.connect(this.gain2);
    this.gain1.connect(this.masterGain);
    this.gain2.connect(this.masterGain);

    this.osc1.start();
    this.osc2.start();
    this.lfo.start();
  }

  // Update atmosphere based on zoom levels
  updateAmbience(zoom) {
    if (!this.initialized || !this.ambienceStarted) return;
    const t = this.ctx.currentTime;
    
    // Zoomed in (higher detail) -> Higher, granular hum
    // Zoomed out (macro) -> Deeper, broader drone
    const freq1 = 30 + (zoom * 20); // 30Hz to 90Hz approx
    const freq2 = 60 + (zoom * 40); 
    
    this.osc1.frequency.setTargetAtTime(freq1, t, 0.5);
    this.osc2.frequency.setTargetAtTime(freq2, t, 0.5);
  }

  stopAmbience() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [this.gain1, this.gain2].forEach(g => {
        if (g) {
            g.gain.cancelScheduledValues(t);
            g.gain.linearRampToValueAtTime(0, t + 2);
        }
    });
    setTimeout(() => {
        [this.osc1, this.osc2, this.lfo].forEach(o => o?.stop());
        this.ambienceStarted = false;
    }, 2000);
  }
}

export const soundManager = new SoundManager();
export default soundManager;
