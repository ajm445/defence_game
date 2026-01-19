import React, { useState } from 'react';
import { Emoji } from '../common/Emoji';

interface HelpModalProps {
  onClose: () => void;
}

interface SlideData {
  title: string;
  icon: string;
  content: React.ReactNode;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: SlideData[] = [
    {
      title: '게임 규칙',
      icon: '🎯',
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="text-white font-bold mb-3">승리 조건</h4>
            <ul className="space-y-2 text-gray-200">
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan">•</span>
                <span>적 본진의 HP를 0으로 만들면 승리</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan">•</span>
                <span>10분 종료 시 HP가 높은 쪽이 승리</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan">•</span>
                <span>HP가 같으면 패배</span>
              </li>
            </ul>
          </div>
          <div className="text-center py-4 bg-neon-cyan/10 rounded-lg border border-neon-cyan/30 text-neon-cyan font-bold text-lg flex items-center justify-center gap-2">
            <Emoji emoji="⏱️" size={24} /> 제한 시간: 10분
          </div>
        </div>
      ),
    },
    {
      title: '자원',
      icon: '📦',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-dark-700/50 p-3 rounded-lg">
            <Emoji emoji="💰" size={28} />
            <div>
              <span className="text-yellow-300 font-bold">골드</span>
              <span className="text-gray-200 ml-2">- 초당 4 자동 획득, 모든 행동의 기본</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-dark-700/50 p-3 rounded-lg">
            <Emoji emoji="🪵" size={28} />
            <div>
              <span className="text-amber-400 font-bold">나무</span>
              <span className="text-gray-200 ml-2">- 나무꾼이 채집, 궁수/기사/건설에 필요</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-dark-700/50 p-3 rounded-lg">
            <Emoji emoji="🪨" size={28} />
            <div>
              <span className="text-gray-300 font-bold">돌</span>
              <span className="text-gray-200 ml-2">- 광부가 채집, 기사/벽/업그레이드에 필요</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-dark-700/50 p-3 rounded-lg">
            <Emoji emoji="🌿" size={28} />
            <div>
              <span className="text-green-300 font-bold">약초</span>
              <span className="text-gray-200 ml-2">- 채집꾼이 채집, 힐러 생산/판매에 사용</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-dark-700/50 p-3 rounded-lg">
            <Emoji emoji="💎" size={28} />
            <div>
              <span className="text-purple-300 font-bold">수정</span>
              <span className="text-gray-200 ml-2">- 맵 중앙의 희귀 자원, 마법사 생산에 필요</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '전투 유닛',
      icon: '⚔️',
      content: (
        <div className="space-y-3">
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🗡️" size={20} /> 검병</div>
            <div className="text-yellow-300">비용: 50골드</div>
            <div className="text-gray-200">HP 100 | 공격력 15 | 근접</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🏹" size={20} /> 궁수</div>
            <div className="text-yellow-300">비용: 80골드 + 10나무</div>
            <div className="text-gray-200">HP 50 | 공격력 25 | 원거리</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🛡️" size={20} /> 기사</div>
            <div className="text-yellow-300">비용: 120골드 + 20나무 + 30돌</div>
            <div className="text-gray-200">HP 250 | 공격력 10 | 근접 탱커</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🔮" size={20} /> 마법사</div>
            <div className="text-yellow-300">비용: 150골드 + 10수정</div>
            <div className="text-gray-200">HP 40 | 공격력 50 | 범위 공격</div>
          </div>
        </div>
      ),
    },
    {
      title: '지원 유닛',
      icon: '👷',
      content: (
        <div className="space-y-3">
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🪓" size={20} /> 나무꾼</div>
            <div className="text-yellow-300">비용: 30골드</div>
            <div className="text-gray-200">나무 채집 (1.0/초)</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="⛏️" size={20} /> 광부</div>
            <div className="text-yellow-300">비용: 40골드 + 5나무</div>
            <div className="text-gray-200">돌 채집 (0.8/초)</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🧺" size={20} /> 채집꾼</div>
            <div className="text-yellow-300">비용: 35골드</div>
            <div className="text-gray-200">약초 채집 (1.2/초)</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="⚒️" size={20} /> 금광부</div>
            <div className="text-yellow-300">비용: 100골드 + 20나무</div>
            <div className="text-gray-200">골드 채집 (1.5/초) - 광산 필요</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="💚" size={20} /> 힐러</div>
            <div className="text-yellow-300">비용: 70골드 + 15약초</div>
            <div className="text-gray-200">전투 유닛 광역 회복 (10HP/초, 범위 100px)</div>
            <div className="text-gray-400 text-sm mt-1">전투 유닛만 회복하며 따라다님, 전투 유닛 전멸 시 공격</div>
          </div>
        </div>
      ),
    },
    {
      title: '건설 / 업그레이드',
      icon: '🏗️',
      content: (
        <div className="space-y-4">
          <div className="bg-dark-700/70 p-4 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🧱" size={20} /> 벽 건설</div>
            <div className="text-yellow-300">비용: 20나무 + 10돌</div>
            <div className="text-gray-200">HP 200 방어벽 생성 (30초 후 소멸)</div>
          </div>
          <div className="bg-dark-700/70 p-4 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🏰" size={20} /> 기지 업그레이드</div>
            <div className="text-yellow-300">비용: 100골드 + 50돌 (레벨당 1.5배)</div>
            <div className="text-gray-200">본진 HP +200, 골드 수입 +1/초 (최대 5레벨)</div>
          </div>
          <div className="bg-dark-700/70 p-4 rounded-lg border border-dark-500">
            <div className="text-white font-bold text-lg mb-1 flex items-center gap-2"><Emoji emoji="🌿" size={20} /> 약초 판매</div>
            <div className="text-yellow-300">필요: 약초 10개</div>
            <div className="text-gray-200">30골드 획득</div>
          </div>
        </div>
      ),
    },
    {
      title: '조작법',
      icon: '🎮',
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">좌클릭</div>
            <div className="text-gray-200">유닛 선택</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">우클릭 드래그</div>
            <div className="text-gray-200">카메라 이동</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">WASD / 방향키</div>
            <div className="text-gray-200">카메라 이동</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">스페이스바</div>
            <div className="text-gray-200">본진으로 이동</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">미니맵 클릭</div>
            <div className="text-gray-200">해당 위치로 이동</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">ESC</div>
            <div className="text-gray-200">일시정지 (AI대전)</div>
          </div>
          <div className="bg-dark-700/70 p-3 rounded-lg border border-dark-500">
            <div className="text-neon-cyan font-bold">마우스 휠</div>
            <div className="text-gray-200">맵 확대/축소</div>
          </div>
        </div>
      ),
    },
    {
      title: '전략 팁',
      icon: '💡',
      content: (
        <div className="space-y-4">
          <ul className="space-y-3 text-white">
            <li className="flex items-start gap-3 bg-dark-700/50 p-3 rounded-lg">
              <Emoji emoji="💡" size={20} />
              <span>초반에 나무꾼 2~3명을 먼저 고용하세요</span>
            </li>
            <li className="flex items-start gap-3 bg-dark-700/50 p-3 rounded-lg">
              <Emoji emoji="💡" size={20} />
              <span>기사는 HP가 높아 전선 유지에 좋습니다</span>
            </li>
            <li className="flex items-start gap-3 bg-dark-700/50 p-3 rounded-lg">
              <Emoji emoji="💡" size={20} />
              <span>마법사는 범위 공격으로 다수의 적을 처리합니다</span>
            </li>
            <li className="flex items-start gap-3 bg-dark-700/50 p-3 rounded-lg">
              <Emoji emoji="💡" size={20} />
              <span>힐러로 아군 유닛의 생존력을 높이세요</span>
            </li>
            <li className="flex items-start gap-3 bg-dark-700/50 p-3 rounded-lg">
              <Emoji emoji="💡" size={20} />
              <span>벽으로 적의 공격을 지연시킬 수 있습니다</span>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-neon-cyan/30 rounded-lg max-w-2xl w-full mx-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neon-cyan/20">
          <h2 className="text-xl font-game text-neon-cyan">도움말</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* 슬라이드 네비게이션 탭 */}
        <div className="flex overflow-x-auto px-4 py-2 border-b border-dark-600 bg-dark-900/50 gap-1">
          {slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all text-sm cursor-pointer
                ${currentSlide === index
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }
              `}
            >
              <Emoji emoji={slide.icon} size={16} />
              <span className="font-korean">{slide.title}</span>
            </button>
          ))}
        </div>

        {/* 슬라이드 콘텐츠 */}
        <div className="px-6 py-5 font-korean text-base leading-relaxed min-h-[400px] max-h-[50vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Emoji emoji={slides[currentSlide].icon} size={28} />
            <h3 className="text-neon-cyan font-bold text-xl">{slides[currentSlide].title}</h3>
          </div>
          {slides[currentSlide].content}
        </div>

        {/* 모달 푸터 - 네비게이션 */}
        <div className="px-6 py-4 border-t border-neon-cyan/20 flex items-center justify-between">
          <button
            onClick={prevSlide}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded text-gray-300 hover:text-white font-korean transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>◀</span>
            <span>이전</span>
          </button>

          {/* 페이지 인디케이터 */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`
                  w-2.5 h-2.5 rounded-full transition-all cursor-pointer
                  ${currentSlide === index
                    ? 'bg-neon-cyan w-6'
                    : 'bg-dark-500 hover:bg-dark-400'
                  }
                `}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded text-gray-300 hover:text-white font-korean transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>다음</span>
            <span>▶</span>
          </button>
        </div>
      </div>
    </div>
  );
};
