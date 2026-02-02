import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  ClassProgress,
  GameRecord,
  LevelUpResult,
  StatUpgradeType,
  getRequiredPlayerExp,
  getRequiredClassExp,
  calculatePlayerExp,
  calculateClassExp,
  createDefaultStatUpgrades,
  SP_PER_CLASS_LEVEL,
  STAT_UPGRADE_CONFIG,
  getUpgradeableStats,
} from '../types/auth';
import { HeroClass, RPGDifficulty, AdvancedHeroClass } from '../types/rpg';
import {
  getClassProgress,
  getGameHistory,
  processGameResult,
  processRTSGameResult,
  getPlayerStats,
  upgradeCharacterStat,
  resetCharacterStats,
  advanceJob,
  applySecondEnhancement,
} from '../services/profileService';
import { useAuthStore } from './useAuthStore';

interface ProfileState {
  // 클래스 진행 상황
  classProgress: ClassProgress[];

  // 게임 기록
  gameHistory: GameRecord[];

  // 통계
  stats: {
    totalGames: number;
    totalWins: number;
    totalKills: number;
    totalPlayTime: number;
    highestWave: number;
    favoriteClass: HeroClass | null;
  } | null;

  // 마지막 게임 결과
  lastGameResult: {
    playerExpGained: number;
    classExpGained: number;
    levelUpResult: LevelUpResult;
  } | null;

  // 로딩 상태
  isLoading: boolean;
}

interface ProfileActions {
  // 데이터 로드
  loadProfileData: () => Promise<void>;
  loadClassProgress: () => Promise<void>;
  loadGameHistory: () => Promise<void>;
  loadStats: () => Promise<void>;

  // 게임 결과 처리 (넥서스 디펜스 - 싱글)
  handleGameEnd: (gameData: {
    mode: 'single' | 'coop';
    classUsed: HeroClass;
    basesDestroyed: number;
    bossesKilled: number;
    kills: number;
    playTime: number;  // 초 단위
    victory: boolean;
    difficulty?: RPGDifficulty;  // 난이도 (경험치 배율 적용)
  }) => Promise<LevelUpResult | null>;

  // 협동 모드 게임 결과 처리 (넥서스 디펜스)
  handleCoopGameEnd: (gameData: {
    classUsed: HeroClass;
    basesDestroyed: number;
    bossesKilled: number;
    kills: number;
    playTime: number;
    victory: boolean;
    difficulty?: RPGDifficulty;  // 난이도 (경험치 배율 적용)
  }) => Promise<LevelUpResult | null>;

  // RTS 게임 결과 처리 (플레이어 경험치만)
  handleRTSGameEnd: (gameData: {
    victory: boolean;
    playTime: number;
    mode: 'tutorial' | 'ai' | 'multiplayer';
  }) => Promise<{ playerLeveledUp: boolean; newPlayerLevel?: number; playerExpGained: number } | null>;

  // 클래스 진행 상황 가져오기
  getClassProgressFor: (className: HeroClass) => ClassProgress | undefined;

  // 레벨업 요구 경험치 계산
  getPlayerExpProgress: () => { current: number; required: number; percentage: number };
  getClassExpProgress: (className: HeroClass) => { current: number; required: number; percentage: number };

  // 마지막 결과 초기화
  clearLastGameResult: () => void;

  // SP 스탯 업그레이드
  upgradeCharacterStatAction: (
    className: HeroClass,
    statType: StatUpgradeType
  ) => Promise<boolean>;

  // 업그레이드 가능 여부 확인
  canUpgradeStat: (className: HeroClass, statType: StatUpgradeType) => boolean;

  // SP 초기화 (스탯 리셋)
  resetCharacterStatsAction: (className: HeroClass) => Promise<boolean>;

  // 전직 (직업 전환)
  advanceJobAction: (className: HeroClass, advancedClass: AdvancedHeroClass) => Promise<boolean>;

  // 2차 강화 (레벨 50 도달 시)
  applySecondEnhancementAction: (className: HeroClass) => Promise<boolean>;

  // 전체 초기화 (로그아웃 시)
  reset: () => void;
}

interface ProfileStore extends ProfileState, ProfileActions {}

export const useProfileStore = create<ProfileStore>()(
  subscribeWithSelector((set, get) => ({
    // 초기 상태
    classProgress: [],
    gameHistory: [],
    stats: null,
    lastGameResult: null,
    isLoading: false,

    // 전체 프로필 데이터 로드
    loadProfileData: async () => {
      set({ isLoading: true });
      await Promise.all([
        get().loadClassProgress(),
        get().loadGameHistory(),
        get().loadStats(),
      ]);
      set({ isLoading: false });
    },

    // 클래스 진행 상황 로드
    loadClassProgress: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const progress = await getClassProgress(profile.id);
      set({ classProgress: progress });

      // useAuthStore의 classProgress도 동기화
      for (const p of progress) {
        authState.updateClassProgress(p);
      }
    },

    // 게임 기록 로드
    loadGameHistory: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const history = await getGameHistory(profile.id);
      set({ gameHistory: history });
    },

    // 통계 로드
    loadStats: async () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;
      if (!profile || profile.isGuest) return;

      const stats = await getPlayerStats(profile.id);
      set({ stats });
    },

    // 게임 종료 처리
    handleGameEnd: async (gameData) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      // 게스트인 경우 경험치 저장하지 않음
      if (!profile || profile.isGuest) return null;

      // useProfileStore 우선, 비어있으면 useAuthStore 사용 (로그인 시 로드됨)
      let classProgress = get().classProgress;
      if (classProgress.length === 0) {
        classProgress = authState.classProgress;
      }

      const result = await processGameResult(
        profile.id,
        profile,
        classProgress,
        gameData
      );

      // 로컬 상태 업데이트
      set({
        lastGameResult: {
          playerExpGained: result.playerExpGained,
          classExpGained: result.classExpGained,
          levelUpResult: result.levelUpResult,
        },
      });

      // 인증 스토어의 프로필 업데이트
      authState.updateLocalProfile(result.newProfile);

      // 클래스 진행 상황 업데이트 (useProfileStore)
      const existingIndex = classProgress.findIndex(
        (p) => p.className === gameData.classUsed
      );

      if (existingIndex >= 0) {
        const updated = [...classProgress];
        updated[existingIndex] = result.newClassProgress;
        set({ classProgress: updated });
      } else {
        set({ classProgress: [...classProgress, result.newClassProgress] });
      }

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(result.newClassProgress);

      return result.levelUpResult;
    },

    // 협동 모드 게임 종료 처리 (넥서스 디펜스)
    // 싱글플레이와 동일하게 processGameResult를 사용하여 서버에 저장
    handleCoopGameEnd: async (gameData) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      // 게스트인 경우 경험치 저장하지 않음
      if (!profile || profile.isGuest) return null;

      // useProfileStore 우선, 비어있으면 useAuthStore 사용 (로그인 시 로드됨)
      let classProgress = get().classProgress;
      if (classProgress.length === 0) {
        classProgress = authState.classProgress;
      }

      // 협동 모드: processGameResult 호출 (서버에 저장됨)
      const result = await processGameResult(
        profile.id,
        profile,
        classProgress,
        {
          mode: 'coop',  // 협동 모드 1.2배 보너스 적용
          classUsed: gameData.classUsed,
          basesDestroyed: gameData.basesDestroyed,
          bossesKilled: gameData.bossesKilled,
          kills: gameData.kills,
          playTime: gameData.playTime,
          victory: gameData.victory,
          difficulty: gameData.difficulty,  // 난이도 배율 적용
        }
      );

      // 로컬 상태 업데이트
      set({
        lastGameResult: {
          playerExpGained: result.playerExpGained,
          classExpGained: result.classExpGained,
          levelUpResult: result.levelUpResult,
        },
      });

      // 인증 스토어의 프로필 업데이트
      authState.updateLocalProfile(result.newProfile);

      // 클래스 진행 상황 업데이트 (useProfileStore)
      const existingIndex = classProgress.findIndex(
        (p) => p.className === gameData.classUsed
      );

      if (existingIndex >= 0) {
        const updated = [...classProgress];
        updated[existingIndex] = result.newClassProgress;
        set({ classProgress: updated });
      } else {
        set({ classProgress: [...classProgress, result.newClassProgress] });
      }

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(result.newClassProgress);

      return result.levelUpResult;
    },

    // RTS 게임 결과 처리 (플레이어 경험치만)
    handleRTSGameEnd: async (gameData) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      // 게스트인 경우 경험치 저장하지 않음 (null 반환)
      if (!profile || profile.isGuest) return null;

      const result = await processRTSGameResult(profile.id, profile, gameData);

      // 로컬 상태 업데이트
      set({
        lastGameResult: {
          playerExpGained: result.playerExpGained,
          classExpGained: 0,
          levelUpResult: {
            playerLeveledUp: result.levelUpResult.playerLeveledUp,
            newPlayerLevel: result.levelUpResult.newPlayerLevel,
            classLeveledUp: false,  // RTS는 클래스 레벨업 없음
          },
        },
      });

      // 인증 스토어의 프로필 업데이트
      authState.updateLocalProfile(result.newProfile);

      return {
        playerLeveledUp: result.levelUpResult.playerLeveledUp,
        newPlayerLevel: result.levelUpResult.newPlayerLevel,
        playerExpGained: result.playerExpGained,
      };
    },

    // 특정 클래스 진행 상황 가져오기
    getClassProgressFor: (className) => {
      return get().classProgress.find((p) => p.className === className);
    },

    // 플레이어 경험치 진행률
    getPlayerExpProgress: () => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile) {
        return { current: 0, required: 100, percentage: 0 };
      }

      const required = getRequiredPlayerExp(profile.playerLevel);
      const percentage = Math.min((profile.playerExp / required) * 100, 100);

      return {
        current: profile.playerExp,
        required,
        percentage,
      };
    },

    // 클래스 경험치 진행률
    getClassExpProgress: (className) => {
      const progress = get().classProgress.find((p) => p.className === className);

      if (!progress) {
        return { current: 0, required: 50, percentage: 0 };
      }

      const required = getRequiredClassExp(progress.classLevel);
      const percentage = Math.min((progress.classExp / required) * 100, 100);

      return {
        current: progress.classExp,
        required,
        percentage,
      };
    },

    // 마지막 게임 결과 초기화
    clearLastGameResult: () => {
      set({ lastGameResult: null });
    },

    // SP 스탯 업그레이드
    upgradeCharacterStatAction: async (className, statType) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile || profile.isGuest) return false;

      const { classProgress } = get();
      const progress = classProgress.find((p) => p.className === className);

      if (!progress || progress.sp <= 0) return false;

      // 업그레이드 가능 여부 확인
      if (!get().canUpgradeStat(className, statType)) return false;

      // API 호출
      const updatedProgress = await upgradeCharacterStat(
        profile.id,
        className,
        statType,
        progress
      );

      if (!updatedProgress) return false;

      // 로컬 상태 업데이트 (useProfileStore)
      const updatedList = classProgress.map((p) =>
        p.className === className ? updatedProgress : p
      );
      set({ classProgress: updatedList });

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(updatedProgress);

      return true;
    },

    // 업그레이드 가능 여부 확인
    canUpgradeStat: (className, statType) => {
      const { classProgress } = get();
      const progress = classProgress.find((p) => p.className === className);

      if (!progress || progress.sp <= 0) return false;

      // statUpgrades가 없으면 업그레이드 불가
      if (!progress.statUpgrades) return false;

      // 해당 캐릭터가 이 스탯을 업그레이드할 수 있는지 확인
      const upgradeableStats = getUpgradeableStats(className);
      if (!upgradeableStats.includes(statType)) return false;

      // 최대 레벨 확인
      const currentLevel = progress.statUpgrades[statType] ?? 0;
      const maxLevel = STAT_UPGRADE_CONFIG[statType].maxLevel;
      if (currentLevel >= maxLevel) return false;

      return true;
    },

    // SP 초기화 (스탯 리셋)
    resetCharacterStatsAction: async (className) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile || profile.isGuest) return false;

      const { classProgress } = get();
      const progress = classProgress.find((p) => p.className === className);

      if (!progress) return false;

      // 사용한 SP가 없으면 리셋할 필요 없음
      const spentSP =
        progress.statUpgrades.attack +
        progress.statUpgrades.speed +
        progress.statUpgrades.hp +
        progress.statUpgrades.attackSpeed +
        progress.statUpgrades.range +
        progress.statUpgrades.hpRegen;

      if (spentSP === 0) return false;

      // API 호출
      const updatedProgress = await resetCharacterStats(
        profile.id,
        className,
        progress
      );

      if (!updatedProgress) return false;

      // 로컬 상태 업데이트 (useProfileStore)
      const updatedList = classProgress.map((p) =>
        p.className === className ? updatedProgress : p
      );
      set({ classProgress: updatedList });

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(updatedProgress);

      return true;
    },

    // 전직 액션 (전직 변경도 지원)
    advanceJobAction: async (className, advancedClass) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile || profile.isGuest) return false;

      const { classProgress } = get();
      const progress = classProgress.find((p) => p.className === className);

      if (!progress) return false;

      // 레벨 조건 확인 (Lv.15 이상)
      if (progress.classLevel < 15) return false;

      // 같은 전직으로 변경하는 경우 무시
      if (progress.advancedClass === advancedClass) return false;

      // 전직 변경 여부 로깅
      const isJobChange = !!progress.advancedClass;

      // 서버에 전직 정보 저장
      const updatedProgress = await advanceJob(profile.id, className, advancedClass, progress);

      if (!updatedProgress) {
        console.error(`[전직] ${className} → ${advancedClass} 전직 실패`);
        return false;
      }

      // 로컬 상태 업데이트 (useProfileStore)
      const updatedList = classProgress.map((p) =>
        p.className === className ? updatedProgress : p
      );
      set({ classProgress: updatedList });

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(updatedProgress);

      if (isJobChange) {
        console.log(`[전직 변경] ${progress.advancedClass} → ${advancedClass} 완료 (레벨 15, SP 14, 스탯 초기화)`);
      } else {
        console.log(`[전직] ${className} → ${advancedClass} 전직 완료 (서버 저장)`);
      }
      return true;
    },

    // 2차 강화 액션
    applySecondEnhancementAction: async (className) => {
      const authState = useAuthStore.getState();
      const profile = authState.profile;

      if (!profile || profile.isGuest) return false;

      const { classProgress } = get();
      const progress = classProgress.find((p) => p.className === className);

      if (!progress) return false;

      // 레벨 조건 확인 (Lv.40 이상)
      if (progress.classLevel < 40) return false;

      // 전직했는지 확인
      if (!progress.advancedClass) return false;

      // 이미 2차 강화했는지 확인
      if (progress.tier === 2) return false;

      // 서버에 2차 강화 정보 저장
      const updatedProgress = await applySecondEnhancement(profile.id, className, progress);

      if (!updatedProgress) {
        console.error(`[2차 강화] ${className} 2차 강화 실패`);
        return false;
      }

      // 로컬 상태 업데이트 (useProfileStore)
      const updatedList = classProgress.map((p) =>
        p.className === className ? updatedProgress : p
      );
      set({ classProgress: updatedList });

      // useAuthStore의 classProgress도 동기화
      authState.updateClassProgress(updatedProgress);

      console.log(`[2차 강화] ${className} → tier 2 강화 완료 (서버 저장)`);
      return true;
    },

    // 전체 초기화 (로그아웃 시)
    reset: () => {
      set({
        classProgress: [],
        gameHistory: [],
        stats: null,
        lastGameResult: null,
        isLoading: false,
      });
    },
  }))
);

// 셀렉터 훅들
export const useClassProgress = () => useProfileStore((state) => state.classProgress);
export const useGameHistory = () => useProfileStore((state) => state.gameHistory);
export const useProfileStats = () => useProfileStore((state) => state.stats);
export const useLastGameResult = () => useProfileStore((state) => state.lastGameResult);
export const useProfileIsLoading = () => useProfileStore((state) => state.isLoading);
