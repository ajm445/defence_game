import React, { useState, useRef, useEffect, useCallback } from 'react';
import { wsClient } from '../../services/WebSocketClient';
import { useFriendStore } from '../../stores/useFriendStore';
import { DM_CHAT_CONFIG } from '@shared/types/friendNetwork';
import type { DirectMessage } from '@shared/types/friendNetwork';
import { useAuthStore } from '../../stores/useAuthStore';

interface DMChatWindowProps {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

export const DMChatWindow: React.FC<DMChatWindowProps> = ({ friendId, friendName, onClose }) => {
  const [message, setMessage] = useState('');
  const [lastSendTime, setLastSendTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversations = useFriendStore((state) => state.dmConversations);
  const messages = conversations.get(friendId) || [];
  const myUserId = useAuthStore((state) => state.profile?.id);

  // 새 메시지 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 마운트 시 입력 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return;

    if (trimmed.length > DM_CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      setError(`메시지가 너무 깁니다. (최대 ${DM_CHAT_CONFIG.MAX_MESSAGE_LENGTH}자)`);
      return;
    }

    const now = Date.now();
    if (now - lastSendTime < DM_CHAT_CONFIG.MIN_MESSAGE_INTERVAL) {
      setError('너무 빠르게 메시지를 보내고 있습니다.');
      return;
    }

    wsClient.send({ type: 'SEND_DM', targetUserId: friendId, content: trimmed } as any);
    setMessage('');
    setLastSendTime(now);
  }, [message, lastSendTime, friendId]);

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
    <div className="w-[300px] h-[350px] bg-gray-900 border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between flex-shrink-0">
        <span className="text-white text-sm font-medium truncate">{friendName}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors cursor-pointer ml-2 text-sm"
          title="닫기"
        >
          ✕
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-8">
            {friendName}님에게 메시지를 보내보세요!
          </p>
        ) : (
          messages.map((msg: DirectMessage) => {
            const isMe = msg.fromUserId === myUserId;
            return (
              <div
                key={msg.id}
                className={`text-sm break-all overflow-hidden ${isMe ? 'text-neon-cyan' : 'text-gray-300'}`}
              >
                <span className="text-gray-500 text-xs mr-1">[{formatTime(msg.timestamp)}]</span>
                <span className={`font-medium ${isMe ? 'text-neon-cyan' : 'text-white'}`}>
                  {isMe ? '나' : msg.fromUserName}
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
      {error && (
        <div className="px-3 py-1 bg-red-500/20 border-t border-red-500/50 flex-shrink-0">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-3 py-2 border-t border-gray-700 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력..."
          maxLength={DM_CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          className="flex-1 px-2 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-white text-xs placeholder-gray-500 focus:border-neon-cyan focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={message.trim().length === 0}
          className="px-2 py-1.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan text-xs rounded hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          전송
        </button>
      </div>
    </div>
  );
};
