// Codex 이미지 생성으로 에셋 원본 PNG를 다시 뽑는다 (프롬프트와 참조는 tools/art/assets.ts).
//   node tools/art/gen.ts <key | 그룹/key> [더 많은 키...] [--out <raw 폴더>] [--ref <참조 폴더>] [--dry]
// 결과: <out>/<그룹>/<key>.png. 있던 파일은 <out>/<그룹>/_old/ 로 옮겨 둔다 (실패하면 되돌린다).
// 다음 단계: node tools/art/process.ts --raw <out> --only <그룹/key>
//
// 하는 일: 'codex exec'를 <out>/<그룹>에서 띄우고, 참조 그림을 -i로 붙이고, 프롬프트는 표준 입력으로 보낸다.
// Codex는 내장 image_gen 도구로 그림을 그린 뒤 ~/.codex/generated_images/... 에서 <key>.png로 복사해 온다.
// 한 장에 1~3분쯤 걸린다. Codex CLI에 로그인돼 있어야 한다 (OPENAI_API_KEY는 필요 없다).
//
// 참조(refs): 'name'은 --ref 폴더의 <name>.png, 없으면 REF_IMAGES의 대신할 에셋.
//             '@key'는 다른 에셋의 원본 <out>/<그룹>/<key>.png, 없으면 처리된 src/assets/art/<그룹>/<key>.webp.
//
// Options:
//   --out DIR      원본 PNG 폴더 (기본: OS 임시 폴더/blacksmith-art/raw, process.ts --raw의 기본값과 같다)
//   --ref DIR      참조 그림 폴더 (기본: <out>의 옆 폴더 ref, 즉 <out>/../ref). 화풍 기준 그림(D 드워프)은
//                  저장소의 tools/art/ref에 있으니 보통 '--ref tools/art/ref'로 준다
//   --model M      Codex 모델 (기본: Codex 설정)
//   --force        copy 표시된 에셋(이미 있는 원본, 예: dwarf_idle)도 다시 뽑는다
//   --dry          실행하지 않고 만들 명령과 프롬프트만 찍는다
// 실행 파일: 환경 변수 CODEX_BIN(실행 파일 또는 codex.js), 아니면 npm 전역 설치의 codex.js, 아니면 PATH의 codex.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ART_ASSETS, type ArtAsset, assetId, buildPrompt, parseSize, REF_IMAGES } from './assets.ts';
import { ASSETS_OUT_DIR, DEFAULT_RAW_DIR, findAssets, kb, parseArgv, readImageHead } from './common.ts';

interface ResolvedRef {
  readonly name: string;
  /** 찾은 파일. 없으면 null. */
  readonly path: string | null;
  /** 어디서 찾았는지 / 무엇을 찾았는지 */
  readonly how: string;
}

/** 원본 PNG가 있으면 그것, 없으면 처리된 WebP. */
function assetFile(rawDir: string, a: ArtAsset): string | null {
  const png = join(rawDir, a.group, `${a.key}.png`);
  if (existsSync(png)) return png;
  const webp = join(ASSETS_OUT_DIR, a.group, `${a.key}.webp`);
  return existsSync(webp) ? webp : null;
}

function resolveRef(name: string, rawDir: string, refDir: string): ResolvedRef {
  if (name.startsWith('@')) {
    const [target] = findAssets(name.slice(1));
    if (target === undefined) return { name, path: null, how: '매니페스트에 없다' };
    const path = assetFile(rawDir, target);
    return { name, path, how: path === null ? `${assetId(target)}를 먼저 뽑아야 한다` : `에셋 ${assetId(target)}` };
  }
  const ref = REF_IMAGES[name];
  if (ref === undefined) return { name, path: null, how: 'REF_IMAGES에 없는 참조' };
  const direct = join(refDir, ref.file);
  if (existsSync(direct)) return { name, path: direct, how: '참조 폴더' };
  const [target] = findAssets(ref.fallback);
  const path = target === undefined ? null : assetFile(rawDir, target);
  return { name, path, how: path === null ? `참조 폴더에도, ${ref.fallback}에도 없다` : `참조 폴더에 없어 ${ref.fallback}로 대신` };
}

/** Codex에게 보내는 지시. buildPrompt(화풍 + 에셋 프롬프트)를 그림 프롬프트로 감싼다. */
function codexTask(a: ArtAsset, refs: readonly ResolvedRef[]): string {
  const { w, h } = parseSize(a.size);
  const shape = w === h ? 'square' : w > h ? 'landscape' : 'portrait';
  const lines = [
    `Use your built-in image generation tool (image_gen) to create exactly ONE image, then save it as ${a.key}.png in the current directory.`,
    `- Size: ${a.size} (${shape}). If the tool has a size parameter, use this size or the closest supported one.`,
    a.transparent
      ? '- Background: TRANSPARENT, a real alpha channel in a PNG, no backdrop at all. If the tool has a background parameter, set it to transparent.'
      : '- Background: a fully painted, opaque image that fills the whole frame. No transparency.',
  ];
  if (refs.length > 0) {
    const names = refs.map((r, i) => `${i + 1}) ${r.name.replace(/^@/, '')}`).join(', ');
    lines.push(
      refs.length > 1
        ? `- Attached reference images, in order: ${names}. Use them as the image prompt says.`
        : `- Attached reference image: ${names}. Use it as the image prompt says.`,
    );
  }
  lines.push(
    `- Generate once, then copy the generated file from where the tool saved it to ./${a.key}.png. Do not edit, crop, resize or post-process it, and do not create any other files.`,
    '',
    'Image prompt:',
    buildPrompt(a),
    '',
    'Reply with only the saved file path.',
  );
  return lines.join('\n');
}

interface CodexCommand {
  /** 실제로 띄울 실행 파일 */
  readonly file: string;
  /** codex 인자 앞에 붙는 인자 (node로 codex.js를 띄울 때 그 경로) */
  readonly pre: readonly string[];
  /** Windows의 codex.cmd처럼 셸을 거쳐야 하는가 */
  readonly shell: boolean;
}

function codexCommand(): CodexCommand {
  const bin = process.env['CODEX_BIN'];
  if (bin !== undefined && bin !== '') {
    return bin.endsWith('.js') ? { file: process.execPath, pre: [bin], shell: false } : { file: bin, pre: [], shell: false };
  }
  // npm 전역 설치: node로 codex.js를 바로 띄우면 셸 따옴표 문제가 없다.
  const npmRoot = process.platform === 'win32' ? join(process.env['APPDATA'] ?? '', 'npm', 'node_modules') : null;
  const js = npmRoot === null ? null : join(npmRoot, '@openai', 'codex', 'bin', 'codex.js');
  if (js !== null && existsSync(js)) return { file: process.execPath, pre: [js], shell: false };
  return { file: 'codex', pre: [], shell: process.platform === 'win32' };
}

function codexArgs(workDir: string, refs: readonly ResolvedRef[], model: string | undefined): string[] {
  const args = ['exec', '--skip-git-repo-check', '-C', workDir, '-s', 'workspace-write', '--color', 'never'];
  if (model !== undefined) args.push('-m', model);
  for (const r of refs) if (r.path !== null) args.push('-i', r.path);
  // -i는 값을 여러 개 받으므로 '--' 뒤에 프롬프트 자리를 둔다. '-'는 프롬프트를 표준 입력에서 읽으라는 뜻.
  args.push('--', '-');
  return args;
}

const quote = (s: string): string => (/^[\w@%+=:,./\\-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`);

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function run(cmd: CodexCommand, args: readonly string[], cwd: string, stdin: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const all = [...cmd.pre, ...args];
    const child = cmd.shell
      ? spawn([cmd.file, ...all].map(quote).join(' '), { cwd, shell: true, stdio: ['pipe', 'inherit', 'inherit'] })
      : spawn(cmd.file, all, { cwd, stdio: ['pipe', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('exit', (code) => resolvePromise(code ?? 1));
    child.stdin?.end(stdin);
  });
}

async function genOne(a: ArtAsset, rawDir: string, refDir: string, opts: { dry: boolean; force: boolean; model: string | undefined }): Promise<void> {
  const id = assetId(a);
  if (a.copy === true && !opts.force) {
    throw new Error(`${id}: ${a.note ?? '이미 있는 원본을 쓰는 에셋이다.'} (정말 다시 뽑으려면 --force)`);
  }
  const workDir = join(rawDir, a.group);
  const target = join(workDir, `${a.key}.png`);
  const refs = (a.refs ?? []).map((r) => resolveRef(r, rawDir, refDir));
  const cmd = codexCommand();
  const args = codexArgs(workDir, refs, opts.model);
  const task = codexTask(a, refs);

  console.log(`[${id}] ${a.size}, ${a.transparent ? '투명' : '불투명'}, 처리 뒤 최대 ${a.max}px${a.label ? `, ${a.label}` : ''}`);
  for (const r of refs) console.log(`  참조 ${r.name}: ${r.path ?? '(없음)'}  — ${r.how}`);
  const missing = refs.filter((r) => r.path === null);

  if (opts.dry) {
    console.log(`  작업 폴더: ${workDir}`);
    console.log(`  명령: codex ${args.map(quote).join(' ')}`);
    console.log(`  (실행 파일: ${[cmd.file, ...cmd.pre].map(quote).join(' ')}${cmd.shell ? ', 셸 경유' : ''})`);
    console.log('  표준 입력(프롬프트):');
    for (const line of task.split('\n')) console.log(`  | ${line}`);
    console.log(`  결과: ${target}`);
    if (missing.length > 0) console.log(`  주의: 참조 ${missing.map((r) => r.name).join(', ')}가 없어 실제로는 멈춘다.`);
    console.log('');
    return;
  }

  if (missing.length > 0) {
    throw new Error(`${id}: 참조 그림이 없다: ${missing.map((r) => `${r.name} (${r.how})`).join(', ')}`);
  }
  mkdirSync(workDir, { recursive: true });
  let backup: string | null = null;
  if (existsSync(target)) {
    backup = join(workDir, '_old', `${a.key}-${stamp()}.png`);
    mkdirSync(dirname(backup), { recursive: true });
    renameSync(target, backup);
    console.log(`  있던 원본을 옮겨 둠: ${backup}`);
  }
  const started = Date.now();
  const code = await run(cmd, args, workDir, task);
  const made = existsSync(target) && statSync(target).mtimeMs >= started - 2000;
  if (!made) {
    if (backup !== null && !existsSync(target)) renameSync(backup, target);
    throw new Error(`${id}: Codex가 ${target}를 만들지 않았다 (종료 코드 ${code})${backup !== null ? '. 있던 원본을 되돌렸다' : ''}`);
  }
  const buf = readFileSync(target);
  const head = readImageHead(buf);
  if (head === null || head.format !== 'png') {
    console.log(`  주의: ${target}가 PNG가 아니다. process.ts가 읽지 못한다.`);
  } else {
    console.log(`  뽑음: ${target} (${head.w}x${head.h}, ${kb(buf.length)}, ${head.alpha ? '알파 있음' : '알파 없음'})`);
    if (a.transparent && !head.alpha) console.log('  주의: 투명 에셋인데 알파 채널이 없다. 다시 뽑는 편이 낫다.');
  }
  if (code !== 0) console.log(`  주의: Codex 종료 코드 ${code}`);
  console.log(`  다음: node tools/art/process.ts --raw ${quote(rawDir)} --only ${id}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgv(argv, { valued: ['out', 'ref', 'model'], switches: ['dry', 'force', 'help'] });
  if (args.has('help') || args.positional.length === 0) {
    console.log('node tools/art/gen.ts <key | 그룹/key> [...] [--out <raw 폴더>] [--ref <참조 폴더>] [--model M] [--force] [--dry]');
    console.log(`키: ${ART_ASSETS.map(assetId).join(', ')}`);
    if (!args.has('help')) process.exitCode = 1;
    return;
  }
  const rawDir = resolve(args.get('out') ?? DEFAULT_RAW_DIR);
  const refDir = resolve(args.get('ref') ?? join(rawDir, '..', 'ref'));
  const assets: ArtAsset[] = [];
  for (const q of args.positional) {
    const found = findAssets(q);
    if (found.length > 1) {
      throw new Error(`'${q}'는 여러 그룹에 있다: ${found.map(assetId).join(', ')}. 그룹/키로 적어 달라.`);
    }
    assets.push(...found);
  }
  console.log(`${args.has('dry') ? '(--dry: 실행하지 않음)\n' : ''}원본 폴더 ${rawDir}\n참조 폴더 ${refDir}\n`);
  for (const a of assets) {
    await genOne(a, rawDir, refDir, { dry: args.has('dry'), force: args.has('force'), model: args.get('model') });
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
