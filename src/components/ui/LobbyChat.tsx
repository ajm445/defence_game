import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { wsClient } from '../../services/WebSocketClient';
import { LOBBY_CHAT_CONFIG } from '@shared/types/rpgNetwork';

interface LobbyChatProps {
  blockedPlayers?: Map<string, string>;
  onUnblock?: (playerId: string) => void;
}

export const LobbyChat: React.FC<LobbyChatProps> = ({ blockedPlayers, onUnblock }) => {
  const [message, setMessage] = useState('');
  const [lastSendTime, setLastSendTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showBlockList, setShowBlockList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blockListRef = useRef<HTMLDivElement>(null);

  const lobbyChatMessages = useRPGStore((state) => state.multiplayer.lobbyChatMessages);
  const serverError = useRPGStore((state) => state.multiplayer.lobbyChatError);
  const setLobbyChatError = useRPGStore((state) => state.setLobbyChatError);

  const filteredMessages = useMemo(
    () => blockedPlayers && blockedPlayers.size > 0
      ? lobbyChatMessages.filter((msg) => !blockedPlayers.has(msg.playerId))
      : lobbyChatMessages,
    [lobbyChatMessages, blockedPlayers]
  );

  // 차단 목록 외부 클릭 시 닫기
  useEffect(() => {
    if (!showBlockList) return;
    const handler = (e: MouseEvent) => {
      if (blockListRef.current && !blockListRef.current.contains(e.target as Node)) {
        setShowBlockList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBlockList]);

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  // 로컬 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 서버 에러 자동 클리어
  useEffect(() => {
    if (serverError) {
      const timer = setTimeout(() => setLobbyChatError(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [serverError, setLobbyChatError]);

  // 표시할 에러 (로컬 에러 우선, 없으면 서버 에러)
  const displayError = error || serverError;

  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      return;
    }

    if (trimmedMessage.length > LOBBY_CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      setError(`메시지가 너무 깁니다. (최대 ${LOBBY_CHAT_CONFIG.MAX_MESSAGE_LENGTH}자)`);
      return;
    }

    // 클라이언트 측 스팸 방지
    const now = Date.now();
    if (now - lastSendTime < LOBBY_CHAT_CONFIG.MIN_MESSAGE_INTERVAL) {
      setError('너무 빠르게 메시지를 보내고 있습니다.');
      return;
    }

    wsClient.sendLobbyChatMessage(trimmedMessage);
    setMessage('');
    setLastSendTime(now);
  }, [message, lastSendTime]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const myPlayerId = wsClient.playerId;

  return (
    <div className="w-full bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">채팅</span>
        {blockedPlayers && blockedPlayers.size > 0 && onUnblock && (
          <div className="relative" ref={blockListRef}>
            <button
              onClick={() => setShowBlockList((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              차단 목록 ({blockedPlayers.size})
            </button>
            {showBlockList && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 py-1">
                {Array.from(blockedPlayers.entries()).map(([id, name]) => (
                  <div key={id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-700/50">
                    <span className="text-gray-300 text-xs truncate mr-2">{name}</span>
                    <button
                      onClick={() => onUnblock(id)}
                      className="text-red-400 hover:text-red-300 text-xs flex-shrink-0 cursor-pointer"
                    >
                      해제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="h-36 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {filteredMessages.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">
            메시지가 없습니다. 채팅을 시작해보세요!
          </p>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.playerId === myPlayerId;
            return (
              <div
                key={msg.id}
                className={`text-sm break-all overflow-hidden ${isMe ? 'text-neon-cyan' : 'text-gray-300'}`}
              >
                <span className="text-gray-500 text-xs mr-2">[{formatTime(msg.timestamp)}]</span>
                <span className={`font-medium ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
                  {msg.playerName}
                </span>
                <span className="text-gray-400">: </span>
                <span className={isMe ? 'text-neon-cyan/90' : 'text-gray-300'}>
                  {msg.content}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 에러 메시지 */}
      {displayError && (
        <div className="px-3 py-1 bg-red-500/20 border-t border-red-500/50">
          <p className="text-red-400 text-xs">{displayError}</p>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-3 py-2 border-t border-gray-700 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력..."
          maxLength={LOBBY_CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          className="flex-1 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:border-neon-cyan focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={message.trim().length === 0}
          className="px-3 py-1.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan text-sm rounded hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          전송
        </button>
      </div>
    </div>
  );
};
