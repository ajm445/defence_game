import React, { useRef, useCallback } from 'react';
import { useHero, useRPGStore } from '../../stores/useRPGStore';
import { useUIStore } from '../../stores/useUIStore';
import { SkillType } from '../../types/rpg';
import { sendSkillUse } from '../../hooks/useNetworkSync';
import { soundManager } from '../../services/SoundManager';

interface TouchSkillButtonProps {
  slot: 'W' | 'E';
  icon: string;
  label: string;
  cooldown: number;
  maxCooldown: number;
  active?: boolean;
  disabled?: boolean;
  onUse: (targetX: number, targetY: number) => void;
}

const TouchSkillButton: React.FC<TouchSkillButtonProps> = ({
  slot: _slot, icon, label, cooldown, maxCooldown, active, disabled, onUse,
}) => {
  const uiScale = useUIStore((s) => s.uiScale);
  const size = Math.round(56 * uiScale);
  const isOnCooldown = cooldown > 0;
  const isDisabled = active ? false : (isOnCooldown || disabled);
  const cooldownPercent = isOnCooldown ? (cooldown / maxCooldown) * 100 : 0;

  // 드래그 방향 지정용
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isDisabled && !active) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDisabled, active]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > 15) {
      isDraggingRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return;

    const state = useRPGStore.getState();
    const hero = state.hero;
    if (!hero || hero.hp <= 0) {
      startRef.current = null;
      return;
    }

    let targetX: number;
    let targetY: number;

    if (isDraggingRef.current) {
      // 드래그: 방향 지정
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        targetX = hero.x + (dx / dist) * 200;
        targetY = hero.y + (dy / dist) * 200;
      } else {
        targetX = hero.x + (hero.facingRight ? 200 : -200);
        targetY = hero.y;
      }
    } else {
      // 탭: 가장 가까운 적 방향으로 자동 타겟
      const enemies = state.enemies;
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const d = Math.hypot(enemy.x - hero.x, enemy.y - hero.y);
        if (d < nearestDist) {
          nearest = enemy;
          nearestDist = d;
        }
      }
      if (nearest) {
        targetX = nearest.x;
        targetY = nearest.y;
      } else {
        targetX = hero.x + (hero.facingRight ? 200 : -200);
        targetY = hero.y;
      }
    }

    onUse(targetX, targetY);
    startRef.current = null;
    isDraggingRef.current = false;
  }, [onUse]);

  return (
    <div className="relative" style={{ touchAction: 'none' }}>
      <button
        className={`
          relative rounded-xl border-2 overflow-hidden
          transition-all duration-200
          ${active
            ? 'bg-gradient-to-br from-purple-600/50 to-purple-900/50 border-purple-400 shadow-[0_0_12px_rgba(147,51,234,0.5)]'
            : isDisabled
              ? 'bg-dark-700/80 border-dark-500'
              : 'bg-dark-700/60 border-neon-cyan/50 active:scale-95'
          }
        `}
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { startRef.current = null; }}
      >
        {/* 쿨다운 오버레이 */}
        {isOnCooldown && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-dark-900/80"
            style={{ height: `${cooldownPercent}%` }}
          />
        )}

        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <span className="text-xl">{icon}</span>
          <span className="text-[9px] text-white/60 font-bold">{label}</span>
        </div>

        {/* 쿨다운 텍스트 */}
        {isOnCooldown && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <span className="text-sm font-bold text-white drop-shadow-lg">
              {Math.ceil(cooldown)}
            </span>
          </div>
        )}

        {/* 토글 활성 표시 */}
        {active && (
          <div className="absolute top-0 left-0 bg-purple-500 text-white text-[8px] font-bold px-1 rounded-br animate-pulse">
            ON
          </div>
        )}
      </button>
    </div>
  );
};

interface TouchSkillButtonsProps {
  onUseSkill: (skillType: SkillType) => void;
  requestSkill: (skillType: SkillType) => boolean;
}

export const TouchSkillButtons: React.FC<TouchSkillButtonsProps> = ({ onUseSkill: _onUseSkill, requestSkill }) => {
  const hero = useHero();
  const uiScale = useUIStore((s) => s.uiScale);

  if (!hero || hero.hp <= 0) return null;

  const wSkill = hero.skills.find(s => s.key === 'W');
  const eSkill = hero.skills.find(s => s.key === 'E');

  // 스킬 아이콘 맵 (간략화)
  const getIcon = (type: string): string => {
    const map: Record<string, string> = {
      warrior_w: '💨', warrior_e: '🔥',
      archer_w: '➡️', archer_e: '🌧️',
      knight_w: '🛡️', knight_e: '🏰',
      mage_w: '🔥', mage_e: '☄️',
      blood_rush: '🩸', guardian_rush: '🛡️',
      backflip_shot: '🔙', multi_arrow: '🏹',
      holy_charge: '✝️', heavy_strike: '⚔️',
      inferno: '🔥', healing_light: '💚',
      rage: '😡', shield: '🛡️',
      snipe: '🎯', arrow_storm: '🌪️',
      divine_light: '☀️', dark_blade: '⚫',
      meteor_shower: '☄️', spring_of_life: '💧',
    };
    return map[type] || '⭐';
  };

  const handleWSkill = useCallback((targetX: number, targetY: number) => {
    if (!wSkill) return;
    const state = useRPGStore.getState();
    const { isMultiplayer } = state.multiplayer;

    // 마우스 위치를 타겟으로 설정
    useRPGStore.getState().setMousePosition(targetX, targetY);

    if (isMultiplayer) {
      sendSkillUse('W', targetX, targetY);

      // 다크나이트 W스킬 로컬 예측
      if (state.hero?.advancedClass === 'darkKnight') {
        const hpCost = Math.floor(state.hero.maxHp * 0.20);
        if (state.hero.hp > hpCost) {
          const dx = targetX - state.hero.x;
          const dy = targetY - state.hero.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const dirX = dist > 0 ? dx / dist : (state.hero.facingRight ? 1 : -1);
          const dirY = dist > 0 ? dy / dist : 0;

          useRPGStore.setState((s) => {
            if (!s.hero) return s;
            return {
              hero: {
                ...s.hero,
                hp: s.hero.hp - hpCost,
                castingUntil: s.gameTime + 1.0,
                facingRight: dirX >= 0,
                moveDirection: undefined,
                state: 'idle' as const,
              },
              activeSkillEffects: [...s.activeSkillEffects, {
                type: 'heavy_strike' as any,
                position: { x: s.hero.x, y: s.hero.y },
                direction: { x: dirX, y: dirY },
                duration: 1.0,
                startTime: s.gameTime,
                heroId: s.hero.id,
              }],
            };
          });
          useRPGStore.getState().useSkill(wSkill.type);
        }
      }

      soundManager.play('attack_melee');
    } else {
      if (requestSkill(wSkill.type)) {
        soundManager.play('attack_melee');
      }
    }
  }, [wSkill, requestSkill]);

  const handleESkill = useCallback((targetX: number, targetY: number) => {
    if (!eSkill) return;
    const state = useRPGStore.getState();
    const { isMultiplayer } = state.multiplayer;

    useRPGStore.getState().setMousePosition(targetX, targetY);

    if (isMultiplayer) {
      sendSkillUse('E', targetX, targetY);
      const heroClass = state.hero?.heroClass;
      if (heroClass === 'knight' || heroClass === 'warrior') {
        soundManager.play('heal');
      } else {
        soundManager.play('attack_ranged');
      }
    } else {
      if (requestSkill(eSkill.type)) {
        const heroClass = state.hero?.heroClass;
        if (heroClass === 'knight' || heroClass === 'warrior') {
          soundManager.play('heal');
        } else {
          soundManager.play('attack_ranged');
        }
      }
    }
  }, [eSkill, requestSkill]);

  const gap = Math.round(12 * uiScale);

  return (
    <div
      className="flex flex-col items-center"
      style={{ gap }}
    >
      {wSkill && (
        <TouchSkillButton
          slot="W"
          icon={getIcon(wSkill.type)}
          label="스킬"
          cooldown={wSkill.currentCooldown}
          maxCooldown={wSkill.cooldown}
          onUse={handleWSkill}
        />
      )}
      {eSkill && (
        <TouchSkillButton
          slot="E"
          icon={getIcon(eSkill.type)}
          label="궁극기"
          cooldown={eSkill.currentCooldown}
          maxCooldown={eSkill.cooldown}
          active={eSkill.type === 'dark_blade' && hero.darkBladeActive}
          onUse={handleESkill}
        />
      )}
    </div>
  );
};
