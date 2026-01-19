import React, { memo } from 'react';
import twemoji from 'twemoji';

interface EmojiProps {
  emoji: string;
  size?: number | string;
  className?: string;
}

/**
 * Twemoji를 사용하여 모든 플랫폼에서 동일한 이모지를 렌더링하는 컴포넌트
 */
export const Emoji: React.FC<EmojiProps> = memo(({ emoji, size = 24, className = '' }) => {
  const parsed = twemoji.parse(emoji, {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
  });

  // twemoji.parse는 <img> 태그가 포함된 HTML 문자열을 반환
  // style을 추가하여 크기 조절
  const sizeValue = typeof size === 'number' ? `${size}px` : size;
  const styledHtml = parsed.replace(
    /<img /g,
    `<img style="width: ${sizeValue}; height: ${sizeValue}; display: block; vertical-align: middle;" `
  );

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      style={{ lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: styledHtml }}
    />
  );
});

Emoji.displayName = 'Emoji';
