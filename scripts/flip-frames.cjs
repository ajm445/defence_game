/**
 * 2×2 스프라이트 시트에서 지정 프레임만 좌우 반전
 *
 * 사용법:
 *   node scripts/flip-frames.js <input.png> <output.png> <frames>
 *
 * <frames>: 반전할 프레임 번호 (1~4, 쉼표 구분)
 *
 * 예시:
 *   node scripts/flip-frames.js warrior_attack.png warrior_attack.png 2,4
 *   → 2번, 4번 프레임만 좌우 반전
 *
 *   node scripts/flip-frames.js warrior_attack.png warrior_attack.png all
 *   → 전체 프레임 좌우 반전
 */

const sharp = require('sharp');
const path = require('path');

async function flipFrames(inputPath, outputPath, framesToFlip) {
  const meta = await sharp(inputPath).metadata();
  const halfW = Math.floor(meta.width / 2);
  const halfH = Math.floor(meta.height / 2);

  console.log(`  입력: ${path.basename(inputPath)} (${meta.width}x${meta.height})`);
  console.log(`  프레임 크기: ${halfW}x${halfH}`);
  console.log(`  반전 대상: ${framesToFlip.join(', ')}번 프레임`);

  // 4프레임 위치: 1=좌상, 2=우상, 3=좌하, 4=우하
  const positions = [
    { left: 0, top: 0 },
    { left: halfW, top: 0 },
    { left: 0, top: halfH },
    { left: halfW, top: halfH },
  ];

  // 각 프레임 추출 후 필요 시 반전
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    let frame = sharp(inputPath).extract({
      left: pos.left, top: pos.top, width: halfW, height: halfH
    });

    if (framesToFlip.includes(i + 1)) {
      frame = frame.flop(); // 좌우 반전
      console.log(`  → ${i + 1}번 프레임 반전`);
    }

    frames.push(await frame.toBuffer());
  }

  // 재합성
  await sharp({
    create: {
      width: meta.width, height: meta.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([
    { input: frames[0], left: 0, top: 0 },
    { input: frames[1], left: halfW, top: 0 },
    { input: frames[2], left: 0, top: halfH },
    { input: frames[3], left: halfW, top: halfH },
  ])
  .png()
  .toFile(outputPath);

  console.log(`  ✓ 저장: ${outputPath}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('사용법: node scripts/flip-frames.js <input.png> <output.png> <frames>');
  console.log('  <frames>: 반전할 프레임 번호 (1~4 쉼표 구분, 또는 "all")');
  console.log('예시:  node scripts/flip-frames.js attack.png attack.png 2,4');
  console.log('       node scripts/flip-frames.js attack.png attack.png all');
  process.exit(1);
}

const framesToFlip = args[2] === 'all'
  ? [1, 2, 3, 4]
  : args[2].split(',').map(Number).filter(n => n >= 1 && n <= 4);

flipFrames(args[0], args[1], framesToFlip).catch(e => {
  console.error('에러:', e.message);
  process.exit(1);
});
