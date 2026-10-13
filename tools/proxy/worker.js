// 「용사의 대장간」 개발용 API 중계 Worker (Cloudflare Workers, ES module).
// 진짜 키는 이 Worker의 Secret에만 있다. 개발 PC의 도구는 Worker 주소와 PROXY_TOKEN만 안다.
//
// Secret (대시보드 → 이 Worker → Settings → Variables and Secrets 에서 Type = Secret 으로 넣는다):
//   ARK_API_KEY         시댄스 (BytePlus ModelArk) API 키
//   ELEVENLABS_API_KEY  ElevenLabs API 키
//   PROXY_TOKEN         아무도 못 맞힐 긴 임의 문자열. 개발 PC의 .env 에도 같은 값을 넣는다
// Variable (Type = Text, 비밀 아님):
//   ARK_BASE_URL        예: https://ark.ap-southeast.bytepluses.com/api/v3  (콘솔에 적힌 지역 주소)
//
// 부르는 법 (개발 PC):
//   POST https://<worker>.workers.dev/ark/contents/generations/tasks      헤더 x-proxy-token: <PROXY_TOKEN>
//   GET  https://<worker>.workers.dev/ark/contents/generations/tasks/<id>
//   POST https://<worker>.workers.dev/eleven/v1/sound-generation
//   POST https://<worker>.workers.dev/eleven/v1/text-to-speech/<voice_id>
//   GET  https://<worker>.workers.dev/eleven/v1/voices

const ROUTES = [
  // [접두어, 허용하는 메서드와 경로(접두어 뒤), 대상]
  { prefix: '/ark/', allow: [/^POST contents\/generations\/tasks$/, /^GET contents\/generations\/tasks\/[\w-]+$/], target: 'ark' },
  {
    prefix: '/eleven/',
    allow: [/^POST v1\/sound-generation$/, /^POST v1\/text-to-speech\/[\w-]+$/, /^GET v1\/voices$/],
    target: 'eleven',
  },
];

function same(a, b) {
  // 길이와 상관없이 끝까지 비교한다 (토큰 맞히기 시간 차이를 줄인다).
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    if (!env.PROXY_TOKEN || !same(request.headers.get('x-proxy-token') ?? '', env.PROXY_TOKEN)) {
      return json(401, { error: 'unauthorized' });
    }
    const url = new URL(request.url);
    const route = ROUTES.find((r) => url.pathname.startsWith(r.prefix));
    if (!route) return json(404, { error: 'unknown route' });
    const rest = url.pathname.slice(route.prefix.length);
    if (!route.allow.some((re) => re.test(`${request.method} ${rest}`))) return json(403, { error: 'path not allowed' });

    const headers = new Headers();
    const type = request.headers.get('content-type');
    if (type) headers.set('content-type', type);
    let upstream;
    if (route.target === 'ark') {
      if (!env.ARK_API_KEY || !env.ARK_BASE_URL) return json(500, { error: 'ark not configured' });
      headers.set('authorization', `Bearer ${env.ARK_API_KEY}`);
      upstream = `${env.ARK_BASE_URL.replace(/\/$/, '')}/${rest}${url.search}`;
    } else {
      if (!env.ELEVENLABS_API_KEY) return json(500, { error: 'elevenlabs not configured' });
      headers.set('xi-api-key', env.ELEVENLABS_API_KEY);
      upstream = `https://api.elevenlabs.io/${rest}${url.search}`;
    }
    const body = request.method === 'GET' ? undefined : await request.arrayBuffer();
    const res = await fetch(upstream, { method: request.method, headers, body });
    // 응답은 그대로 돌려준다 (영상 결과 주소, 오디오 바이트 등). 키는 응답에 들어 있지 않다.
    return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } });
  },
};
