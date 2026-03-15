/**
 * 4개의 개별 프레임 이미지를 2×2 스프라이트 시트로 합성
 *
 * 사용법:
 *   node scripts/combine-sprites.js <frame1> <frame2> <frame3> <frame4> <output>
 *
 * 예시:
 *   node scripts/combine-sprites.js walk_1.png walk_2.png walk_3.png walk_4.png warrior_walk.png
 *
 * 모든 프레임을 동일 크기(최대 크기 기준)로 맞추고 하단 정렬(발 위치 고정)로 합성합니다.
 */

const sharp = require('sharp');
const path = require('path');

async function combineSprites(frame1Path, frame2Path, frame3Path, frame4Path, outputPath) {
  const paths = [frame1Path, frame2Path, frame3Path, frame4Path];

  // 각 프레임 메타데이터 확인
  let maxW = 0, maxH = 0;
  const metas = [];
  for (const p of paths) {
    const m = await sharp(p).metadata();
    metas.push({ path: p, w: m.width, h: m.height });
    if (m.width > maxW) maxW = m.width;
    if (m.height > maxH) maxH = m.height;
    console.log(`  ${path.basename(p)}: ${m.width}x${m.height}`);
  }

  console.log(`\n  통일 프레임 크기: ${maxW}x${maxH}`);
  console.log(`  출력 시트 크기: ${maxW * 2}x${maxH * 2}`);

  // 각 프레임을 동일 크기로 패딩 (하단 정렬)
  const frames = [];
  for (const m of metas) {
    if (m.w === maxW && m.h === maxH) {
      frames.push(await sharp(m.path).toBuffer());
    } else {
      const padLeft = Math.floor((maxW - m.w) / 2);
      const padRight = maxW - m.w - padLeft;
      const padTop = maxH - m.h; // 하단 정렬
      frames.push(
        await sharp(m.path)
          .extend({
            top: padTop, bottom: 0,
            left: padLeft, right: padRight,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer()
      );
    }
  }

  // 2×2 합성
  await sharp({
    create: {
      width: maxW * 2,
      height: maxH * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([
    { input: frames[0], left: 0, top: 0 },
    { input: frames[1], left: maxW, top: 0 },
    { input: frames[2], left: 0, top: maxH },
    { input: frames[3], left: maxW, top: maxH },
  ])
  .png()
  .toFile(outputPath);

  console.log(`\n  ✓ 저장: ${outputPath}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 5) {
  console.log('사용법: node scripts/combine-sprites.js <frame1> <frame2> <frame3> <frame4> <output>');
  console.log('예시:  node scripts/combine-sprites.js walk_1.png walk_2.png walk_3.png walk_4.png warrior_walk.png');
  process.exit(1);
}

combineSprites(args[0], args[1], args[2], args[3], args[4]).catch(e => {
  console.error('에러:', e.message);
  process.exit(1);
});
