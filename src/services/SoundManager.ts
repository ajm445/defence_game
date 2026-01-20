/**
 * SoundManager - Web Audio API 기반 프로시저럴 사운드 시스템
 * 외부 파일 없이 코드로 사운드를 생성합니다.
 */

export type SoundType =
  | 'ui_click'
  | 'unit_spawn'
  | 'attack_melee'
  | 'attack_ranged'
  | 'attack_mage'
  | 'unit_death'
  | 'resource_collect'
  | 'build_wall'
  | 'upgrade'
  | 'victory'
  | 'defeat'
  | 'warning'
  | 'boss_spawn'
  | 'heal';

class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private initialized: boolean = false;

  // 사운드 쿨다운 (동시 재생 방지)
  private lastPlayTime: Map<SoundType, number> = new Map();
  private readonly COOLDOWN_MS = 50; // 50ms 쿨다운

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * AudioContext 초기화 (사용자 인터랙션 후 호출 필요)
   */
  public init(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volume;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMuted(): void {
    this.setMuted(!this.muted);
  }

  /**
   * 사운드 재생
   */
  public play(soundId: SoundType): void {
    if (!this.audioContext || !this.masterGain || this.muted) return;

    // 쿨다운 체크
    const now = performance.now();
    const lastTime = this.lastPlayTime.get(soundId) || 0;
    if (now - lastTime < this.COOLDOWN_MS) return;
    this.lastPlayTime.set(soundId, now);

    // Resume if suspended (브라우저 정책)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    switch (soundId) {
      case 'ui_click':
        this.playUIClick();
        break;
      case 'unit_spawn':
        this.playUnitSpawn();
        break;
      case 'attack_melee':
        this.playAttackMelee();
        break;
      case 'attack_ranged':
        this.playAttackRanged();
        break;
      case 'attack_mage':
        this.playAttackMage();
        break;
      case 'unit_death':
        this.playUnitDeath();
        break;
      case 'resource_collect':
        this.playResourceCollect();
        break;
      case 'build_wall':
        this.playBuildWall();
        break;
      case 'upgrade':
        this.playUpgrade();
        break;
      case 'victory':
        this.playVictory();
        break;
      case 'defeat':
        this.playDefeat();
        break;
      case 'warning':
        this.playWarning();
        break;
      case 'boss_spawn':
        this.playBossSpawn();
        break;
      case 'heal':
        this.playHeal();
        break;
    }
  }

  // ===== 프로시저럴 사운드 생성 메서드 =====

  /**
   * UI 클릭 - 짧은 사인파 (800Hz, 50ms)
   */
  private playUIClick(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 800;

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 유닛 생산 - 상승 톤 (300→600Hz)
   */
  private playUnitSpawn(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * 근접 공격 - 노이즈 버스트 + 저음
   */
  private playAttackMelee(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 노이즈
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // 저음 임팩트
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);

    noise.start(now);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 원거리 공격 - 짧은 휘슬음
   */
  private playAttackRanged(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 마법 공격 - 전자음 + 리버브 느낌
   */
  private playAttackMage(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 메인 톤
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(660, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
  }

  /**
   * 유닛 사망 - 하강 톤 (400→100Hz)
   */
  private playUnitDeath(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * 자원 수집 - 동전 소리 (고음 핑)
   */
  private playResourceCollect(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 벽 건설 - 돌 부딪히는 소리
   */
  private playBuildWall(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 노이즈 버스트
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(now);
  }

  /**
   * 업그레이드 - 상승 아르페지오 (3음)
   */
  private playUpgrade(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const notes = [523, 659, 784]; // C5, E5, G5
    const duration = 0.12;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * 승리 - 팡파레 (3음 상승)
   */
  private playVictory(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const duration = 0.2;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = freq;

      const startTime = now + i * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.setValueAtTime(0.15, startTime + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * 패배 - 하강 3음
   */
  private playDefeat(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const notes = [392, 330, 262]; // G4, E4, C4
    const duration = 0.25;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const startTime = now + i * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * 대량발생 경고 - 경고 사이렌
   */
  private playWarning(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';

    // 사이렌 효과 (주파수 변조)
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.15);
    osc.frequency.linearRampToValueAtTime(600, now + 0.3);
    osc.frequency.linearRampToValueAtTime(900, now + 0.45);
    osc.frequency.linearRampToValueAtTime(600, now + 0.6);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.15, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * 보스 등장 - 무거운 드럼 + 저음
   */
  private playBossSpawn(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 저음 드럼
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const startTime = now + i * 0.2;
      osc.frequency.setValueAtTime(80, startTime);
      osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.15);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }

    // 노이즈 임팩트
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    noise.start(now);
  }

  /**
   * 힐 - 부드러운 상승음
   */
  private playHeal(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const soundManager = SoundManager.getInstance();
