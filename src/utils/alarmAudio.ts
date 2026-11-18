import type { AlarmSoundId } from '../types/database.types';

export interface AlarmSoundOption {
  id: AlarmSoundId;
  label: string;
  description: string;
}

export const ALARM_SOUND_OPTIONS: AlarmSoundOption[] = [
  { id: 'chime', label: 'Melodic Chime', description: 'Warm ascending three-note chime' },
  { id: 'bell', label: 'Classic Bell', description: 'Crisp double-ring alarm bell' },
  { id: 'pulse', label: 'Digital Pulse', description: 'Clear rhythmic alert beeps' },
  { id: 'gentle', label: 'Gentle Wave', description: 'Soft harmonic reminder tone' },
];

type AudioContextCtor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private loopTimer: number | null = null;
  private activeOscillators = new Set<OscillatorNode>();
  private currentVolume = 0.75;
  private currentSound: AlarmSoundId = 'chime';
  private isPlaying = false;
  private unlocked = false;

  private ensureContext(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'closed') {
      return this.ctx;
    }
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  public isAudioUnlocked(): boolean {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') {
      return true;
    }
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  public async unlockAudio(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.unlocked = ctx.state === 'running';
      return this.unlocked;
    } catch {
      return false;
    }
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startOffsetSec: number,
    durationSec: number,
    type: OscillatorType,
    gainMultiplier: number
  ) {
    const now = ctx.currentTime + startOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    const peakGain = Math.max(0.001, this.currentVolume * gainMultiplier);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    this.activeOscillators.add(osc);
    osc.onended = () => {
      this.activeOscillators.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private playPatternOnce(ctx: AudioContext, sound: AlarmSoundId): void {
    switch (sound) {
      case 'bell':
        this.playTone(ctx, 1046.5, 0.0, 0.32, 'triangle', 0.45);
        this.playTone(ctx, 1318.5, 0.0, 0.32, 'sine', 0.28);
        this.playTone(ctx, 1046.5, 0.38, 0.36, 'triangle', 0.45);
        this.playTone(ctx, 1318.5, 0.38, 0.36, 'sine', 0.28);
        break;
      case 'pulse':
        this.playTone(ctx, 880, 0.0, 0.16, 'square', 0.22);
        this.playTone(ctx, 880, 0.24, 0.16, 'square', 0.22);
        this.playTone(ctx, 1174.66, 0.48, 0.24, 'square', 0.22);
        break;
      case 'gentle':
        this.playTone(ctx, 440, 0.0, 0.65, 'sine', 0.35);
        this.playTone(ctx, 554.37, 0.22, 0.7, 'sine', 0.3);
        break;
      case 'chime':
      default:
        this.playTone(ctx, 523.25, 0.0, 0.4, 'sine', 0.38);
        this.playTone(ctx, 659.25, 0.16, 0.42, 'sine', 0.38);
        this.playTone(ctx, 783.99, 0.32, 0.55, 'sine', 0.42);
        break;
    }
  }

  public async previewSound(sound: AlarmSoundId, volume: number): Promise<boolean> {
    this.setVolume(volume);
    const ok = await this.unlockAudio();
    if (!ok || !this.ctx) return false;
    this.playPatternOnce(this.ctx, sound);
    return true;
  }

  public async startRepeatingAlarm(sound: AlarmSoundId, volume: number): Promise<boolean> {
    this.stopAlarm();
    this.currentSound = sound;
    this.setVolume(volume);

    const ok = await this.unlockAudio();
    if (!ok || !this.ctx) {
      return false;
    }

    this.isPlaying = true;
    this.playPatternOnce(this.ctx, this.currentSound);

    this.loopTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.playPatternOnce(this.ctx, this.currentSound);
    }, 2200);

    return true;
  }

  public stopAlarm(): void {
    this.isPlaying = false;
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeOscillators.clear();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const alarmAudio = new AlarmAudioEngine();

