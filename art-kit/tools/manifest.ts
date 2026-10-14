// 아트 키트의 매니페스트: 화풍 머리말, 공통 문단, 도움 함수, 예제 그림 (프롬프트, 크기, 투명, 참조, 처리 크기).
//   1. node tools/gen.ts <그룹/key>              Codex 이미지 생성으로 <raw>/<그룹>/<key>.png 를 뽑는다
//   2. (뽑은 PNG를 눈으로 본다. 마음에 안 들면 <key>.rejected1.png 로 이름을 바꿔 두고 프롬프트 끝에 고칠 말을 더해 다시 뽑는다)
//   3. node tools/process.ts --only <그룹/key>   다듬어 <out>/<그룹>/<key>.webp 와 <out>/meta.json 에 쓴다
//
// 이 파일은 '용사의 대장간'(게임)의 tools/art/assets.ts에서 옮겨 왔다. 화풍 머리말(STYLE)과 공통 문단은 그 게임에서
// 실제로 보낸 글자 그대로다 (글자 하나 바꾸지 않았다. 키트에서 새로 쓴 문장은 FOE_STYLE_REF 하나이고 그렇게 적어 두었다).
//
// **새 프로젝트는 이 파일을 고치지 않는다.** 그림 목록은 키트 폴더 밖의 '프로젝트 파일'(기본: 키트 폴더 옆의 art-assets.ts,
// node tools/init.ts가 만든다)에 적는다. 그래야 키트를 새 판으로 통째로 바꿔도 그림 목록과 원본이 남는다.
// 프로젝트 파일은 이 파일의 도움 함수를 import해 쓰고, 아래 ArtProjectModule의 이름들을 내보낸다:
//   PROJECT_ASSETS (꼭), PROJECT_DIRS (원본·출력 폴더), PROJECT_GROUPS (그룹 더하기), PROJECT_REFS (참조 그림 더하기).
//
// 화풍: '하찮은' 낙서풍 SD (D 화풍). 굵고 살짝 삐뚤한 짙은 갈색 외곽선, 평면 채색, 음영·그라데이션·광택 없음,
// 단순하고 둥근 모양, 디테일은 아주 적게. 모든 그림이 드워프 기준 그림(참조 d_dwarf_idle)의 선과 채색을 따른다.
// 드워프를 그리지 않는 그림에도 d_dwarf_idle을 첫 참조로 늘 붙인다 (그리고 "STYLE REFERENCE ONLY, do NOT draw the dwarf"를 적는다).
//
// 최종 프롬프트 = 화풍 머리말(STYLE) + [그룹 규칙: 참조 안내(STYLE_REF_ONLY) 또는 카드 구도(CARD_FRAMING)] + 에셋 프롬프트.
// buildPrompt가 붙인다. ownStyle이면 prompt를 그대로 보낸다 (프롬프트 안에 화풍을 직접 적은 그림).
//
// 참조(refs)는 순서가 있는 목록이고 그 순서대로 'codex exec -i'로 붙는다. 프롬프트가 "first attached image",
// "second attached image"라고 부르므로 순서와 낱말이 맞아야 한다.
//   'name'        참조 폴더(--ref, 기본 <kit>/ref)의 파일. 이름과 파일은 REF_IMAGES에 있다.
//                 프로젝트 파일의 PROJECT_REFS로 이름을 더할 수 있다 (파일은 프로젝트 파일의 폴더 기준).
//   '@key'        다른 에셋 (예제나 프로젝트 파일의 그림. 먼저 뽑아 둔 원본 <raw>/<그룹>/<key>.png, 없으면 처리된 <out>/<그룹>/<key>.webp).
//                 '@그룹/key'로 그룹을 정할 수 있다. 세트의 '기준 그림'을 두 번째 참조로 붙일 때 쓴다.
//   '@자기 key'   고쳐 그리기: 다시 뽑기 직전의 지금 원본을 보낸다 (gen.ts가 _old/로 옮긴 그 파일).

// ── 그룹 ────────────────────────────────────────────────────────────────

/**
 * 그룹 규칙: buildPrompt가 STYLE 다음에 무엇을 붙이는지.
 *   'style'          STYLE만. 참조 안내는 에셋 프롬프트 안에 직접 적는다 (캐릭터·몬스터·지도·소품).
 *   'style+refOnly'  STYLE + STYLE_REF_ONLY (드워프는 화풍만, 그리지 마라). UI·아이콘·아이템처럼 사람이 없는 그림.
 *   'style+card'     STYLE + CARD_FRAMING (정사각 카드 일러스트, 평면 단색 배경).
 */
export type GroupRule = 'style' | 'style+refOnly' | 'style+card';

/**
 * 키트의 그룹 = 출력 폴더 이름과 그 규칙. 그룹을 더하려면 이 파일이 아니라 프로젝트 파일의 PROJECT_GROUPS에 적는다.
 * 원래 게임의 그룹과의 대응: scene→objects, heroes→characters, monsters→monsters, icons→icons, ui→ui,
 * refine→items, cards→cards, town→map. 규칙은 원래 게임과 같다 (ui·refine·icons만 STYLE_REF_ONLY, cards만 CARD_FRAMING).
 */
export const GROUP_RULES = {
  characters: 'style',
  monsters: 'style',
  objects: 'style',
  map: 'style',
  ui: 'style+refOnly',
  icons: 'style+refOnly',
  items: 'style+refOnly',
  cards: 'style+card',
} as const satisfies Readonly<Record<string, GroupRule>>;

/** 키트의 그룹 이름. */
export type KitGroup = keyof typeof GROUP_RULES;

/** 그룹 이름. 키트 그룹이 아닌 이름은 프로젝트 파일의 PROJECT_GROUPS에 있어야 한다 (도구가 확인한다). */
export type ArtGroup = KitGroup | (string & {});

/** 키트 그룹의 순서 (meta.json의 순서. 프로젝트 그룹은 그 뒤에 온다). */
export const ART_GROUPS = Object.keys(GROUP_RULES) as KitGroup[];

// ── 타입 ────────────────────────────────────────────────────────────────

/** 'WxH' (px). Codex에 부탁할 원본 크기: '1024x1024' 정사각, '1536x1024' 가로, '1024x1536' 세로. */
export type ArtSize = `${number}x${number}`;

/** 처리할 때 키마다 더 하는 일 (process.ts). */
export interface ArtProcess {
  /**
   * 불투명 그림의 가장자리 n px 띠를 바로 안쪽 픽셀로 메우고 그 띠를 불투명으로 한다.
   * Codex가 뽑은 불투명 그림(카드)은 가장자리 1px이 반투명(알파 193 안팎)이거나 한 줄 어둡다. 카드는 2를 썼다.
   */
  readonly edge?: number;
  /**
   * 단색 배경을 다른 색으로: 가장자리에 이어진 배경 영역(배경색과 색 거리 tol 안)과 그 안의 넓은 배경 조각만
   * 바꾸고, 외곽선과 맞닿은 경계 픽셀은 섞인 만큼만 바꾼다. 외곽선과 주제는 건드리지 않는다.
   * 원래 배경색은 가장자리 픽셀에서 읽는다. Codex가 'a little muted'보다 쨍하게 칠한 배경을 팔레트에 맞출 때.
   */
  readonly recolor?: { readonly to: string; readonly tol?: number };
  /**
   * 불투명 그림을 이 가로÷세로까지 양옆으로 넓힌다 (양옆 가장자리 열의 색으로 채운다). 정사각 카드 일러스트를
   * 카드 틀의 넓은 그림 창에 넣을 때 위아래가 덜 잘리게 1.35:1로 넓혔다.
   */
  readonly widen?: number;
}

export interface ArtAsset {
  readonly key: string;
  /** 출력 폴더: <out>/<group>/<key>.webp */
  readonly group: ArtGroup;
  /** 생성할 원본 크기. 이미 있는 원본(copy)은 실제 크기. */
  readonly size: ArtSize;
  /** 진짜 알파 채널이 있는 투명 배경. 처리할 때 투명 여백을 잘라 낸다. */
  readonly transparent: boolean;
  /** 처리 뒤 긴 변의 최대 길이(px). 투명 에셋은 여백을 잘라 낸 뒤의 크기에 맞춘다. 키우지는 않는다. */
  readonly max: number;
  /** 함께 보낼 참조 그림 (머리 주석 참고). 첫 참조는 늘 'd_dwarf_idle'. */
  readonly refs?: readonly string[];
  /** 그릴 것. 화풍 머리말과 그룹 규칙의 문단은 buildPrompt가 붙인다. */
  readonly prompt: string;
  /** true면 prompt에 화풍이 들어 있어 buildPrompt가 아무것도 붙이지 않는다. */
  readonly ownStyle?: boolean;
  /** 사람이 보는 이름·메모 (프롬프트에 들어가지 않는다). */
  readonly label?: string;
  /** true면 이미 있는 원본을 그대로 쓴다. gen.ts는 --force 없이 다시 뽑지 않는다 (기준 그림을 지킨다). */
  readonly copy?: boolean;
  /** 왜 다시 뽑았는지, 무엇이 남은 흠인지. 다시 뽑을 때마다 적는다 ("둘째 판. 첫 판은 …"). */
  readonly note?: string;
  readonly process?: ArtProcess;
}

// ── 화풍 (고치지 않는다) ────────────────────────────────────────────────────

/** 모든 그림 앞에 붙는 화풍 머리말 (D 화풍). 원래 게임의 STYLE과 글자까지 같다. */
export const STYLE =
  'Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (cream, warm brown, soft grey, soft orange, a little muted). No text, no letters, no numbers, no watermark, no signature.';

/** 사람이 없는 그림(틀, 버튼, 아이콘, 아이템, 건물)에: 드워프는 화풍 기준일 뿐 그리지 마라. */
export const STYLE_REF_ONLY =
  'The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only what is asked below.';

/** 카드 일러스트 구도. 화풍 머리말 다음, 카드별 장면 앞에 붙는다. */
export const CARD_FRAMING =
  'Card illustration, square composition: one clear subject in the center with breathing room (it will be cropped to a 4:3 window, so keep everything important inside the central area), a single flat warm background color block (no scenery detail). Funny and charming.';

/** 최종 그림 프롬프트. rules = 그룹 규칙 (프로젝트 그룹을 쓰면 도구가 PROJECT_GROUPS를 합쳐 넘긴다). */
export function buildPrompt(a: ArtAsset, rules: Readonly<Record<string, GroupRule>> = GROUP_RULES): string {
  if (a.ownStyle === true) return a.prompt;
  const rule = rules[a.group];
  if (rule === undefined) throw new Error(`그룹 '${a.group}'의 규칙이 없다 (프로젝트 파일의 PROJECT_GROUPS에 더한다)`);
  if (rule === 'style+card') return `${STYLE}\n\n${CARD_FRAMING}\n\n${a.prompt}`;
  if (rule === 'style+refOnly') return `${STYLE}\n\n${STYLE_REF_ONLY}\n\n${a.prompt}`;
  return `${STYLE}\n\n${a.prompt}`;
}

/** 프롬프트 조각을 빈 줄로 잇는다. */
export const para = (...parts: readonly string[]): string => parts.join('\n\n');

// ── 참조 그림 (<kit>/ref) ─────────────────────────────────────────────────

export interface RefImage {
  /** 참조 폴더 안의 파일 이름 (PROJECT_REFS에서는 프로젝트 파일의 폴더 기준 경로나 절대 경로). */
  readonly file: string;
  readonly note: string;
}

// ── 프로젝트 파일 (키트 밖, 새 프로젝트가 쓴다) ──────────────────────────────

/** 프로젝트 파일이 정하는 폴더. 상대 경로는 프로젝트 파일이 있는 폴더 기준. 명령줄 옵션과 환경 변수가 이보다 먼저다. */
export interface ProjectDirs {
  /** Codex 원본 PNG. 지우지 않고 백업되는 곳에 둔다 (임시 폴더 금지, 키트 폴더 안도 피한다). */
  readonly raw?: string;
  /** 다듬은 WebP와 meta.json. 게임의 에셋 폴더를 바로 줘도 된다. */
  readonly out?: string;
  /** 참조 그림 폴더 (보통 정하지 않는다: 키트의 ref/). */
  readonly ref?: string;
}

/**
 * 프로젝트 파일(기본: 키트 폴더 옆의 art-assets.ts)이 내보내는 이름. 도구(gen.ts, process.ts)가 읽는다.
 * 찾는 순서: --assets <파일> → 환경 변수 ART_ASSETS_FILE → <키트 폴더>/../art-assets.ts. 없으면 키트 예제만 쓴다.
 */
export interface ArtProjectModule {
  /** 이 프로젝트의 그림 목록 (꼭). 예제와 같은 '그룹/key'를 적으면 예제 대신 이 항목을 쓴다. */
  readonly PROJECT_ASSETS: readonly ArtAsset[];
  readonly PROJECT_DIRS?: ProjectDirs;
  /** 그룹 더하기 (이름 → 규칙). 키트 그룹과 같은 이름이면 규칙을 바꾼다. */
  readonly PROJECT_GROUPS?: Readonly<Record<string, GroupRule>>;
  /** 참조 그림 더하기 (이름 → 파일). 다른 프로젝트로도 가져갈 세트 기준 그림을 둘 때. 그 프로젝트 안에서만 쓰면 '@그룹/key'로 충분하다. */
  readonly PROJECT_REFS?: Readonly<Record<string, RefImage>>;
}

/**
 * 참조 폴더의 그림. 화풍 기준(D 드워프 셋)과, 원래 게임에서 세트의 '기준 그림'으로 두 번째 참조에 붙였던 원본들.
 * 새 프로젝트가 자기 세트의 기준 그림을 뽑으면 '@key'로 부르거나, ref/에 넣고 여기에 더한다.
 */
export const REF_IMAGES: Readonly<Record<string, RefImage>> = {
  d_dwarf_idle: {
    file: 'd_dwarf_idle.png',
    note: '화풍 기준 (1227x1282 RGBA). 모든 그림의 첫 참조. 드워프가 없는 그림에도 붙이고 "그리지 마라"를 적는다.',
  },
  d_dwarf_strike: { file: 'd_dwarf_strike.png', note: '망치를 내려치는 드워프. 망치를 든 카드 장면의 두 번째 참조.' },
  d_dwarf_work: { file: 'd_dwarf_work.png', note: '숫돌질하는 드워프. 손으로 하는 카드 장면의 두 번째 참조.' },
  hero_vail: {
    file: 'hero_vail.png',
    note: '용사 바일 (특급, 1024x1536). 용사 26명이 두 번째 참조로 받은 캐릭터 세트의 기준 (비례 약 2.3등신·선 굵기·틀 안 크기).',
  },
  hero_rookie: { file: 'hero_rookie.png', note: '신참 검사 (일반, 1024x1536). 가장 \'하찮은\' 결. 수수한 캐릭터의 예.' },
  mon_humanoid_water: {
    file: 'mon_humanoid_water.png',
    note: '귀여운 몬스터 \'냄비 고블린\' 물 변형 (1024x1024). 같은 체형의 색 변형·보스가 두 번째 참조로 받은 기준.',
  },
  mon_armored_earth: { file: 'mon_armored_earth.png', note: '귀여운 몬스터 \'동글게\' 땅 변형 (1024x1024). 적 버전(톱니게)의 두 번째 참조.' },
  foe_humanoid_earth: {
    file: 'foe_humanoid_earth.png',
    note: '적다운 몬스터 \'엄니 오크\' (1024x1024). 대형 보스(오우거·오크 로드·트윈헤드)의 두 번째 참조: 선 굵기·채색만, 디자인은 금지.',
  },
  boss_twinhead_ogre: {
    file: 'boss_twinhead_ogre.png',
    note: '대형 보스 트윈헤드 오우거 (1536x1024). 대형 보스의 중립적인 두 번째 참조 (리치 둘째 판이 받았다).',
  },
  element_water: { file: 'element_water.png', note: '물 속성 아이콘 (1254x1254). 아이콘 세트 모두의 기준.' },
  role_melee: { file: 'role_melee.png', note: '근접 역할 아이콘 (1254x1254). 역할 아이콘과 [자동]·[배속] 단추 아이콘의 기준.' },
  frame_progress: { file: 'frame_progress.png', note: '빈 카드 틀 (1024x1536). 카드 틀 다섯 장의 기준.' },
  ore_iron: { file: 'ore_iron.png', note: '철광석 아이템 아이콘 (1254x1254). 아이템 아이콘(광석·골드·선물·가방)의 기준.' },
  bld_forge: { file: 'bld_forge.png', note: '마을 지도의 대장간 (1254x1254, 3/4 위에서 본 시점). 건물·탑의 기준.' },
  weapon_oneHandSword: { file: 'weapon_oneHandSword.png', note: '공방의 완성 무기 한손검 (1024x1024). 무기 그림의 기준.' },
  prop_tree_round: { file: 'prop_tree_round.png', note: '마을 지도 소품 둥근 나무 (1254x1254). 작은 소품의 기준.' },
};

// ── 공통 문단 (원래 게임에서 세트마다 쓴 글자 그대로) ──────────────────────────

// 캐릭터: 기준 드워프의 새 자세 (d_dwarf_idle 하나만 참조).
/** 드워프 자세가 같이 쓰는 앞말. 'New pose: …'가 뒤에 붙는다. */
export const DWARF_SAME =
  'The attached image is our dwarf blacksmith in the final art style. Draw the SAME character in EXACTLY the same style: super simple flat doodle, the grey beard is one big round blob with two tiny braids, grey hair blob, two dot eyes, small nose, tiny stick-like arms and legs, little brown boots, brown apron, cream shirt, uneven hand-drawn dark outline, flat colors, NO shading, NO extra detail. Same size and proportions (about 2 heads tall), side view facing right. Transparent background with a real alpha channel. No text.';

// 캐릭터: 세트의 첫 캐릭터 (참조는 드워프 하나). 원래 게임의 '용사 예제 10명' (hero_vail이 이것으로 태어났다).
/** 첫 캐릭터의 화풍 머리말 (STYLE에서 팔레트 괄호와 'no signature'를 뺀 판). ownStyle로 쓴다. */
export const HERO_STYLE =
  'Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (a little muted). No text, no letters, no numbers, no watermark.';
/** 드워프는 화풍 참조일 뿐이라는 안내 (첫 캐릭터). */
export const HERO_REF_NOTE =
  'The attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. Draw only the new character described below.';
/** 첫 캐릭터의 공통 문단: 왼쪽을 보는 2.3~2.5등신, 단순한 얼굴, 투명. */
export const HERO_COMMON =
  "Draw ONE human adventurer hero, full body from head to boots, standing, front three-quarter view: body and face turned slightly toward the LEFT edge of the image (the character looks toward the viewer's left). Chibi proportions about 2.3 to 2.5 heads tall (a little less squat than the dwarf: a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow.";

// 캐릭터: 세트의 나머지 (드워프 + 세트 기준 캐릭터). 원래 게임 '명단 용사' 묶음 4의 글자 (가장 마지막에 다듬은 판).
/** 참조 안내: 1) 드워프는 화풍만, 2) 같은 세트의 캐릭터는 비례·선·틀 안 크기만. */
export const CHAR_REF =
  'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its proportions (about 2.3 to 2.5 heads tall, a big round head), its outline thickness, its flat fills, its small amount of detail and how large the character sits in the frame exactly, but do NOT draw that hero (no red tunic, no ledger, no sword unless asked). Draw only the new character described below.';
/** 공통 문단 (세트의 나머지 캐릭터). */
export const CHAR_COMMON =
  "Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. Holding their weapon. Thick outlines, flat colors. The whole character fits inside the frame with wide empty margin on all sides (the character fills only the middle of the image, like the second reference), nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.";
/** 특급(눈에 띄는) 캐릭터의 등급 문단 (공통 문단 뒤). */
export const SPECIAL_ONE_IDEA =
  'This is a special-rank hero: make the design a little more distinctive (one memorable silhouette idea), but keep it just as simple and doodle-like as the others.';
/** 일반(수수한) 캐릭터: 생김새 끝에 붙이는 문장. */
export const NORMAL_TAIL = 'An ordinary common hero: plain and humble, simple clothes, nothing fancy.';

// 몬스터: 귀여운 쪽.
/** 드워프는 화풍 참조일 뿐이라는 안내 (몬스터 모두). */
export const MON_REF_NOTE =
  'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes), but do NOT draw the dwarf or any person. Draw only the monster described below.';
/** 귀여운 몬스터 공통 문단: 왼쪽을 본다, 무섭지 않다, 투명. */
export const MON_COMMON =
  'Draw ONE monster for a cozy, silly idle RPG, full body, as one character. It faces LEFT: body and face turned three-quarters toward the LEFT edge of the image (it looks at the heroes standing on the left). Cute, silly and harmless, NOT scary: no sharp teeth, no sharp claws, no spikes, no blood, no angry or glowing eyes; round chunky shapes; a very simple face with two dot eyes (or simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: a few flat color blocks, at most a few inner lines, no patterns, no texture, no ornaments beyond what is described. The whole monster fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects around it.';
/** 같은 종의 색 변형: 두 번째 참조(먼저 그린 변형)와 같은 몸에 색과 표식만 바꾼다. */
export const MON_SAME_SPECIES =
  'The second attached image is the SAME monster species already drawn in another element color. Draw the SAME creature: same silhouette, same pose, same proportions, same face and expression, same size and position in the frame and the same outline weight. Change ONLY the main body color (and its matching darker shade, if any) and the one small element mark on top, which replaces the mark shown in the second image, as described below.';
/** 종의 보스: 두 번째 참조(그 종의 물 변형)에서 모양만 따르고 색과 물방울은 따르지 않는다. */
export const FLOOR_BOSS_NOTE =
  'The second attached image is an ordinary member of this monster species (its sky-blue water-element variant). Draw its BOSS: clearly the same species with the same face style, the same shapes, the same outline weight and the same clothes or parts, but bigger, rounder and heavier, with the one boss mark described below. Do NOT copy its sky-blue body color or the small water-droplet mark on its head: the boss is element-neutral and uses the colors described below.';
/** 종의 보스 크기 줄. */
export const FLOOR_BOSS_FRAME = 'Draw it large in the frame (it is a boss), centered, with a small empty margin on every side and nothing cut off.';
/** 화면을 크게 채우는 보스 크기 줄 (일일 보스). */
export const DAILY_BOSS_FRAME =
  'This is a BIG daily BOSS that fills the battle screen: draw it LARGE so it fills most of the square frame (roughly 85% of the frame width or height, whichever is larger), centered, still with a small empty margin on every side and nothing cut off.';

// 몬스터: 적다운 쪽 (원래 게임 매니페스트 밖. tools/art/roster/monsters_menacing/list.json의 글자 그대로).
/** 적다운 몬스터 공통 문단: 위협은 몇 가지 표식으로만, 공포는 아니다. */
export const FOE_COMMON =
  'Draw ONE monster for a cozy, silly idle RPG, full body, as one character. It faces LEFT: body and face turned three-quarters toward the LEFT edge of the image (it glares at the heroes standing on the left). This one is a real ENEMY, a little mean and threatening, but drawn in exactly the same simple chunky cartoon style as our cute monsters: round chunky shapes, thick dark brown outline, flat fills, a very simple face. Show the menace ONLY through the few features described below (frowning brows, narrowed eyes, small pointed fangs, blunt spikes, claws, horns, a weapon in hand, a crouched or lunging pose, a few flat dark puffs). It should look petty and small-time, but like it would really hurt if you picked a fight with it. NOT horror: no blood, no wounds, no gore, no skulls, no bones, no glowing eyes, no realistic anatomy, no glow effects, no gradients. Keep details minimal like the dwarf: a few flat color blocks, at most a few inner lines, no patterns, no texture. The whole monster fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects around it except what is described.';
/** 적다운 몬스터의 두 번째 참조(같은 체형·속성의 귀여운 몬스터) 안내. */
export const FOE_SAME_BODY =
  'The second attached image is one of our existing cute monsters of the same body type and element. Use it to match the drawing style, outline weight, flat colors, element color and the size in the frame. Draw the creature described below: if the description says it is the SAME species as the second image, keep that species recognizable; otherwise draw a new creature and do not copy the one in the second image.';
/**
 * 적다운 몬스터의 두 번째 참조가 '같은 체형·속성의 귀여운 몬스터'가 아닐 때 (새 프로젝트에 맞는 몬스터가 아직 없을 때,
 * 속성이 없는 게임). 화풍·선·디테일·틀 안 크기만 따르고 종·몸·색·표식은 따르지 않게 한다.
 * **키트에서 새로 쓴 문장이다** (원래 게임에서는 쓰지 않았다). 낱말은 원래 게임의 대형 보스 참조 문단(BIG_BOSS_SCALE)과
 * 적다운 몬스터 감싸기 ②의 참조 줄("style, coloring and size reference")에서 가져왔다. foe(..., { secondRef: 'style' }).
 */
export const FOE_STYLE_REF =
  'The second attached image is an existing monster from the same game: use it ONLY as a reference for the drawing style, the flat coloring, the thick dark brown outline weight, the level of detail and the size in the frame. Do NOT copy its species, body, colors or marks: draw the new creature described below, in the colors described below.';

// 몬스터: 대형 보스 (원래 게임 매니페스트 밖. 기존 몬스터의 변형이 아닌 새 생물, 용사 키의 2~3배).
/** 대형 보스 문단의 앞말. 생김새가 바로 뒤에 붙는다. */
export const BIG_BOSS_INTRO =
  'A big boss monster for the game, facing left, drawn in the same flat doodle style and coloring as the second attached image but much bigger and heavier, and a completely new creature (not a recolor of the attached monster): ';
/** 대형 보스의 참조·덩치 문단 (그때 Codex 지시문에 들어 있던 그림 부분만, 글자 그대로). */
export const BIG_BOSS_SCALE =
  'Attached images: 1) the doodle dwarf = drawing style reference only (do not draw the dwarf); 2) an existing enemy monster from the same game = reference for the flat coloring, the thick dark brown outline weight and the level of detail only. Do NOT copy its species, body or gear: draw the new boss described above. This boss will stand 2 to 3 times as tall as the heroes on screen, so give it huge, heavy proportions: a small head (or heads) on very broad shoulders, thick arms and legs, a big heavy silhouette. It is a step more threatening than the attached monster (big, heavy, angry), but it stays a silly flat doodle: no blood, no wounds, no gore, no skulls, no horror, no realistic anatomy, no glow effects, no gradients, and very few details (do not pile on decorations).';

// 아이콘 (그룹 규칙이 STYLE_REF_ONLY를 붙인다).
/** 아이콘 세트의 두 번째 참조 안내. */
export const ICON_SAME_SET =
  'The second attached image is another icon from the same game UI icon set. Match it exactly in drawing style, outline weight and how big the shape sits in the frame (same scale and margin, centered), so all the icons look like one set. Do NOT redraw that icon; draw only the new icon described below.';
/** 아이콘 모두: 24px에서 읽히는 한 덩어리, 투명 배경, 굵은 선, 얼굴 없음. */
export const ICON_FRAME =
  'A small game UI icon that must read clearly at 24px: one simple bold shape, centered, filling about three quarters of the square canvas with a comfortable empty margin on every side, nothing cut off. Transparent background with a real alpha channel: no backdrop, no badge or circle behind it, no ground shadow, no glow. Draw it with the same VERY fat, bold dark brown marker outline as the dwarf, one flat color per part (no lighter or darker patches, no shading, no gradient, no glossy shine), and at most one or two inner lines. No face.';

// 아이템 아이콘과 버튼 (그룹 규칙이 STYLE_REF_ONLY를 붙인다).
/** 아이템 아이콘 세트의 두 번째 참조(철광석) 안내. */
export const SAME_ITEM_SET =
  'The second attached image is an item icon from the same set (iron ore). Match it exactly in drawing style, outline weight and how big the object sits in the frame (same scale and margin, centered), so the icons look like one set. Do NOT redraw the iron ore; draw only the new object described below.';
/** 버튼 세트의 두 번째 참조(먼저 그린 버튼) 안내. */
export const SAME_UI_SET =
  'The second attached image is an existing button from the same game UI. Match its very fat, crisp dark brown outline, its flat warm light grey fill and its little flat orange flame marks, so it looks like the same UI set. Do NOT redraw that button; draw only the new object described below.';
/** 투명 배경과 여백 (아이템·버튼). */
export const ALPHA_MARGIN =
  'Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges.';

// 카드 일러스트 (그룹 규칙이 CARD_FRAMING을 붙인다). 배경은 카드 종류마다 평면 한 색.
/** 카드 배경색 (원래 게임: 공정 주황, 품질 하늘, 보조 민트, 각인 라벤더). */
export const CARD_COLORS = {
  orange: 'a soft warm orange (like #F2B279)',
  sky: 'a pale soft sky blue (like #BFDDEB)',
  mint: 'a soft pale mint green (like #CBE6C1)',
  lavender: 'a soft pale lavender (like #D8CBEA)',
} as const;
/** 카드 배경 문장: 캔버스 전체가 평면 단색. */
export const cardBackground = (color: string): string =>
  `Background: the whole canvas is one single flat solid color, ${color}, edge to edge, no pattern, no frame, no border.`;
/** 드워프가 나오는 카드 장면의 앞말 (동작이 바로 뒤에 붙는다). */
export const CARD_DWARF_SCENE = 'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs)';
/** 드워프가 나오는 카드: 생김새를 다시 적어 디자인이 바뀌지 않게. */
export const CARD_DWARF_KEEP =
  'Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible.';
/** 사물만 나오는 카드: 불투명 단색 배경을 꽉 채운다. */
export const CARD_OPAQUE = 'Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border).';
/** 사물만 나오는 카드: 사람 얼굴 없음. */
export const CARD_OBJECTS_ONLY = 'Only objects (and at most a simple cartoon hand); no human faces.';

// 지도·건물·소품 (그룹 규칙은 STYLE만. 참조 안내를 프롬프트 안에 적는다).
/** 건물·탑의 두 번째 참조(대장간) 안내. */
export const BUILDING_SAME_SET =
  'The second attached image is the forge building from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail, and the same scale (a door of the same size, so the buildings line up on one map). Do NOT redraw the forge; draw only the new object described below.';
/** 같은 짜임에 주제만 바꾸는 건물(탑)의 두 번째 참조 안내. */
export const TOWER_SAME_SET =
  'The second attached image is the water tower from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills, the same silhouette and the same size and position in the frame. Do NOT redraw the water theme; change only the theme as described below.';
/** 같은 지도 세트의 다른 그림을 두 번째 참조로. what = 그 그림이 무엇인지 (예: 'a pair of market stalls'). */
export const mapSameSet = (what: string): string =>
  `The second attached image is ${what} from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail. Do NOT redraw it; draw only the new object described below.`;
/** 시점: 3/4 위에서 약 40°, 문 벽이 왼쪽 아래를 본다, 음영 없음, 평면 그림자 한 덩이. */
export const VIEW_TOPDOWN =
  'Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the forge: the building is turned a little, so its front (door) wall faces the viewer toward the lower left, one narrow side wall shows on the right, and a little of the top surface of the roof is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.';
/** 시점: 두 번째 참조처럼 조금 돌려 (참조가 대장간이 아닐 때). */
export const VIEW_TOPDOWN_LIKE_REF =
  'Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the second attached image: the object is turned a little, so its front faces the viewer toward the lower left, one narrow side shows on the right, and a little of the top surface is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.';
/** 시점: 위에서 보되 이 물건만 정면 대칭 (문, 관문). */
export const VIEW_FRONT =
  'Camera: a cozy village tycoon / management game map seen from above at roughly 40 degrees, but this object is seen STRAIGHT-ON FROM THE FRONT: it is perfectly symmetric left to right, its front faces the viewer squarely, and the flat top surfaces are a little visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground, no road, no grass, no scenery: the object stands alone on the transparent background.';
/** 시점: 지도 바닥. */
export const VIEW_MAP =
  'View: like a cozy tycoon / management game map, seen from above at a gentle 3/4 top-down angle. Light comes from the upper left. Everything flat-colored; no cast shadows on the ground.';
/** 투명 배경, 여백, 간판에 글자 없음 (건물·탑·광장 소품의 끝). */
export const MAP_FRAME =
  'Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges. Signs carry only simple picture symbols, never letters or numbers.';
/** 작은 소품의 참조 안내 (STYLE_REF_ONLY와 끝 낱말만 다르다). */
export const PROP_REF_ONLY =
  'The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only the object asked below.';
/** 작은 소품의 두 번째 참조(둥근 나무) 안내. */
export const PROP_SAME_SET =
  'The second attached image is another prop from the SAME town map set (a round tree): match its outline thickness, its flat muted colors, its viewing angle and its flat shadow exactly, so all props look like one consistent set. Do NOT redraw that tree unless asked.';
/** 작은 소품의 구도: 지도에 아이콘처럼 작게 놓이므로 디테일은 더 적게, 선은 더 굵게. */
export const PROP_FRAMING =
  'This is a small decoration prop for the town map of a cozy tycoon / management game, seen in a 3/4 top-down view (the camera looks down at about 45 degrees: the front side is visible and a little of the top surface is visible). Light comes from the upper left. It will be placed small, like an icon, on a big map, so use EVEN FEWER details than usual and BOLD, thick outlines; simple chunky readable silhouette. Flat colors only, no shading, no gradient. A single flat darker shadow blob may sit under the object on the ground (one flat color, offset slightly toward the lower right), nothing else on the ground. One object only, centered, the whole object fully inside the frame with generous empty margin on all sides, nothing cropped. No text, no letters, no symbols.';

// ── 만들기 도우미 (원래 게임의 조립 순서 그대로) ────────────────────────────

/** 그룹 없는 항목 (아래 목록에서 그룹을 붙인다). */
export type Entry = Omit<ArtAsset, 'group'>;

const opt = <K extends string, V>(k: K, v: V | undefined): Partial<Record<K, V>> =>
  (v === undefined ? {} : { [k]: v }) as Partial<Record<K, V>>;

/** 기준 드워프의 새 자세 (1227x1282 같은 캔버스, 처리에서 키 높이로 크기를 맞춘다). */
export function pose(key: string, newPose: string, note?: string): Entry {
  return {
    key,
    size: '1227x1282',
    transparent: true,
    max: 900,
    refs: ['d_dwarf_idle'],
    ownStyle: true,
    ...opt('note', note),
    prompt: `${DWARF_SAME} New pose: ${newPose}`,
  };
}

/** 세트의 첫 캐릭터 (드워프만 참조). 이 그림이 나중에 세트의 두 번째 참조가 된다. */
export function leadCharacter(key: string, label: string, body: string, note?: string): Entry {
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: 400,
    label,
    refs: ['d_dwarf_idle'],
    ownStyle: true,
    ...opt('note', note),
    prompt: para(HERO_STYLE, HERO_REF_NOTE, HERO_COMMON, body),
  };
}

/**
 * 세트의 나머지 캐릭터: 1) 드워프 2) 세트 기준 캐릭터(lead, 기본 hero_vail).
 * 프롬프트 = 참조 안내 + 'A hero character for the game: ' + 생김새(일반이면 끝에 NORMAL_TAIL) + 공통 문단 + [특급 문단] + [extra].
 * extra = 다시 뽑을 때 '무엇이 틀렸나'를 고치는 끝 문단 (앞 문단은 바꾸지 않는다).
 */
export function character(
  key: string,
  label: string,
  rarity: 'special' | 'normal',
  look: string,
  more: { extra?: string; note?: string; lead?: string } = {},
): Entry {
  const lookPara = rarity === 'normal' ? `${look} ${NORMAL_TAIL}` : look;
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: 400,
    label,
    refs: ['d_dwarf_idle', more.lead ?? 'hero_vail'],
    ...opt('note', more.note),
    prompt: para(
      CHAR_REF,
      `A hero character for the game: ${lookPara}`,
      CHAR_COMMON,
      ...(rarity === 'special' ? [SPECIAL_ONE_IDEA] : []),
      ...(more.extra !== undefined ? [more.extra] : []),
    ),
  };
}

/** 귀여운 몬스터. sameAs(같은 종의 먼저 그린 변형)가 있으면 두 번째 참조로 받아 색과 표식만 바꾼다. tail은 생김새 끝 문장. */
export function monster(key: string, label: string, look: string, more: { sameAs?: string; tail?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 400,
    label,
    refs: more.sameAs !== undefined ? ['d_dwarf_idle', more.sameAs] : ['d_dwarf_idle'],
    ...opt('note', more.note),
    prompt: para(MON_REF_NOTE, MON_COMMON, ...(more.sameAs !== undefined ? [MON_SAME_SPECIES] : []), more.tail !== undefined ? `${look} ${more.tail}` : look),
  };
}

/** 종의 보스: 그 종의 귀여운 몬스터(species)를 두 번째 참조로. 원래 게임의 '층 보스'. */
export function speciesBoss(key: string, label: string, species: string, look: string, note?: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 560,
    label,
    refs: ['d_dwarf_idle', species],
    ...opt('note', note),
    prompt: para(MON_REF_NOTE, MON_COMMON, FLOOR_BOSS_NOTE, FLOOR_BOSS_FRAME, look),
  };
}

/** 화면을 크게 채우는 보스 (드워프만 참조). extra는 다시 뽑을 때 더한 끝 문단. 원래 게임의 '일일 보스'. */
export function screenBoss(key: string, label: string, look: string, more: { extra?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 560,
    label,
    refs: ['d_dwarf_idle'],
    ...opt('note', more.note),
    prompt: para(MON_REF_NOTE, MON_COMMON, DAILY_BOSS_FRAME, look, ...(more.extra !== undefined ? [more.extra] : [])),
  };
}

/**
 * 적다운 몬스터: base = 두 번째 참조. extra는 생김새 뒤에 한 칸 띄어 붙는다.
 * secondRef 'sameBody'(기본, 원래 게임): base가 같은 체형·속성의 귀여운 몬스터 (FOE_SAME_BODY).
 * secondRef 'style': base는 화풍·선·틀 안 크기의 기준일 뿐 (FOE_STYLE_REF, 키트에서 새로 쓴 문장).
 *   맞는 귀여운 몬스터가 없거나, 속성이 없는 게임이거나, 생김새의 색이 base와 다를 때 쓴다.
 */
export function foe(
  key: string,
  label: string,
  base: string,
  look: string,
  more: { extra?: string; note?: string; secondRef?: 'sameBody' | 'style' } = {},
): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 400,
    label,
    refs: ['d_dwarf_idle', base],
    ...opt('note', more.note),
    prompt: para(
      MON_REF_NOTE,
      FOE_COMMON,
      more.secondRef === 'style' ? FOE_STYLE_REF : FOE_SAME_BODY,
      `${look}${more.extra !== undefined ? ` ${more.extra}` : ''} Transparent background with a real alpha channel.`,
    ),
  };
}

/** 대형 보스: 새 생물. base = 선 굵기·채색만 따를 적다운 몬스터 (두 번째 참조, 디자인은 따르지 않는다). */
export function bigBoss(
  key: string,
  label: string,
  base: string,
  size: ArtSize,
  look: string,
  more: { extra?: string; note?: string } = {},
): Entry {
  return {
    key,
    size,
    transparent: true,
    max: 640,
    label,
    refs: ['d_dwarf_idle', base],
    ...opt('note', more.note),
    prompt: para(
      `${BIG_BOSS_INTRO}${look}${more.extra !== undefined ? ` ${more.extra}` : ''} Transparent background with a real alpha channel.`,
      BIG_BOSS_SCALE,
    ),
  };
}

/** 아이콘: 1024 정사각, 투명. lead = 따를 아이콘 (세트의 첫 아이콘이면 null: 드워프만). */
export function icon(key: string, label: string, lead: string | null, body: string, more: { max?: number; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: more.max ?? 96,
    label,
    refs: lead !== null ? ['d_dwarf_idle', lead] : ['d_dwarf_idle'],
    ...opt('note', more.note),
    prompt: para(...(lead !== null ? [ICON_SAME_SET] : []), ICON_FRAME, body),
  };
}

/** 아이템 아이콘 (철광석 ore_iron을 두 번째 참조로): 화면에서 32~48px. body 안에 ALPHA_MARGIN을 적는다. */
export function itemIcon(key: string, label: string, body: string, note?: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 160,
    label,
    refs: ['d_dwarf_idle', 'ore_iron'],
    prompt: `${SAME_ITEM_SET}\n\n${body}`,
    ...opt('note', note),
  };
}

/** 카드 일러스트: 정사각 불투명, 가장자리 2px 메움, 1.35:1로 넓혀 540x400. recolor는 배경색을 팔레트로 누를 때. */
export function card(key: string, label: string, refs: readonly string[], prompt: string, more: { recolor?: ArtProcess['recolor']; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: false,
    max: 540,
    refs,
    label,
    prompt,
    ...opt('note', more.note),
    process: { edge: 2, widen: 1.35, ...(more.recolor !== undefined ? { recolor: more.recolor } : {}) },
  };
}

/** 지도 건물 (대장간 bld_forge를 두 번째 참조로). body 뒤에 MAP_FRAME, 그 뒤에 다시 뽑으며 덧붙인 말(extra). */
export function building(key: string, label: string, body: string, more: { extra?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 720,
    label,
    refs: ['d_dwarf_idle', 'bld_forge'],
    ...opt('note', more.note),
    prompt: para(STYLE_REF_ONLY, BUILDING_SAME_SET, VIEW_TOPDOWN, `${body} ${MAP_FRAME}${more.extra !== undefined ? ` ${more.extra}` : ''}`),
  };
}

/** 지도에 작게 놓는 소품 (둥근 나무 prop_tree_round를 두 번째 참조로). extra = 다시 뽑으며 덧붙인 문단. */
export function prop(key: string, label: string, body: string, more: { extra?: string; note?: string; size?: ArtSize } = {}): Entry {
  return {
    key,
    size: more.size ?? '1024x1024',
    transparent: true,
    max: 320,
    label,
    refs: ['d_dwarf_idle', 'prop_tree_round'],
    ...opt('note', more.note),
    prompt: para(
      PROP_REF_ONLY,
      PROP_SAME_SET,
      PROP_FRAMING,
      `${body} Transparent background with a real alpha channel.`,
      ...(more.extra !== undefined ? [more.extra] : []),
    ),
  };
}

// ── 예제 (원래 게임에서 채택한 판의 프롬프트, 그룹마다 하나 이상) ─────────────────
// 그대로 뽑아 보며 화풍이 지금도 같은지 확인하는 데 쓴다 (README의 '시험 한 장'). 프롬프트를 본뜨는 본보기이기도 하다.
// 도구는 늘 예제와 프로젝트 파일의 그림을 함께 읽는다. 원본(<raw>/<그룹>/<key>.png)이 없는 예제는 process.ts가 건너뛴다.

const EXAMPLE_CHARACTERS: readonly Entry[] = [
  {
    key: 'dwarf_idle',
    size: '1227x1282',
    transparent: true,
    max: 900,
    copy: true,
    ownStyle: true,
    label: '화풍 기준 드워프 (ref/d_dwarf_idle.png 그 자체)',
    note: '참조 없이 글로만 뽑은 한 장이다 (화풍 후보 D). 네 후보(D~G) 가운데 사용자가 D를 골랐고 그대로 기준 그림이 됐다. 다시 뽑지 마라 (같은 그림이 나오지 않는다). 프롬프트는 기록으로 남긴다.',
    prompt:
      "Character design for a cozy comic mobile game: an old dwarf blacksmith (grey hair and a big grey beard with two small braids, cream shirt, brown leather apron, little boots, holding a forging hammer). Make him SILLY, HUMBLE and a bit pathetic-cute (the Korean 'hachanhan' meme vibe): tiny and stubby, very LOW detail, very simple shapes, few colors, comic deadpan expression. Full body, side view facing right, standing. Transparent background with a real alpha channel. No text. Style D: super simple flat doodle, about 2 heads tall, the beard is one big round blob covering most of the body, two dot eyes peeking above the beard, tiny stick-like arms and legs, uneven hand-drawn dark outline, flat colors with no shading at all. Looks like a cute doodle drawn in a minute.",
  },
  pose('dwarf_cheer', 'satisfied, the hammer resting on his shoulder, eyes closed as two happy upward arcs, a tiny blush, standing a bit proudly.', '첫 판 채택. 기준 그림의 새 자세 (같은 1227x1282 캔버스).'),
  leadCharacter(
    'hero_vail',
    '바일 (특급) 캐릭터 세트의 기준. 결과는 ref/hero_vail.png',
    'The hero: Vail, a young man, the first hero who ever came to the forge. Broad square shoulders and a sturdy build, chibi 2.4 heads tall. Short dark brown hair as one simple tufty blob. Blunt but honest: a straight flat serious mouth and steady dot eyes, slight frown. Rust-red tunic (#b5523b), brown belt, brown trousers, little brown boots. A small worn brown ledger book tucked into the front of his tunic, its top corner sticking out. One old burn scar shown as a simple pale pink patch on the back of his right hand. He holds a plain one-handed sword (simple grey blade, brown grip) pointing down at his side.',
    '둘째 판. 첫 판은 혼자 오른쪽을 보고 약 2.8등신에 머리카락 가닥이 많았다. 새 판은 왼쪽을 보고 약 2.3등신, 드워프처럼 덩어리 머리다.',
  ),
  character(
    'hero_milo',
    '밀로 (특급) 세트의 나머지 캐릭터 (참조: 드워프 + 바일)',
    'special',
    'A stocky, jolly middle-aged miller with a big bushy brown moustache (no beard), rosy cheeks and a dab of white flour on his nose, in a pale-green work shirt with rolled sleeves and a white apron dusted with flour. He holds a sturdy wooden crossbow at his side, and a small white flour sack is slung over his back.',
    {
      extra:
        'Important: keep him the same size in the frame as the second reference hero, with wide empty margins all around (he must NOT fill the frame). His head is about 40% of his height, NOT bigger. Keep the face as simple as the dwarf: two plain black dot eyes, NO eyebrows, NO tongue, NO open mouth; the bushy moustache is ONE simple flat brown blob shape under a small round nose with one small white flour dot on it, plus two small flat pink cheek circles. Flour on the apron is at most two small pale smudges. Hair is one simple brown blob with at most one inner line. The crossbow hangs low at his side pointing down toward the left: a plain straight wooden stock with a curved wooden bow limb across its front end and a clearly visible straight string between the limb tips (a clear T shape). The small white flour sack peeks over his shoulder from his back.',
      note: '둘째 판. 첫 판은 틀을 꽉 채우고 머리가 컸으며 눈썹·혀처럼 세부가 많았다. 고칠 말을 끝 문단(extra)으로 더했다.',
    },
  ),
];

const EXAMPLE_MONSTERS: readonly Entry[] = [
  monster(
    'mon_humanoid_fire',
    '불씨 고블린 (귀여운 몬스터의 색 변형, 기준: ref/mon_humanoid_water.png)',
    'A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin: soft red-orange (#e8875a). It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark: one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its pot helmet like a little tuft, no glow.',
    { sameAs: 'mon_humanoid_water', note: '첫 판 채택.' },
  ),
  foe(
    'foe_armored_earth',
    '톱니게 (적다운 몬스터, 귀여운 동글게의 적 버전. 위협 \'약간\')',
    'mon_armored_earth',
    'A small chubby round crab monster of the SAME species as the second image (wider than tall, a big dome-shaped shell like an upturned bowl, a plain cream rim #f6ebd5 along the bottom edge of the shell, two short eye stalks on top with dot eyes, three short stubby round legs on each side), but this one is a grumpy brawler: each eye on its stalk has a short heavy brow slanted down into a glare, a small down-turned scowl under the shell rim, and a row of four short blunt rocky bumps along the top of the shell. Shell: warm ochre brown (#c9995f). Its two claws are now real pincers, both the same medium size, opened wide, the inner edge of each pincer cut into a simple zigzag sawtooth, raised and snapping toward the left. It crouches low, sidling toward the left. Turned three-quarters toward the LEFT. Element mark: one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its shell, just behind its eye stalks.',
    {
      extra:
        'Make the menace clearly readable even at small size (it must look like an angry enemy, not our cute crab with a frown): its face is on the front cream rim and is clearly visible, NOT covered by any claw: a wide grumpy frown with two small pointed fangs poking up from the lower lip. The two eye stalks are short, thick, filled stalks standing straight UP from the top of the shell exactly like in the second image, with simple round eyeballs and dot pupils like the second image; each eyeball is topped by a thick heavy brow slanted down hard into a V glare. Both pincers are raised high and wide to the sides, ABOVE the shell and NOT in front of the body or face, both opened wide; the inner edge of each pincer is a neat regular zigzag of three small triangle teeth (a clean sawtooth, not broken or chipped looking). Along the top back of the shell, four short blunt rounded rock bumps in a row. Low wide crouch, body and face turned a little toward the LEFT. IMPORTANT outline weight: use the SAME very thick, bold dark brown outline as the second image, about twice as thick as a normal pen line, on every shape including the legs, stalks and pincers. Very few interior lines, flat fills, and about the same size and position in the frame as the second image.',
      note: '넷째 판 채택 (원래 게임 매니페스트 밖, 그때의 그림 프롬프트 글자 그대로). 앞 판들은 외곽선이 귀여운 동글게보다 가늘었고(외곽선 굵기를 픽셀로 쟀다), 집게가 얼굴을 가렸다.',
    },
  ),
  screenBoss(
    'daily_turtle',
    '연못 거북 (화면을 크게 채우는 보스, 드워프만 참조)',
    'A HUGE chubby old turtle boss, much wider than tall, standing on four short stumpy round legs, its round head stretched forward toward the LEFT with sleepy half-closed eyes and a calm tiny smile. Soft blue-grey skin (#a9c3cc). Its giant dome shell is soft sky blue (#8ec8ee) with only a few big simple plate lines, and the TOP of the shell is a tiny round pond: a flat pale-blue water oval (#d4ecf9) with one round moss-green lily pad (#8fae6b) and one very small green frog sitting on it. Two small water droplets fly off the edge of the shell. Calm, slow, harmless and a little silly. Turned three-quarters toward the LEFT.',
    { note: '첫 판 채택. 등딱지 줄이 조금 많고 외곽선이 드워프보다 조금 가늘다.' },
  ),
  bigBoss(
    'boss_twinhead_ogre',
    '트윈헤드 오우거 (대형 보스: 새 생물, 용사 키의 2~3배. 결과는 ref/boss_twinhead_ogre.png)',
    'foe_humanoid_earth',
    '1536x1024',
    'A two-headed ogre boss: one massive body with TWO heads side by side that look different (one head shouting with an open mouth, the other head grumpy and sleepy with a squint), huge shoulders, a big stone hammer in one hand and a chunk of chain in the other, patched hide clothes, dusty purple-grey skin. Wide and heavy.',
    {
      note: '첫 판 채택 (원래 게임 매니페스트 밖). 그때는 둘째 문단(BIG_BOSS_SCALE) 뒤에 크기·투명·저장 문장이 붙어 있었고, 지금은 gen.ts의 지시문이 그 일을 한다. 처리 크기(max)는 게임에 아직 넣지 않아 정하지 않았다 (예시 값).',
    },
  ),
];

const EXAMPLE_ICONS: readonly Entry[] = [
  icon(
    'element_fire',
    '불 속성 아이콘 (기준: ref/element_water.png)',
    'element_water',
    'Fire element icon: one chunky cartoon flame (a round full bottom rising into three soft rounded flame tips, the middle tip tallest), in one flat soft red-orange (#e8875a), with one smaller flat warm yellow (#f3d36a) inner flame inside it. Nothing else: no sparks, no embers, no glow. The same size and weight as the droplet in the second image.',
  ),
  icon(
    'ui_auto',
    '[자동] 단추 아이콘 (기준: ref/role_melee.png)',
    'role_melee',
    'Auto mode icon: two fat chunky curved arrows chasing each other around in a circle (a round "repeat" loop), each arrow a thick ribbon ending in a big rounded arrowhead, both in one flat warm orange (#f2a65a). The middle of the loop is empty. Nothing else.',
  ),
];

const EXAMPLE_UI: readonly Entry[] = [
  {
    key: 'frame_quality',
    size: '1024x1536',
    transparent: true,
    max: 640,
    label: '빈 카드 틀, 하늘색 테 (기준: ref/frame_progress.png와 같은 짜임에 색만)',
    refs: ['d_dwarf_idle', 'frame_progress'],
    prompt:
      'Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to soft sky blue. A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.',
  },
];

const EXAMPLE_OBJECTS: readonly Entry[] = [
  {
    key: 'anvil',
    size: '1024x1024',
    transparent: true,
    max: 600,
    label: '모루 (작은 사물: 그림을 작게 시켜 선을 굵게)',
    refs: ['d_dwarf_idle'],
    note: '둘째 판. 첫 판은 그루터기에 나뭇결을 그렸다.',
    prompt:
      "A chunky little grey anvil sitting on a short round wooden stump, side view, the horn pointing left, flat top. Cute proportions, very simple. Draw it with the SAME fat marker pen as the dwarf: the dark brown outline must be very thick and bold (about as thick as on the dwarf's beard and hammer), so draw the anvil fairly small and centered in the canvas, filling only about half of the image width, with lots of empty space around it. The stump is a plain flat brown cylinder with a flat lighter top ellipse, NO wood grain lines, NO rings; the anvil is a plain flat grey shape with no extra lines. Transparent background with a real alpha channel.",
  },
  {
    key: 'weapon_greatsword',
    size: '1024x1024',
    transparent: true,
    max: 640,
    label: '대검 (기준: ref/weapon_oneHandSword.png. 너비를 비율로 적었다)',
    refs: ['d_dwarf_idle', 'weapon_oneHandSword'],
    note: '둘째 판. 첫 판은 날이 가늘었다(날 너비를 비율로 적어 고쳤다). 그때 두 번째 참조의 이름은 @weapon_oneHandSword였다.',
    prompt:
      'A cute but big, heavy two-handed greatsword, diagonal from lower left to upper right, one tiny sparkle. Chunky and heavy: a VERY WIDE simple flat grey blade (the blade is about twice as wide as the blade of the attached one-handed sword, roughly one quarter as wide as it is long) with a blunt rounded-square tip, a wide flat yellow guard, a long thick brown two-hand grip with a round yellow pommel. Same cute toy-like style and same yellow and brown colors as the attached sword, and exactly the same fat dark brown outline thickness as the attached sword. Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.',
  },
  {
    key: 'bg_workshop',
    size: '1536x1024',
    transparent: false,
    max: 1400,
    label: '배경 (불투명 가로 그림: 캐릭터보다 조금 어둡고 차분하게, 가운데를 비운다)',
    refs: ['d_dwarf_idle'],
    note: '벽과 바닥의 경계가 그림 높이의 약 53%. 그 아래는 평평한 갈색 바닥이라 소품을 놓기 좋다.',
    prompt:
      'A cozy little dwarf smithy interior as a simple flat doodle, wide landscape: back wall of big simple stone blocks in muted warm grey-brown, two wooden beams, a few tools hanging on the wall (one hammer, one pair of tongs) as simple shapes, a small round window with a dark blue night sky and one tiny star on the upper left, a small shelf with two ingots on the right, the floor a flat warm brown. Calm, uncluttered, a little muted and darker than the characters so they pop in front. The lower middle of the floor is EMPTY (a character, an anvil and a furnace will be placed there). Opaque background, no characters.',
  },
];

const EXAMPLE_ITEMS: readonly Entry[] = [
  itemIcon(
    'gold_coins',
    '골드 아이콘 (기준: ref/ore_iron.png)',
    `A small pile of three round gold coins, flat yellow with a darker edge. Item icon, readable at 40px. ${ALPHA_MARGIN} Three thick round coins overlapping in a little heap, each a flat bright warm yellow face with a darker orange-gold rim ring and NO symbol on the face. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
];

const EXAMPLE_CARDS: readonly Entry[] = [
  card(
    'hammer',
    '두드리기 카드 (드워프가 나오는 장면, 참조: 드워프 + 망치 자세)',
    ['d_dwarf_idle', 'd_dwarf_strike'],
    `${CARD_DWARF_SCENE} whacking a glowing orange iron bar on a tiny anvil, a burst of simple spark marks. ${CARD_DWARF_KEEP} ${cardBackground(CARD_COLORS.orange)}`,
  ),
  card(
    'ironMelt',
    '쇳물 고르기 카드 (사물만, 배경을 버터색으로 누름)',
    ['d_dwarf_idle'],
    `Subject: a small ladle of glowing orange molten iron with a little bubble. Background: one flat soft warm yellow color. ${CARD_OPAQUE} ${CARD_OBJECTS_ONLY}`,
    { recolor: { to: '#F3DC8F' }, note: 'Codex가 레몬색(약 253,224,90)으로 칠한 배경을 처리에서 버터색 #F3DC8F로 누른다.' },
  ),
];

const EXAMPLE_MAP: readonly Entry[] = [
  building(
    'bld_shop',
    '상점 건물 (기준: ref/bld_forge.png)',
    'A small general goods and materials shop, same 3/4 top-down view and style as the second attached image: a cozy small wooden shop with a striped cloth awning, crates of ore and sacks out front, a hanging sign with a simple coin symbol (no letters).',
    {
      extra:
        'It must NOT look like the forge: no chimney and no smoke at all, no glowing doorway, no tools inside; instead a plain closed wooden shop door with a small window and a wide shop counter window under the awning. Give it a soft muted green roof so it reads as a different building at a glance.',
      note: '둘째 판. 첫 판은 굴뚝 연기, 대장간과 같은 지붕, 빛나는 문간과 연장 걸이라 대장간이 하나 더 있는 것처럼 보였다. 그때의 두 번째 참조는 첫 판 대장간이었다.',
    },
  ),
  prop('prop_lamp', '가로등 (작은 소품, 기준: ref/prop_tree_round.png)', 'One little street lamp post with a warm lit lantern on top, 3/4 top-down view.', {
    note: '지붕과 받침 오른쪽에 조금 어두운 면이 하나 있다 (작게 쓰면 보이지 않아 두었다).',
  }),
];

/**
 * 그룹 없는 항목들에 그룹을 붙인다. 프로젝트 파일에서:
 *   ...inGroup('icons', icon('element_light', ...), icon('element_dark', ...)),
 * 한 항목이면 { ...icon(...), group: 'icons' }로 적어도 같다.
 */
export function inGroup(group: ArtGroup, ...entries: readonly Entry[]): ArtAsset[] {
  return entries.map((e) => ({ ...e, group }));
}

/** 예제 에셋 (그룹 순서대로). 도구가 프로젝트 파일의 PROJECT_ASSETS와 합쳐 쓴다 (README의 '시험 한 장'이 이 예제를 뽑는다). */
export const EXAMPLE_ASSETS: readonly ArtAsset[] = [
  ...inGroup('characters', ...EXAMPLE_CHARACTERS),
  ...inGroup('monsters', ...EXAMPLE_MONSTERS),
  ...inGroup('objects', ...EXAMPLE_OBJECTS),
  ...inGroup('map', ...EXAMPLE_MAP),
  ...inGroup('ui', ...EXAMPLE_UI),
  ...inGroup('icons', ...EXAMPLE_ICONS),
  ...inGroup('items', ...EXAMPLE_ITEMS),
  ...inGroup('cards', ...EXAMPLE_CARDS),
];

// 새 프로젝트의 그림은 여기에 적지 않는다. 프로젝트 파일(node tools/init.ts가 만드는 art-assets.ts)의 PROJECT_ASSETS에 적는다.
// 세트를 시작할 때는 기준 그림 한 장을 드워프만 참조로 먼저 뽑고(leadCharacter, icon(..., null, ...)),
// 그 그림을 '@그룹/key'로 나머지의 두 번째 참조에 붙인다. 다시 뽑을 때는 note에 이유를 적는다.

/** '그룹/키'. */
export function assetId(a: Pick<ArtAsset, 'group' | 'key'>): string {
  return `${a.group}/${a.key}`;
}

export function parseSize(size: ArtSize): { w: number; h: number } {
  const [w, h] = size.split('x').map(Number);
  return { w: w ?? 0, h: h ?? 0 };
}
