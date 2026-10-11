// 헤드리스 크롬 하나를 띄워 CDP(크롬 개발자 도구 프로토콜)로 식을 계산한다.
// 새 npm 패키지 없이 그림을 디코딩·축소·WebP 인코딩하려고 쓴다 (process.ts).
// 크롬 위치: --chrome 옵션, 환경 변수 CHROME_PATH, 아니면 흔한 설치 위치.
// 포트는 크롬이 빈 포트를 고르게 하고(--remote-debugging-port=0) 프로필 폴더의 DevToolsActivePort에서 읽는다.

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Chrome {
  /** 페이지에서 식을 계산해 값(JSON으로 옮길 수 있는 값)을 돌려준다. Promise면 기다린다. */
  evaluate<T>(expression: string): Promise<T>;
  /** 크롬을 끄고 임시 프로필 폴더를 지운다. 여러 번 불러도 된다. */
  close(): Promise<void>;
}

export interface LaunchOptions {
  /** chrome.exe 경로. 없으면 CHROME_PATH, 그다음 흔한 위치. */
  readonly chromePath?: string | undefined;
  /** 임시 프로필 폴더를 만들 곳 (기본: OS 임시 폴더). */
  readonly tmpDir?: string | undefined;
}

function candidates(): string[] {
  const env = process.env;
  if (process.platform === 'win32') {
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(
      (r): r is string => r !== undefined && r !== '',
    );
    return [
      ...roots.map((r) => join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map((r) => join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

export function findChrome(explicit?: string): string {
  const given = explicit ?? process.env['CHROME_PATH'];
  if (given !== undefined && given !== '') {
    if (!existsSync(given)) throw new Error(`크롬이 없다: ${given}`);
    return given;
  }
  const found = candidates().find((p) => existsSync(p));
  if (found === undefined) throw new Error('크롬을 찾지 못했다. --chrome <경로> 또는 CHROME_PATH로 알려 달라.');
  return found;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const t = setTimeout(() => reject(new Error(`${what}: ${ms}ms 안에 끝나지 않았다`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolvePromise(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function waitExit(proc: ChildProcess, ms: number): Promise<boolean> {
  if (proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolvePromise) => {
    const t = setTimeout(() => resolvePromise(false), ms);
    proc.once('exit', () => {
      clearTimeout(t);
      resolvePromise(true);
    });
  });
}

function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (e) {
    console.warn(`임시 프로필 폴더를 지우지 못했다: ${dir} (${e instanceof Error ? e.message : String(e)})`);
  }
}

interface Pending {
  resolve(v: unknown): void;
  reject(e: Error): void;
}

interface EvaluateResult {
  result: { value?: unknown };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

export async function launchChrome(opts: LaunchOptions = {}): Promise<Chrome> {
  const exe = findChrome(opts.chromePath);
  const base = opts.tmpDir ?? tmpdir();
  mkdirSync(base, { recursive: true });
  const profile = mkdtempSync(join(base, 'art-chrome-'));
  const proc = spawn(
    exe,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const failed: { error: Error | null } = { error: null };
  proc.once('error', (e) => {
    failed.error = e;
  });

  // Ctrl+C로 멈춰도 크롬이 남지 않게.
  const onSigint = (): void => {
    proc.kill();
    removeDir(profile);
    process.exit(130);
  };
  process.once('SIGINT', onSigint);

  let ws: WebSocket | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const send = (method: string, params: object = {}, sessionId?: string): Promise<unknown> => {
    const socket = ws;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP 연결이 없다'));
    const id = nextId++;
    socket.send(JSON.stringify(sessionId === undefined ? { id, method, params } : { id, method, params, sessionId }));
    return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject }));
  };

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    process.removeListener('SIGINT', onSigint);
    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      try {
        await withTimeout(send('Browser.close'), 3000, 'Browser.close');
      } catch {
        // 아래에서 강제로 끈다.
      }
      ws.close();
    }
    if (!(await waitExit(proc, 5000))) {
      proc.kill();
      await waitExit(proc, 3000);
    }
    removeDir(profile);
  };

  try {
    // 크롬이 고른 포트와 브라우저 웹소켓 경로를 기다린다.
    const portFile = join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 20_000;
    let lines: string[] = [];
    for (;;) {
      if (failed.error !== null) throw new Error(`크롬을 띄우지 못했다: ${failed.error.message}`);
      if (proc.exitCode !== null) throw new Error(`크롬이 바로 꺼졌다 (종료 코드 ${proc.exitCode})`);
      if (existsSync(portFile)) {
        lines = readFileSync(portFile, 'utf8').split(/\r?\n/);
        if ((lines[1] ?? '') !== '') break;
      }
      if (Date.now() > deadline) throw new Error('크롬 디버깅 포트가 20초 안에 열리지 않았다');
      await delay(100);
    }
    const url = `ws://127.0.0.1:${lines[0]}${lines[1]}`;

    const socket = new WebSocket(url);
    ws = socket;
    await new Promise<void>((resolvePromise, reject) => {
      socket.addEventListener('open', () => resolvePromise(), { once: true });
      socket.addEventListener('error', () => reject(new Error(`CDP 연결 실패: ${url}`)), { once: true });
    });
    socket.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string } };
      if (msg.id === undefined) return;
      const p = pending.get(msg.id);
      if (p === undefined) return;
      pending.delete(msg.id);
      if (msg.error !== undefined) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    });
    socket.addEventListener('close', () => {
      for (const p of pending.values()) p.reject(new Error('CDP 연결이 끊겼다'));
      pending.clear();
    });

    // 빈 페이지 하나를 만들어 붙는다 (flatten: 같은 소켓에 sessionId로 보낸다).
    const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })) as { targetId: string };
    const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };

    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)) as EvaluateResult;
      if (r.exceptionDetails !== undefined) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      }
      return r.result.value as T;
    };
    return { evaluate, close };
  } catch (e) {
    await close();
    throw e;
  }
}
