import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRPGStore } from '../../stores/useRPGStore';
import { wsClient } from '../../services/WebSocketClient';
import { LOBBY_CHAT_CONFIG } from '@shared/types/rpgNetwork';

export const LobbyChat: React.FC = () => {
  const [message, setMessage] = useState('');
  const [lastSendTime, setLastSendTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lobbyChatMessages = useRPGStore((state) => state.multiplayer.lobbyChatMessages);
  const serverError = useRPGStore((state) => state.multiplayer.lobbyChatError);
  const setLobbyChatError = useRPGStore((state) => state.setLobbyChatError);
  const myPlayerId = wsClient.playerId;

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lobbyChatMessages]);

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

  return (
    <div className="w-full bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="text-gray-400 text-sm font-medium">채팅</span>
      </div>

      {/* 메시지 목록 */}
      <div className="h-36 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {lobbyChatMessages.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">
            메시지가 없습니다. 채팅을 시작해보세요!
          </p>
        ) : (
          lobbyChatMessages.map((msg) => {
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
