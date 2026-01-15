import { Unit, UnitType, Team, Base } from '../../types';
import { CONFIG } from '../../constants/config';
import { generateId } from '../../utils/math';

export function createUnit(type: UnitType, team: Team, base: Base): Unit {
  const unitConfig = CONFIG.UNITS[type];

  return {
    id: generateId(),
    type,
    config: unitConfig,
    x: base.x + (team === 'player' ? 50 : -50),
    y: base.y + (Math.random() - 0.5) * 100,
    hp: unitConfig.hp,
    maxHp: unitConfig.hp,
    state: 'idle',
    attackCooldown: 0,
    team,
  };
}
