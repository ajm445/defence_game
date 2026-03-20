/**
 * 전직 스킬 쿨다운 공유 설정
 * 서버(rpgServerHeroSystem.ts)와 클라이언트(rpgConfig.ts) 양쪽에서 참조
 * 쿨다운 변경 시 이 파일만 수정하면 됨
 */

import type { HeroClass, AdvancedHeroClass } from '../../src/types/rpg';

// 기본 직업 스킬 설정 (타입 + 쿨다운)
export const BASE_SKILL_COOLDOWNS: Record<HeroClass, {
  qType: string; qCd: number;
  wType: string; wCd: number;
  eType: string; eCd: number;
}> = {
  warrior: { qType: 'warrior_q', qCd: 1.0, wType: 'warrior_w', wCd: 7.0, eType: 'warrior_e', eCd: 30.0 },
  archer:  { qType: 'archer_q',  qCd: 0.7, wType: 'archer_w',  wCd: 8.0, eType: 'archer_e',  eCd: 30.0 },
  knight:  { qType: 'knight_q',  qCd: 1.1, wType: 'knight_w',  wCd: 8.0, eType: 'knight_e',  eCd: 35.0 },
  mage:    { qType: 'mage_q',    qCd: 1.4, wType: 'mage_w',    wCd: 7.0, eType: 'mage_e',    eCd: 40.0 },
};

// 전직 스킬 설정 (타입 + 쿨다운)
export const ADVANCED_SKILL_COOLDOWNS: Record<AdvancedHeroClass, {
  wType: string; wCd: number;
  eType: string; eCd: number;
}> = {
  berserker:  { wType: 'blood_rush',     wCd: 6.0,  eType: 'berserker_rage',  eCd: 45.0 },
  guardian:   { wType: 'guardian_rush',   wCd: 8.0,  eType: 'guardian_wall',   eCd: 40.0 },
  sniper:     { wType: 'backflip_shot',  wCd: 5.0,  eType: 'headshot',        eCd: 30.0 },
  ranger:     { wType: 'multi_arrow',    wCd: 5.0,  eType: 'arrow_storm',     eCd: 35.0 },
  paladin:    { wType: 'holy_charge',    wCd: 8.0,  eType: 'holy_judgment',   eCd: 60.0 },
  darkKnight: { wType: 'heavy_strike',   wCd: 4.0,  eType: 'dark_blade',      eCd: 0 },
  archmage:   { wType: 'inferno',        wCd: 7.0,  eType: 'meteor_shower',   eCd: 50.0 },
  healer:     { wType: 'healing_light',  wCd: 7.0,  eType: 'spring_of_life',  eCd: 45.0 },
};
