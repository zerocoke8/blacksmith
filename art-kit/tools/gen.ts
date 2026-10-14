// Codex 이미지 생성으로 에셋 원본 PNG를 뽑는다 (그림 목록: 프로젝트 파일의 PROJECT_ASSETS + tools/manifest.ts의 예제).
//   node tools/gen.ts <key | 그룹/key> [더 많은 키...] [--assets <프로젝트 파일>] [--raw <원본 폴더>] [--ref <참조 폴더>]
//                     [--out <처리 폴더>] [--model M] [--force] [--dry] [--verbose]
// 결과: <raw>/<그룹>/<key>.png. 있던 파일은 <raw>/<그룹>/_old/ 로 옮겨 둔다 (실패하면 되돌린다).
// Codex의 출력 전부는 <raw>/<그룹>/_logs/<key>-<시각>.log 에 남기고, 화면에는 진행(30초마다)과 결과만 찍는다.
// 다음 단계: 뽑은 PNG를 눈으로 보고, 찍어 주는 process.ts 명령을 돌린다.
//
// 하는 일: 'codex exec'를 <raw>/<그룹>에서 띄우고, 참조 그림을 -i로 붙이고, 프롬프트는 표준 입력으로 보내고 닫는다.
// Codex는 내장 image_gen 도구로 그림을 그린 뒤 ~/.codex/generated_images/<세션>/... 에서 <key>.png로 복사해 온다.
// 한 장에 1~3분쯤 걸린다 (원래 게임에서 62번 잰 중앙값 99초). 키를 여러 개 주면 하나씩 차례로 뽑는다.
// 다른 키라면 gen.ts를 2~3개 따로 띄워 동시에 돌려도 된다 (같은 그룹 폴더여도 된다). 같은 키를 동시에 두 번 돌리지는 않는다
// (<raw>/<그룹>/_logs/<key>.running 이 있으면 멈춘다. 15분 넘은 것은 남은 찌꺼기로 보고 무시한다).
// Codex CLI에 로그인돼 있어야 한다 (codex login). OPENAI_API_KEY는 필요 없다
// (기록에 Codex 이미지 스킬 설명이 들어가는데, 거기 나오는 OPENAI_API_KEY 이야기는 쓰지 않는 다른 길의 것이다).
//
// 이 파일의 Codex 호출(인자, 표준 입력의 지시문)은 원래 게임의 tools/art/gen.ts와 같다. 바꾼 것은 경로, 기록, 안내뿐이다
// (원래 게임은 --out이 원본 폴더였다. 키트는 gen.ts와 process.ts 모두 --raw가 원본, --out이 처리 결과다).
//
// 참조(refs): 'name'은 참조 폴더의 REF_IMAGES[name].file 또는 프로젝트 파일의 PROJECT_REFS[name].file.
//             '@key'는 다른 에셋의 원본 <raw>/<그룹>/<key>.png, 없으면 처리된 <out>/<그룹>/<key>.webp.
//             자기 키(고쳐 그리기)는 다시 뽑기 직전의 지금 원본이다 (_old로 옮긴 그 파일을 보낸다).
//
// Options:
//   --assets FILE  프로젝트 파일 (기본: ART_ASSETS_FILE, 없으면 키트 폴더 옆의 art-assets.ts가 있으면 그것)
//   --raw DIR      원본 PNG 폴더 (기본: ART_RAW_DIR → 프로젝트 파일의 PROJECT_DIRS.raw → <kit>/raw)
//   --ref DIR      참조 그림 폴더 (기본: ART_REF_DIR → PROJECT_DIRS.ref → <kit>/ref)
//   --out DIR      처리 결과 폴더. '@key' 참조의 원본이 없을 때 WebP를 찾는 곳 (기본: ART_OUT_DIR → PROJECT_DIRS.out → <kit>/out)
//   --model M      Codex 모델 (기본: ~/.codex/config.toml의 모델)
//   --force        copy 표시된 에셋(이미 있는 기준 그림)도 다시 뽑는다
//   --dry          실행하지 않고 만들 명령과 프롬프트만 찍는다
//   --verbose      Codex의 출력을 화면에도 모두 흘린다 (한 장에 약 25KB. 기록 파일에는 늘 남는다)
// 실행 파일: 환경 변수 CODEX_BIN(실행 파일 또는 codex.js), 아니면 npm 전역 설치의 codex.js(Windows), 아니면 PATH의 codex.

import { spawn } from 'node:child_process';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  type ArtContext,
  describeContext,
  findAssets,
  isInside,
  KIT_ROOT,
  kb,
  loadContext,
  parseArgv,
  readImageHead,
  shortPath,
  tempParent,
  toolCommand,
} from './common.ts';
import { type ArtAsset, assetId, buildPrompt, parseSize } from './manifest.ts';

interface ResolvedRef {
  readonly name: string;
  /** 찾은 파일. 없으면 null. */
  readonly path: string | null;
  /** 어디서 찾았는지 / 무엇을 찾았는지 */
  readonly how: string;
}

/** 원본 PNG가 있으면 그것, 없으면 처리된 WebP. */
function assetFile(ctx: ArtContext, a: ArtAsset): string | null {
  const png = join(ctx.rawDir, a.group, `${a.key}.png`);
  if (existsSync(png)) return png;
  const webp = join(ctx.outDir, a.group, `${a.key}.webp`);
  return existsSync(webp) ? webp : null;
}

function resolveRef(name: string, ctx: ArtContext): ResolvedRef {
  if (name.startsWith('@')) {
    const found = findAssets(ctx.assets, name.slice(1));
    const [target] = found;
    if (target === undefined) return { name, path: null, how: '목록에 없다' };
    if (found.length > 1) return { name, path: null, how: `여러 그룹에 있다 (${found.map(assetId).join(', ')}): '@그룹/key'로 적는다` };
    const path = assetFile(ctx, target);
    return { name, path, how: path === null ? `${assetId(target)}를 먼저 뽑아야 한다` : `에셋 ${assetId(target)}` };
  }
  const file = ctx.refFiles[name];
  if (file === undefined) return { name, path: null, how: '없는 참조 이름 (프로젝트 파일의 PROJECT_REFS에 더하거나 @그룹/key로 적는다)' };
  return existsSync(file) ? { name, path: file, how: '참조 그림' } : { name, path: null, how: `${file}가 없다` };
}

/** Codex에게 보내는 지시. buildPrompt(화풍 + 에셋 프롬프트)를 그림 프롬프트로 감싼다. 원래 게임과 글자까지 같다. */
function codexTask(a: ArtAsset, refs: readonly ResolvedRef[], ctx: ArtContext): string {
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
    buildPrompt(a, ctx.groupRules),
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

interface RunResult {
  readonly code: number;
  /** Codex의 마지막 답 (표준 출력). 보통 저장한 파일 경로 한 줄. */
  readonly reply: string;
  /** 'tokens used' 뒤의 숫자 (찾으면). */
  readonly tokens: string | null;
  /** 출력의 끝 몇 줄 (실패했을 때 보여 준다). */
  readonly tail: string;
}

function run(cmd: CodexCommand, args: readonly string[], cwd: string, stdin: string, logFile: string, verbose: boolean): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const all = [...cmd.pre, ...args];
    const child = cmd.shell
      ? spawn([cmd.file, ...all].map(quote).join(' '), { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(cmd.file, all, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const log = createWriteStream(logFile);
    log.write(`$ codex ${args.map(quote).join(' ')}\n(작업 폴더 ${cwd})\n\n`);
    let stdout = '';
    let both = '';
    child.stdout?.on('data', (d: Buffer) => {
      log.write(d);
      stdout += d.toString('utf8');
      both += d.toString('utf8');
      if (verbose) process.stdout.write(d);
    });
    child.stderr?.on('data', (d: Buffer) => {
      log.write(d);
      both += d.toString('utf8');
      if (verbose) process.stderr.write(d);
    });
    const started = Date.now();
    const beat = verbose ? null : setInterval(() => console.log(`  … ${Math.round((Date.now() - started) / 1000)}초`), 30_000);
    const finish = (code: number) => {
      if (beat !== null) clearInterval(beat);
      log.end(() => {
        const lines = both.replace(/\r/g, '').split('\n');
        const tokens = /tokens used\s*\n\s*([\d,]+)/.exec(both.replace(/\r/g, ''))?.[1] ?? null;
        const reply = stdout.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l !== '').slice(-1)[0] ?? '';
        resolvePromise({ code, reply, tokens, tail: lines.slice(-20).join('\n') });
      });
    };
    child.once('error', (e) => {
      if (beat !== null) clearInterval(beat);
      log.end();
      reject(e);
    });
    child.once('exit', (code) => finish(code ?? 1));
    // 표준 입력을 꼭 닫는다. 열어 두면 Codex가 "Reading additional input from stdin..."에서 멈춘다.
    child.stdin?.end(stdin);
  });
}

/** 같은 키를 동시에 두 번 뽑지 않게 하는 표시 파일. 15분 넘은 것은 남은 찌꺼기(멈춘 실행)로 본다. */
function takeLock(file: string, id: string): () => void {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 15 * 60_000) {
    throw new Error(`${id}: 이미 뽑는 중이다 (${file}). 다른 창에서 돌고 있지 않다면 이 파일을 지우고 다시 한다.`);
  }
  const fd = openSync(file, 'w');
  writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
  closeSync(fd);
  return () => {
    try {
      unlinkSync(file);
    } catch {
      // 이미 없다
    }
  };
}

interface GenOptions {
  readonly dry: boolean;
  readonly force: boolean;
  readonly verbose: boolean;
  readonly model: string | undefined;
  /** process.ts에 그대로 넘길 경로 옵션 (명령줄로 받은 것만) */
  readonly forward: readonly string[];
}

async function genOne(a: ArtAsset, ctx: ArtContext, o: GenOptions): Promise<void> {
  const id = assetId(a);
  if (a.copy === true && !o.force) {
    throw new Error(`${id}: ${a.note ?? '이미 있는 원본을 쓰는 에셋이다.'} (정말 다시 뽑으려면 --force)`);
  }
  const workDir = join(ctx.rawDir, a.group);
  const target = join(workDir, `${a.key}.png`);
  const refs = (a.refs ?? []).map((r) => resolveRef(r, ctx));
  const cmd = codexCommand();
  const args = codexArgs(workDir, refs, o.model);
  const task = codexTask(a, refs, ctx);

  console.log(`[${id}] ${a.size}, ${a.transparent ? '투명' : '불투명'}, 처리 뒤 최대 ${a.max}px${a.label ? `, ${a.label}` : ''}`);
  for (const r of refs) console.log(`  참조 ${r.name}: ${r.path ?? '(없음)'}  — ${r.how}`);
  const missing = refs.filter((r) => r.path === null);

  if (o.dry) {
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
  const logDir = join(workDir, '_logs');
  const release = takeLock(join(logDir, `${a.key}.running`), id);
  try {
    let backup: string | null = null;
    if (existsSync(target)) {
      backup = join(workDir, '_old', `${a.key}-${stamp()}.png`);
      mkdirSync(dirname(backup), { recursive: true });
      renameSync(target, backup);
      console.log(`  있던 원본을 옮겨 둠: ${backup}`);
    }
    // 자기 키를 참조하면(고쳐 그리기) 방금 _old로 옮긴 지금 원본을 보낸다.
    const sent = backup === null ? refs : refs.map((r) => (r.path === target ? { ...r, path: backup } : r));
    const logFile = join(logDir, `${a.key}-${stamp()}.log`);
    console.log(`  Codex에 보냄. 1~3분 걸린다. 출력 기록: ${shortPath(logFile)}${o.verbose ? '' : ' (화면에 다 보려면 --verbose)'}`);
    const started = Date.now();
    const r = await run(cmd, codexArgs(workDir, sent, o.model), workDir, task, logFile, o.verbose);
    const made = existsSync(target) && statSync(target).mtimeMs >= started - 2000;
    if (!made) {
      if (backup !== null && !existsSync(target)) renameSync(backup, target);
      console.log(`  Codex 출력의 끝:\n${r.tail.split('\n').map((l) => `    ${l}`).join('\n')}`);
      throw new Error(
        `${id}: Codex가 ${target}를 만들지 않았다 (종료 코드 ${r.code})${backup !== null ? '. 있던 원본을 되돌렸다' : ''}. 전체 기록: ${logFile}`,
      );
    }
    const buf = readFileSync(target);
    const head = readImageHead(buf);
    const secs = Math.round((Date.now() - started) / 1000);
    if (r.reply !== '') console.log(`  Codex 답: ${r.reply}`);
    if (head === null || head.format !== 'png') {
      console.log(`  주의: ${target}가 PNG가 아니다. process.ts가 읽지 못한다.`);
    } else {
      const { w, h } = parseSize(a.size);
      const sizeNote = head.w === w && head.h === h ? '' : ` (요청 ${a.size}${Math.abs(head.w / head.h - w / h) < 0.01 ? ', 비율은 같다: process.ts가 meta.json을 요청 크기 단위로 적는다' : ', 비율이 다르다'})`;
      console.log(
        `  뽑음: ${target} (${head.w}x${head.h}${sizeNote}, ${kb(buf.length)}, ${head.alpha ? '알파 있음' : '알파 없음'}, ${secs}초${r.tokens !== null ? `, 토큰 ${r.tokens}` : ''})`,
      );
      if (a.transparent && !head.alpha) console.log('  주의: 투명 에셋인데 알파 채널이 없다. 다시 뽑는 편이 낫다.');
    }
    if (r.code !== 0) console.log(`  주의: Codex 종료 코드 ${r.code}`);
    const fwd = o.forward.length > 0 ? ` ${o.forward.map(quote).join(' ')}` : '';
    console.log(`  다음: 그림을 눈으로 본다 (${toolCommand('inspect.ts')} ${quote(shortPath(target))})`);
    console.log(`        괜찮으면 ${toolCommand('process.ts')}${fwd} --only ${id}`);
    console.log(`        틀렸으면 ${a.key}.png를 ${a.key}.rejected1.png로 이름을 바꾸고 프롬프트 끝에 고칠 말을 더해 다시 뽑는다\n`);
  } finally {
    release();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgv(argv, { valued: ['assets', 'raw', 'ref', 'out', 'model'], switches: ['dry', 'force', 'verbose', 'help'] });
  const ctx = await loadContext(args);
  if (args.has('help') || args.positional.length === 0) {
    console.log(
      `${toolCommand('gen.ts')} <key | 그룹/key> [...] [--assets <프로젝트 파일>] [--raw <원본 폴더>] [--ref <참조 폴더>] [--out <처리 폴더>] [--model M] [--force] [--dry] [--verbose]`,
    );
    console.log(describeContext(ctx, ['raw', 'out', 'ref']));
    const project = ctx.assets.filter((a) => ctx.projectIds.has(assetId(a))).map(assetId);
    if (project.length > 0) console.log(`프로젝트 그림: ${project.join(', ')}`);
    console.log(`키트 예제: ${ctx.assets.filter((a) => !ctx.projectIds.has(assetId(a))).map(assetId).join(', ')}`);
    if (!args.has('help')) process.exitCode = 1;
    return;
  }
  const assets: ArtAsset[] = [];
  for (const q of args.positional) {
    const found = findAssets(ctx.assets, q);
    if (found.length > 1) {
      throw new Error(`'${q}'는 여러 그룹에 있다: ${found.map(assetId).join(', ')}. 그룹/키로 적어 달라.`);
    }
    assets.push(...found);
  }
  console.log(`${args.has('dry') ? '(--dry: 실행하지 않음)\n' : ''}${describeContext(ctx, ['raw', 'ref'])}\n`);
  const temp = tempParent(ctx.rawDir);
  if (temp !== null) {
    console.log(`주의: 원본 폴더가 OS 임시 폴더(${temp}) 안이다. 원본은 다시 만들 수 없으니, 시험이 아니면 오래 남는 곳으로 옮긴다 (--raw 또는 PROJECT_DIRS.raw).\n`);
  } else if (ctx.projectFile !== null && ctx.dirFrom.raw !== '--raw' && isInside(ctx.rawDir, KIT_ROOT)) {
    console.log('알림: 원본 폴더가 키트 폴더 안이다. 키트를 새 판으로 바꿀 때 지워지지 않게 프로젝트 파일의 PROJECT_DIRS.raw를 키트 밖으로 정해 두는 편이 낫다.\n');
  }
  // process.ts에 넘길 경로 옵션: 명령줄로 받은 것만 (환경 변수와 프로젝트 파일은 process.ts도 똑같이 읽는다).
  const forward: string[] = [];
  for (const name of ['assets', 'raw', 'out'] as const) {
    const v = args.get(name);
    if (v !== undefined) forward.push(`--${name}`, v);
  }
  for (const a of assets) {
    await genOne(a, ctx, { dry: args.has('dry'), force: args.has('force'), verbose: args.has('verbose'), model: args.get('model'), forward });
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
