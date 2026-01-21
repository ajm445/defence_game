import React from 'react';
import { useCoopPlayers } from '../../stores/useRPGCoopStore';
import { CLASS_CONFIGS } from '../../constants/rpgConfig';
import type { CoopPlayerInfo } from '@shared/types/rpgNetwork';

interface RPGCoopPlayerListProps {
  myPlayerId?: string;
  onKickPlayer?: (playerId: string) => void;
  isHost?: boolean;
}

export const RPGCoopPlayerList: React.FC<RPGCoopPlayerListProps> = ({
  myPlayerId,
  onKickPlayer,
  isHost = false,
}) => {
  const players = useCoopPlayers();

  return (
    <div className="space-y-2">
      {players.map((player) => (
        <PlayerListItem
          key={player.id}
          player={player}
          isMe={player.id === myPlayerId}
          isHost={isHost}
          canKick={isHost && !player.isHost && player.id !== myPlayerId}
          onKick={onKickPlayer}
        />
      ))}
      {/* 빈 슬롯 */}
      {Array.from({ length: 4 - players.length }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex items-center justify-center px-4 py-2 rounded-lg border border-gray-700/50 border-dashed text-gray-600"
        >
          대기중...
        </div>
      ))}
    </div>
  );
};

interface PlayerListItemProps {
  player: CoopPlayerInfo;
  isMe: boolean;
  isHost: boolean;
  canKick: boolean;
  onKick?: (playerId: string) => void;
}

const PlayerListItem: React.FC<PlayerListItemProps> = ({
  player,
  isMe,
  isHost: _isHost,
  canKick,
  onKick,
}) => {
  const config = CLASS_CONFIGS[player.heroClass];

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
        isMe
          ? 'border-neon-cyan bg-neon-cyan/10'
          : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{config.emoji}</span>
        <div>
          <p className={`font-bold ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
            {player.name}
            {player.isHost && (
              <span className="ml-2 text-yellow-500 text-xs">(호스트)</span>
            )}
          </p>
          <p className="text-gray-500 text-xs">{config.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {player.isReady && !player.isHost && (
          <span className="text-green-400 text-sm">준비 완료</span>
        )}
        {!player.connected && (
          <span className="text-red-400 text-sm">연결 끊김</span>
        )}
        {canKick && onKick && (
          <button
            onClick={() => onKick(player.id)}
            className="px-2 py-1 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
          >
            추방
          </button>
        )}
      </div>
    </div>
  );
};
