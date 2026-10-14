// 새 프로젝트의 '프로젝트 파일'(그림 목록)을 만든다. 한 번만 돌린다.
//   node tools/init.ts [--to <파일>] [--raw <원본 폴더>] [--out <출력 폴더>]
// 기본으로 키트 폴더 옆에 art-assets.ts를 만든다 (예: <프로젝트>/tools/art-kit/ 이면 <프로젝트>/tools/art-assets.ts).
// 가장 가까운 package.json이 "type": "commonjs"면 저절로 art-assets.mts로 만든다 (Node가 그런 .ts의 import 문을 읽지 못한다. 도구는 .mts도 찾는다).
// 도구(gen.ts, process.ts)는 --assets도 ART_ASSETS_FILE도 없으면 바로 이 자리를 찾는다.
// 프로젝트 파일을 키트 밖에 두는 까닭: 키트를 새 판으로 통째로 바꿔도 그림 목록과 원본 폴더가 남는다.
//
// 만드는 파일:
//   - 키트의 tools/manifest.ts를 상대 경로로 import한다 (도움 함수와 타입). 파일을 옮기면 이 줄을 고친다.
//   - PROJECT_DIRS: 원본(raw)과 출력(out) 폴더. 이 파일의 폴더 기준. 기본 './art-raw', './art-out'.
//     --raw, --out으로 바꿔 적는다 (이 파일의 폴더 기준 경로로 적힌다). 게임 에셋 폴더를 바로 줘도 된다.
//   - PROJECT_ASSETS: 빈 목록과 주석 속 예 셋.
// 이미 있는 파일은 덮어쓰지 않는다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { DEFAULT_PROJECT_FILE, isInside, KIT_ROOT, parseArgv, tempParent, toolCommand } from './common.ts';

function posixRel(fromDir: string, to: string): string {
  const r = relative(fromDir, to).replace(/\\/g, '/');
  return r.startsWith('.') ? r : `./${r}`;
}

/** dir에서 위로 올라가며 가장 가까운 package.json의 "type" (없으면 undefined). */
function packageType(dir: string): string | undefined {
  for (let d = dir; ; d = dirname(d)) {
    const p = join(d, 'package.json');
    if (existsSync(p)) {
      try {
        const t = (JSON.parse(readFileSync(p, 'utf8')) as { type?: unknown }).type;
        return typeof t === 'string' ? t : undefined;
      } catch {
        return undefined;
      }
    }
    if (dirname(d) === d) return undefined;
  }
}

/** 명령줄로 받은 폴더(지금 폴더 기준)를 프로젝트 파일의 폴더 기준 경로로. */
function dirFor(projectDir: string, given: string | undefined, fallback: string): string {
  if (given === undefined) return fallback;
  const abs = resolve(given);
  return isAbsolute(given) && !isInside(abs, projectDir) ? abs.replace(/\\/g, '/') : posixRel(projectDir, abs);
}

function main(): void {
  const args = parseArgv(process.argv.slice(2), { valued: ['to', 'raw', 'out'], switches: ['help'] });
  if (args.has('help') || args.positional.length > 0) {
    console.log(`${toolCommand('init.ts')} [--to <프로젝트 파일>] [--raw <원본 폴더>] [--out <출력 폴더>]`);
    if (args.positional.length > 0) process.exitCode = 1;
    return;
  }
  const mts = DEFAULT_PROJECT_FILE.replace(/\.ts$/, '.mts');
  const cjs = packageType(dirname(DEFAULT_PROJECT_FILE)) === 'commonjs';
  const file = resolve(args.get('to') ?? (cjs ? mts : DEFAULT_PROJECT_FILE));
  if (args.get('to') === undefined) {
    for (const other of [DEFAULT_PROJECT_FILE, mts]) {
      if (existsSync(other)) throw new Error(`이미 있다: ${other} (덮어쓰지 않는다. 고쳐 쓰거나, 지우고 다시 돌린다)`);
    }
    if (cjs) console.log('알림: 가장 가까운 package.json이 "type": "commonjs"라 art-assets.mts로 만든다 (.ts로는 Node가 import 문을 읽지 못한다).');
  }
  if (existsSync(file)) throw new Error(`이미 있다: ${file} (덮어쓰지 않는다. 고쳐 쓰거나, 지우고 다시 돌린다)`);
  if (isInside(file, KIT_ROOT)) {
    console.log(`주의: ${file}는 키트 폴더 안이다. 키트를 새 판으로 바꿀 때 함께 지워지지 않게 키트 밖에 두는 편이 낫다.`);
  }
  const dir = dirname(file);
  const manifest = posixRel(dir, join(KIT_ROOT, 'tools', 'manifest.ts'));
  const raw = dirFor(dir, args.get('raw'), './art-raw');
  const out = dirFor(dir, args.get('out'), './art-out');
  const rawAbs = resolve(dir, raw);
  const temp = tempParent(rawAbs);
  if (temp !== null) console.log(`주의: 원본 폴더 ${rawAbs}가 OS 임시 폴더 안이다. 원본은 다시 만들 수 없으니 오래 남는 곳을 권한다.`);
  if (isInside(rawAbs, KIT_ROOT)) console.log(`주의: 원본 폴더 ${rawAbs}가 키트 폴더 안이다. 키트를 바꿀 때 지워지지 않게 밖에 두는 편이 낫다.`);
  const kitRel = posixRel(dir, KIT_ROOT);
  const today = new Date().toISOString().slice(0, 10);

  const text = `// 이 프로젝트의 그림 목록. art-kit의 도구(gen.ts, process.ts)가 읽는다. ${today} init.ts가 만들었다.
// 키트 폴더 밖에 둔다: 키트를 새 판으로 통째로 바꿔도 이 파일과 원본 폴더는 남는다.
// 도구가 이 파일을 찾는 순서: --assets <파일> → 환경 변수 ART_ASSETS_FILE → 키트 폴더 옆의 art-assets.ts.
//
// 쓰는 법 (자세한 것은 키트의 ART_STYLE_GUIDE.md: 3장 범주별 템플릿, 9장 새 프로젝트):
//   1. 아래 PROJECT_ASSETS에 그림을 적는다. 도움 함수가 화풍 머리말(STYLE)과 공통 문단을 붙이므로 생김새만 영어로 적는다.
//   2. (이 파일이 있는 폴더에서) node ${kitRel}/tools/gen.ts <그룹/key>     원본 PNG → PROJECT_DIRS.raw/<그룹>/<key>.png
//   3. 눈으로 본다. 틀렸으면 <key>.rejected1.png로 이름을 바꾸고, 생김새 끝(extra)에 고칠 말을 더해 다시 뽑는다.
//   4. node ${kitRel}/tools/process.ts --only <그룹/key>   WebP와 meta.json → PROJECT_DIRS.out
// 세트를 시작할 때는 기준 그림 한 장을 드워프만 참조로 먼저 뽑고(leadCharacter, icon(..., null, ...)),
// 그 그림을 '@그룹/key'로 나머지의 두 번째 참조에 붙인다 (character(..., { lead: '@characters/<key>' })).
// 도움 함수는 키트의 manifest.ts에 있다: pose, leadCharacter, character, monster, speciesBoss, screenBoss, foe, bigBoss,
// icon, itemIcon, card, building, prop, inGroup (그리고 STYLE과 공통 문단 상수). 쓰는 것만 아래 import에 적는다
// (아직 그림이 없어 안 쓰인 이름은 프로젝트의 타입 검사가 noUnusedLocals면 알린다. 그림을 적으면 사라진다).

import { type ArtAsset, type ProjectDirs, character, foe, icon, inGroup } from '${manifest}';

/** 폴더 (이 파일이 있는 폴더 기준). 명령줄 --raw/--out과 환경 변수 ART_RAW_DIR/ART_OUT_DIR이 이보다 먼저다. */
export const PROJECT_DIRS: ProjectDirs = {
  // Codex 원본 PNG. 지우지 말고 백업한다 (같은 프롬프트로도 같은 그림은 다시 나오지 않는다). 임시 폴더·키트 폴더 안은 피한다.
  raw: '${raw}',
  // 다듬은 WebP와 meta.json. 게임의 에셋 폴더를 바로 줘도 된다 (예: '../src/assets/art').
  out: '${out}',
};

/** 이 프로젝트의 그림. 그룹: characters, monsters, objects, map, ui, icons, items, cards (더하려면 PROJECT_GROUPS). */
export const PROJECT_ASSETS: readonly ArtAsset[] = [
  // 예 (주석을 풀고 고친다. 셋 모두 키트로 실제로 뽑아 본 것이다: ART_STYLE_GUIDE.md 9.8):
  // ...inGroup('characters', character('hero_baker', '빵집 용사', 'normal', 'A cheerful little young baker ...')),
  // ...inGroup('monsters', foe('foe_iron_hedgehog', '쇠가시 고슴도치', 'mon_armored_earth', 'A small chubby round hedgehog monster ...', { secondRef: 'style' })),
  // ...inGroup('icons', icon('element_lightning', '번개 속성', 'element_water', 'Lightning element icon: ...')),
];

// 쓰지 않으면 지운다. 그룹을 더할 때 (이름 → 'style' | 'style+refOnly' | 'style+card'):
// export const PROJECT_GROUPS = { portraits: 'style' } as const;
// 다른 프로젝트로도 가져갈 기준 그림을 참조 이름으로 부를 때 (파일은 이 파일의 폴더 기준):
// export const PROJECT_REFS = { hero_lead: { file: './art-ref/hero_lead.png', note: '캐릭터 세트의 기준' } };
`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text);
  console.log(`만들었다: ${file}`);
  console.log(`  키트 manifest: ${manifest}`);
  console.log(`  원본 폴더: ${resolve(dir, raw)}`);
  console.log(`  출력 폴더: ${resolve(dir, out)}`);
  const kitCmd = posixRel(process.cwd(), join(KIT_ROOT, 'tools'));
  const isDefault = file === DEFAULT_PROJECT_FILE || file === DEFAULT_PROJECT_FILE.replace(/.ts$/, '.mts');
  const assetsFlag = isDefault ? '' : ` --assets ${posixRel(process.cwd(), file)}`;
  console.log(`다음: PROJECT_ASSETS에 그림을 적고 node ${kitCmd}/gen.ts <그룹/key>${assetsFlag} --dry 로 보낼 프롬프트를 본다.`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
