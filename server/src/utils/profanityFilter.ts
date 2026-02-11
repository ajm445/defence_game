// 비속어 필터 - 서버 측 채팅 필터링

// 한국어 비속어 목록
const KOREAN_PROFANITY: string[] = [
  // === 일반 욕설 ===
  '씨발', '시발', '씨bal', '씨팔', '시팔', '씨바', '시바', '씨빨', '시빨',
  '씨부랄', '시부랄', '씨부럴', '씨방', '시방',
  '개새끼', '개세끼', '개색끼', '개색기', '개쌔끼', '개자식',
  '병신', '병싄', '빙신', '벼신', '병먹', '병딱',
  '지랄', '짓알', '지럴', '지롤',
  '미친놈', '미친년', '미친새끼', '미친것', '미친거', '미친인간',
  '꺼져', '닥쳐', '꺼지세요',
  '새끼', '세끼', '색끼', '쌔끼',
  '좆', '좃', '졷', '좆같',
  '개같', '개갓', '개구라',
  '썅', '쌍놈', '쌍년',
  '엿먹', '엿머', '엿같',
  '꼴통', '꼴값', '꼴깝', '꼴데',
  '또라이', '돌아이', '또라지',
  '찐따', '진따', '찐다', '찐빠',
  '한남', '한녀', '한남충', '한녀충',
  '느금마', '느금', '느개비',
  '니미', '니엄마', '니애미', '니애비', '니할매', '니할미', '니미럴',
  '장애인', '장애아',
  '불알', '불랄',
  '자지', '보지', '잦이',
  '걸레', '걸레년', '걸레놈',
  '창녀', '창년', '창놈',
  '화냥', '화냥년',
  '쓰레기새끼', '쓰레기놈', '쓰레기년',
  '개돼지',

  // === 추가 비속어 ===
  '개놈', '개년', '개간', '개망', '개소리', '개지랄', '개씹',
  '개좆', '개후레', '개후라이',
  '후레자식', '후레아들', '후레놈', '후래자식',
  '나쁜놈', '나쁜년', '못된놈', '못된년',
  '거지같', '거지새끼',
  '등신', '멍청이', '바보새끼', '멍청한놈',
  '대가리', '빡대가리', '돌대가리', '빡빡이',
  '얼간이', '쪼다', '쪼빠',
  '쓰바', '쓰발', '쓰벌',
  '존나', '졸라', '존내', '죤나', '존니',
  '빡치', '빡침', '빡셔', '열받',
  '뒈져', '뒤져', '뒈지', '뒤질', '뒤져라', '죽어라', '죽어버려', '뒤져버려',
  '꼬져', '꼬라지', '꼬라박', '꼴아박',
  '짜증', '짱나',
  '벌레', '벌레새끼', '구더기', '기생충',
  '주둥이', '주둥아리', '아가리',
  '쳐먹', '쳐박', '쳐죽',
  '조까', '조까치', '좃까',
  '십새', '씹새', '십새끼', '씹새끼', '십놈', '씹놈',
  '씹년', '십년', '씹치', '씹할',
  '씹덕', '씹잡',
  '애미', '애비', '에미', '에비',
  '뻐큐', '빠큐',
  '노답', '멍멍이새끼',
  '염병', '엠병', '옘병',
  '쌍놈', '쌍년',
  '개초딩', '급식충',
  '틀딱',
  '재기해', '자살해', '자살해라', '뒤져라',
  '못생긴', '추녀', '추남',
  '찐찌버거', '흉자',
  '고자', '고추',
  '치매', '정신병자', '미치광이',

  // === 인종/지역 비하 ===
  '쪽바리', '짱깨', '짱꼴라', '깜둥이', '흑형',
  '조센징', '똥남아',
  '홍어',

  // === 성적 비하 / 19금 ===
  '강간', '성폭행', '성추행', '성희롱',
  '섹스', '섹쓰', '쎅스', '쎅쓰',
  '야동', '야사', '야설',
  '포르노', '폰섹', '폰쎅',
  '자위', '딸치', '딸딸이',
  '음란', '음경', '음핵',
  '페니스', '클리토리스',
  '오르가즘', '오르가슴',
  '정액', '사정', '질내사정',
  '박히', '따먹', '씹',
  '성관계', '성교',
  '매춘', '매춘부', '원조교제',
  '조건만남',
  '노출', '노출증',
  '변태', '헨타이',
  '페티쉬', '페티시',
  '수간',
  '근친',
  '롤리', '로리', '쇼타',
  '팬티', '브라',
  '가슴만져', '엉덩이만져',
  '빨아', '빨어', '빨아줘',
  '젖꼭지', '유두',
  '야한', '음탕',

  // === 초성/변형 ===
  'ㅅㅅ', 'ㅇㄷ',
  'ㅆㅂ', 'ㅅㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄹ', 'ㅁㅊ', 'ㄲㅈ', 'ㄷㅊ',
  'ㅅㅍ', 'ㅆㅍ', 'ㄱㅅㄲ', 'ㅈㄴ', 'ㄴㄱㅁ', 'ㅈㄲ',
  'ㅗ', 'ㅊㅁ',
  // 숫자/특수문자 치환
  '시1발', '씨1발', 'c발', '씨8', 'ㅆ8',
  '병1신', '뱅신',
  '좆1', 'ㅈ1',
  '18놈', '18년', '18새끼',
];

// 영어 비속어 목록
const ENGLISH_PROFANITY: string[] = [
  // === 일반 욕설 ===
  'fuck', 'fucker', 'fucking', 'fucked', 'fuckoff', 'fuckface', 'fuckwit',
  'fck', 'fuk', 'fuc', 'phuck', 'phuk', 'f u c k',
  'shit', 'shitty', 'bullshit', 'shithead', 'shitface', 'dipshit', 'horseshit',
  'bitch', 'bitchy', 'bitchass', 'sonofabitch',
  'asshole', 'ass', 'asswipe', 'asshat', 'jackass', 'dumbass', 'fatass', 'smartass',
  'bastard',
  'dick', 'dickhead', 'dickwad', 'dickface',
  'pussy', 'pussyass',
  'cunt',
  'damn', 'dammit', 'goddamn', 'goddammit',
  'cock', 'cocksucker', 'cockhead',
  'motherfucker', 'motherfucking', 'mofo', 'mfer',
  'wtf', 'stfu', 'gtfo', 'lmfao', 'omfg',
  'douche', 'douchebag',
  'wanker', 'wank',
  'tosser', 'twat', 'bellend',
  'piss', 'pissoff', 'pissed',
  'crap', 'crappy',
  'screw', 'screwed', 'screwyou',
  'suck', 'sucker', 'suckass',
  'loser', 'dumbfuck', 'fuckboy', 'fuckgirl',
  'idiot', 'moron', 'imbecile',
  'scumbag', 'scum', 'lowlife',
  'degenerate', 'trashy',
  'kys', 'killyourself',

  // === 인종/차별 비하 ===
  'nigger', 'nigga', 'negro',
  'chink', 'gook', 'zipperhead',
  'spic', 'wetback', 'beaner',
  'kike',
  'cracker', 'redneck', 'whitetrash',
  'coon', 'darkie',
  'retard', 'retarded', 'tard',
  'faggot', 'fag', 'dyke', 'homo', 'queer',
  'tranny',

  // === 19금 / 성인 표현 ===
  'sex', 'sexy', 'sexual',
  'porn', 'porno', 'pornography', 'pornhub', 'xvideos', 'xhamster',
  'hentai', 'ecchi', 'ahegao', 'doujin',
  'masturbate', 'masturbation', 'jerkoff', 'jackoff', 'fap', 'fapping',
  'orgasm',
  'blowjob', 'handjob', 'rimjob', 'footjob', 'titjob',
  'dildo', 'vibrator', 'fleshlight',
  'anal', 'anus', 'butthole', 'buttplug',
  'erection', 'erect', 'boner', 'hardon',
  'cum', 'cumshot', 'cumming', 'jizz', 'sperm', 'semen',
  'boobs', 'boobies', 'tits', 'titties', 'knockers',
  'nipple', 'nipples',
  'penis', 'vagina', 'clitoris', 'ballsack', 'testicle',
  'nude', 'nudes', 'naked', 'nsfw',
  'fetish', 'bdsm', 'bondage', 'dominatrix', 'sadomasochism',
  'milf', 'gilf', 'dilf',
  'incest',
  'pedophile', 'pedo', 'paedophile',
  'loli', 'shota',
  'rape', 'raping', 'rapist',
  'molest', 'molestation', 'molester',
  'whore', 'slut', 'skank', 'thot',
  'hooker', 'prostitute', 'escort',
  'stripper', 'striptease',
  'threesome', 'foursome', 'gangbang', 'orgy',
  'creampie',
  'deepthroat',
  'camgirl', 'onlyfans',
  'horny', 'kinky', 'naughty',
  'squirt', 'squirting',
  'facial',
  'bukake', 'bukkake',
];

// 정규식 특수문자 이스케이프
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 한국어 단어에 공백/특수문자 삽입 우회 대응 정규식 생성
// 예: "씨발" → "씨\s*발" (글자 사이 공백 허용)
function buildKoreanPattern(word: string): string {
  const chars = [...word]; // 유니코드 문자 단위 분리
  if (chars.length <= 1) return escapeRegex(word);
  return chars.map(c => escapeRegex(c)).join('[\\s._\\-*]*');
}

// 매칭된 문자열을 같은 길이의 *로 치환
function replaceWithStars(match: string): string {
  // 공백은 유지하고 실제 문자만 *로 치환
  return match.replace(/\S/g, '*');
}

// 전체 비속어 정규식 빌드 (한 번만 실행)
function buildProfanityRegex(): RegExp {
  const patterns: string[] = [];

  // 한국어 패턴 (공백 삽입 우회 대응)
  for (const word of KOREAN_PROFANITY) {
    patterns.push(buildKoreanPattern(word));
  }

  // 영어 패턴 (단어 경계 + 대소문자 무시)
  for (const word of ENGLISH_PROFANITY) {
    // 영어는 단어 경계를 사용하여 부분 매칭 방지 (ass가 class를 매칭하지 않도록)
    patterns.push(`\\b${escapeRegex(word)}\\b`);
  }

  // 긴 패턴 우선 매칭 (motherfucker가 fucker보다 먼저)
  patterns.sort((a, b) => b.length - a.length);

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

// 컴파일된 정규식 캐시
const profanityRegex = buildProfanityRegex();

/**
 * 텍스트에서 비속어를 감지하고 *로 치환합니다.
 * @param text 원본 텍스트
 * @returns 필터링된 텍스트
 */
export function filterProfanity(text: string): string {
  return text.replace(profanityRegex, replaceWithStars);
}
