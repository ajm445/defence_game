import { Effect, EffectType, Particle } from '../types/effect';
import { PARTICLE_CONFIGS, ParticleConfig } from './particleConfigs';
import { drawEmoji } from '../utils/canvasEmoji';

const MAX_EFFECTS = 200;
const MAX_PARTICLES_PER_EFFECT = 30;

class EffectManager {
  private static instance: EffectManager;
  private effects: Effect[] = [];
  private nextId = 0;
  private gatherCooldowns: Map<string, number> = new Map();
  private readonly GATHER_COOLDOWN = 0.3; // 채집 이펙트 쿨타임

  private constructor() {}

  public static getInstance(): EffectManager {
    if (!EffectManager.instance) {
      EffectManager.instance = new EffectManager();
    }
    return EffectManager.instance;
  }

  public createEffect(type: EffectType, x: number, y: number, targetX?: number, targetY?: number): void {
    // 최대 이펙트 개수 제한
    if (this.effects.length >= MAX_EFFECTS) {
      // 가장 오래된 이펙트 제거
      this.effects.shift();
    }

    const config = PARTICLE_CONFIGS[type];
    const particles = this.createParticles(config, x, y, targetX, targetY);

    const effect: Effect = {
      id: `effect_${this.nextId++}`,
      type,
      x,
      y,
      particles,
      startTime: performance.now(),
      duration: config.lifeMax * 1000,
      radius: type === 'attack_mage' ? 50 : undefined,
      targetX,
      targetY,
    };

    this.effects.push(effect);
  }

  public createGatherEffect(type: EffectType, x: number, y: number, unitId: string): boolean {
    const now = performance.now() / 1000;
    const lastTime = this.gatherCooldowns.get(unitId) || 0;

    if (now - lastTime < this.GATHER_COOLDOWN) {
      return false;
    }

    this.gatherCooldowns.set(unitId, now);
    this.createEffect(type, x, y);
    return true;
  }

  private createParticles(config: ParticleConfig, x: number, y: number, targetX?: number, targetY?: number): Particle[] {
    const particles: Particle[] = [];
    const count = Math.min(config.count, MAX_PARTICLES_PER_EFFECT);

    for (let i = 0; i < count; i++) {
      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      const life = config.lifeMin + Math.random() * (config.lifeMax - config.lifeMin);
      const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];

      let angle: number;
      if (targetX !== undefined && targetY !== undefined) {
        // 타겟 방향으로 파티클 방출
        const baseAngle = Math.atan2(targetY - y, targetX - x);
        angle = baseAngle + (Math.random() - 0.5) * config.spread;
      } else if (config.direction !== undefined) {
        angle = config.direction + (Math.random() - 0.5) * config.spread;
      } else {
        angle = Math.random() * config.spread;
      }

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size,
        color,
        gravity: config.gravity,
        shape: config.shape,
        alpha: 1,
        emoji: config.emoji,
      });
    }

    return particles;
  }

  public update(deltaTime: number): void {
    // 이펙트와 파티클 업데이트
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      let allDead = true;

      for (const particle of effect.particles) {
        if (particle.life <= 0) continue;

        particle.life -= deltaTime;
        if (particle.life > 0) {
          allDead = false;
          particle.x += particle.vx * deltaTime;
          particle.y += particle.vy * deltaTime;
          if (particle.gravity) {
            particle.vy += particle.gravity * deltaTime;
          }
          particle.alpha = particle.life / particle.maxLife;
        }
      }

      if (allDead) {
        this.effects.splice(i, 1);
      }
    }

    // 오래된 쿨타임 정리
    const now = performance.now() / 1000;
    for (const [unitId, time] of this.gatherCooldowns) {
      if (now - time > this.GATHER_COOLDOWN * 2) {
        this.gatherCooldowns.delete(unitId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, scaledWidth: number, scaledHeight: number): void {
    for (const effect of this.effects) {
      // AOE 원형 파동 (마법사 공격)
      if (effect.type === 'attack_mage' && effect.radius) {
        this.renderAoeWave(ctx, effect, cameraX, cameraY);
      }

      // 파티클 렌더링
      for (const particle of effect.particles) {
        if (particle.life <= 0) continue;

        const screenX = particle.x - cameraX;
        const screenY = particle.y - cameraY;

        // 화면 밖이면 스킵
        if (screenX < -20 || screenX > scaledWidth + 20 ||
            screenY < -20 || screenY > scaledHeight + 20) {
          continue;
        }

        ctx.save();
        ctx.globalAlpha = particle.alpha || 1;
        ctx.fillStyle = particle.color;

        switch (particle.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 'square':
            ctx.fillRect(
              screenX - particle.size / 2,
              screenY - particle.size / 2,
              particle.size,
              particle.size
            );
            break;

          case 'star':
            this.drawStar(ctx, screenX, screenY, particle.size);
            break;

          case 'emoji':
            if (particle.emoji) {
              drawEmoji(ctx, particle.emoji, screenX, screenY, particle.size);
            }
            break;

          case 'cross':
            this.drawCross(ctx, screenX, screenY, particle.size);
            break;
        }

        ctx.restore();
      }
    }
  }

  private renderAoeWave(ctx: CanvasRenderingContext2D, effect: Effect, cameraX: number, cameraY: number): void {
    const elapsed = (performance.now() - effect.startTime) / 1000;
    const maxDuration = 0.5;
    if (elapsed > maxDuration) return;

    const progress = elapsed / maxDuration;
    const radius = (effect.radius || 50) * progress;
    const alpha = 1 - progress;

    const screenX = effect.x - cameraX;
    const screenY = effect.y - cameraY;

    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#9933ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 글로우
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = '#cc66ff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size / 2;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const thickness = size * 0.35; // 십자가 두께
    const halfSize = size / 2;
    const halfThick = thickness / 2;

    ctx.beginPath();
    // 세로 막대
    ctx.rect(x - halfThick, y - halfSize, thickness, size);
    // 가로 막대
    ctx.rect(x - halfSize, y - halfThick, size, thickness);
    ctx.fill();
  }

  public clear(): void {
    this.effects = [];
    this.gatherCooldowns.clear();
  }

  public getEffectCount(): number {
    return this.effects.length;
  }
}

export const effectManager = EffectManager.getInstance();
