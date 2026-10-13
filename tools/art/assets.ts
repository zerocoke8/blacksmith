// 아트 에셋 매니페스트. 그림의 원본은 이 파일이다.
// 그림을 다시 뽑을 때도, 게임에 넣을 때도 여기를 읽는다.
//   1. node tools/art/gen.ts <key> [--out <raw 폴더>]          Codex 이미지 생성으로 <raw>/<그룹>/<key>.png 를 뽑는다
//   2. node tools/art/process.ts --raw <raw 폴더> --only <key>   다듬어 src/assets/art/<그룹>/<key>.webp 와 meta.json 에 쓴다
// 프롬프트를 고쳤으면 그 키를 다시 뽑고 다시 처리한다.
//
// 화풍: '하찮은' 낙서풍 SD (D 화풍). 굵고 살짝 삐뚤한 짙은 갈색 외곽선, 평면 채색, 음영·그라데이션·광택 없음,
// 단순하고 둥근 모양. 모든 그림이 드워프 기준 그림(참조 d_dwarf_idle)의 선과 채색을 따른다.
// 프롬프트는 그림을 뽑을 때 실제로 쓴 마지막 판이다 (다시 뽑은 키는 note에 왜 다시 뽑았는지 적었다).
//
// 화풍을 맞추려고 참조 그림(refs)을 함께 보낸다. 첫 참조는 늘 화풍 기준인 d_dwarf_idle이다.
//   'name'  참조 폴더(gen.ts --ref)의 <name>.png. 무엇인지와 없을 때 대신 쓸 에셋은 REF_IMAGES에 있다.
//   '@key'  이 매니페스트의 다른 에셋(먼저 뽑아 둔 원본). '@그룹/key'로 그룹을 정할 수 있다.
//           예: 카드 틀 네 장은 @frame_progress를, 화로 상태 일곱 장은 @fire_normal을 따라 그린다.
//           자기 키를 적으면 고쳐 그리기다: 다시 뽑기 직전의 지금 원본을 보낸다 (마을 문, 마을 바닥).
//
// 최종 프롬프트 = 화풍 머리말(STYLE) + [UI·정제·아이콘이면 참조 안내(STYLE_REF_ONLY)] + [카드면 카드 구도(CARD_FRAMING)]
// + 에셋 프롬프트. buildPrompt가 붙인다. 드워프 자세(ownStyle)는 화풍을 프롬프트에 직접 적었다.
// 기록과 다른 점: UI 그림을 처음 뽑을 때는 참조 안내가 Codex 지시문 쪽에 "첨부 1은 화풍 참조일 뿐 …, 첨부 2는
// 그대로 따라 그릴 카드 틀 …"처럼 들어 있었다. 지금은 STYLE_REF_ONLY가 그림 프롬프트 안에 들어가고 gen.ts의
// 지시문은 참조 순서만 적으므로, gen.ts로 다시 뽑으면 낱말이 그때와 조금 다르다 (뜻은 같다). 드워프 6자세의
// 프롬프트는 그림 생성 기록에 없어 메인 세션이 보낸 codex 명령에서 옮겼다 (기록과 대조하지 못했다).
//
// 처리(process.ts)에서 키마다 더 하는 일은 process에 적는다: 카드 일러스트의 가장자리 메움(edge)과
// 양옆으로 넓히기(widen), 단색 배경 색 바꾸기(recolor), 다른 그림과 같은 자리에 맞추기(alignTo).
//
// 그룹 town(마을 지도)은 홈 화면의 마을 지도(src/render/town)가 쓴다 (아래 town 머리말).
// 그룹 heroes(용사 36명)는 용사 목록·전투가 쓸 그림이다. 지금은 앞의 예제 10명(TOWN_GUEST_HEROES)만 마을 지도의 걷는
// 손님으로 구워 쓴다 (아래 heroes 머리말). 용사 36명·몬스터 25종(monsters)·아이콘(icons: 속성·무기·역할·별)은 용사 목록과
// 전투 화면이 쓴다 (src/render/battle/assets.ts). 전투 동작 시트와 소리를 끼울 자리는 tools/art/README.md에 있다.

export const ART_GROUPS = ['scene', 'ui', 'cards', 'refine', 'town', 'heroes', 'monsters', 'icons'] as const;
export type ArtGroup = (typeof ART_GROUPS)[number];

/** 'WxH' (px). */
export type ArtSize = `${number}x${number}`;

/** 처리할 때 키마다 더 하는 일 (process.ts). */
export interface ArtProcess {
  /**
   * 불투명 그림의 가장자리 n px 띠를 바로 안쪽 픽셀로 메우고 그 띠를 불투명으로 한다.
   * Codex가 뽑은 카드는 가장자리 1px이 반투명(알파 193 안팎)이거나 한 줄 어둡다.
   */
  readonly edge?: number;
  /**
   * 단색 배경을 다른 색으로: 가장자리에 이어진 배경 영역(배경색과 색 거리 tol 안)과 그 안의 배경 조각만
   * 바꾸고, 외곽선과 맞닿은 경계 픽셀은 섞인 만큼만 바꾼다. 외곽선과 주제는 건드리지 않는다.
   * 원래 배경색은 가장자리 픽셀에서 읽는다.
   */
  readonly recolor?: { readonly to: string; readonly tol?: number };
  /**
   * 불투명 그림을 이 가로÷세로까지 양옆으로 넓힌다 (양옆 가장자리 열의 색으로 채운다). 정사각 카드 일러스트를
   * 카드 틀의 넓은 그림 창(약 1.6:1)에 넣을 때 위아래가 덜 잘리게 1.35:1로 넓힌다.
   */
  readonly widen?: number;
  /**
   * 같은 그룹의 다른 에셋과 같은 캔버스·같은 자리에 놓는다: 두 그림의 막대(알파>128에서 가장 넓은 줄)의
   * 길이를 맞추고 가운데·밑변을 맞춘 뒤, 그 에셋과 같은 사각형으로 잘라 같은 크기로 만든다.
   * 장면은 두 그림을 같은 자리·같은 배율로 바꿔 끼운다 (iron_hot ↔ iron_cracked).
   */
  readonly alignTo?: string;
  /**
   * 처리한 그림에서 기준점을 재서 meta.json의 anchors에 적는다 (그림 너비·높이에 대한 비율). 화면 쪽 숫자
   * (render/forge/layout.ts)는 손으로 적은 값이고, 테스트(layout.test.ts)가 이 실측과 맞는지 본다.
   *   bar    막대: 알파>128 픽셀이 가장 많은 줄의 70%를 넘는 줄들의 상자 (x0, x1, y0, y1)
   *   crack  갈라진 금: 붉은 금 픽셀의 가운데 x
   *   ring   둥근 계기: 안쪽 주황·노랑 불덩이의 가운데와 반지름 (cx, cy, r: r은 너비에 대한 비율)
   *   frame  카드 틀: 크림색 칸들 (비용 원 cost, 이름 띠 name, 그림 창 art, 종류 리본 ribbon, 글칸 text)
   */
  readonly measure?: readonly ('bar' | 'crack' | 'ring' | 'frame')[];
}

export interface ArtAsset {
  readonly key: string;
  /** 출력 폴더: src/assets/art/<group>/<key>.webp */
  readonly group: ArtGroup;
  /** 생성할 원본 크기. 이미 있는 원본(copy)은 실제 크기. */
  readonly size: ArtSize;
  /** 진짜 알파 채널이 있는 투명 배경. 처리할 때 투명 여백을 잘라 낸다. */
  readonly transparent: boolean;
  /** 처리 뒤 긴 변의 최대 길이(px). 투명 에셋은 여백을 잘라 낸 뒤의 크기에 맞춘다. */
  readonly max: number;
  /** 함께 보낼 참조 그림 (머리 주석 참고). */
  readonly refs?: readonly string[];
  /** 그릴 것. 화풍 머리말과 카드 구도는 buildPrompt가 붙인다. */
  readonly prompt: string;
  /** true면 prompt에 화풍이 들어 있어 buildPrompt가 머리말을 붙이지 않는다 (드워프 자세). */
  readonly ownStyle?: boolean;
  /** 카드 일러스트: 카드 이름과 성격 (사람이 보는 메모, 프롬프트에 들어가지 않는다). */
  readonly label?: string;
  /** true면 이미 있는 원본을 그대로 쓴다. gen.ts는 --force 없이 다시 뽑지 않는다. */
  readonly copy?: boolean;
  readonly note?: string;
  readonly process?: ArtProcess;
}

// ── 화풍 ────────────────────────────────────────────────────────────────

/** 모든 그림 앞에 붙는 화풍 머리말 (D 화풍). */
export const STYLE =
  'Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (cream, warm brown, soft grey, soft orange, a little muted). No text, no letters, no numbers, no watermark, no signature.';

/** 이전 화풍(v1, 페인터리). 지금은 쓰지 않는다. 옛 그림은 raw/<그룹>/<key>.painterly.png에 있다. */
export const STYLE_V1 =
  "Hand-painted 2D fantasy game art in the style of Slay the Spire: visible painterly brush strokes, bold readable silhouettes, slightly stylized chunky proportions, warm forge-lit palette (ember orange, soot brown, iron grey, parchment) with cool blue-grey shadows and soft orange rim light coming from the right. Mood: warm but quietly lonely, an old craftsman's workshop at dusk. No text, no letters, no numbers, no logos, no watermark, no signature, no UI, no border.";

/** UI 그림(틀, 버튼, 아이콘)은 드워프를 화풍 기준으로만 보내고 그리지 말라고 덧붙인다. */
export const STYLE_REF_ONLY =
  'The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only what is asked below.';

/** 카드 일러스트 구도. 화풍 머리말 다음, 카드별 장면 앞에 붙는다. */
export const CARD_FRAMING =
  'Card illustration, square composition: one clear subject in the center with breathing room (it will be cropped to a 4:3 window, so keep everything important inside the central area), a single flat warm background color block (no scenery detail). Funny and charming.';

/**
 * 카드 일러스트의 원본 크기·처리 크기. 투명 아님. Codex는 정사각을 1024 또는 1254로 낸다.
 * 처리에서 1.35:1로 넓혀(CARD_WIDEN) 긴 변을 CARD_MAX에 맞춘다 (540×400). 틀의 그림 창(약 1.6:1)이 위아래를
 * 8%씩만 자른다.
 */
export const CARD_SIZE: ArtSize = '1024x1024';
export const CARD_MAX = 540;
export const CARD_WIDEN = 1.35;

export function buildPrompt(a: ArtAsset): string {
  if (a.ownStyle === true) return a.prompt;
  if (a.group === 'cards') return `${STYLE}\n\n${CARD_FRAMING}\n\n${a.prompt}`;
  if (a.group === 'ui' || a.group === 'refine' || a.group === 'icons') return `${STYLE}\n\n${STYLE_REF_ONLY}\n\n${a.prompt}`;
  return `${STYLE}\n\n${a.prompt}`;
}

// ── 참조 그림 ───────────────────────────────────────────────────────────

export interface RefImage {
  /** 참조 폴더 안의 파일 이름. */
  readonly file: string;
  /** 참조 폴더에 없을 때 대신 보낼 에셋 ('그룹/키'). 그 에셋의 원본 PNG, 없으면 처리된 WebP를 쓴다. */
  readonly fallback: string;
  readonly note: string;
}

export const REF_IMAGES: Readonly<Record<string, RefImage>> = {
  d_dwarf_idle: {
    file: 'd_dwarf_idle.png',
    fallback: 'scene/dwarf_idle',
    note: '화풍 기준: D 화풍으로 고른 드워프 (scene/dwarf_idle 원본과 같다). 모든 그림이 이 선 굵기·평면 채색·디자인을 따른다.',
  },
  d_dwarf_strike: {
    file: 'd_dwarf_strike.png',
    fallback: 'scene/dwarf_strike',
    note: '망치를 내려치는 드워프 (scene/dwarf_strike 원본과 같다). 망치를 든 카드 장면의 두 번째 참조.',
  },
  d_dwarf_work: {
    file: 'd_dwarf_work.png',
    fallback: 'scene/dwarf_work',
    note: '숫돌질하는 드워프 (scene/dwarf_work 원본과 같다). 손으로 하는 카드 장면의 두 번째 참조.',
  },
};

// ── scene: 공방 배경, 드워프, 소품, 완성 무기 ─────────────────────────────

type Entry = Omit<ArtAsset, 'group'>;

/** 드워프 자세 다섯 장이 같이 쓰는 앞말 (d_dwarf_idle을 참조로 보낸다). */
const DWARF_SAME =
  'The attached image is our dwarf blacksmith in the final art style. Draw the SAME character in EXACTLY the same style: super simple flat doodle, the grey beard is one big round blob with two tiny braids, grey hair blob, two dot eyes, small nose, tiny stick-like arms and legs, little brown boots, brown apron, cream shirt, uneven hand-drawn dark outline, flat colors, NO shading, NO extra detail. Same size and proportions (about 2 heads tall), side view facing right. Transparent background with a real alpha channel. No text.';

function dwarfPose(key: string, pose: string, note?: string): Entry {
  return {
    key,
    size: '1227x1282',
    transparent: true,
    max: 900,
    refs: ['d_dwarf_idle'],
    ownStyle: true,
    ...(note !== undefined ? { note } : {}),
    prompt: `${DWARF_SAME} New pose: ${pose}`,
  };
}

const SCENE: readonly Entry[] = [
  {
    key: 'dwarf_idle',
    size: '1227x1282',
    transparent: true,
    max: 900,
    copy: true,
    ownStyle: true,
    note: '화풍 기준 그림(참조 d_dwarf_idle과 같다). 네 화풍 후보(D~G) 가운데 사용자가 D를 골랐다. 다시 뽑지 마라.',
    prompt:
      "Character design for a cozy comic mobile game: an old dwarf blacksmith (grey hair and a big grey beard with two small braids, cream shirt, brown leather apron, little boots, holding a forging hammer). Make him SILLY, HUMBLE and a bit pathetic-cute (the Korean 'hachanhan' meme vibe): tiny and stubby, very LOW detail, very simple shapes, few colors, comic deadpan expression. Full body, side view facing right, standing. Transparent background with a real alpha channel. No text. Style D: super simple flat doodle, about 2 heads tall, the beard is one big round blob covering most of the body, two dot eyes peeking above the beard, tiny stick-like arms and legs, uneven hand-drawn dark outline, flat colors with no shading at all. Looks like a cute doodle drawn in a minute.",
  },
  dwarfPose('dwarf_raise', 'both tiny arms holding the hammer raised high above his head, ready to strike down in front of him, beard blob bouncing up a little.'),
  dwarfPose(
    'dwarf_strike',
    'the moment right after a hammer blow, both tiny arms holding the hammer brought down in front of him at belly height (the hammer head is in front of the beard, as if it just hit an anvil top, do not draw the anvil), body leaning forward, eyes squeezed shut as two short lines.',
  ),
  dwarfPose('dwarf_work', 'leaning forward with focus, a small grey whetstone in his tiny hands held out in front of him, polishing something (do not draw the object), tongue sticking out a little in concentration.'),
  dwarfPose('dwarf_cheer', 'satisfied, the hammer resting on his shoulder, eyes closed as two happy upward arcs, a tiny blush, standing a bit proudly.', '완성 연출.'),
  dwarfPose(
    'dwarf_slump',
    'disappointed, shoulders drooped, head hanging down, the hammer dragging on the floor from one hand, a small sigh puff near his face.',
    '실패 연출: 쇠가 갈라졌을 때, 망치를 내려놓았을 때.',
  ),
  {
    key: 'bg_workshop',
    size: '1536x1024',
    transparent: false,
    max: 1400,
    refs: ['d_dwarf_idle'],
    note: '벽과 바닥의 경계가 그림 높이의 약 53%(1024px 원본에서 y≈545). 그 아래는 평평한 갈색 바닥이라 소품을 놓기 좋다.',
    prompt:
      'A cozy little dwarf smithy interior as a simple flat doodle, wide landscape: back wall of big simple stone blocks in muted warm grey-brown, two wooden beams, a few tools hanging on the wall (one hammer, one pair of tongs) as simple shapes, a small round window with a dark blue night sky and one tiny star on the upper left, a small shelf with two ingots on the right, the floor a flat warm brown. Calm, uncluttered, a little muted and darker than the characters so they pop in front. The lower middle of the floor is EMPTY (a character, an anvil and a furnace will be placed there). Opaque background, no characters.',
  },
  {
    key: 'anvil',
    size: '1024x1024',
    transparent: true,
    max: 600,
    refs: ['d_dwarf_idle'],
    note: '둘째 판. 첫 판은 그루터기에 나뭇결을 그렸다.',
    prompt:
      "A chunky little grey anvil sitting on a short round wooden stump, side view, the horn pointing left, flat top. Cute proportions, very simple. Draw it with the SAME fat marker pen as the dwarf: the dark brown outline must be very thick and bold (about as thick as on the dwarf's beard and hammer), so draw the anvil fairly small and centered in the canvas, filling only about half of the image width, with lots of empty space around it. The stump is a plain flat brown cylinder with a flat lighter top ellipse, NO wood grain lines, NO rings; the anvil is a plain flat grey shape with no extra lines. Transparent background with a real alpha channel.",
  },
  {
    key: 'furnace',
    size: '1024x1536',
    transparent: true,
    max: 800,
    refs: ['d_dwarf_idle', '@anvil'],
    prompt:
      'A small round stone forge furnace with a short chimney, front three-quarter view, an arched mouth with simple flat orange and yellow flames inside, a few stone blocks drawn as simple rounded shapes. Cute and chunky. It belongs in the same scene as the attached dwarf and the attached anvil, so draw it with the SAME fat dark brown marker outline as them (very thick and bold) and the same flat fills: only about 8 to 10 big rounded stones in total, no cracks, no soot, no texture, no glow, no light on the stones; the flames are two or three flat cartoon flame shapes. Keep the furnace centered with empty space around it, filling about two thirds of the image height. Transparent background with a real alpha channel.',
  },
  {
    key: 'bellows',
    size: '1024x1024',
    transparent: true,
    max: 450,
    refs: ['d_dwarf_idle', '@anvil'],
    note: '둘째 판. 첫 판은 외곽선이 드워프보다 얇았다.',
    prompt:
      "A small chunky round brown leather bellows on a tiny wooden stand, lying horizontally, the nozzle pointing right, simple shapes. Only two simple fold lines on the leather, no stitches, no studs. It belongs in the same scene as the attached dwarf and the attached anvil. Copy the outline of the attached anvil image exactly: a VERY fat, bold dark brown marker line, roughly 3 percent of the object's width, just as heavy as on the anvil. Plain flat fills, no extra lines, no texture lines. Center it with empty margin around it, filling about 60 percent of the image width. Transparent background with a real alpha channel.",
  },
  {
    key: 'quench',
    size: '1024x1024',
    transparent: true,
    max: 450,
    refs: ['d_dwarf_idle', '@anvil'],
    prompt:
      "A small wooden bucket with two iron bands, filled with flat blue water, a pair of tongs leaning on its rim. Side view, simple. The bucket is a plain flat brown shape with no plank lines (or at most two), the water is one flat blue ellipse with no ripples, the tongs are one simple dark grey shape. It belongs in the same scene as the attached dwarf and the attached anvil. Copy the outline of the attached anvil image exactly: a VERY fat, bold dark brown marker line, roughly 3 percent of the object's width, just as heavy as on the anvil. Plain flat fills, no extra lines, no texture lines. Center it with empty margin around it, filling about 60 percent of the image width. Transparent background with a real alpha channel.",
  },
  {
    key: 'iron_hot',
    process: { measure: ['bar'] },
    size: '1536x1024',
    transparent: true,
    max: 420,
    refs: ['d_dwarf_idle', '@anvil'],
    prompt:
      "A small rectangular bar of glowing hot iron lying horizontally, side view, flat orange-yellow fill with a lighter yellow center stripe, two or three tiny sparkle marks around it. The bar is a simple rounded rectangle, the sparkles are tiny simple four-point stars or dashes with the same outline. Nothing else. It belongs in the same scene as the attached dwarf and the attached anvil. Copy the outline of the attached anvil image exactly: a VERY fat, bold dark brown marker line, roughly 3 percent of the object's width, just as heavy as on the anvil. Plain flat fills, no extra lines, no texture lines. Center it with empty margin around it, filling about 60 percent of the image width. Transparent background with a real alpha channel.",
  },
  {
    key: 'iron_cracked',
    size: '1536x1024',
    transparent: true,
    max: 420,
    refs: ['d_dwarf_idle', '@iron_hot'],
    process: { alignTo: 'iron_hot', measure: ['bar', 'crack'] },
    note: 'iron_hot과 짝이 되게 iron_hot을 참조로 다시 그렸다. 처리할 때 막대를 iron_hot에 맞춰 같은 캔버스에 놓는다(process.alignTo).',
    prompt:
      'The SAME small iron bar as in the second attached image (same long rounded-rectangle shape, same length and thickness, same position in the frame, and EXACTLY the same very fat dark brown marker outline as that bar), but gone cold: one flat dark grey fill, no stripe, no sparkles. One jagged zigzag crack across its middle drawn as a fat dark brown zigzag line with a thin muted dull red line inside it. One tiny simple grey smoke puff (a small round cloud with the same fat outline) just above the crack. Nothing else, no shading, no texture.',
  },
  {
    key: 'iron_cold',
    size: '1536x1024',
    transparent: true,
    max: 420,
    refs: ['d_dwarf_idle', '@iron_hot', '@iron_cracked'],
    process: { alignTo: 'iron_hot', measure: ['bar'] },
    note: '망치를 내려놓았을 때(그만둠)의 식은 쇠. 갈라지지 않고 반짝이도 없다. 결과 화면과 장면이 iron_hot을 회색으로 칠하던 것(반짝이·밝은 띠가 남았다)을 바꾼다. 처리할 때 막대를 iron_hot에 맞춘다.',
    prompt:
      'The SAME small iron bar as in the second attached image (same long rounded-rectangle shape, same length and thickness, same position in the frame, and EXACTLY the same very fat dark brown marker outline as that bar), but gone cold and left whole: one flat soft grey fill, the same grey as the cold bar in the third attached image, no stripe, no crack, no sparkles, no shine, no highlight. One tiny thin wisp of steam (a small round puff with the same fat outline) rising just above its right end. Nothing else, no shading, no texture.',
  },
  {
    key: 'weapon_oneHandSword',
    size: '1024x1024',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@anvil'],
    prompt:
      'A cute chunky one-handed sword, diagonal from lower left to upper right, simple grey blade, brown grip, small yellow guard, one tiny sparkle on the blade. A short, stubby, slightly wide blade with a rounded tip, cute toy-like proportions. Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_greatsword',
    size: '1024x1024',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@weapon_oneHandSword'],
    note: '둘째 판. 첫 판은 날이 가늘었다(날 너비를 비율로 적어 고쳤다).',
    prompt:
      'A cute but big, heavy two-handed greatsword, diagonal from lower left to upper right, one tiny sparkle. Chunky and heavy: a VERY WIDE simple flat grey blade (the blade is about twice as wide as the blade of the attached one-handed sword, roughly one quarter as wide as it is long) with a blunt rounded-square tip, a wide flat yellow guard, a long thick brown two-hand grip with a round yellow pommel. Same cute toy-like style and same yellow and brown colors as the attached sword, and exactly the same fat dark brown outline thickness as the attached sword. Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_dagger',
    size: '1024x1024',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@weapon_oneHandSword'],
    prompt:
      'A cute small dagger, diagonal from lower left to upper right, short grey blade, wrapped brown grip, tiny guard, one tiny sparkle. It must clearly read as a small knife compared with the attached one-handed sword: a short leaf-shaped pointed blade about as long as the grip, a tiny yellow guard, a brown grip with two or three simple wrap lines, a small round yellow pommel. Same cute toy-like style, same colors and exactly the same fat dark brown outline thickness as the attached sword. Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_bow',
    size: '1024x1024',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@weapon_oneHandSword'],
    note: '셋째 판. 앞 판들은 활대가 가늘었다.',
    prompt:
      'A cute chunky toy-like bow, diagonal, one tiny sparkle. The bow arc runs from the lower left to the upper right and curves toward the upper left. The two limbs are FAT rounded brown wooden shapes, about as wide as the brown grip of the attached sword (never thin sticks), with small rounded grey tips and a cream wrapped grip in the middle. The string is one straight dark brown line between the two tips. No arrow. The sparkle is a tiny simple four-point star. Same cute toy-like style, colors and exactly the same VERY fat, bold dark brown marker outline as the attached sword (second image), plain flat fills, no shading, no wood grain, no extra lines. Keep the whole bow inside the frame with empty margin around it, filling about 70 percent of the image.',
  },
  {
    key: 'weapon_crossbow',
    size: '1024x1024',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@weapon_oneHandSword'],
    prompt:
      'A cute simple crossbow, brown wooden stock and a grey bow arm, a loaded bolt, pointing to the upper right, one tiny sparkle. Seen from above at a diagonal: a chunky straight brown stock from the lower left to the upper right, a short thick grey bow arm crossing it near the front end, a straight thin string, one short bolt with a grey head lying on the stock. Very few parts, no trigger details, no screws. Same cute toy-like style, colors and exactly the same fat dark brown outline thickness as the attached sword. Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_staff',
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@weapon_oneHandSword'],
    note: '둘째 판. 첫 판은 자루가 가늘고 울퉁불퉁했다.',
    prompt:
      'A cute chunky toy-like mage staff, diagonal from the lower left to the upper right, one tiny sparkle. The shaft is FAT and short-ish, a plain brown rounded stick about as wide as the brown grip of the attached sword (never thin), with two simple grey rings; the head is one simple chunky curled wooden hook holding one round flat orange orb (one flat orange, no glow). The sparkle is a tiny simple four-point star. Same cute toy-like style, colors and exactly the same VERY fat, bold dark brown marker outline as the attached sword (second image), plain flat fills, no shading, no wood grain, no extra lines. Keep the whole staff inside the frame with empty margin around it, filling about 70 percent of the image height.',
  },
];

// ── ui: 카드 틀, 카드 뒷면, 게이지, 버튼, 더미, 화로 상태, 작은 아이콘 ─────────

const UI: readonly Entry[] = [
  {
    key: 'frame_progress',
    process: { measure: ['frame'] },
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle'],
    note: '틀 다섯 장의 기준. 칸 위치를 layout.ts CARD_FACE에 가깝게 맞추려고 대략의 비율을 프롬프트에 적었다.',
    prompt:
      'A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel. Border color: warm orange-red. The card fills almost the whole canvas with only a thin transparent margin. Rough proportions (fractions of the card): the cost bubble is centred about 12% from the left and 8% from the top, overlapping the corner; the name banner runs from about 23% to 89% of the width near the top (about 6% to 12% of the height); the art window spans about 12% to 89% of the width and 16% to 53% of the height; the ribbon tab is centred just under it (about 54% to 59% of the height, about half the card width); the text area spans about 10% to 91% of the width and 61% to 92% of the height. Every inner part has its own thick dark brown outline.',
  },
  {
    key: 'frame_quality',
    process: { measure: ['frame'] },
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@frame_progress'],
    prompt:
      'Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to soft sky blue. A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'frame_support',
    process: { measure: ['frame'] },
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@frame_progress'],
    prompt:
      'Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to mint green. A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'frame_material',
    process: { measure: ['frame'] },
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@frame_progress'],
    prompt:
      'Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to golden yellow. A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'frame_imprint',
    process: { measure: ['frame'] },
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['d_dwarf_idle', '@frame_progress'],
    prompt:
      'Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to soft lavender purple. A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'card_back',
    size: '1024x1536',
    transparent: true,
    max: 400,
    refs: ['d_dwarf_idle'],
    prompt:
      'The back of a cute doodle card, portrait 2:3, flat: a brown rounded rectangle with a thick outline and a simple cream hammer-over-anvil emblem in the middle, a few dots around it. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'orb_durability',
    process: { measure: ['ring'] },
    size: '1024x1024',
    transparent: true,
    max: 280,
    refs: ['d_dwarf_idle'],
    prompt:
      'A round doodle game gauge seen from the front: a thick grey iron ring with four rivet dots, holding a flat orange molten center with a lighter yellow middle, plain enough for a number to be drawn over it. Transparent background with a real alpha channel.',
  },
  {
    key: 'btn_reheat',
    size: '1536x1024',
    transparent: true,
    max: 420,
    refs: ['d_dwarf_idle', '@orb_durability'],
    note: '셋째 판. 첫 판은 짙은 숯색에 외곽선이 흐린 번짐이었고(검토: 외곽선이 묻혀 덩어리로 읽힌다), 둘째 판도 외곽선 없이 번졌다. 외곽선을 또렷한 선으로, 채움을 계기의 쇠고리 회색으로 적어 다시 뽑았다.',
    prompt:
      "A wide rounded doodle game button plate seen from the front, a long pill shape about four times as wide as it is tall. IMPORTANT: the whole plate is surrounded by one VERY fat, solid, crisp dark brown marker line (the same dark brown and the same heavy weight as the outline of the iron ring in the second attached image), drawn right on the plate's edge, a clean hard line with no glow, no blur, no soft halo and no shadow outside it. Inside the line: one flat warm light grey fill, the same grey as the iron ring in the second attached image. Two little orange flame marks with the same fat outline sit just inside the left and right ends. A blank flat center for a label. Plain flat fills, no shading, no rivets, no texture. Transparent background with a real alpha channel.",
  },
  {
    key: 'pile_draw',
    size: '1024x1024',
    transparent: true,
    max: 180,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle icon: a small neat stack of three brown cards, slightly tilted, readable at small size. Transparent background with a real alpha channel.',
  },
  {
    key: 'pile_discard',
    size: '1024x1024',
    transparent: true,
    max: 180,
    refs: ['d_dwarf_idle', '@pile_draw'],
    note: '둘째 판. 첫 판은 재 더미에 잔점이 많고(질감) 외곽선이 얇았다.',
    prompt:
      'A doodle game icon (discard pile): a small rounded mound of ash drawn as ONE simple flat mid-grey blob (no specks, no dots, no pebbles, no texture, no inner lines), with one torn cream card corner sticking up out of it and one small flat orange ember on its side. Chunky and compact, about as tall as it is wide, centered, filling about 60 percent of the canvas so it reads at 40 pixels. Use the second attached image (a card-stack icon of the same icon set) for size, framing and outline: the SAME very fat dark brown marker outline on every shape, as heavy as on the dwarf.',
  },
  {
    key: 'pile_exhaust',
    size: '1024x1024',
    transparent: true,
    max: 180,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle icon: a single curly puff of pale grey smoke over a small black coal, readable at small size. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_normal',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle status icon: one simple orange flame with a tiny calm face (two dot eyes), centered, readable at 48 pixels. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_good',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a bright yellow-orange flame with a happy smiling face and two little sparkle marks. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_excellent',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a big bright golden-white flame with a beaming face (closed happy eyes) and a simple star burst behind it. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_poor',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a small droopy pale blue-grey flame with a sad sleepy face, a little ash under it. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_sturdy',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a stubborn orange flame with a determined face, sitting inside a thick grey stone ring. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_surge',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a tall wild red flame with an excited shouting face, leaping up. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_malleable',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    note: '둘째 판. 첫 판은 fire_normal과 거의 같은 주황이라 48px에서 구별이 약했다.',
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a soft wobbly melty flame in a clearly PINK color (soft rose pink, NOT orange, so it looks different from the orange flame) with a relaxed smiling face (closed happy eyes), drooping and dripping like honey with a few round drips at its base. Keep it simple, very few details. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_goodOmen',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['d_dwarf_idle', '@fire_normal'],
    prompt:
      'Same icon style, size and framing as the second attached flame icon: a small calm flame with a curious face looking up at a tiny yellow star floating above it. Transparent background with a real alpha channel.',
  },
  {
    key: 'icon_heat',
    size: '1024x1024',
    transparent: true,
    max: 110,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle icon: one small red-orange glowing coal with a tiny face (dot eyes) and two little wavy heat lines above. Readable at 32 pixels. Transparent background with a real alpha channel.',
  },
  {
    key: 'icon_progress',
    size: '1024x1024',
    transparent: true,
    max: 110,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle icon: a small hammer tilted as if striking, with three short spark lines. Readable at 32 pixels. Transparent background with a real alpha channel.',
  },
  {
    key: 'icon_quality',
    size: '1024x1024',
    transparent: true,
    max: 110,
    refs: ['d_dwarf_idle'],
    prompt:
      'A doodle icon: a simple faceted gem in soft blue with one small star glint. Readable at 32 pixels. Transparent background with a real alpha channel.',
  },
];

// ── cards: 카드 일러스트 ─────────────────────────────────────────────────
// 키는 sim의 카드 id와 같다. 프롬프트 = STYLE + CARD_FRAMING + 장면. 배경은 종류마다 평면 한 색:
// 공정 주황(#F2B279), 품질 하늘(#BFDDEB), 보조 민트(#CBE6C1), 각인 라벤더(#D8CBEA), 재료 노랑(처리에서
// 버터색 #F3DC8F로), 전설 재료 금색에 보라 원(처리에서 #E9C46A로). 처리에서 바꾸는
// 색(recolor)은 Codex가 덱의 파스텔보다 쨍하게 칠한 배경을 맞춘 것이다.

/** 전설 재료 카드의 진한 금색 배경(약 253,197,4)을 덱의 파스텔에 맞춘다. */
const LEGEND: ArtProcess['recolor'] = { to: '#E9C46A' };
/** 재료 카드의 레몬색(약 253,224,90)을 한 톤 눌러, 전설 금색보다 옅은 버터색으로. */
const MATERIAL: ArtProcess['recolor'] = { to: '#F3DC8F' };

/** 카드 일러스트 하나: 키, 카드 이름·성격(메모), 참조, 장면. 가장자리는 늘 메우고 1.35:1로 넓힌다. */
function card(key: string, label: string, refs: readonly string[], prompt: string, more: { recolor?: ArtProcess['recolor']; note?: string } = {}): Entry {
  return {
    key,
    size: CARD_SIZE,
    transparent: false,
    max: CARD_MAX,
    refs,
    label,
    prompt,
    ...(more.note !== undefined ? { note: more.note } : {}),
    process: { edge: 2, widen: CARD_WIDEN, ...(more.recolor !== undefined ? { recolor: more.recolor } : {}) },
  };
}

/** 기본 카드와 해금 카드. */
const CARDS_A: readonly Entry[] = [
  card('hammer', '두드리기 (기본, 공정 카드)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) whacking a glowing orange iron bar on a tiny anvil, a burst of simple spark marks. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.'),
  card('polish', '다듬기 (기본, 품질 카드)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) rubbing a whetstone along a blade, a small shine mark on the edge. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a pale soft sky blue (like #BFDDEB), edge to edge, no pattern, no frame, no border.'),
  card('precisePolish', '정밀 다듬기 (기본, 품질 카드)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) squinting through a big round magnifying glass at the tip of a blade, holding a tiny file. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a pale soft sky blue (like #BFDDEB), edge to edge, no pattern, no frame, no border.'),
  card('bellows', '풀무질 (기본, 보조: 열기)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) squashing a bellows with both arms, a puff of wind making the forge flames jump up. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('quench', '담금질 (기본, 보조)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) dunking a hot blade into a bucket of water, a huge comic cloud of steam. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('finisher', '마무리 (기본, 품질: 열기를 써서 마무리)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) holding up a finished shiny sword proudly, sparkle marks around the blade. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a pale soft sky blue (like #BFDDEB), edge to edge, no pattern, no frame, no border.'),
  card('thrift', '아껴 치기 (해금, 보조: 다음 카드 비용을 줄임)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene (card "thrifty tapping"): the little dwarf blacksmith from the attached images standing at a small anvil, holding his hammer daintily with only two fingers and giving the glowing orange iron bar on the anvil a very gentle little tap, ONE single small spark; his eyes narrowed into a stingy, careful squint, and a small round brown coin pouch tied to his apron. The anvil and the glowing bar are clearly visible and not tiny. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), the same three-quarter view facing right, small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.',
    { note: '둘째 판. 첫 판은 망치와 쇠가 너무 작아 카드 크기에서 동작이 안 읽혔다.' }),
  card('carefulHammer', '신중한 두드리기 (해금, 공정)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) aiming a hammer carefully at a small chalk X mark on glowing iron, tongue out. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.'),
  card('firstHammer', '첫 망치 (해금, 공정, 첫 손)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) giving the first hammer blow of the day, a little rising sun peeking through a window behind. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.'),
  card('keepForging', '단조 유지 (해금, 보조: 내구도 회복)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) putting the iron back into the forge flames with tongs, patiently. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('thickAnvil', '두꺼운 모루판 (해금, 각인: 영구 효과)', ['d_dwarf_idle', '@cards/hammer'],
    "Scene: a comically extra-thick, squat, chubby cartoon anvil, its body twice as tall and fat as a normal anvil (like a fat heavy block with a short rounded horn), sitting heavily with two tiny 'thud' marks at its base, sturdy and proud, with a simple glowing purple rune drawn on its side. Draw it in the same way as the small anvil in the second attached image: rounded soft corners, ONE single flat dark grey fill for the whole anvil (no lighter top face, no two-tone planes, no shading), and outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines. The rune is just a few simple flat purple strokes. Keep the anvil compact, about 60% of the canvas width, centered. No character in this card. Background: the whole canvas is one single flat solid color, a soft pale lavender (like #D8CBEA), edge to edge, no pattern, no frame, no border."),
  card('heatUp', '달구기 (해금, 보조: 열기)', ['d_dwarf_idle', '@cards/keepForging'],
    "Scene: a long thin rectangular iron bar (clearly a blacksmith's metal bar, long and straight, poking out diagonally) resting in a small pile of glowing coals; the half of the bar inside the coals is bright orange-hot, the other half is grey; the coals are a few round dark-red and orange lumps with two or three small simple flame tips between them; three simple wavy heat lines rising. No character in this card. Draw it with outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, chunky rounded shapes, ONE flat fill per shape (no shading, no two-tone planes, no glow gradients), like the fire and iron in the second attached image. Keep it compact, about 65% of the canvas width, centered. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border."),
  card('bigStrike', '크게 내려치기 (해금, 공정)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) swinging a comically huge sledgehammer down, a big circular whoosh line and sparks. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.'),
  card('trainedArm', '단련된 팔 (해금, 각인)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) flexing one tiny arm proudly, a small purple rune glowing on his bracer. Draw him EXACTLY like the first attached image, do not redesign him: the same three-quarter view facing right, the same smooth grey hair blob, the same two tiny dot eyes, the same big round nose, the same huge round smooth grey beard covering his body with two little braided tips, cream short-sleeve shirt, brown apron, little brown boots. He bends one tiny arm up to flex a small bicep; on that forearm a plain brown wristband with a simple purple diamond rune (a diamond with a dot in the middle, never a letter or number) and three tiny glow strokes. Small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale lavender (like #D8CBEA), edge to edge, no pattern, no frame, no border.',
    { note: '보라 룬이 카드 크기에서 작다.' }),
  card('lastStroke', '최후의 한 수 (해금, 공정, 간직)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) with a sweat drop giving one last decisive hammer blow, one big star-shaped spark. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.'),
  card('firstTouch', '첫 손질 (해금, 품질, 첫 손)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) gently poking the edge of a fresh blade with one finger, a tiny shine mark. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a pale soft sky blue (like #BFDDEB), edge to edge, no pattern, no frame, no border.'),
  card('allIn', '혼신 (해금, 보조: 다음 카드 강화)', ['d_dwarf_idle', 'd_dwarf_strike'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) gripping a hammer with all his strength, a comic flame aura around him, determined face. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('kindle', '불씨 살리기 (해금, 보조)', ['d_dwarf_idle', 'd_dwarf_work'],
    "Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) with puffed cheeks blowing on a tiny ember to bring it back to life. His cheeks are comically puffed up round like balloons and his mouth is a tiny round 'o' circle (not a '3' shape); he holds up in both palms, in front of his face, a small dark lump of coal with a little orange ember flame on top, clearly readable (about the size of his nose or a bit bigger); three simple breath strokes go from his mouth to the ember. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border."),
  card('reread', '불 다시 보기 (해금, 보조: 화로 상태 다시 굴리기)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) peering into the forge mouth, flames reflected as tiny stars in his dot eyes. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('smithSense', '대장장이의 감 (해금, 보조)', ['d_dwarf_idle', 'd_dwarf_work'],
    'Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs) resting one hand on the anvil with eyes closed, a little lightbulb-like glow above his head. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible. Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.'),
  card('deftHand', '섬세한 손 (해금, 각인)', ['d_dwarf_idle', 'd_dwarf_work'],
    "Scene: two small hands holding a tiny engraving tool over a blade, a little purple rune glowing. Only the two chubby little hands and short forearms with cream sleeve cuffs (same skin color and outline as the attached dwarf), no full character, no face. The blade lies flat and horizontal, a simple grey sword blade; the little purple rune on it is a simple diamond with a dot (never a letter or number) with two or three tiny glow strokes. Outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, ONE flat fill per shape (no shading, no two-tone planes, no gradients). Keep it compact, about 65% of the canvas width, centered. Background: the whole canvas is one single flat solid color, a soft pale lavender (like #D8CBEA), edge to edge, no pattern, no frame, no border.",
    { note: '보라 룬이 카드 크기에서 작다.' }),
  card('flameReading', '불꽃 읽기 (해금, 각인)', ['d_dwarf_idle', '@cards/keepForging'],
    "Scene: a cute flame with one big round eye and a simple purple rune circle around it. No dwarf in this card. The flame is a chubby rounded orange flame shape with a soft yellow inner flame, one big round cartoon eye (white with a black dot pupil), looking a bit sleepy-silly. Around it, a simple purple ring with four small diamond marks on it (never letters or numbers). Outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, ONE flat fill per shape (no shading, no glow gradients). IMPORTANT size: the whole design, ring and diamonds included, must be small and fit inside the middle 55% of the canvas height and width, with wide empty margins of flat background on every side. Background: the whole canvas is one single flat solid color, a soft pale lavender (like #D8CBEA), edge to edge, no pattern, no frame, no border."),
];

/** 재료 카드, 전설 재료 카드. */
const CARDS_B: readonly Entry[] = [
  card('ironMelt', '쇳물 고르기 (재료, 철)', ['d_dwarf_idle'],
    'Subject: a small ladle of glowing orange molten iron with a little bubble. Background: one flat soft warm yellow color. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: MATERIAL }),
  card('steelFold', '강철 접기 (재료, 강철)', ['d_dwarf_idle'],
    'Subject: a glowing steel bar folded over itself like a sandwich, visible stripes. Background: one flat soft warm yellow color. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: MATERIAL }),
  card('mithrilGrain', '미스릴 결 (재료, 미스릴)', ['d_dwarf_idle'],
    'Subject: a silvery-blue ingot with simple wavy grain lines and a sparkle. Background: one flat soft warm yellow color. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: MATERIAL }),
  card('orichalcumGlow', '오리할콘 빛 (재료, 오리할콘)', ['d_dwarf_idle'],
    'Subject: a red-gold ingot glowing warmly with simple radiating lines. Background: one flat soft warm yellow color. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: MATERIAL }),
  card('adamantCore', '아다만 심 (재료, 아다만)', ['d_dwarf_idle'],
    'Subject: a chunky grey metal block with one pointy dark purple crystal sticking out of the middle of its front face (the crystal is a simple tall pointed gem shape with one or two straight facet lines, clearly a gem, NOT an oval; no cracks, no lines around it). Background: one flat soft warm yellow color. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: MATERIAL }),
  card('dragonBreath', '용의 숨결 (전설 재료: 화룡의 심장)', ['d_dwarf_idle'],
    'Subject: a cute little red dragon heart with tiny wings breathing a puff of fire into a forge. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND }),
  card('rekindle', '다시 피는 불 (전설 재료: 불사조의 꼬리깃)', ['d_dwarf_idle'],
    'Subject: a bright orange phoenix feather popping up from a grey ash pile and lighting it up. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND }),
  card('giantHammer', '거인의 망치 (전설 재료: 거인의 핵)', ['d_dwarf_idle'],
    'Subject: a comically enormous stone hammer with a glowing core in its head, a tiny anvil next to it for scale. Keep the hammer very simple: the head is ONE plain rounded grey block (no segments, no chips, no notches) with one round soft-orange core dot in its middle, and a short thick brown handle; the hammer and the tiny anvil together fill only about two thirds of the frame, leaving plain background all around. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND, note: '아주 단순해 간판처럼 보인다. 화풍은 맞아서 두었다.' }),
  card('layeredShell', '겹친 갑피 (전설 재료: 여왕의 갑피)', ['d_dwarf_idle', '@cards/dragonBreath'],
    'Subject (card "the queen\'s layered carapace"): a cute chubby round beetle queen seen from the side, with a tiny yellow crown, two dot eyes and two little curly antennae; her back shell is made of three overlapping rounded sage-green shell plates like roof tiles, each plate with a thin muted purple rim; she sits proudly on top of a short thick hot iron bar drawn as ONE flat orange rounded rectangle seen straight from the side (no top face, no second tone). Muted colors, not neon. Draw EVERY shape with a VERY fat, bold dark brown marker outline, as heavy as on the dwarf and on the dragon in the second attached image (about 3 percent of the subject width). Keep the beetle and bar compact, about 55 percent of the canvas width. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject, the circle about 70 percent of the canvas width so plenty of yellow shows around it (just two flat colors, no gradient, no glow), exactly like the background of the second attached card image. Only objects and the beetle; no humans.',
    { recolor: LEGEND, note: '셋째 판. 첫 판은 돌·마카롱처럼 읽혀 딱정벌레 여왕으로 바꿨다. 보라 원이 다른 전설 카드보다 크다(4:3 창에서 위아래가 잘린다).' }),
  card('stormBellows', '폭풍 풀무 (전설 재료: 폭풍 깃)', ['d_dwarf_idle'],
    'Subject: a blue feather with little lightning zigzags blowing a swirl of wind. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND }),
  card('tailwind', '순풍 (전설 재료: 정령왕의 숨결)', ['d_dwarf_idle'],
    'Subject: a gentle pale green swirl of breath with a tiny spirit face flowing over a glowing bar. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND }),
  card('deepWater', '깊은 물 담금 (전설 재료: 심해룡의 비늘)', ['d_dwarf_idle', '@cards/dragonBreath'],
    'Subject (card "deep water quench", from the scale of an abyssal sea dragon): a glowing orange-hot short sword blade dunked point-first into a tall round wooden barrel full of flat dark blue water; next to the blade, a cute little light-blue sea-dragon head with two dot eyes and a small fin peeks out of the water, looking surprised; three round bubbles and two little steam puffs rise. Simple, chunky, very few details. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), exactly like the background of the second attached card image. Only objects and the little dragon; no humans.',
    { recolor: LEGEND, note: '둘째 판. 첫 판은 기타 피크 모양 비늘이라 안 읽혔다.' }),
  card('frostFinish', '서리 마무리 (전설 재료: 서리 왕관 조각)', ['d_dwarf_idle'],
    'Subject: a small pale blue crown shard spreading little ice crystals along a blade. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special. Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.',
    { recolor: LEGEND }),
  // 뺀 키 (시즌 악마의 탑과 함께, 프롬프트는 git 기록에): repayStrike windRead downStrike edgeHone emberWatch ashHammer ashQuench
];

// ── refine: 광석 정제 화면 (기획서 10.1) ─────────────────────────────────
// 덩어리, 덩어리 더미, 결과 표의 아이콘(광석 5, 골드, 선물 4), 망치 버튼, 가방. (배율 판은 CSS, 아래 뺀 키)
// 아이콘은 ore_iron을 두 번째 참조로 받아 크기·외곽선을 한 세트로 맞췄다. 망치 버튼은 ui/btn_reheat를,
// 덩어리 더미와 철광석(둘째 판)은 ore_chunk를 따른다. 결과 표에 줄을 더하면 여기에 아이콘을 더하고
// render/refine/assets.ts REFINE_ITEM_ART에 잇는다.

/** 아이콘 세트의 두 번째 참조(ore_iron) 안내. */
const SAME_ITEM_SET =
  'The second attached image is an item icon from the same set (iron ore). Match it exactly in drawing style, outline weight and how big the object sits in the frame (same scale and margin, centered), so the icons look like one set. Do NOT redraw the iron ore; draw only the new object described below.';
/** 버튼 세트의 두 번째 참조(btn_reheat) 안내. */
const SAME_UI_SET =
  'The second attached image is an existing button from the same game UI. Match its very fat, crisp dark brown outline, its flat warm light grey fill and its little flat orange flame marks, so it looks like the same UI set. Do NOT redraw that button; draw only the new object described below.';
/** 투명 배경과 여백 (정제 그림 모두). */
const ALPHA_MARGIN =
  'Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges.';

/** 결과 표의 아이콘: 1024 정사각, 투명, 화면에서 32~48px로 쓴다. */
function refineIcon(key: string, label: string, prompt: string, note?: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 160,
    label,
    refs: ['d_dwarf_idle', '@refine/ore_iron'],
    prompt: `${SAME_ITEM_SET}\n\n${prompt}`,
    ...(note !== undefined ? { note } : {}),
  };
}

const REFINE: readonly Entry[] = [
  {
    key: 'ore_chunk',
    size: '1024x1024',
    transparent: true,
    max: 160,
    label: '광석 덩어리 (모루 위, 더미에서 모루로 튀는 한 덩이)',
    refs: ['d_dwarf_idle'],
    note: '둘째 판. 첫 판(ore_chunk.rejected1.png)은 밝고 어두운 면으로 음영이 들어가고 화면의 40%만 차지했다.',
    prompt: `One rough lumpy grey-brown ore chunk (an unrefined rock lump with a few tiny metal flecks drawn as simple dots), small and round. ${ALPHA_MARGIN} Paint the whole rock in ONE single flat grey-brown color: no lighter or darker patches, no facets, no shadow tone; the only marks inside are a few tiny orange-yellow fleck dots and one or two short crack lines. The rock fills about two thirds of the canvas.`,
  },
  {
    key: 'chunk_pile',
    size: '1536x1024',
    transparent: true,
    max: 420,
    label: '광석 덩어리 더미 (모루 옆, 덩어리 수에 따라 크기가 바뀐다)',
    refs: ['d_dwarf_idle', '@refine/ore_chunk'],
    note: '덩어리 8개의 낮은 언덕. 덩어리 색이 ore_chunk보다 조금 밝은 회색이다.',
    prompt: `The second attached image is the single ore chunk from the same set. Draw the heap out of chunks that look exactly like it (same colors, same fleck dots, same outline weight). Do NOT just redraw one chunk.\n\nA heap of many rough grey-brown ore chunks piled into a little mound, wider than tall, simple rounded lumps. ${ALPHA_MARGIN} About eight to ten chunks, every chunk one single flat grey-brown color with its own outline and at most one or two tiny orange fleck dots: no lighter or darker patches, no shadow tone, no ground shadow. The heap fills about three quarters of the canvas width.`,
  },
  {
    key: 'ore_iron',
    size: '1024x1024',
    transparent: true,
    max: 160,
    label: '철광석 (흔함)',
    refs: ['d_dwarf_idle', '@refine/ore_chunk'],
    note:
      '아이콘 세트의 기준 그림. 나머지 아이콘이 이 그림을 두 번째 참조로 받는다 (그 아이콘들은 첫 판을 보고 뽑았다). ' +
      '둘째 판 (v0.8 검토). 첫 판(ore_iron.rejected1.png, 회색 바위에 녹슨 줄)은 40px에서 날 덩어리(ore_chunk)와 거의 같아 보여, ' +
      '"덩어리를 쳤더니 덩어리가 나왔다"로 읽혔다. 덩어리를 두 번째 참조로 주고 색과 모양을 다르게 했다.',
    prompt: `The second attached image is the raw unrefined ore chunk from the same set. Match its drawing style, outline weight and how big it sits in the frame, but the new object must look clearly DIFFERENT from it: a different color, a different value and a different silhouette, so the two never get mixed up at 40px. Do NOT redraw the chunk.\n\nA small refined piece of iron ore: a chunky angular iron nugget, already knocked clean of rock. Item icon, readable at 40px. ${ALPHA_MARGIN} Angular and blocky with straight edges and a few corners (NOT a round lumpy rock), in one single flat dark rusty red-brown color (much darker and redder than the grey-brown chunk), with one flat freshly cut face on its front-top painted one single flat light silver grey, and one tiny white shine mark on that cut face. Facet edges are drawn only as outline lines. One flat color per part: no lighter or darker patches, no shadow tone. It fills about two thirds of the canvas, so it reads clearly when shrunk to a tiny icon.`,
  },
  refineIcon(
    'ore_steel',
    '강철 덩이 (드묾)',
    `A small chunky steel nugget/ingot in blue-grey with one tiny shine mark. Item icon, readable at 40px. ${ALPHA_MARGIN} It is clearly a smooth chunky metal bar (a rounded rectangular ingot block), not a rock, in one single flat blue-grey color with one tiny white shine mark. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'ore_mithril',
    '미스릴 원석 (귀함)',
    `A small mithril ore crystal cluster in pale silvery blue with one tiny sparkle. Item icon, readable at 40px. ${ALPHA_MARGIN} Three or four chunky pointed crystals growing from a tiny grey rock base; the crystals are one single flat pale silvery blue with one tiny white four-point sparkle beside them. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'ore_orichalcum',
    '오리할콘 원석 (귀함)',
    `A small orichalcum ore lump in warm red-gold with simple short glow lines around it. Item icon, readable at 40px. ${ALPHA_MARGIN} A lumpy chunky metal nugget with a few bumps and one short crack line (clearly an ore lump like the iron ore, not a plain blob), in one single flat rosy red-gold color (a warm mix of copper and gold), with two or three tiny pale gold fleck dots on it and five short straight pale yellow glow dashes radiating around it (dashes with the same dark brown outline). One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
    '둘째 판. 첫 판(ore_orichalcum.rejected1.png)은 매끈한 주황 덩어리라 해나 얼룩처럼 보였다.',
  ),
  refineIcon(
    'ore_adamant',
    '아다만 원석 (아주 귀함)',
    `A small adamant ore: a dark purple-black crystal set in grey rock, two tiny star sparkles (very rare item). Item icon, readable at 40px. ${ALPHA_MARGIN} One big dark purple-black pointed crystal sticking up out of a small flat grey rock base, and two tiny white four-point star sparkles beside it. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'gold_coins',
    '골드 (흔함)',
    `A small pile of three round gold coins, flat yellow with a darker edge. Item icon, readable at 40px. ${ALPHA_MARGIN} Three thick round coins overlapping in a little heap, each a flat bright warm yellow face with a darker orange-gold rim ring and NO symbol on the face. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'gift_flowers',
    '들꽃 다발 (선물, 드묾)',
    `A tiny bouquet of wild flowers tied with a string, a gift for a hero. Item icon, readable at 40px. ${ALPHA_MARGIN} Three or four simple round wild flowers (soft pink, white, soft yellow) on green stems with two leaves, tied together with a small brown string bow. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'gift_honey',
    '꿀 과자 (선물, 드묾)',
    `A small round honey biscuit in a paper wrap, a gift for a hero. Item icon, readable at 40px. ${ALPHA_MARGIN} One round golden-brown biscuit, half wrapped in a cream paper wrap twisted at one side, with a tiny amber honey drip on top. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  refineIcon(
    'gift_pebble',
    '반짝 조약돌 (선물, 귀함)',
    `A small shiny smooth pebble with a little star glint, a keepsake gift. Item icon, readable at 40px. ${ALPHA_MARGIN} One smooth flat oval pebble in a soft warm lilac-grey color, with one tiny white four-point star glint beside it. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
    '다른 아이콘보다 조금 작게 나왔다 (여백을 잘라 내 크기를 맞춘다).',
  ),
  refineIcon(
    'gift_gloves',
    '손뜨개 장갑 (선물, 귀함)',
    `A pair of small hand-knitted mittens, a warm gift for a hero. Item icon, readable at 40px. ${ALPHA_MARGIN} Two small mittens side by side, soft warm red-orange with a cream cuff band each and one or two simple knit stitch marks. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  ),
  {
    key: 'btn_hammer',
    size: '1024x1024',
    transparent: true,
    max: 360,
    label: '정제 버튼 (망치)',
    refs: ['d_dwarf_idle', '@ui/btn_reheat'],
    prompt: `${SAME_UI_SET}\n\nA big chunky game button shaped like a blacksmith hammer seen from the side (head on top, short handle), flat grey head and brown handle, thick outline, made to be pressed, front view. ${ALPHA_MARGIN} The hammer is drawn big and bold like a pressable button: a wide chunky rectangular flat grey head (the same warm light grey as the button in the second image) on top of a short thick brown handle, the whole thing wrapped in the same very fat crisp dark brown outline, slightly tilted for a playful look, no glow and no shadow outside the outline. One flat color per part: no lighter or darker patches. It fills about three quarters of the canvas.`,
  },
  // 뺀 키 badge_mult (배율 판, v0.8 검토): 첫 판은 btn_reheat를 따라 4.6:1 긴 막대, 둘째 판은 그 불꽃이 귀퉁이에 따라와
  // '다시 달구기'처럼 읽혔다. 불꽃 대신 덩어리를 쌓으라고 다시 뽑은 두 판도 4:1 막대에 외곽선 둘레 번짐이 생겼다.
  // 그래서 배율 판은 그림 대신 낙서풍 CSS 스티커(크림 바탕, 굵은 잉크 선, 딱딱한 그림자)에 ore_chunk 둘을 얹어 그린다
  // (src/ui/refine/refine.css .rf-mult-plate). 마지막 프롬프트와 원본은 git 기록과 작업 폴더에 있다.
  {
    key: 'bag',
    size: '1024x1024',
    transparent: true,
    max: 160,
    label: '가방 (얻은 것)',
    refs: ['d_dwarf_idle', '@refine/ore_iron'],
    prompt: `${SAME_ITEM_SET}\n\nA small brown cloth sack tied with a string, slightly bulging with things inside, the inventory bag icon. Readable at 40px. ${ALPHA_MARGIN} A round-bottomed warm brown cloth sack, the top gathered and tied with a lighter tan string, plump and bulging, nothing sticking out. One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).`,
  },
];

// ── town: 마을 지도 (기획서 9장) ──────────────────────────────────────────
// 홈 화면 마을 지도의 바닥, 구름 띠, 건물, 탑, 소품. 바닥과 건물을 따로 뽑아 합친다(9.1).
// 게임에서는 src/render/town이 docs/mockups/town/layout.json 그대로 PixiJS로 그린다 (지도 청크에서만 import).
// 합친 시안과 합성 방법은 docs/mockups/town (README.md), 다시 합성하는 스크립트는 tools/art/town/compose.ts.
// 모두 아늑한 타이쿤 지도의 3/4 위에서 본 시점(약 40°), 빛은 왼쪽 위, 그림자는 오른쪽 아래에 평면 한 덩이.
//
// 프롬프트 = STYLE + 아래 조각들. buildPrompt는 이 그룹에 STYLE만 붙이고(scene처럼), 참조 안내(STYLE_REF_ONLY 또는
// 소품의 TOWN_PROP_REF_ONLY)·두 번째 참조 안내·시점 문장·본문은 그때 보낸 그대로 prompt에 적었다.
// 두 회차로 뽑았다: 바닥·건물·탑·소품(첫 회차) → 첫 합성 → 검토 → 대장간, 마을 문, 바닥, 구름 띠, 벤치·화분·노점 수레
// (둘째 회차). 아래 prompt는 마지막으로 채택한 판의 그림 프롬프트와 글자까지 같다 (기록과 대조했다).
// 기록과 다른 점:
//   - gen.ts가 그림 프롬프트를 감싸는 Codex 지시문은 낱말이 조금 다르다. 그때는 참조 목록에 "1) d_dwarf_idle (style
//     reference), 2) bld_forge (same village map set)"처럼 설명을 붙였고, 첫 회차 소품은 크기·참조 줄이 더 짧았다.
//   - Codex는 1024x1024를 1254x1254로 냈다 (size는 요청한 크기).
//   - 첫 회차 건물과 물의 탑의 두 번째 참조 @bld_forge는 그때 첫 판 대장간(bld_forge.rejected1.png)이었다. 대장간을
//     둘째 회차에 다시 뽑았으므로 지금 다시 뽑으면 둘째 판이 간다.
//   - 소품의 두 번째 참조 @prop_tree_round는 그때 그 원본을 복사해 둔 것이었다 (같은 그림).
//   - '@자기 키'(bld_gate, ground_b)는 고쳐 그리기다: 다시 뽑기 직전의 지금 원본을 두 번째 참조로 보낸다 (gen.ts).
// 처리 크기(max): 바닥 세로 2400(원본 1536이라 키우지 않는다. 지도에서는 2.4배로 키운다), 건물 720, 탑 1000,
// 소품 320, 구름 띠 1100 (지도에서 한 장을 약 1040px 폭으로 이어 붙인다. 소품 크기로 줄이면 흐려진다).
//
// 그림 없이 합성에서 그린 것 (tools/art/town/page.js, 수치는 tools/art/town/layout.ts):
//   - 바닥: 2.4배로 키우고(부드럽게), 짙은 갈색 잉크 선을 양쪽 3px씩 얇게 깎았다 (thinInk). 그 위로 하늘 760px (#CFE3EA).
//   - 탑의 층 쌓기: 탑마다 창 하나 위에서 다음 창 위까지 한 층(원본 px 행)을 잘라 위로 8~9번, 층마다 0.95배로 쌓아
//     지도 위 끝 밖까지 끝없이 오르게 했다. 이음매는 10행씩 겹쳐 흐리게 잇는다.
//   - 구름: 탑마다 구름 띠로 들어가는 자리를 감싸는 구름 고리, 고원 너머 지평선의 낮은 구름 줄 (원과 잉크 테두리,
//     구름 띠의 색 #F7F9FA·#DCE4EA). 구름 띠 그림은 그 위에 좌우로 뒤집어 가며 이어 붙인다.
//   - 대장간 굴뚝 연기 (같은 방식의 작은 구름 무리). 대장간 둘째 판은 연기 없이 뽑았다.
//   - 흙 오솔길: 문 앞에서 큰길까지 (모래색 채움, 풀 위에서만 잉크 테두리).
//   - 그림자: 그림에 구운 회색 그림자를 떼어 내고 바닥 접지 타원과 함께 한 층에 모아 #c3cba6로 곱하기(multiply) 한 번.
//   - 작게 쓰는 소품과 사람은 원본에 바깥 잉크 테두리를 덧그려 건물과 선 굵기를 맞췄다.
// 걷는 사람은 영웅 예제 그림(이 매니페스트 밖)과 드워프 기준 그림(d_dwarf_idle)을 줄여 놓았다.
//
// 시안 후보 ground_a (지도에 쓰지 않았다, 처리하지 않았다): 둘째 판, 1024x1536 불투명, 참조 d_dwarf_idle과
// scene/bg_workshop. 가운데 둥근 광장에서 네 길이 뻗는 십자, 아래 3분의 1을 가로지르는 강과 나무다리, 길가의 빈
// 풀밭. 첫 판(ground_a.rejected1.png)은 곧장 내려다본 듯 광장이 동그란 원이고 길이 자로 그은 듯해서 3/4 단서를 더했다.
// 둘째 판도 평평하게 읽히고 탑을 세울 언덕이 없어 ground_b를 골랐다 (ground_b는 위에 탑 고원이 있고 강 대신 연못).
// 마지막 프롬프트 = STYLE + 참조 안내(드워프는 화풍만, 공방 벽 그림은 색·선만) + 시점(타이쿤 지도, 완만한 3/4,
// 빛은 왼쪽 위, 같은 선 굵기, 바닥 그림자 없음) + "A big empty village ground map seen from above at a gentle 3/4
// top-down angle (NOT straight down: the ground is slightly foreshortened, so the round plaza looks like a wide oval,
// clearly wider than tall, and the river banks show a thin brown earth side face), portrait, as one flat doodle with
// hand-drawn slightly wobbly road edges: soft green grass everywhere, light sandy dirt roads with thick outlines: a round
// open plaza in the middle, one main road going up from the plaza to the top edge (toward a field where towers will
// stand), one road going down to the bottom edge (to a town gate), and two roads branching left and right from the
// plaza. A gentle blue river crosses the lower third from left to right with one small flat wooden bridge where the
// down road crosses it. Along the roads there are many EMPTY flat lots of plain grass (buildings will be placed there
// later). Only a few tiny grass tufts and flower dots as decoration. NO buildings, NO trees, NO people, NO text. Flat
// colors, thick outlines on roads and river banks only."

/** 프롬프트 조각을 빈 줄로 잇는다 (buildPrompt가 STYLE을 앞에 붙인다). */
const para = (...parts: readonly string[]): string => parts.join('\n\n');

/** 첫 회차 건물·물의 탑의 두 번째 참조(대장간) 안내. */
const TOWN_SAME_FORGE =
  'The second attached image is the forge building from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail, and the same scale (a door of the same size, so the buildings line up on one map). Do NOT redraw the forge; draw only the new object described below.';
/** 불·땅·바람의 탑의 두 번째 참조(물의 탑) 안내. */
const TOWN_SAME_TOWER =
  'The second attached image is the water tower from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills, the same silhouette and the same size and position in the frame. Do NOT redraw the water theme; change only the theme as described below.';
/** 둘째 회차 소품의 두 번째 참조 안내. what = 그 그림이 무엇인지. */
const townSameSet = (what: string): string =>
  `The second attached image is ${what} from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail. Do NOT redraw it; draw only the new object described below.`;

/** 시점: 대장간(첫 판)처럼 조금 돌려 문 벽이 왼쪽 아래를 본다. 첫 회차 건물과 탑. */
const TOWN_VIEW_FORGE =
  'Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the forge: the building is turned a little, so its front (door) wall faces the viewer toward the lower left, one narrow side wall shows on the right, and a little of the top surface of the roof is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.';
/** 시점: 두 번째 참조처럼 조금 돌려. 둘째 회차의 대장간과 광장 소품. */
const TOWN_VIEW_TURNED =
  'Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the second attached image: the object is turned a little, so its front faces the viewer toward the lower left, one narrow side shows on the right, and a little of the top surface is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.';
/** 시점: 정면 대칭 (마을 문만). 길이 문을 곧장 지나 화면 쪽으로 온다. */
const TOWN_VIEW_FRONT =
  'Camera: a cozy village tycoon / management game map seen from above at roughly 40 degrees, but this object is seen STRAIGHT-ON FROM THE FRONT: it is perfectly symmetric left to right, its front faces the viewer squarely, and the flat top surfaces are a little visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground, no road, no grass, no scenery: the object stands alone on the transparent background.';
/** 시점: 지도 바닥. */
const TOWN_VIEW_MAP =
  'View: like a cozy tycoon / management game map, seen from above at a gentle 3/4 top-down angle. Light comes from the upper left. Everything flat-colored; no cast shadows on the ground.';
/** 투명 배경, 여백, 간판에 글자 없음 (건물·탑과 둘째 회차 소품의 끝). */
const TOWN_FRAME =
  'Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges. Signs carry only simple picture symbols, never letters or numbers.';

/** 첫 회차 소품의 참조 안내 (STYLE_REF_ONLY와 끝 낱말만 다르다). */
const TOWN_PROP_REF_ONLY =
  'The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only the object asked below.';
/** 첫 회차 소품의 두 번째 참조(둥근 나무) 안내. */
const TOWN_PROP_SAME_TREE =
  'The second attached image is another prop from the SAME town map set (a round tree): match its outline thickness, its flat muted colors, its viewing angle and its flat shadow exactly, so all props look like one consistent set. Do NOT redraw that tree unless asked.';
/** 첫 회차 소품의 구도. */
const TOWN_PROP_FRAMING =
  'This is a small decoration prop for the town map of a cozy tycoon / management game, seen in a 3/4 top-down view (the camera looks down at about 45 degrees: the front side is visible and a little of the top surface is visible). Light comes from the upper left. It will be placed small, like an icon, on a big map, so use EVEN FEWER details than usual and BOLD, thick outlines; simple chunky readable silhouette. Flat colors only, no shading, no gradient. A single flat darker shadow blob may sit under the object on the ground (one flat color, offset slightly toward the lower right), nothing else on the ground. One object only, centered, the whole object fully inside the frame with generous empty margin on all sides, nothing cropped. No text, no letters, no symbols.';

/** 처리 크기 (긴 변, px). */
const TOWN_MAX = { ground: 2400, sky: 1100, building: 720, tower: 1000, prop: 320 } as const;

/** 첫 회차 건물 (대장간을 두 번째 참조로). body 뒤에 TOWN_FRAME, 그 뒤에 다시 뽑으며 덧붙인 말(extra). */
function townBuilding(key: string, label: string, body: string, more: { extra?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: TOWN_MAX.building,
    label,
    refs: ['d_dwarf_idle', '@bld_forge'],
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(STYLE_REF_ONLY, TOWN_SAME_FORGE, TOWN_VIEW_FORGE, `${body} ${TOWN_FRAME}${more.extra !== undefined ? ` ${more.extra}` : ''}`),
  };
}

/** 불·땅·바람의 탑: 물의 탑과 같은 짜임에 색과 주제만 바꾼다. */
const TOWER_RETHEME =
  "Keep the same tower structure as the second image (round base with a small arched door, two ring ledges, arched windows, a pointed spire wrapped in flat cloud puffs), only recolor and re-theme it. Just as the water tower's whole wall is blue stone, this tower's whole wall is ";
function townTower(key: string, label: string, theme: string, wall: string, note: string): Entry {
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: TOWN_MAX.tower,
    label,
    refs: ['d_dwarf_idle', '@tower_water'],
    note,
    prompt: para(
      STYLE_REF_ONLY,
      TOWN_SAME_TOWER,
      TOWN_VIEW_FORGE,
      `Same kind of tower as the second attached image (same shape language, size, view and style), but its theme is ${theme}, the top fades into flat cloud puffs. ${TOWN_FRAME} ${TOWER_RETHEME}${wall}`,
    ),
  };
}

/** 첫 회차 소품 (둥근 나무를 두 번째 참조로, 둥근 나무 자신은 빼고). extra = 다시 뽑으며 덧붙인 문단. */
function townProp(key: string, label: string, body: string, more: { extra?: string; note?: string; size?: ArtSize } = {}): Entry {
  const first = key === 'prop_tree_round';
  return {
    key,
    size: more.size ?? '1024x1024',
    transparent: true,
    max: TOWN_MAX.prop,
    label,
    refs: first ? ['d_dwarf_idle'] : ['d_dwarf_idle', '@prop_tree_round'],
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(
      TOWN_PROP_REF_ONLY,
      ...(first ? [] : [TOWN_PROP_SAME_TREE]),
      TOWN_PROP_FRAMING,
      `${body} Transparent background with a real alpha channel.`,
      ...(more.extra !== undefined ? [more.extra] : []),
    ),
  };
}

/** 둘째 회차 광장 소품 (시장 노점을 두 번째 참조로). */
function townPlazaProp(key: string, label: string, body: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: TOWN_MAX.prop,
    label,
    refs: ['d_dwarf_idle', '@bld_market'],
    note: '둘째 회차. 첫 합성의 광장이 분수와 사람 둘뿐이라 비어 보였다 (검토).',
    prompt: para(STYLE_REF_ONLY, townSameSet('a pair of market stalls'), TOWN_VIEW_TURNED, `${body} ${TOWN_FRAME}`),
  };
}

const TOWN: readonly Entry[] = [
  // ---- 바닥과 하늘
  {
    key: 'ground_b',
    size: '1024x1536',
    transparent: false,
    max: TOWN_MAX.ground,
    label: '마을 바닥 (위 탑 고원, 광장, 오른쪽 연못, 아래로 이어지는 큰길)',
    refs: ['d_dwarf_idle', '@ground_b'],
    note:
      '둘째 판 (둘째 회차). 첫 판(ground_b.rejected1.png, 참조 d_dwarf_idle과 scene/bg_workshop)은 2배로 키우면 길·절벽 선이 ' +
      '건물보다 두 배 굵었고, 덤불·바위를 그려 넣었고(배치로 다룰 수 없다), 탑 고원이 얕았다 (검토). 첫 판을 두 번째 참조로 주고 ' +
      '구성은 그대로, 선은 얇게, 고원은 지도 높이의 약 22%로 깊게, 큰길은 아래 끝 밖으로 이었다. 합성에서는 2.4배로 키워 하늘 아래에 깐다.',
    prompt: para(
      STYLE_REF_ONLY,
      'The second attached image is the old version of this same village ground map. Keep its LAYOUT (the tower plateau at the top with a road climbing up onto it, the oval plaza a little below the middle, the pond on the right, the long main street going down, the side roads going out to the left and right), but change it as described below.',
      TOWN_VIEW_MAP,
      'An EMPTY village ground map, portrait, as one flat doodle: plain flat soft green grass and light sandy dirt roads. Use THIN dark brown ink outlines on the road edges and the cliff edges, about 3px at 1024px width, much thinner than the outline of the reference character. Layout from top to bottom: (1) a raised grassy plateau for towers fills the top quarter of the map (about 25% of the image height) and runs off the TOP EDGE and both side edges of the image; its front edge is a low grey-brown cliff face of a few simple blocks; a sandy road climbs from the plaza up through a gap in the cliff onto the plateau. (2) Below the cliff, wide empty grass lots on both sides of the up road, and a small flat blue pond on the right side. (3) An oval sandy plaza a little below the middle of the image, with one road going out to the left edge and one road going out to the right edge. (4) A long straight main street going down from the plaza and running off the BOTTOM EDGE of the image. Big empty grass lots on both sides of every road. NO bushes, NO rocks, NO flowers, NO trees, NO buildings, NO people, NO fences, NO bridge, NO text: only flat grass with a few tiny grass tufts, flat sandy roads with a few tiny pebble dots, the flat blue pond and the cliff. A fully painted, opaque image that fills the whole frame.',
    ),
  },
  {
    key: 'cloud_band',
    size: '1536x1024',
    transparent: true,
    max: TOWN_MAX.sky,
    label: '구름 띠 (지도 위 끝, 탑이 들어가는 구름)',
    refs: ['d_dwarf_idle'],
    note:
      '둘째 회차. 첫 합성은 구름을 캔버스에 크림색으로 그렸는데 UI 종이색과 같아 탑이 구름으로 들어가지 않고 지도 끝이나 빈 머리글처럼 ' +
      '보였다 (검토). 합성에서는 윗부분(원본 0~530행)을 360px 높이로 줄여 지도 폭만큼 좌우로 뒤집어 가며 이어 붙인다.',
    prompt: para(
      STYLE_REF_ONLY,
      'View: the sky at the very top of a cozy tycoon / management game village map. Flat colors only, no shading, no gradients.',
      'A long horizontal band of big fluffy cartoon cumulus clouds that fills the FULL WIDTH of the image from the left edge to the right edge with no gap at either side (copies will be placed side by side, so the band must be horizontally tileable). The upper part of the band is solid cloud that reaches the top edge of the image. The lower edge of the band is a bumpy, uneven row of big and small round cloud heaps hanging down, with the transparent background showing below and between them; a few heaps hang lower than others. Colours, all perfectly flat: the upper parts of the puffs almost white (#FFFFFF to #F4F7F8); the lower part of each heap a second flat pale blue-grey (#DCE4EA), divided from the white by one simple curved line; in a few small gaps between puffs a flat pale sky blue (#CFE3EA). The same thick dark brown hand-drawn outline around every puff as the reference character. No shading, no gradients, no sun, no birds, no ground, no buildings, no towers. The cloud band covers roughly the top 55% of the image; below that the image is fully transparent except for the lowest hanging puffs. Transparent background with a real alpha channel.',
    ),
  },

  // ---- 건물
  {
    key: 'bld_forge',
    size: '1024x1024',
    transparent: true,
    max: TOWN_MAX.building,
    label: '대장간 (마을의 주인공 건물)',
    refs: ['d_dwarf_idle', '@bld_guild'],
    note:
      '둘째 판 (둘째 회차). 첫 판(bld_forge.rejected1.png, 첫 회차 건물들의 기준)은 집만 한 돌집이라 멀리서 대장간으로 읽히지 않았고, ' +
      '간판 그림이 한글(全·숫)처럼 읽혔다 (검토). 길드를 참조로 집보다 넓은 열린 작업장으로 다시 그렸다. 굴뚝 연기는 넣지 않고 합성에서 ' +
      '그린다. 길드나 집보다 조금 더 아이소메트릭 쪽으로 돌아 있다.',
    prompt: para(
      STYLE_REF_ONLY,
      'The second attached image is the guild hall from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail, and the same scale (a door of the same size, so the buildings line up on one map). Do NOT redraw the guild; draw only the new building described below.',
      TOWN_VIEW_TURNED,
      `A big dwarf blacksmith forge workshop, the main hero building of the village. It is clearly much WIDER than a house: as wide as the guild hall in the second image or wider, but lower, one storey. A long low building of grey stone and wooden beams with a dark brown wooden plank roof. The LEFT part of the front is an OPEN-FRONTED workshop with no front wall: a deep roof overhang held up by two thick wooden posts, and inside it, plainly visible, a big round stone forge hearth with a bright flat orange fire, a black iron anvil on a wooden tree stump standing under the eave, a hammer and a pair of tongs hanging on the back wall, and a wooden water barrel. The RIGHT part of the front is a closed stone wall with a wooden door and one small window with warm orange light. ONE thick round stone chimney rises from the roof right above the hearth, with NO smoke at all (just an empty dark chimney opening). A wooden sign hangs from an iron bracket at the front corner, painted with a pictogram of a hammer above an anvil: pictogram only, no letters, no text, no glyph-like shapes, nothing that could be read as a letter or a character. ${TOWN_FRAME}`,
    ),
  },
  townBuilding(
    'bld_guild',
    '모험가 길드',
    'An adventurer guild hall, same game, same 3/4 top-down view and style as the second attached image: a big two-story wooden hall with a red-brown roof, a large banner with a simple sword-and-shield symbol (no letters), a notice board with a few pinned papers (no readable text) beside the double doors, two little flag poles. Bigger than the forge.',
    { note: '게시판 종이에는 읽히지 않는 구불선만 있다. 대장간 첫 판보다 크다 (둘째 판 대장간이 이 그림을 참조로 받았다).' },
  ),
  townBuilding(
    'bld_shop',
    '재료 상점',
    'A small general goods and materials shop, same 3/4 top-down view and style as the second attached image: a cozy small wooden shop with a striped cloth awning, crates of ore and sacks out front, a hanging sign with a simple coin symbol (no letters).',
    {
      extra:
        'It must NOT look like the forge: no chimney and no smoke at all, no glowing doorway, no tools inside; instead a plain closed wooden shop door with a small window and a wide shop counter window under the awning. Give it a soft muted green roof so it reads as a different building at a glance.',
      note: '둘째 판. 첫 판(bld_shop.rejected1.png)은 굴뚝 연기, 대장간과 같은 지붕, 빛나는 문간과 연장 걸이라 대장간이 하나 더 있는 것처럼 보였다.',
    },
  ),
  townBuilding(
    'bld_inn',
    '여관',
    'A village inn and tavern, same 3/4 top-down view and style as the second attached image: a two-story timber house with a warm lit window, a hanging sign with a simple mug symbol (no letters), a bench by the door.',
    { extra: 'No smoke; the door is a normal wooden door (not a glowing doorway) so it does not look like the forge.' },
  ),
  townBuilding(
    'bld_house_a',
    '집 A (초가 오두막)',
    'A small cute villager cottage, same 3/4 top-down view and style as the second attached image: round-ish walls, a straw-colored roof, one round window, a tiny flower box. Smaller than the shop.',
    { note: '둥근 벽이라 거의 정면으로 보인다. 지도에서는 좌우로 뒤집어서도 쓴다.' },
  ),
  townBuilding(
    'bld_house_b',
    '집 B (좁은 이층집)',
    'A small villager house, same 3/4 top-down view and style as the second attached image: a narrow two-story house with a blue-grey roof and a little chimney, a small fence corner. Different from a straw cottage.',
    {
      extra: 'It is just a private home: NO hanging sign and no symbol anywhere, and no smoke from the chimney (only the forge has smoke).',
      note: '둘째 판. 첫 판(bld_house_b.rejected1.png)은 집 모양 간판과 굴뚝 연기를 그렸다. 지도에서 간판은 들어갈 수 있는 건물, 연기는 대장간의 표시다.',
    },
  ),
  townBuilding(
    'bld_market',
    '시장 (노점 둘)',
    'Two small market stalls side by side, same 3/4 top-down view and style as the second attached image: wooden stalls with cloth roofs (one orange, one green), baskets of fruit and a few bread loaves.',
    { extra: 'No people, no sellers.', note: '사과와 빵 그림 간판(글자 없음)을 스스로 더했다. 둘째 회차 광장 소품의 기준.' },
  ),
  townBuilding(
    'bld_mine',
    '광산 입구',
    'A small mine entrance in a rocky hillside, same 3/4 top-down view and style as the second attached image: a dark tunnel framed by wooden beams, a little rail track coming out with one cart full of grey-brown ore lumps, a lantern. This is where the ore lumps come from.',
    {
      extra: 'The rocky hillside is a small self-contained mound of rounded grey-brown rocks (flat fills), not a whole landscape; no people.',
      note: '바닥 그림자가 없다 (합성에서 접지 타원만 깐다).',
    },
  ),
  {
    key: 'bld_gate',
    size: '1536x1024',
    transparent: true,
    max: TOWN_MAX.building,
    label: '마을 문 (큰길을 가로지르는 문)',
    refs: ['d_dwarf_idle', '@bld_gate'],
    note:
      '다섯째 판 (둘째 회차). 첫 회차의 셋째 판(bld_gate.rejected3.png)은 대장간처럼 대각선으로 놓여, 첫 합성에서 기울이고 1.35배로 ' +
      '늘려 큰길에 맞췄다 (기둥 머리가 찌그러졌다, 검토). 정면 대칭으로 다시 뽑은 넷째 판(rejected4)은 문 안쪽이 그림 폭의 35%뿐이라, ' +
      '그 판을 두 번째 참조로 주고 비율을 적어 넓혔다(약 49%). 다른 건물과 달리 이것만 정면을 본다. 첫 판(rejected1)은 기둥이 비뚤고 ' +
      '홈이 있었고, 둘째 판(rejected2)은 선이 얇고 나뭇결·금이 있었다.',
    prompt: para(
      STYLE_REF_ONLY,
      'The second attached image is the previous drawing of this same village gate. Keep its parts, colours, outline weight and straight-on symmetric front view exactly, but move the two pillars much FARTHER APART so the opening is much wider, as described below.',
      TOWN_VIEW_FRONT,
      `A small, low, cute village gate seen straight-on from the front, symmetric, the road runs straight toward the viewer through the arch: two short upright stone pillars (each a stack of three big rounded grey stone blocks with a flat stone cap), a curved wooden arch beam joining the tops of the pillars, and a small blank wooden plaque hanging from the middle of the arch with NOTHING on it (no letters, no symbols). On the outer side of each pillar, a short wooden palisade of three or four pointed logs held by one crossbar, running straight out to the left and to the right. The open passage between the two pillars is wide: about 45% of the whole image width. The gate is short and wide, not tall. Plain flat fills, no wood grain, no cracks, no scratch marks, the same very thick dark brown outline. No road drawn, no people. ${TOWN_FRAME} Proportions from left to right across the whole gate: left palisade about 15%, left pillar about 12%, EMPTY OPENING about 46%, right pillar about 12%, right palisade about 15%. The arch beam is long and only gently curved to span this wide opening, with the small blank plaque hanging from its middle. One flat soft-grey shadow shape on the ground at the lower right of each pillar is allowed.`,
    ),
  },
  townBuilding(
    'bld_fountain',
    '분수 (광장 가운데)',
    'A round stone fountain for the village plaza, same 3/4 top-down view and style as the second attached image: a round stone basin with flat blue water and a small spout in the middle, a couple of stone benches is NOT needed, just the fountain.',
    {
      extra:
        'Seen from the same 40-degree top-down angle as the forge, so the round basin looks like a wide oval and its flat water surface is clearly visible from above. The water is drawn as flat blue shapes with thick outlines (a simple little splash at the spout), no gradients. No benches, no people.',
      note: '바닥 그림자가 없다. 돌이 대장간보다 조금 따뜻한 회갈색이다.',
    },
  ),

  // ---- 탑 넷 (물·불·땅·바람). 합성에서는 한 층을 잘라 위로 쌓아 끝없이 늘린다 (원본 px 행, tools/art/town/layout.ts).
  {
    key: 'tower_water',
    size: '1024x1536',
    transparent: true,
    max: TOWN_MAX.tower,
    label: '물의 탑',
    refs: ['d_dwarf_idle', '@bld_forge'],
    note: '탑 넷의 기준 (둥근 받침과 아치 문, 고리 턱 둘, 아치 창, 구름에 감긴 뾰족 지붕). 합성: 원본 580~908행 한 층을 8번 쌓는다.',
    prompt: para(
      STYLE_REF_ONLY,
      TOWN_SAME_FORGE,
      TOWN_VIEW_FORGE,
      `A tall mysterious tower for heroes to climb, seen in the distance, same 3/4 top-down view and doodle style as the second attached image: a tall slim round stone tower with a pointed top, its theme is WATER: blue stones, a little waterfall line and wave marks, the top fades into a few flat cloud puffs (the tower is endless). ${TOWN_FRAME} Keep the silhouette simple and chunky with the SAME very thick dark brown outline as the forge and plain flat fills. The tower fills most of the frame height; its bottom is a round stone base with one small arched door, standing on the ground with one flat grey shadow to the lower right; flat cloud puffs wrap only around the very top. Stones are simple rounded blocks like the forge chimney. No people.`,
    ),
  },
  townTower(
    'tower_fire',
    '불의 탑',
    'FIRE: red-orange stones and a few flat flame shapes',
    'warm red-orange stone (NOT cream or white), with darker brick-red ledges; instead of the waterfall stripe there is a stripe of flat lava-orange with flame shapes, and a few small flat flame shapes lick up from the base ring. Flames are simple flat shapes with thick outlines, no glow, no gradients. No people.',
    '둘째 판. 첫 판(tower_fire.rejected1.png)은 벽이 크림색에 붉은 테만 둘러 등대처럼 보였다. 합성: 원본 585~904행 한 층을 9번 쌓는다 (불꽃 띠의 이음매가 조금 비친다).',
  ),
  townTower(
    'tower_earth',
    '땅의 탑',
    'EARTH: brown and moss-green stones with a few roots and rocks',
    'warm brown stone with patches of flat moss-green, darker brown ledges and a moss-green spire; instead of the waterfall stripe, a few thick brown roots climb up the wall, and a couple of round rocks and a small sprout sit at the base. Plain flat fills with thick outlines, no gradients. No people.',
    '합성: 원본 580~900행 한 층을 8번 쌓는다 (쌓은 이음매에서 덩굴이 조금 어긋난다).',
  ),
  townTower(
    'tower_wind',
    '바람의 탑',
    'WIND: pale mint and white stones with swirl lines and a little flag',
    'pale mint and off-white stone with soft teal ledges; instead of the waterfall stripe, a few curly swirl lines (wind) wrap around the tower, and a small triangular flag on a thin pole flutters from the spire. Plain flat fills with thick outlines, no gradients. No people.',
    '소용돌이는 외곽선 없는 가는 청록 선이다. 깃발 때문에 그림 상자의 가운데가 조금 오른쪽이다. 합성: 원본 590~908행 한 층을 9번 쌓는다.',
  ),

  // ---- 소품
  townProp('prop_tree_round', '둥근 나무', 'One round fluffy deciduous tree, 3/4 top-down view, a big round green crown blob and a short brown trunk.', {
    note: '소품 세트의 기준 (나머지 첫 회차 소품이 두 번째 참조로 받았다). 혼자 바닥 그림자가 없다 (합성에서 접지 타원을 깐다).',
  }),
  townProp('prop_tree_pine', '뾰족 나무', 'One small pine tree, 3/4 top-down view, three stacked dark green triangles and a short trunk.'),
  townProp('prop_bush', '덤불', 'One small round green bush with two tiny flowers, 3/4 top-down view.'),
  townProp('prop_rocks', '바위', 'A small cluster of three grey rounded rocks, 3/4 top-down view.'),
  townProp('prop_fence', '울타리 (옆으로 이어 붙인다)', 'One short straight section of a low wooden picket fence (four posts), 3/4 top-down view, horizontal.', {
    size: '1536x1024',
    extra:
      'IMPORTANT: the fence runs perfectly HORIZONTALLY from left to right, parallel to the bottom edge of the image, NOT diagonal and NOT isometric. We see its front face straight on, from slightly above, so only a thin sliver of the top of each post shows. Four separate posts with clear gaps between them, joined by two straight horizontal rails. Every post and rail is ONE single flat warm brown color: no darker side faces, no lighter top faces, no inner lines. Low and wide, about four times wider than tall.',
    note: '둘째 판. 첫 판(prop_fence.rejected1.png)은 대각선 아이소메트릭에 옆면 음영이 있었다.',
  }),
  townProp('prop_lamp', '가로등', 'One little street lamp post with a warm lit lantern on top, 3/4 top-down view.', {
    note: '지붕과 받침 오른쪽에 조금 어두운 면이 하나 있다 (작게 쓰면 보이지 않아 두었다).',
  }),
  townProp('prop_flowers', '꽃', 'A small patch of wild flowers (a few pink, yellow and white blobs) on grass, flat, 3/4 top-down view.'),
  townProp('prop_crates', '상자와 통', 'A small stack of two wooden crates and one barrel, 3/4 top-down view.'),
  townProp(
    'prop_signpost',
    '이정표',
    'One wooden signpost with two arrow boards pointing different ways (no letters, just blank boards), 3/4 top-down view.',
    {
      extra:
        'IMPORTANT: keep it as plain and chunky as the round tree reference. NO wood grain lines, NO thin inner lines, NO scratches, NO nails or dots on the boards. The post and each arrow board are each ONE single flat color with only the thick dark brown outline: no darker side faces, no lighter top faces, no shading planes. Nothing else at its foot (no rocks, no grass), only one flat shadow blob. The two blank arrow boards point to opposite sides (one left, one right).',
      note: '둘째 판. 첫 판(prop_signpost.rejected1.png)은 나뭇결, 못 자국 점, 옆면 음영, 발치의 음영 진 바위가 있었다.',
    },
  ),
  townProp('prop_cart', '광석 수레', 'One small wooden hand cart loaded with grey-brown ore lumps, 3/4 top-down view.', {
    extra:
      'IMPORTANT: keep it as plain and chunky as the round tree reference, a simple toy-like cart. The cart body is one simple box in ONE flat warm brown color with no plank lines, no darker side faces, no lighter top faces. Two simple round wheels, each a plain flat circle with a small center dot (no spokes). Two short handles. The ore lumps on top are 3 or 4 simple round blobs, each ONE flat grey-brown color with NO facets, NO darker sides, NO highlights. Only one flat shadow blob under it. Whole cart fully inside the frame with a generous margin.',
    note: '둘째 판. 첫 판(prop_cart.rejected1.png)은 광석에 면과 음영, 바큇살, 판자 선, 어두운 옆면이 있었다. 지도에서는 대장간 앞마당에 둔다.',
  }),
  townPlazaProp(
    'prop_bench',
    '벤치',
    'A small wooden park bench for a village plaza: a simple bench of a few warm brown wooden planks with a backrest and two stubby legs at each end, nothing on it. Small, chunky and simple.',
  ),
  townPlazaProp(
    'prop_planter',
    '꽃 화분',
    'A square wooden flower planter box for a village plaza: a low square box of brown wooden planks, filled with one small round green bush and a few simple pink and yellow flowers. Small, chunky and simple.',
  ),
  townPlazaProp(
    'prop_stall',
    '노점 수레',
    'A small cute street vendor hand cart for a village plaza: a wooden cart with two big wooden wheels and two handles, a small striped cloth canopy (cream and soft red stripes) on two thin poles, a few round apples and loaves of bread on top. Small, chunky and simple, no sign.',
  ),
];

// ── heroes: 용사 36명 (기획서 5장, 5.9, 9.3) ─────────────────────────────────
// 용사 명단 (2026-10-13): 특급 24명(속성 4 × 무기 6의 조합마다 한 명), 일반 12명(무기마다 2명, 속성마다 3명).
// 힐러는 유나·모라(특급)와 견습 치유사 솜(일반). 이름·등급·속성·무기·역할·대사·생김새는 tools/art/roster/roster.json에
// 있다 (다음 단계가 sim 데이터로 옮긴다). 아래 label의 괄호는 (등급 · 속성 · 무기 [· 힐러]), 그 뒤는 대사다.
// 모두 왼쪽을 본다 (오른쪽을 보는 드워프와 마주 보고, 전투에서는 오른쪽의 몬스터와 마주 본다).
// 처리: 투명 여백을 자르고 긴 변 400px (HERO_MAX). 원본은 모두 1024x1536.
// 앞의 10명(EXAMPLE_HEROES)은 명단보다 먼저 뽑은 예제이고, 명단이 그 그림을 그대로 쓴다 (roster.json의 existing_art,
// 키가 같다). 명단에서 바뀐 이름: hero_veteran = 베르다, hero_ace = 하엘, hero_rookie = 신참 검사 비코.
// 마을 지도는 이 10명만 걷는 손님으로 굽는다 (TOWN_GUEST_HEROES, tools/art/town/bake.ts). 나머지 26명(ROSTER_HEROES)은
// 아직 게임이 읽지 않는다.
//
// ── 예제 10명 ──
// 용사 그림의 예제다 (2026-10-13). 이름과 성격은 v0.8 가문 예시(src/sim/data/families.ts)에서 왔다. 토마와 유나는
// 기획서에 이름만 예로 있어 성별·나이는 그림을 뽑은 쪽이 정했다 (남 5, 여 5).
//
// 프롬프트 = 화풍 머리말(HERO_STYLE) + 참조 안내(HERO_REF_NOTE) + 공통 문단(HERO_COMMON) + 영웅마다의 문단. 그림 생성
// 기록(Codex 출력)의 그림 프롬프트와 글자까지 같다 (대조했다). 화풍 머리말은 STYLE과 조금 다르다 (팔레트 괄호와
// 'no signature'가 없다). 그래서 ownStyle로 전체를 prompt에 적었다.
// 기록과 다른 점:
//   - 네아와 오델은 공통 문단의 첫 판(HERO_COMMON_V1: 덩어리 머리·튜브 팔다리 줄을 더하기 전)으로 뽑았다.
//   - 그때의 Codex 지시문은 크기 줄이 "use this size"였고 끝 줄이 "Save the generated image as <key>.png in the current
//     directory. Reply with only the saved file path."였다. gen.ts로 다시 뽑으면 낱말이 조금 다르다 (뜻은 같다).
//   - 다시 뽑은 셋(바일, 아렌, S급 마법사)의 버린 판은 원본 폴더의 hero_<이름>.rejected1.png다.

/** 영웅 예제의 화풍 머리말 (STYLE에서 팔레트 괄호와 'no signature'를 뺀 판). */
const HERO_STYLE =
  'Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (a little muted). No text, no letters, no numbers, no watermark.';
/** 드워프는 화풍 참조일 뿐이라는 안내. */
const HERO_REF_NOTE =
  'The attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. Draw only the new character described below.';
/** 공통 문단 (여덟 명). */
const HERO_COMMON =
  "Draw ONE human adventurer hero, full body from head to boots, standing, front three-quarter view: body and face turned slightly toward the LEFT edge of the image (the character looks toward the viewer's left). Chibi proportions about 2.3 to 2.5 heads tall (a little less squat than the dwarf: a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow.";
/** 공통 문단의 첫 판 (네아, 오델). */
const HERO_COMMON_V1 =
  'Draw ONE human adventurer hero, full body from head to boots, standing, front three-quarter view with the body turned slightly toward the LEFT side of the image. Chibi proportions about 2.3 to 2.5 heads tall (a little less squat than the dwarf: big round head, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal: plain clothes made of a few flat color blocks, no patterns, no ornaments beyond what is described. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow.';

/** 처리 크기 (긴 변, px). 지도에서는 키 약 80px로 작게, 용사 목록에서는 카드 그림으로 쓴다. */
const HERO_MAX = 400;

function hero(key: string, label: string, body: string, more: { v1?: boolean; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: HERO_MAX,
    label,
    refs: ['d_dwarf_idle'],
    ownStyle: true,
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(HERO_STYLE, HERO_REF_NOTE, more.v1 === true ? HERO_COMMON_V1 : HERO_COMMON, body),
  };
}

const EXAMPLE_HEROES: readonly Entry[] = [
  hero(
    'hero_vail',
    '바일 (특급 · 불 · 한손검) 처음 대장간에 온 용사. 명단 용사들의 두 번째 참조',
    'The hero: Vail, a young man, the first hero who ever came to the forge. Broad square shoulders and a sturdy build, chibi 2.4 heads tall. Short dark brown hair as one simple tufty blob. Blunt but honest: a straight flat serious mouth and steady dot eyes, slight frown. Rust-red tunic (#b5523b), brown belt, brown trousers, little brown boots. A small worn brown ledger book tucked into the front of his tunic, its top corner sticking out. One old burn scar shown as a simple pale pink patch on the back of his right hand. He holds a plain one-handed sword (simple grey blade, brown grip) pointing down at his side.',
    { note: '둘째 판. 첫 판(hero_vail.rejected1.png)은 혼자 오른쪽을 보고 약 2.8등신에 머리카락 가닥이 많았다. 새 판은 왼쪽을 보고 약 2.3등신, 드워프처럼 덩어리 머리다.' },
  ),
  hero(
    'hero_nea',
    '네아 (특급 · 바람 · 활) 먼저 보고 먼저 말하는 궁수',
    'The hero: Nea, a slim young woman archer who always sees first and speaks first. Narrow eyes drawn as two short flat lines, wind-tousled hair blowing to one side in a few big simple tufts (dark teal-brown). Her mouth is open mid-sentence, eager, and her free hand points ahead with one finger as if saying "over there!". Short teal-blue hooded cloak (#4f8a9e) over a cream shirt, brown boots, a small quiver with three arrows on her back. She holds a simple wooden longbow, and a single white feather is tied to the top tip of the bow with a tiny string.',
    { v1: true, note: '첫 판 채택. 화살통, 머리 가닥이 조금 많지만 화풍 안이다. 활 끝 깃털이 오른쪽 끝에서 12px 떨어져 있다.' },
  ),
  hero(
    'hero_odel',
    '오델 (특급 · 땅 · 대검) 남의 짐까지 지는 큰 사람',
    "The hero: Odel, a very big, broad, gentle man, the heaviest and roundest of all the heroes, slow and calm. Huge round body, short buzzed hair, small calm sleepy dot eyes, tiny closed mouth, a slight nodding tilt of the head. Earthy khaki-brown clothes (#7a6a4f) and a simple leather strap across his chest. On his back an oversized bulging backpack, with one EXTRA bundle tied on top of it (someone else's luggage he is carrying for them). He rests a big plain greatsword (wide grey blade, brown grip) on his shoulder with one hand.",
    { v1: true, note: '첫 판 채택. 드워프의 둥근 덩어리 화풍에 가장 가깝다. 좌우 여백이 16~20px로 빠듯하지만 잘리지 않았다.' },
  ),
  hero(
    'hero_aren',
    '아렌 (특급 · 불 · 단검) 가볍고 겁 없는, 단검 둘',
    'The hero: Aren, a skinny wiry young man, light and carefree but brave. A thin narrow body and thin arms and legs, but still the same chibi 2.5-heads-tall proportions (big head, short legs). Messy light-brown hair as one big tufty blob, a relaxed grin, and he is whistling (lips puckered in a small round "o", NO music notes, no symbols). Amber-ochre short jacket (#a8743a), cream shirt, dark brown trousers, little boots. TWO daggers at his belt: he spins one dagger casually in his raised hand, while the second dagger stays sheathed at his hip, its handle wrapped in a faded cloth strip because he never uses it (it was his older brother\'s). One hand on his hip, a cocky relaxed stance.',
    { note: '둘째 판. 첫 판(hero_aren.rejected1.png)은 오른쪽을 보고 다리가 길어 약 3.2등신이었다. 휘파람 부는 입이 숫자 3처럼 보이는 만화 기호다.' },
  ),
  hero(
    'hero_isol',
    '이솔 (특급 · 불 · 석궁) 지붕을 걷는 아이',
    'The hero: Isol, a small, light young girl (about 12), quiet and careful, light on her feet like a child who walks on rooftops. She stands on tiptoe on one foot, arms slightly out for balance, and looks UP with a quiet curious face (two dot eyes looking upward, tiny mouth). Short grey-black hair. A long grey scarf (#8a8a8f) wrapped around her neck with long ends fluttering, smudged with a few small darker grey ash spots. Simple grey-brown tunic, little boots. A small crossbow is slung on her back by a strap, its bow limbs clearly visible sticking out behind her shoulders.',
    { note: '첫 판 채택. 한 발로 서서 위를 본다 (탑을 오래 올려다보는 아이).' },
  ),
  hero(
    'hero_toma',
    '토마 (특급 · 땅 · 석궁) 한 발을 오래 겨누는',
    'The hero: Toma, a stocky calm middle-aged man, an unhurried patient sniper who aims one shot for a long time. Half-closed relaxed sleepy eyes, one eye shut as if quietly aiming, a short stalk of grass in the corner of his mouth, a small stubble chin drawn as a flat darker patch. A wide-brimmed soft hat, olive and mud-brown earthy clothes, a sturdy brown vest. He holds a big heavy wooden crossbow low at his hip with both hands, pointing it slightly forward, perfectly still and unbothered.',
    { note: '첫 판 채택. 모자와 석궁이 조금 자세하지만 화풍 안이다.' },
  ),
  hero(
    'hero_yuna',
    '유나 (특급 · 물 · 지팡이 · 힐러) 원소 결정을 모으는 마법사',
    'The hero: Yuna, a small cheerful young woman mage who collects elemental crystals. A soft blue hooded robe (water color), short dark hair peeking out, a proud happy smile with closed happy eyes (two upward arcs). LOTS of tiny round pouches hang all over her: from her belt, her shoulder strap and her staff, each pouch with a small crystal peeking out in different colors (red, blue, green, yellow). She holds a simple wooden staff topped with one blue crystal. Her pose shows off her collection a little.',
    { note: '첫 판 채택.' },
  ),
  hero(
    'hero_rookie',
    '신참 검사 비코 (일반 · 땅 · 한손검) 가장 낮은 등급의 이름 없는 신참으로 그렸다',
    'The hero: a nameless rookie adventurer, the lowest rank, a nervous teenage boy. A way-too-big dented iron helmet slides down over his eyes so his eyes are hidden; only his small wobbly worried mouth shows. Three big sweat drops flying off his head (nervous cold sweat). Thin body, a cheap padded cream vest, patched brown trousers, knock-kneed trembling stance. He grips a rusty one-handed sword with both hands, held up stiffly in front of him; the blade is grey with a few orange-brown rust spots and a small chip in the edge.',
    { note: "첫 판 채택. '하찮은' 결에 가장 가깝다. 투구 눈구멍이 조금 눈처럼 읽힌다." },
  ),
  hero(
    'hero_ace',
    '하엘 (특급 · 바람 · 지팡이) S급 마법사로 그렸다',
    "The hero: a top-rank (S rank) mage, a tall slim woman, a bit taller and slimmer than the other chibi heroes but STILL a chibi: about 3 heads tall and NOT more, with a big round head. Draw her with outlines exactly as thick and bold as the dwarf's and the same chunky simple rounded shapes (not a thin elegant illustration). Short chestnut-brown bob haircut as one simple blob, round human ears (NOT an elf, NOT white or silver hair, no twin tails, no hair ornaments). Calm, composed, expressionless face: two dot eyes and a small straight mouth. A plain cream robe and a long deep-forest-green cape billowing far out to one side in the wind. She holds a tall plain wooden staff, taller than her, topped with a small round amber stone drawn as one flat amber circle (no shine, no highlight dot). Quiet confident stance, not posing. She must NOT resemble any famous anime or game character.",
    { note: '둘째 판. 첫 판(hero_ace.rejected1.png)은 선이 얇고 4등신이 넘는 보통 일러스트 같았고 구슬에 광택이 있었다. 새 판은 선이 드워프만큼 굵고 약 3등신이다.' },
  ),
  hero(
    'hero_veteran',
    '베르다 (특급 · 불 · 대검) 은퇴를 앞둔 할머니 전사',
    'The hero: an old grandmother warrior about to retire, still strong. Short stocky body, grey hair in a round bun, kind gentle eyes drawn as two soft smiling crescents, a warm small smile, ONE scar as a single short line across her cheek. Worn simple armor: a dull steel breastplate over a faded maroon tunic, a short faded cape. Instead of a walking cane she leans on her sheathed greatsword: the big greatsword in its long brown leather scabbard is planted point-down on the ground in front of her and she rests both hands on its crossguard and pommel like an old lady leaning on a cane.',
    { note: '첫 판 채택. 칼집째 세운 대검에 두 손을 얹고 지팡이처럼 기댄다.' },
  ),
];

/**
 * 마을 지도의 걷는 손님으로 굽는 용사 (9.3, tools/art/town/bake.ts가 읽는다): 예제 10명. 명단의 나머지 26명은
 * 그림만 두고 굽지 않는다. 손님을 바꾸려면 이 목록을 고치고 지도를 다시 굽는다 (node tools/art/town/bake.ts).
 */
export const TOWN_GUEST_HEROES: readonly string[] = EXAMPLE_HEROES.map((e) => e.key);

// ── 명단 용사 26명 (2026-10-13) ──
// 네 묶음으로 나눠 뽑았다 (그림 생성 기록의 draw:heroes-1·2·3과 명단 검토 check:roster). 묶음마다 참조 안내와 공통
// 문단의 낱말이 조금 다르다 (ROSTER_B1~B4). 명단 검토가 다시 그린 넷(밀로·리타·솜·호브)은 묶음 4다.
// 프롬프트 = 화풍 머리말(STYLE, buildPrompt가 붙인다) + 참조 안내 + 'A hero character for the game: ' + 생김새
// (roster.json의 look, 일반이면 끝에 NORMAL_TAIL) + 공통 문단 + [등급 문단] + [다시 뽑을 때 더한 끝 문단(extra)].
// 그림 생성 기록의 그림 프롬프트와 글자까지 같다 (대조했다).
// 참조: 1) 드워프(화풍), 2) 바일 원본(hero_vail: 비례·선 굵기·틀 안 크기). 버린 판은 원본 폴더의 hero_<이름>.rejected<n>.png.
// 기록과 다른 점: 그때의 Codex 지시문(크기·투명·참조 순서·저장 줄)은 묶음마다 달랐다. gen.ts로 다시 뽑으면 지시문의
// 낱말이 그때와 조금 다르다 (뜻은 같다).

/** 명단 용사의 참조: 화풍 기준 드워프, 그리고 비례·선 굵기·틀 안 크기를 맞출 바일. */
const ROSTER_REFS: readonly string[] = ['d_dwarf_idle', '@heroes/hero_vail'];

/** 한 번에 뽑은 묶음의 참조 안내, 공통 문단, 등급 문단. */
interface RosterBatch {
  readonly ref: string;
  readonly common: string;
  /** 특급의 등급 문단 (공통 문단 뒤). 없으면 특급도 등급 문단이 없다. */
  readonly special?: string;
  /** 일반의 등급 문단 (공통 문단 뒤). 없으면 생김새 끝에 NORMAL_TAIL을 붙인다. */
  readonly normal?: string;
}

/** 일반 용사의 생김새 끝에 붙인 문장 (묶음 3·4: 등급 문단 대신). */
const NORMAL_TAIL = 'An ordinary common hero: plain and humble, simple clothes, nothing fancy.';
/** 특급의 등급 문단 (묶음 1·4). */
const SPECIAL_ONE_IDEA =
  'This is a special-rank hero: make the design a little more distinctive (one memorable silhouette idea), but keep it just as simple and doodle-like as the others.';

/** 묶음 1 (draw:heroes-1, 특급 9명): 시엔·도윈·키오·로나·다로·세온·헤른·피아·누아. */
const ROSTER_B1: RosterBatch = {
  ref: 'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its proportions (about 2.3 to 2.5 heads tall, a big round head), its outline thickness, its flat fills and its small amount of detail exactly, but do NOT draw that hero. Draw only the new character described below.',
  common: "Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. Holding their weapon. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.",
  special: SPECIAL_ONE_IDEA,
};
/** 묶음 2 (draw:heroes-2): 보로·엘다·리브·카렐·모라 (특급), 브리·페노 (일반). */
const ROSTER_B2: RosterBatch = {
  ref: 'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same roster: match its body proportions (big round head, small body, about 2.3 to 2.5 heads tall), its outline thickness, its flat fills and how large the character sits in the frame, but do NOT redraw that hero. Draw only the new character described below.',
  common: "Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, the character looks toward the viewer's left). About 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Holding their weapon. Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, ONE clear expression. Keep details minimal like the dwarf: hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.",
  special: 'This is a special-rank hero: make the design a little more distinctive (a clear, memorable silhouette and one signature prop), while keeping the same super simple doodle style.',
  normal: 'This is a common-rank hero: keep the design plain and humble (simple everyday clothes, a plain weapon, nothing fancy).',
};
/** 묶음 3 (draw:heroes-3, 일반 6명): 슈·포리·토리·오토·테사·노노. 등급은 생김새 끝(NORMAL_TAIL)에 적었다. */
const ROSTER_B3: RosterBatch = {
  ref: 'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its body proportions, head size, outline thickness and amount of detail exactly, but do NOT draw that hero (no red tunic, no book, no sword unless asked). Draw only the new character described below.',
  common: "Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head about 40% of the total height, small body, short legs). Holding their weapon. Very simple face: two dot eyes and a tiny mouth, ONE clear expression. Hair is one or two big simple blob shapes, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.",
};
/** 묶음 4 (명단 검토 check:roster가 다시 그린 넷): 밀로 (특급), 리타·솜·호브 (일반, 생김새 끝에 NORMAL_TAIL). */
const ROSTER_B4: RosterBatch = {
  ref: 'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its proportions (about 2.3 to 2.5 heads tall, a big round head), its outline thickness, its flat fills, its small amount of detail and how large the character sits in the frame exactly, but do NOT draw that hero (no red tunic, no ledger, no sword unless asked). Draw only the new character described below.',
  common: "Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. Holding their weapon. Thick outlines, flat colors. The whole character fits inside the frame with wide empty margin on all sides (the character fills only the middle of the image, like the second reference), nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.",
  special: SPECIAL_ONE_IDEA,
};

function rosterHero(
  key: string,
  label: string,
  batch: RosterBatch,
  rarity: 'special' | 'normal',
  look: string,
  more: { extra?: string; note?: string } = {},
): Entry {
  const grade = rarity === 'special' ? batch.special : batch.normal;
  const lookPara = rarity === 'normal' && batch.normal === undefined ? `${look} ${NORMAL_TAIL}` : look;
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: HERO_MAX,
    label,
    refs: ROSTER_REFS,
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(
      batch.ref,
      `A hero character for the game: ${lookPara}`,
      batch.common,
      ...(grade !== undefined ? [grade] : []),
      ...(more.extra !== undefined ? [more.extra] : []),
    ),
  };
}

/** 명단 용사 26명. roster.json의 순서 (특급: 무기 순, 일반: 무기 순). */
const ROSTER_HEROES: readonly Entry[] = [
  rosterHero(
    'hero_sien',
    '시엔 (특급 · 물 · 한손검) 검을 쓴 날보다 닦은 날이 많다.',
    ROSTER_B1,
    'special',
    'A neat, slim young woman (about 20) with a high black ponytail and a calm, tidy face with a small satisfied smile, in a clean sea-blue tunic with a white collar and grey trousers. She holds a plain one-handed sword in one hand and a small white cloth in the other as if polishing it, and a tiny wooden bucket with a scrub brush hangs from her belt.',
    {
      note: '첫 판 채택. 포니테일까지 재면 약 2.6~2.7등신으로 예제보다 조금 길다.',
    },
  ),
  rosterHero(
    'hero_dowin',
    '도윈 (특급 · 땅 · 한손검) 힘은 장사인데, 말을 걸면 귀가 빨개진다.',
    ROSTER_B1,
    'special',
    'A very tall, lanky, shy young man with long arms and big mitten hands, a short olive-brown mop of hair, eyes glancing away and pink blushing cheeks and ears, in an ochre-brown tunic and khaki trousers. He holds a plain one-handed sword awkwardly close to his chest, and one small white daisy is tucked behind his ear.',
    {
      note: '첫 판 채택. 다리가 길어 약 2.9등신이다 (아주 크고 호리호리한 성격이라 일부러 둔 예외). 다른 용사와 키를 맞추고 싶으면 다시 뽑을 후보다.',
    },
  ),
  rosterHero(
    'hero_kio',
    '키오 (특급 · 바람 · 한손검) 바람개비가 안 돌면 하루 쉰다.',
    ROSTER_B1,
    'special',
    'A cheerful scrawny boy of about 14 with spiky light-brown hair and a wide open grin, in a leaf-green short tunic and rolled-up brown trousers. He raises a plain one-handed sword high, and a small four-blade paper pinwheel (plain mint and cream blades) sticks up from his headband.',
    {
      note: '첫 판 채택. 튜닉이 잎 초록보다 올리브에 가깝다.',
    },
  ),
  rosterHero(
    'hero_rona',
    '로나 (특급 · 물 · 대검) 뱃멀미가 심해서 탑에 왔다.',
    ROSTER_B1,
    'special',
    'A tall, broad-shouldered woman in her forties, a former ferry rower, with a navy-blue knit cap over short sandy hair and a relaxed lopsided half-smile, in a navy-blue sleeveless vest over a cream shirt with the sleeves rolled up. She carries a big plain greatsword over her shoulder the way a rower carries an oar, with a coil of rope looped over her other shoulder.',
    {
      note: '첫 판 채택. 대검 끝과 손잡이 쪽 여백이 빠듯하지만 잘리지 않았다. 얼굴만으로는 성별이 조금 모호하다.',
    },
  ),
  rosterHero(
    'hero_daro',
    '다로 (특급 · 바람 · 대검) 칼보다 키가 작다. 아직은.',
    ROSTER_B1,
    'special',
    'A tiny boy of about 8, the smallest hero of all, with round cheeks, a determined pouting mouth and a mint-green headband over messy black hair, in a leaf-green tunic and little boots. He grips a plain greatsword that is much TALLER than he is with both hands, its tip resting on the ground behind him as he drags it along.',
    {
      extra: 'IMPORTANT, the main joke of this character: the greatsword is clearly LONGER than the boy is tall, about one and a half times his whole height from head to boots. He holds its grip with both hands up near his chest, and the long blade slants down behind him toward the right side of the image so its tip rests on the ground far behind his heels, as if he is dragging it. Make the boy small in the frame so the whole long sword fits inside the image with empty margin on all sides.',
      note: "둘째 판. 첫 판(hero_daro.rejected1.png)은 칼이 아이 키보다 짧아 '칼보다 키가 작다'가 살지 않아 끝 문단을 더했다. 둘째 판의 칼은 키보다 조금 길다 (부탁한 1.5배까지는 아니다).",
    },
  ),
  rosterHero(
    'hero_seon',
    '세온 (특급 · 물 · 단검) 머리 위 개구리와 말이 잘 통한다.',
    ROSTER_B1,
    'special',
    'A slim, easygoing young man with wavy blue-black hair and sleepy, contented half-closed eyes, in a short sky-blue hooded rain cape over a grey tunic. He holds a small plain dagger loosely in one hand, and a small round green frog sits calmly on top of his head.',
    {
      note: '첫 판 채택.',
    },
  ),
  rosterHero(
    'hero_hern',
    '헤른 (특급 · 땅 · 단검) 잡초에게도 이름을 지어 준다.',
    ROSTER_B1,
    'special',
    "A short, slightly hunched old grandpa gardener with a neat little white moustache (no beard) and kind crinkled eyes, in a khaki-olive gardener's apron over a brown shirt. He holds a small curved dagger like a pruning knife, and a little green sprout grows out of the top of his floppy brown sun cap.",
    {
      note: '첫 판 채택. 허리가 굽은 느낌은 약하다.',
    },
  ),
  rosterHero(
    'hero_pia',
    '피아 (특급 · 바람 · 단검) 편지는 꼭 전한다. 가끔 옆집에.',
    ROSTER_B1,
    'special',
    'A quick, skinny courier girl of about 14 with two short dark-brown pigtails and a busy, determined face, standing on her toes and leaning forward as if about to dash off, in a mint-green short jacket and brown shorts. She holds a small plain dagger in one hand, and a big brown satchel stuffed with plain blank envelopes (no writing) hangs at her hip.',
    {
      note: '첫 판 채택. 까치발보다는 웅크린 출발 자세다.',
    },
  ),
  rosterHero(
    'hero_nua',
    '누아 (특급 · 물 · 활) 눈물이 많다. 화살은 똑바로 간다.',
    ROSTER_B1,
    'special',
    'A small girl of about 10 in a big pale-blue raincoat with the hood down, with a short black bob, big watery eyes with one single tear drop on her cheek and a wobbly but brave mouth. She holds a simple wooden bow with an arrow nocked, aimed perfectly straight and steady, in funny contrast to her teary face.',
    {
      note: '첫 판 채택. 명단 검토에서 유나와 덜 닮게 두 번 다시 그렸으나 (외곽선이 가늘거나, 남색 모자가 오토와 겹쳤다. 둘째 판이 hero_nua.rejected2.png) 쓰지 않고 이 판으로 되돌렸다.',
    },
  ),
  rosterHero(
    'hero_boro',
    '보로 (특급 · 불 · 활) 불화살로 고구마를 굽는다.',
    ROSTER_B2,
    'special',
    'A round, chubby young man with closed happy eyes and a big cheerful grin, a red bandana over short ginger hair, in an orange-red tunic and brown trousers. He holds a simple wooden shortbow in one hand and a single arrow in the other with a whole roasted sweet potato skewered on its tip, one tiny curl of steam rising from it.',
    {
      note: '첫 판 채택. 김 한 줄기는 빠졌고 몸이 거의 정면을 본다. 틀을 바일보다 조금 크게 채운다.',
    },
  ),
  rosterHero(
    'hero_elda',
    '엘다 (특급 · 땅 · 활) 머리에 새가 둥지를 틀었다. 그냥 둔다.',
    ROSTER_B2,
    'special',
    "A tall, slender, quiet woman ranger in her thirties with one long dark-brown braid, calm half-closed eyes and a straight mouth, in a moss-olive hooded cloak and brown leggings, holding a tall plain longbow upright beside her. A small round bird's nest with one little brown bird in it sits on top of her head, and she does not mind it at all.",
    {
      note: '첫 판 채택. 새가 갈색이 아니라 연노랑으로 나왔다.',
    },
  ),
  rosterHero(
    'hero_liv',
    '리브 (특급 · 물 · 석궁) 석궁을 고칠수록 복잡해진다.',
    ROSTER_B2,
    'special',
    'A small, bookish young woman tinkerer with huge round glasses, a messy auburn bun with a pencil stuck in it and a proud grin, in blue work overalls over a cream shirt with a brown tool belt. She hugs a home-made crossbow with a few extra gears, a lever and a little crank bolted on, still drawn as a few simple flat shapes.',
    {
      extra: 'Important fixes: keep the colors muted and soft like the dwarf (her overalls are a soft muted denim blue, NOT bright saturated blue). Her crossbow must clearly read as a crossbow: a wooden stock pointing toward the left with a short curved bow (the prod) set crosswise across its front end, a visible bowstring, and a loaded bolt; the extra gears, the lever and the crank are small simple add-ons on the stock. Proportions about 2.4 heads tall like the second image (the body plus legs clearly taller than the head), and the character sits at about the same size in the frame as the second image, with wide empty margins on all sides.',
      note: '둘째 판. 첫 판(hero_liv.rejected1.png)은 파랑이 쨍하고 석궁이 석궁으로 읽히지 않았으며 틀을 꽉 채워 끝 문단을 더했다.',
    },
  ),
  rosterHero(
    'hero_milo',
    '밀로 (특급 · 바람 · 석궁) 바람 부는 날만 일한다.',
    ROSTER_B4,
    'special',
    'A stocky, jolly middle-aged miller with a big bushy brown moustache (no beard), rosy cheeks and a dab of white flour on his nose, in a pale-green work shirt with rolled sleeves and a white apron dusted with flour. He holds a sturdy wooden crossbow at his side, and a small white flour sack is slung over his back.',
    {
      extra: 'Important: keep him the same size in the frame as the second reference hero, with wide empty margins all around (he must NOT fill the frame). His head is about 40% of his height, NOT bigger. Keep the face as simple as the dwarf: two plain black dot eyes, NO eyebrows, NO tongue, NO open mouth; the bushy moustache is ONE simple flat brown blob shape under a small round nose with one small white flour dot on it, plus two small flat pink cheek circles. Flour on the apron is at most two small pale smudges. Hair is one simple brown blob with at most one inner line. The crossbow hangs low at his side pointing down toward the left: a plain straight wooden stock with a curved wooden bow limb across its front end and a clearly visible straight string between the limb tips (a clear T shape). The small white flour sack peeks over his shoulder from his back.',
      note: '둘째 판 (명단 검토). 첫 판(hero_milo.rejected1.png, 묶음 2)은 틀을 꽉 채우고 머리가 컸으며 눈썹·혀처럼 세부가 많았다.',
    },
  ),
  rosterHero(
    'hero_karel',
    '카렐 (특급 · 불 · 지팡이) 주문을 외면 앞머리가 조금 탄다.',
    ROSTER_B2,
    'special',
    'A lanky young man mage with a big puffy frizzy hairdo whose tips are singed black, a single small puff of grey smoke above it, and a startled-but-proud face (round dot eyes, small round mouth), in a rust-red robe with slightly scorched sleeve ends. He holds a crooked wooden staff topped with a small flat orange flame shape.',
    {
      note: '첫 판 채택. 연기가 위쪽 끝에 가깝지만 잘리지 않았다. 묘사보다 덜 호리호리하다.',
    },
  ),
  rosterHero(
    'hero_mora',
    '모라 (특급 · 땅 · 지팡이 · 힐러) 안 다쳐도 약초를 발라 준다.',
    ROSTER_B2,
    'special',
    'A plump, kind middle-aged herbalist woman with round rosy cheeks and a warm closed-eye smile, brown hair tied up in an olive kerchief, in an ochre-brown dress with a big olive apron. She leans on a short gnarled wooden staff with two green leaves sprouting from its top and carries a small woven basket of green herbs on her arm.',
    {
      note: '첫 판 채택. 지팡이가 짧지 않고 길다.',
    },
  ),
  rosterHero(
    'hero_rita',
    '양치기 리타 (일반 · 바람 · 한손검) 양을 세다가 먼저 잠든다.',
    ROSTER_B4,
    'normal',
    "A plain teenage shepherd girl with a short brown bob and sleepy half-closed eyes in the middle of a yawn, in a simple mint-green tunic with a cream wool shawl. She holds a plain one-handed sword in one hand and a short wooden shepherd's crook in the other.",
    {
      extra: "Important: she must NOT look like the second reference hero or like any famous game or anime character. Her head is about 40% of her height, NOT bigger, and she sits the same size in the frame as the second reference hero with wide empty margins. Her hair is ONE simple short brown rounded blob (a plain rounded bob) with at most one inner line, NO strands. Her memorable silhouette: the cream wool shawl is big and fluffy, drawn as one puffy scalloped cloud shape wrapped around her shoulders like a sheep's fleece. She is in the middle of a big sleepy yawn: eyes closed as two small relaxed downward-curving arcs (sleepy and peaceful, NOT angry, no slanted brows), mouth a small open oval. She leans a little on a short wooden shepherd's crook held upright in one hand, and a small plain one-handed sword hangs loosely pointing down in her other hand.",
      note: '셋째 판 (명단 검토). 첫 판(rejected1)은 머리 가닥이 많고 머리가 컸다. 둘째 판(rejected2, 묶음 2의 끝 문단)은 기울어진 감은 눈이 화나 보였고, 갈색 단발에 초록 옷이라 하엘·솜과 겹쳤다.',
    },
  ),
  rosterHero(
    'hero_bri',
    '빨래꾼 브리 (일반 · 물 · 대검) 대검은 빨랫방망이보다 조금 무겁다.',
    ROSTER_B2,
    'normal',
    'A plump middle-aged washerwoman with a blue headscarf, sleeves rolled up and a cheerful no-nonsense face, in a plain blue dress with a white apron. She carries a plain greatsword over her shoulder the same easy way she would carry a laundry paddle.',
    {
      note: '첫 판 채택. 좌우 여백이 빠듯하지만 잘리지 않았다.',
    },
  ),
  rosterHero(
    'hero_peno',
    '빵집 아들 페노 (일반 · 불 · 대검) 칼보다 반죽을 더 잘 친다.',
    ROSTER_B2,
    'normal',
    "A broad, cheerful young man with a short orange-brown crew cut and a smudge of flour on one cheek, in a plain brick-red shirt and a white baker's apron. He holds a plain greatsword out in front of him with both hands like a big bread peel.",
    {
      note: '첫 판 채택. 칼끝이 왼쪽 끝에 가깝지만 잘리지 않았다.',
    },
  ),
  rosterHero(
    'hero_shu',
    '정찰병 슈 (일반 · 바람 · 단검) 숨바꼭질에서 진 적이 없다. 다들 먼저 집에 가서.',
    ROSTER_B3,
    'normal',
    'A small, quiet girl of about 13 in an oversized pale-green hood that hides most of her hair, with shy dot eyes peeking out, in a simple green-grey tunic. She holds a small plain dagger close to her chest.',
    {
      note: '첫 판 채택.',
    },
  ),
  rosterHero(
    'hero_pori',
    '버섯꾼 포리 (일반 · 땅 · 단검) 먹는 버섯을 반쯤 안다.',
    ROSTER_B3,
    'normal',
    'A small round-faced boy of about 10 with a bowl haircut and a curious open mouth, in a plain ochre-brown tunic. He holds a small plain dagger and carries a little basket with a few brown mushrooms on his arm.',
    {
      extra: 'Important: his hair is a smooth round BOWL CUT (one smooth dome-shaped blob with perfectly straight blunt bangs cut straight across his forehead, like an upside-down bowl on his head, NOT tufty or messy), so he looks clearly different from the second reference hero. He is smaller and rounder than the reference hero, a little kid. The basket hangs from the crook of his bent arm by its handle.',
      note: '둘째 판. 첫 판(hero_pori.rejected1.png)은 바일과 같은 덥수룩한 머리여서 바가지 머리가 아니었다.',
    },
  ),
  rosterHero(
    'hero_tori',
    '견습 궁수 토리 (일반 · 불 · 활) 과녁보다 사과를 더 많이 맞혔다.',
    ROSTER_B3,
    'normal',
    'A plain girl archer of about 15 with a short orange-red ponytail and a determined squint, in a simple rust-orange tunic and brown trousers. She holds a small plain shortbow, and a red apple with an arrow stuck through it hangs from her belt.',
    {
      extra: 'Important: keep her as simple as the dwarf. Her hair is one simple orange-red blob with a SHORT little stubby ponytail (a small round tuft at the back of the head, not long), at most two inner lines. The determined squint is drawn as two short flat straight lines for eyes plus one small straight mouth, NO eyelashes, NO extra marks on the face. She stands calmly holding the plain shortbow upright in one hand at her side (not drawing it, no arrow on the bow), the other hand in a small determined fist. The red apple with one arrow stuck through it hangs clearly from her belt.',
      note: '둘째 판. 첫 판(hero_tori.rejected1.png)은 활을 당기는 자세에 머리 가닥·속눈썹이 많았다. 시위가 가늘게 보여 활이 조금 막대처럼 보일 수 있다.',
    },
  ),
  rosterHero(
    'hero_otto',
    '어부 오토 (일반 · 물 · 활) 놓친 물고기 이야기가 제일 길다.',
    ROSTER_B3,
    'normal',
    'A thin, slightly stooped old fisherman with grey stubble (no beard), a floppy navy-blue hat and calm patient eyes, in a faded blue shirt and rolled-up trousers. He holds a simple wooden bow, and a small empty fishing basket hangs at his hip.',
    {
      extra: 'Important: his weapon is a BOW, NOT a fishing rod: a simple curved wooden archery bow (a D-shaped arc with a clearly visible straight bowstring), held upright in one hand at his side. There is NO fishing rod, NO line, NO bobber anywhere. He is thin and old: a narrow body, a slightly bent back with his head pushed a little forward, grey hair tufts under the floppy navy hat, grey stubble dots on the chin. Calm, patient half-closed eyes. A small woven fishing basket (empty) hangs at his hip on a strap.',
      note: '둘째 판. 첫 판(hero_otto.rejected1.png)은 활 대신 낚싯대를 들었다.',
    },
  ),
  rosterHero(
    'hero_tessa',
    '문지기 테사 (일반 · 물 · 석궁) 문은 잘 지킨다. 열쇠는 자주 잃는다.',
    ROSTER_B3,
    'normal',
    'A sturdy, round young woman town gatekeeper with a plain round iron helmet and a broad friendly grin, in a simple blue padded tunic. She holds a plain crossbow at her side, and one big iron key dangles from her belt on a string.',
    {
      extra: 'Important: the crossbow must read clearly as a CROSSBOW, not a pickaxe or hammer: a plain straight wooden stock held horizontally at her hip in both hands, pointing toward the left, with a short curved bow limb across its front end and a clearly visible straight bowstring, forming a clear T or cross shape. She is sturdy and round (a wide round body) with a broad happy grin (a simple wide curved smile line, mouth may be slightly open). Keep everything as simple as the dwarf: eyes are two plain black dots with NO white highlights, the helmet is a plain smooth grey dome with NO rivets and NO bands, the crossbow stock is one flat brown color with NO wood grain lines, the tunic is one flat blue block with at most one or two lines. One big old iron key dangles from her belt on a string. Leave generous empty margin around her (she fills only the middle of the frame, like the second reference hero).',
      note: '셋째 판. 첫 판(rejected1)은 시위 없는 석궁이 곡괭이처럼 보였고, 둘째 판(rejected2)은 눈 하이라이트·나뭇결·투구 리벳으로 자세했다. 틀을 꽤 채운다.',
    },
  ),
  rosterHero(
    'hero_hob',
    '광부 호브 (일반 · 땅 · 석궁) 탑도 결국 큰 굴이라고 생각한다.',
    ROSTER_B4,
    'normal',
    'A short, stocky middle-aged miner with dirt smudges on his cheeks and a plain brown mining helmet with a small lamp on its front, in a khaki work shirt and brown trousers. He holds a sturdy plain crossbow in both hands.',
    {
      extra: 'Important: he must look clearly different from another hero in this game, a stubbly man in a wide-brim hat who holds a crossbow low at his hip. So: NO stubble, NO beard, NO dots or texture on the face; a clean round face with two small flat grey-brown dirt smudges on the cheeks, two plain black dot eyes and a big cheerful open smile (he loves digging); small grey hair tufts above his ears show he is middle-aged. Pose: he carries the crossbow resting on his shoulder the way a miner carries a pickaxe, one mitten hand holding its stock. It must still read clearly as a CROSSBOW, NOT a pickaxe: a plain straight wooden stock, at its front end a curved brown wooden bow limb crossing it like a small bow laid crosswise, and a clearly visible straight cream bowstring between the two limb tips (a clear T or cross shape), no grey metal head shapes. His plain brown round mining helmet has a small flat cream lamp circle on its front (no glow, no light beam). Short, stocky, barrel-shaped body, head about 40% of his height, same size in the frame as the second reference hero with wide empty margins.',
      note: '넷째 판 (명단 검토). 묶음 3의 세 판은 석궁이 곡괭이처럼 보이거나(rejected1), 소년처럼 보여 포리와 겹치거나(rejected2), 같은 땅·석궁인 토마와 겹쳤다(rejected3: 수염 자국, 모자, 허리 아래 석궁). 석궁을 곡괭이처럼 어깨에 메어 작게 보면 곡괭이로 읽힐 여지가 조금 있다.',
    },
  ),
  rosterHero(
    'hero_nono',
    '견습 마법사 노노 (일반 · 불 · 지팡이) 불은 켤 줄 안다. 끄는 건 배우는 중.',
    ROSTER_B3,
    'normal',
    'A small apprentice mage boy of about 11 with a nervous but proud smile, in a rust-red robe far too long for him (the hem pools around his boots) and a floppy pointed hat. He holds a short wooden staff with a tiny flat orange flame on top.',
    {
      note: '첫 판 채택.',
    },
  ),
  rosterHero(
    'hero_som',
    '견습 치유사 솜 (일반 · 바람 · 지팡이 · 힐러) 붕대는 잘 감는다. 너무 잘 감는다.',
    ROSTER_B4,
    'normal',
    'A gentle teenage apprentice healer girl with short light-brown hair and a soft smile, in a white dress with a short mint-green cape. She holds a simple wooden staff with one small green leaf on top, and a roll of white bandage hangs from her belt with one end trailing down.',
    {
      extra: 'Important: she must look clearly different from a brown-bob girl in a cream robe with a long green cape. Her memorable joke is that she wraps bandages TOO well: her own arm is wrapped in white bandage from wrist to shoulder, a strip of white bandage is tied around her head like a headband with a small bow knot on the side, and from the bandage roll on her belt one long loose white bandage end trails down to the ground in a few simple loops. Her hair: ONE simple rounded short light honey-brown blob with at most one inner line, NO strands, NO long side locks. Her cape is only a tiny round pale mint capelet that covers just her shoulders (not a long cape). Her white dress is short and plain. Gentle closed-eye smile (two small upward arcs and a tiny smile). Her head is about 40% of her height, not bigger, and she sits the same size in the frame as the second reference hero with wide empty margins.',
      note: "둘째 판 (명단 검토). 첫 판(hero_som.rejected1.png, 묶음 3)은 갈색 단발·흰 옷·초록 망토·지팡이로 하엘과 실루엣이 거의 같았다. '붕대를 너무 잘 감는다'를 살렸다.",
    },
  ),
];

const HEROES: readonly Entry[] = [...EXAMPLE_HEROES, ...ROSTER_HEROES];

// ── monsters: 몬스터 25종 (기획서 6장, 8장) ─────────────────────────────────
// 귀여운 몬스터 명단 (2026-10-13, tools/art/roster/bestiary.json): 일반 16 = 체형 4 × 속성 4, 층 보스 4 (체형마다),
// 일일 보스 5. 키의 체형·속성 이름은 src/sim/core/types.ts의 BODY_TYPES·ELEMENTS와 같다. 모두 왼쪽(용사 쪽)을 본다.
// 체형마다 생김새는 하나다: 인간형 '냄비 고블린', 갑각 '동글게', 비행 '통통박쥐', 영체 '꼬마 유령'. 속성은 몸 색과
// 머리 위 표식 하나만 바꾼다. 층 보스는 무속성으로 그렸다 (그 층의 속성은 화면의 속성 표식으로 보인다).
// 전투에서 그림 높이의 추천 (용사 키 = 1): 일반 약 0.65, 층 보스 약 1.1, 일일 보스 약 1.7 [튜닝] (bestiary.json scale).
// 처리: 투명 여백을 자르고 긴 변 400px (일반), 560px (보스). 원본은 일반 1024x1024, 보스 1254x1254 (1024를 부탁했지만
// Codex가 정사각을 1254로 냈다).
//
// 프롬프트 = 화풍 머리말(STYLE) + 참조 안내(MON_REF_NOTE) + 공통 문단(MON_COMMON) + [종류별 문단] + 생김새
// (bestiary.json의 look) + [다시 뽑을 때 더한 끝 문장]. 그림 생성 기록의 그림 프롬프트와 글자까지 같다 (대조했다).
//   일반: 체형마다 물 변형을 먼저 드워프만 참조로 그리고(그 체형의 기준), 나머지 셋은 물 변형을 두 번째 참조로 받아
//         같은 몸에 색과 표식만 바꿨다 (MON_SAME_SPECIES). bestiary.json의 무속성 기준(mon_<체형>_base)은 그리지 않았다.
//   층 보스: 같은 체형의 물 변형을 두 번째 참조로 (FLOOR_BOSS_NOTE: 물 색과 물방울은 따르지 않는다).
//   일일 보스: 드워프만 참조로, 틀을 크게 채운다 (DAILY_BOSS_FRAME).
// 기록과 다른 점: 그때의 Codex 지시문은 일반이 '… size 1024x1024. The background must be genuinely transparent …'이었고
// 보스는 gen.ts와 거의 같은 지시문이었다. gen.ts로 다시 뽑으면 낱말이 조금 다르다 (뜻은 같다).

/** 드워프는 화풍 참조일 뿐이라는 안내 (몬스터 모두, bestiary.json prompt.refNote). */
const MON_REF_NOTE =
  'The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes), but do NOT draw the dwarf or any person. Draw only the monster described below.';
/** 공통 문단 (몬스터 모두, bestiary.json prompt.common). */
const MON_COMMON =
  'Draw ONE monster for a cozy, silly idle RPG, full body, as one character. It faces LEFT: body and face turned three-quarters toward the LEFT edge of the image (it looks at the heroes standing on the left). Cute, silly and harmless, NOT scary: no sharp teeth, no sharp claws, no spikes, no blood, no angry or glowing eyes; round chunky shapes; a very simple face with two dot eyes (or simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: a few flat color blocks, at most a few inner lines, no patterns, no texture, no ornaments beyond what is described. The whole monster fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects around it.';
/** 일반 몬스터의 불·땅·바람 변형: 같은 체형의 물 변형(두 번째 참조)과 같은 몸에 색과 표식만 바꾼다. */
const MON_SAME_SPECIES =
  'The second attached image is the SAME monster species already drawn in another element color. Draw the SAME creature: same silhouette, same pose, same proportions, same face and expression, same size and position in the frame and the same outline weight. Change ONLY the main body color (and its matching darker shade, if any) and the one small element mark on top, which replaces the mark shown in the second image, as described below.';
/** 동글게 넷의 생김새 끝 문장 (mon_armored_water의 첫 판이 집게·다리를 다른 색으로 칠해서 더했다). */
const CRAB_ONE_COLOR =
  'Its claws, eye stalks and stubby legs are the SAME color as its shell (no other body color), so the whole crab reads as one element color; only the shell rim is cream.';
/** 층 보스: 두 번째 참조(같은 체형의 물 변형)에서 모양만 따르고 색과 물방울은 따르지 않는다. */
const FLOOR_BOSS_NOTE =
  'The second attached image is an ordinary member of this monster species (its sky-blue water-element variant). Draw its BOSS: clearly the same species with the same face style, the same shapes, the same outline weight and the same clothes or parts, but bigger, rounder and heavier, with the one boss mark described below. Do NOT copy its sky-blue body color or the small water-droplet mark on its head: the boss is element-neutral and uses the colors described below.';
/** 층 보스의 크기 줄. */
const FLOOR_BOSS_FRAME = 'Draw it large in the frame (it is a boss), centered, with a small empty margin on every side and nothing cut off.';
/** 일일 보스의 크기 줄: 전투 화면을 크게 채운다. */
const DAILY_BOSS_FRAME =
  'This is a BIG daily BOSS that fills the battle screen: draw it LARGE so it fills most of the square frame (roughly 85% of the frame width or height, whichever is larger), centered, still with a small empty margin on every side and nothing cut off.';

/** 처리 크기 (긴 변, px). 일반은 용사(HERO_MAX)와 같고, 보스는 화면을 크게 차지한다. */
const MONSTER_MAX = 400;
const BOSS_MAX = 560;

/**
 * 일반 몬스터. sameAs가 있으면 그 그림(같은 체형의 물 변형)을 두 번째 참조로 받아 같은 몸에 색과 표식만 바꾼다.
 * tail은 생김새 문단 끝에 붙인 문장이다.
 */
function monster(key: string, label: string, look: string, more: { sameAs?: string; tail?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: MONSTER_MAX,
    label,
    refs: more.sameAs !== undefined ? ['d_dwarf_idle', `@monsters/${more.sameAs}`] : ['d_dwarf_idle'],
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(
      MON_REF_NOTE,
      MON_COMMON,
      ...(more.sameAs !== undefined ? [MON_SAME_SPECIES] : []),
      more.tail !== undefined ? `${look} ${more.tail}` : look,
    ),
  };
}

/** 층 보스: 같은 체형의 일반 몬스터(species, 물 변형)를 두 번째 참조로. */
function floorBoss(key: string, label: string, species: string, look: string, note?: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: BOSS_MAX,
    label,
    refs: ['d_dwarf_idle', `@monsters/${species}`],
    ...(note !== undefined ? { note } : {}),
    prompt: para(MON_REF_NOTE, MON_COMMON, FLOOR_BOSS_NOTE, FLOOR_BOSS_FRAME, look),
  };
}

/** 일일 보스: 드워프만 참조로. extra는 다시 뽑을 때 더한 끝 문단. */
function dailyBoss(key: string, label: string, look: string, more: { extra?: string; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: BOSS_MAX,
    label,
    refs: ['d_dwarf_idle'],
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(MON_REF_NOTE, MON_COMMON, DAILY_BOSS_FRAME, look, ...(more.extra !== undefined ? [more.extra] : [])),
  };
}

/** 일반 16 (체형 순, 체형 안에서 물·불·땅·바람), 층 보스 4 (10·20·30·40층의 추천 순서), 일일 보스 5 (1~5일째). */
const MONSTERS: readonly Entry[] = [
  monster(
    'mon_humanoid_water',
    '물방울 고블린 (일반 · 인간형 · 물)',
    'A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin: soft sky blue (#8ec8ee). It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark: one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on top of its pot helmet.',
    {
      note: '첫 판 채택. 고블린의 기준 그림: 같은 체형의 다른 속성 셋과 층 보스가 두 번째 참조로 받는다. bestiary의 무속성 기준(mon_humanoid_base)은 그리지 않고 물 변형을 먼저 그려 기준으로 썼다 (체형 넷 모두 같다).',
    },
  ),
  monster(
    'mon_humanoid_fire',
    '불씨 고블린 (일반 · 인간형 · 불)',
    'A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin: soft red-orange (#e8875a). It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark: one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its pot helmet like a little tuft, no glow.',
    {
      sameAs: 'mon_humanoid_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_humanoid_earth',
    '조약돌 고블린 (일반 · 인간형 · 땅)',
    'A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin: warm ochre brown (#c9995f). It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark: one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its pot helmet.',
    {
      sameAs: 'mon_humanoid_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_humanoid_wind',
    '산들 고블린 (일반 · 인간형 · 바람)',
    'A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin: pale mint (#bfe6d2). It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark: one small curly teal wind swirl (#5fa8a0, a spiral line with a little tail) floating just above its pot helmet.',
    {
      sameAs: 'mon_humanoid_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_armored_water',
    '물방울 동글게 (일반 · 갑각 · 물)',
    'A small chubby round crab monster, wider than tall: a big smooth dome-shaped shell like an upturned bowl in soft sky blue (#8ec8ee), a plain cream rim (#f6ebd5) along the bottom edge of the shell, two short eye stalks on top with dot eyes, a tiny content smile under the shell rim, three short stubby round legs on each side, and two round mitten-like claws (no sharp points): one tiny claw and one comically oversized claw held up proudly toward the left. Turned three-quarters toward the LEFT. Element mark: one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on top of its shell, just behind its eye stalks.',
    {
      tail: CRAB_ONE_COLOR,
      note: '둘째 판. 첫 판(mon_armored_water.rejected1.png)은 파란 등딱지에 집게·다리를 주황(불 색)으로 그려 속성이 헷갈렸다. 몸을 모두 등딱지 색으로 칠하라는 끝 문장(CRAB_ONE_COLOR)을 동글게 넷에 더했다. 동글게의 기준 그림.',
    },
  ),
  monster(
    'mon_armored_fire',
    '불씨 동글게 (일반 · 갑각 · 불)',
    'A small chubby round crab monster, wider than tall: a big smooth dome-shaped shell like an upturned bowl in soft red-orange (#e8875a), a plain cream rim (#f6ebd5) along the bottom edge of the shell, two short eye stalks on top with dot eyes, a tiny content smile under the shell rim, three short stubby round legs on each side, and two round mitten-like claws (no sharp points): one tiny claw and one comically oversized claw held up proudly toward the left. Turned three-quarters toward the LEFT. Element mark: one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its shell, just behind its eye stalks like a little tuft, no glow.',
    {
      sameAs: 'mon_armored_water',
      tail: CRAB_ONE_COLOR,
      note: '첫 판 채택. 불꽃 바깥 주황이 등딱지 색과 가깝지만 외곽선과 노란 속불로 읽힌다.',
    },
  ),
  monster(
    'mon_armored_earth',
    '조약돌 동글게 (일반 · 갑각 · 땅)',
    'A small chubby round crab monster, wider than tall: a big smooth dome-shaped shell like an upturned bowl in warm ochre brown (#c9995f), a plain cream rim (#f6ebd5) along the bottom edge of the shell, two short eye stalks on top with dot eyes, a tiny content smile under the shell rim, three short stubby round legs on each side, and two round mitten-like claws (no sharp points): one tiny claw and one comically oversized claw held up proudly toward the left. Turned three-quarters toward the LEFT. Element mark: one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its shell, just behind its eye stalks.',
    {
      sameAs: 'mon_armored_water',
      tail: CRAB_ONE_COLOR,
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_armored_wind',
    '산들 동글게 (일반 · 갑각 · 바람)',
    'A small chubby round crab monster, wider than tall: a big smooth dome-shaped shell like an upturned bowl in pale mint (#bfe6d2), a plain cream rim (#f6ebd5) along the bottom edge of the shell, two short eye stalks on top with dot eyes, a tiny content smile under the shell rim, three short stubby round legs on each side, and two round mitten-like claws (no sharp points): one tiny claw and one comically oversized claw held up proudly toward the left. Turned three-quarters toward the LEFT. Element mark: one small curly teal wind swirl (#5fa8a0, a spiral line with a little tail) floating just above its shell, just behind its eye stalks.',
    {
      sameAs: 'mon_armored_water',
      tail: CRAB_ONE_COLOR,
      note: '첫 판 채택. 소용돌이는 외곽선 없는 선이다.',
    },
  ),
  monster(
    'mon_flying_water',
    '물방울 박쥐 (일반 · 비행 · 물)',
    'A small round chubby bat monster that is basically one fluffy ball: the body and head are one round blob of soft sky blue (#8ec8ee) fur, two big pointy ears, two dot eyes, a tiny open mouth with ONE small cute fang, a plain cream oval belly (#f6ebd5), comically TINY bat wings in a slightly darker blue (#6fa9cf) flapping hard on both sides (clearly too small to carry its round body), two tiny feet dangling below. It hovers in the air with a determined little face. Turned three-quarters toward the LEFT. Element mark: one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on top of its head, between its ears.',
    {
      note: '첫 판 채택. 통통박쥐의 기준 그림. 날개 옆에 짧은 움직임 선이 있다.',
    },
  ),
  monster(
    'mon_flying_fire',
    '불씨 박쥐 (일반 · 비행 · 불)',
    'A small round chubby bat monster that is basically one fluffy ball: the body and head are one round blob of soft red-orange (#e8875a) fur, two big pointy ears, two dot eyes, a tiny open mouth with ONE small cute fang, a plain cream oval belly (#f6ebd5), comically TINY bat wings in a slightly darker red-orange (#c96a43) flapping hard on both sides (clearly too small to carry its round body), two tiny feet dangling below. It hovers in the air with a determined little face. Turned three-quarters toward the LEFT. Element mark: one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its head, between its ears like a little tuft, no glow.',
    {
      sameAs: 'mon_flying_water',
      note: '첫 판 채택. 틀 안에서 다른 박쥐보다 약 10% 크다 (처리에서 여백을 잘라 내 맞춘다).',
    },
  ),
  monster(
    'mon_flying_earth',
    '조약돌 박쥐 (일반 · 비행 · 땅)',
    'A small round chubby bat monster that is basically one fluffy ball: the body and head are one round blob of warm ochre brown (#c9995f) fur, two big pointy ears, two dot eyes, a tiny open mouth with ONE small cute fang, a plain cream oval belly (#f6ebd5), comically TINY bat wings in a slightly darker brown (#a8774e) flapping hard on both sides (clearly too small to carry its round body), two tiny feet dangling below. It hovers in the air with a determined little face. Turned three-quarters toward the LEFT. Element mark: one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its head, between its ears.',
    {
      sameAs: 'mon_flying_water',
      note: '첫 판 채택. 박쥐 가운데 혼자 움직임 선이 없다.',
    },
  ),
  monster(
    'mon_flying_wind',
    '산들 박쥐 (일반 · 비행 · 바람)',
    'A small round chubby bat monster that is basically one fluffy ball: the body and head are one round blob of pale mint (#bfe6d2) fur, two big pointy ears, two dot eyes, a tiny open mouth with ONE small cute fang, a plain cream oval belly (#f6ebd5), comically TINY bat wings in a slightly darker mint (#8fcab0) flapping hard on both sides (clearly too small to carry its round body), two tiny feet dangling below. It hovers in the air with a determined little face. Turned three-quarters toward the LEFT. Element mark: one small curly teal wind swirl (#5fa8a0, a spiral line with a little tail) floating just above its head, between its ears.',
    {
      sameAs: 'mon_flying_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_spirit_water',
    '물방울 유령 (일반 · 영체 · 물)',
    'A small floating ghost monster: one soft round blob for the head and body (like an upside-down gumdrop), the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms held up, two dot eyes and a small round "o" mouth, shy and a little surprised. Its body is ONE solid flat color, soft sky blue (#8ec8ee), with the dark outline (NOT see-through, no transparency, no glow, no sparkles). It floats in the air above the ground. Turned three-quarters toward the LEFT. Element mark: one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on top of its head.',
    {
      note: '첫 판 채택. 꼬마 유령의 기준 그림. 넷 가운데 가장 좁다.',
    },
  ),
  monster(
    'mon_spirit_fire',
    '불씨 유령 (일반 · 영체 · 불)',
    'A small floating ghost monster: one soft round blob for the head and body (like an upside-down gumdrop), the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms held up, two dot eyes and a small round "o" mouth, shy and a little surprised. Its body is ONE solid flat color, soft red-orange (#e8875a), with the dark outline (NOT see-through, no transparency, no glow, no sparkles). It floats in the air above the ground. Turned three-quarters toward the LEFT. Element mark: one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its head like a little tuft, no glow.',
    {
      sameAs: 'mon_spirit_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_spirit_earth',
    '조약돌 유령 (일반 · 영체 · 땅)',
    'A small floating ghost monster: one soft round blob for the head and body (like an upside-down gumdrop), the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms held up, two dot eyes and a small round "o" mouth, shy and a little surprised. Its body is ONE solid flat color, warm ochre brown (#c9995f), with the dark outline (NOT see-through, no transparency, no glow, no sparkles). It floats in the air above the ground. Turned three-quarters toward the LEFT. Element mark: one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its head.',
    {
      sameAs: 'mon_spirit_water',
      note: '첫 판 채택.',
    },
  ),
  monster(
    'mon_spirit_wind',
    '산들 유령 (일반 · 영체 · 바람)',
    'A small floating ghost monster: one soft round blob for the head and body (like an upside-down gumdrop), the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms held up, two dot eyes and a small round "o" mouth, shy and a little surprised. Its body is ONE solid flat color, pale mint (#bfe6d2), with the dark outline (NOT see-through, no transparency, no glow, no sparkles). It floats in the air above the ground. Turned three-quarters toward the LEFT. Element mark: one small curly teal wind swirl (#5fa8a0, a spiral line with a little tail) floating just above its head.',
    {
      sameAs: 'mon_spirit_water',
      tail: 'The top of its head is one smooth, unbroken round dome (no dent, notch or flat spot where the droplet of the second image sat); the wind swirl floats above it with a small clear gap and does not touch the head.',
      note: '둘째 판. 첫 판(mon_spirit_wind.rejected1.png)은 머리 위 물방울 자리가 오목하게 남아 머리 꼭대기를 매끈하게 하라는 끝 문장을 더했다.',
    },
  ),
  floorBoss(
    'boss_humanoid',
    '고블린 두목 (층 보스 · 인간형)',
    'mon_humanoid_water',
    'The BOSS of the pot goblins: the same chubby goblin species (big round head, two long droopy pointed ears, two dot eyes, one tiny square tooth poking up, warm light grey skin #cfc8c0, a plain cream tunic #f6ebd5 tied with a brown rope, small bare round feet), but about twice as big, much rounder and heavier, with a huge round belly and a proud, grumpy pout. Boss mark: its upside-down cooking-pot helmet (grey #8e8984) has two big curved cream-colored bull horns tied onto it with a rope. It rests a giant wooden soup ladle on its shoulder like a battle club. Turned three-quarters toward the LEFT.',
    '첫 판 채택. 냄비 손잡이가 국자 머리에 조금 겹친다.',
  ),
  floorBoss(
    'boss_armored',
    '투구게 (층 보스 · 갑각)',
    'mon_armored_water',
    "The BOSS of the round crabs: the same chubby dome-shelled crab (a smooth dome shell like an upturned bowl in warm light grey #cfc8c0, a plain cream rim #f6ebd5 along the bottom of the shell, short stubby round legs, round mitten-like claws with no sharp points), but about twice as big and heavier, with BOTH claws oversized and raised in a proud guard pose toward the left. Boss mark: a round iron knight's helmet (grey #8e8984) with a short soft red plume (#c9614a) is jammed on top of its shell, and its two eye stalks poke out through two round holes in the helmet, dot eyes looking very serious. Turned three-quarters toward the LEFT.",
    "첫 판 채택. 표정은 '아주 진지함'보다 만족스러운 얼굴이다.",
  ),
  floorBoss(
    'boss_flying',
    '박쥐 비행대장 (층 보스 · 비행)',
    'mon_flying_water',
    'The BOSS of the chubby bats: the same round fluffy ball of a bat (warm grey-brown fur #a4968a, a plain cream oval belly #f6ebd5, big pointy ears, ONE small cute fang, comically tiny flapping wings in darker grey-brown #857769, two tiny dangling feet), but about twice as big and even rounder, so its tiny wings look even more hopeless; it hovers with a proud, confident face. Boss mark: a brown leather aviator cap (#8a5a3a) with ear flaps and a pair of round goggles pushed up on the forehead; its two pointy ears poke out through holes in the cap. Turned three-quarters toward the LEFT.',
    '첫 판 채택.',
  ),
  floorBoss(
    'boss_spirit',
    '유령 임금 (층 보스 · 영체)',
    'mon_spirit_water',
    'The BOSS of the little ghosts: the same floating gumdrop-shaped ghost (one soft round blob for the head and body, a short wavy tail curling toward the right instead of legs, tiny nub arms, ONE solid flat cream-white body #f6ebd5 that is NOT see-through, no glow), but about twice as big and plumper, with a dignified but sleepy face (half-closed dot eyes, a small calm mouth). Boss mark: a simple golden crown (#f3d36a, three rounded points, no jewels) floating a little above its head, tilted to one side, not touching it. Turned three-quarters toward the LEFT.',
    '첫 판 채택. 금관이 머리에 닿지 않고 떠 있다.',
  ),
  dailyBoss(
    'daily_turtle',
    '연못 거북 (일일 보스 1일째 · 물 · 갑각)',
    'A HUGE chubby old turtle boss, much wider than tall, standing on four short stumpy round legs, its round head stretched forward toward the LEFT with sleepy half-closed eyes and a calm tiny smile. Soft blue-grey skin (#a9c3cc). Its giant dome shell is soft sky blue (#8ec8ee) with only a few big simple plate lines, and the TOP of the shell is a tiny round pond: a flat pale-blue water oval (#d4ecf9) with one round moss-green lily pad (#8fae6b) and one very small green frog sitting on it. Two small water droplets fly off the edge of the shell. Calm, slow, harmless and a little silly. Turned three-quarters toward the LEFT.',
    {
      note: '첫 판 채택. 등딱지 줄이 조금 많고 외곽선이 드워프보다 조금 가늘다.',
    },
  ),
  dailyBoss(
    'daily_mole',
    '두더지 광부 (일일 보스 2일째 · 땅 · 인간형)',
    "A HUGE round chubby mole boss standing upright on two short legs like a miner: warm ochre-brown fur (#c9995f), a big round pink nose (#e8a5a0), eyes drawn as two tiny squinting lines (it can barely see), a puzzled little mouth, two big round pink paws like mittens (no claws). It wears a dented yellow miner's helmet (#f3d36a) with a small round headlamp drawn as a flat cream circle (no light beam, no glow) and moss-green overalls (#8fae6b). It carries a big pickaxe (grey head, brown handle) over one shoulder and a bulging brown sack of round grey ore lumps on its back, with one tiny green sprout growing out of the sack. It squints hard toward the LEFT, a little confused. Turned three-quarters toward the LEFT.",
    {
      note: '첫 판 채택. 곡괭이를 어깨에 메지 않고 앞에 비스듬히 든다.',
    },
  ),
  dailyBoss(
    'daily_dragon',
    '딸꾹 드래곤 (일일 보스 3일째 · 불 · 비행)',
    'A HUGE round chubby baby dragon boss hovering in the air: a big round body in soft red-orange (#e8875a), a cream belly (#f6ebd5) with three simple stripe lines, two short round cream horns, a short tail ending in a small flame-shaped tip, round stubby arms and legs (no claws, no teeth). Its bat-like wings in darker red-orange (#c96a43) flap hard but are a bit too small for its round body. It is in the middle of a hiccup: eyes squeezed shut, cheeks puffed, and a small flat flame (orange #f2a65a with a yellow #f3d36a inner flame) plus one round grey smoke puff popping out of its mouth toward the left. Not scary at all, a little embarrassed. Turned three-quarters toward the LEFT.',
    {
      note: '첫 판 채택. 꼬리 불꽃이 오른쪽 끝에 가깝지만 잘리지 않았다.',
    },
  ),
  dailyBoss(
    'daily_cloud',
    '뭉게 정령 (일일 보스 4일째 · 바람 · 영체)',
    'A HUGE fluffy cumulus cloud spirit boss floating in the air, no legs: one big puffy cloud body made of a few big round bumps, pale mint (#cfeadb) with a few off-white (#f4f7f2) bumps, solid flat fills (NOT see-through, no glow). A face in the middle of the cloud: determined dot eyes and cheeks puffed out hard, lips pushed into a small round "o", blowing a gust toward the LEFT: three curly teal wind swirl lines (#5fa8a0) stream out of its mouth to the left. Two small cloud-puff arms, and a smaller cloud tail trailing behind it on the right. Silly and harmless. Turned three-quarters toward the LEFT.',
    {
      note: '첫 판 채택. 몸에 비해 얼굴이 작다.',
    },
  ),
  dailyBoss(
    'daily_gamasot',
    '가마솥 대감 (일일 보스 5일째 · 불 · 갑각)',
    'A HUGE Korean cast-iron rice cauldron (gamasot) come alive as a boss, wider than tall: a wide round pot body in flat charcoal grey (#6b6461, clearly lighter than the dark outline), a wide flat rim sticking out all around its middle like a brim, two short stubby legs and two short stick arms. Its face is on the pot belly below the rim: two dot eyes and a long thin droopy mustache, looking like a pompous old nobleman. A heavy dark lid sits on top, its round knob shaped like a little topknot, lifted slightly with two round cream steam puffs escaping. A few small flat flames (orange #f2a65a with yellow #f3d36a inner flames) flicker around its feet, no glow. It holds a big wooden rice paddle up like a royal scepter, pointing toward the left. Turned three-quarters toward the LEFT.',
    {
      extra: 'Important details: the wide flat rim goes around the WIDEST MIDDLE of the round pot body (like the brim of a traditional Korean iron cauldron), with the upper half of the pot above it and the face on the lower half below it. The lid knob is firmly ATTACHED to the top center of the lid (not floating). Both arms are the same: two short simple stick arms coming out of the sides of the pot, one holding the rice paddle up, the other a stubby little arm resting at its side. The mustache is long, thin and droopy, hanging down past its chin on both sides. Body and face turned three-quarters toward the LEFT.',
      note: '둘째 판. 첫 판(daily_gamasot.rejected1.png)은 뚜껑 꼭지가 떠 있고, 한쪽 팔이 귀처럼 말렸고, 테가 모자 챙처럼 위에 있어 끝 문단을 더했다. 짙은 회색이라 다른 보스보다 무거워 보인다.',
    },
  ),
];

// ── icons: 화면 아이콘 (기획서 5.5, 5.9, 6장) ────────────────────────────────
// 용사 카드와 편성·전투 화면의 작은 아이콘 (2026-10-13). 아직 게임이 import하지 않는다.
//   속성 4 (element_<ELEMENTS>): 물방울·불꽃·바위·소용돌이. 색은 몬스터의 속성 색(bestiary.json elements)과 같다.
//   무기 6 (weapon_<WEAPON_TYPES>): 한손검·대검·단검·활·석궁·지팡이. 공방의 완성 무기(scene/weapon_*)를 아이콘으로 단순하게.
//   역할 3 (role_melee·role_ranged·role_healer): 근접·원거리·힐러 (편성의 앞열·뒷열).
//   별 문양 5 (star_bronze·silver·gold·moon·sun): 동별·은별·금별, 그다음 달·해 (5.5, 사용자 '금별 다음은 달·해 같은 다른 문양도').
// 참조: 첫째는 드워프(화풍만, STYLE_REF_ONLY). 둘째는 같은 묶음에서 먼저 그린 아이콘(ICON_SAME_SET): 속성은
// element_water를, 무기는 weapon_oneHandSword를, 역할은 role_melee를, 별은 star_bronze를 따른다. 묶음의 첫 아이콘
// (element_water 말고)은 element_water를 따라 네 묶음이 한 벌로 보이게 했다.
// 처리: 투명 여백을 자르고 긴 변 96px (별은 한 줄에 다섯 개를 작게 놓아 64px). 화면에서 20~32px로 쓴다.
// Codex 지시문: 그림 프롬프트(buildPrompt) 끝에 '\n\nSave the generated image as <key>.png in the current directory.'를
// 붙여 codex exec에 바로 보냈다 (gen.ts의 지시문과 낱말이 다르다, 뜻은 같다). 원본은 1254x1254로 나왔다.
// 다시 뽑은 것(한손검, 대검)은 note에 적었다. 나머지는 첫 판이다. 버린 판은 원본 폴더의 <key>.rejected<n>.png.

/** 아이콘 세트의 두 번째 참조 안내. */
const ICON_SAME_SET =
  'The second attached image is another icon from the same game UI icon set. Match it exactly in drawing style, outline weight and how big the shape sits in the frame (same scale and margin, centered), so all the icons look like one set. Do NOT redraw that icon; draw only the new icon described below.';
/** 아이콘 모두: 작게 읽히는 한 덩어리, 투명 배경, 굵은 선. */
const ICON_FRAME =
  'A small game UI icon that must read clearly at 24px: one simple bold shape, centered, filling about three quarters of the square canvas with a comfortable empty margin on every side, nothing cut off. Transparent background with a real alpha channel: no backdrop, no badge or circle behind it, no ground shadow, no glow. Draw it with the same VERY fat, bold dark brown marker outline as the dwarf, one flat color per part (no lighter or darker patches, no shading, no gradient, no glossy shine), and at most one or two inner lines. No face.';

const ICON_MAX = 96;
const STAR_MAX = 64;

/** 아이콘 하나: 1024 정사각, 투명. lead는 따를 아이콘 (없으면 드워프만). */
function icon(key: string, label: string, lead: string | null, body: string, more: { max?: number; note?: string } = {}): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: more.max ?? ICON_MAX,
    label,
    refs: lead !== null ? ['d_dwarf_idle', `@icons/${lead}`] : ['d_dwarf_idle'],
    ...(more.note !== undefined ? { note: more.note } : {}),
    prompt: para(...(lead !== null ? [ICON_SAME_SET] : []), ICON_FRAME, body),
  };
}

const ICONS: readonly Entry[] = [
  icon(
    'element_water',
    '물 속성 (물방울). 아이콘 모두의 기준',
    null,
    'Water element icon: one plump round water droplet (a teardrop shape: a round full bottom rising to one soft rounded point at the top), in one flat soft sky blue (#8ec8ee), with one small flat white curved mark inside near its upper left. Nothing else.',
  ),
  icon(
    'element_fire',
    '불 속성 (불꽃)',
    'element_water',
    'Fire element icon: one chunky cartoon flame (a round full bottom rising into three soft rounded flame tips, the middle tip tallest), in one flat soft red-orange (#e8875a), with one smaller flat warm yellow (#f3d36a) inner flame inside it. Nothing else: no sparks, no embers, no glow. The same size and weight as the droplet in the second image.',
  ),
  icon(
    'element_earth',
    '땅 속성 (바위)',
    'element_water',
    'Earth element icon: one chunky boulder that clearly reads as a hard ROCK, not a sack, a bun or a potato: a blocky rounded-angular shape a little wider than tall, sitting flat, with a few straight edges and blunt corners, in one flat warm ochre brown (#c9995f), with one short zigzag crack line and a tiny two-leaf moss-green (#8fae6b) sprout growing from one corner of its top. Nothing else, no pebbles around it. The same size and weight as the droplet in the second image.',
    { note: '둘째 판. 첫 판(element_earth.rejected1.png)은 둥글고 말랑한 언덕이라 작게 보면 자루(정제의 가방 아이콘)나 감자처럼 읽혔다.' },
  ),
  icon(
    'element_wind',
    '바람 속성 (소용돌이)',
    'element_water',
    'Wind element icon: one curly wind swirl: a fat ribbon that curls inward into a round spiral at the upper right and sweeps out into a long tail toward the lower left, with one shorter curved gust ribbon under it. The ribbons are filled with one flat teal (#5fa8a0) inside the fat dark brown outline. Nothing else, no leaves, no clouds. The same size and weight as the droplet in the second image.',
  ),
  icon(
    'weapon_oneHandSword',
    '한손검. 무기 아이콘의 기준',
    'element_water',
    'One-handed sword icon: a short chunky toy-like sword lying diagonally, the grip at the lower left and the rounded tip at the upper right: a plain flat light grey blade (#c9c9cf), a small flat yellow (#f3d36a) crossguard, a short brown (#8a5a3a) grip and a small round yellow pommel. No sparkle, no engravings, no gems. The blade is straight and fairly SLIM: about one sixth as wide as it is long (a greatsword icon in the same set will have a much wider blade, so this one must not look wide).',
    { note: '둘째 판. 첫 판(weapon_oneHandSword.rejected1.png)은 날이 길이의 3분의 1쯤으로 넓어 대검과 갈리지 않아 날 너비를 비율로 적었다.' },
  ),
  icon(
    'weapon_greatsword',
    '대검',
    'weapon_oneHandSword',
    "Greatsword icon: a big, heavy two-handed sword lying diagonally the same way as the sword in the second image (grip at the lower left, tip at the upper right). Its blade is a huge, heavy, VERY WIDE slab: the blade is nearly as wide as the crossguard is long, only about two and a half times as long as it is wide, and clearly more than twice as wide as the blade of the sword in the second image; flat light grey, with a blunt squared-off tip with rounded corners. A flat yellow crossguard, a thick brown two-hand grip and a big round yellow pommel. The outline must be exactly as fat as in the second image (the same marker), not thinner. At a glance it must read as a much bigger, heavier sword than the second image's, while filling the frame the same way.",
    {
      note: '셋째 판. 첫 판(weapon_greatsword.rejected1.png)은 날이 한손검과 거의 같은 너비이고 외곽선이 가늘었다. 둘째 판(rejected2)은 끝이 각지고 선은 맞았지만 날이 여전히 좁았다.',
    },
  ),
  icon(
    'weapon_dagger',
    '단검',
    'weapon_oneHandSword',
    'Dagger icon: a small knife lying diagonally the same way as the sword in the second image: a short leaf-shaped pointed light grey blade only about as long as its grip, a tiny yellow crossguard, a brown grip with two simple wrap lines and a small round yellow pommel. Drawn at the same icon size as the second image (it fills the frame the same way), but it must read clearly as a short knife, not a sword.',
  ),
  icon(
    'weapon_bow',
    '활',
    'weapon_oneHandSword',
    'Bow icon: a chunky toy-like wooden bow, standing diagonally: the bow arc runs from the lower left to the upper right and bulges toward the upper left. The two limbs are FAT rounded brown (#a8703e) shapes (never thin sticks) with small rounded grey tips and a cream wrapped grip in the middle; one straight dark brown string joins the two tips. No arrow.',
  ),
  icon(
    'weapon_crossbow',
    '석궁',
    'weapon_oneHandSword',
    'Crossbow icon: a crossbow seen from above, pointing to the upper right: a chunky straight brown wooden stock from the lower left to the upper right, a short thick curved brown bow limb crossing its front end, a straight string between the limb tips and one short bolt with a grey head lying on the stock, so it forms a clear cross shape. Very few parts, no trigger details, no screws.',
  ),
  icon(
    'weapon_staff',
    '지팡이',
    'weapon_oneHandSword',
    'Mage staff icon: a fat short brown wooden staff lying diagonally from the lower left to the upper right (the shaft about as wide as the grip of the sword in the second image, never thin), one simple grey ring on the shaft, and its head a chunky curled wooden hook holding one round flat orange (#f2a65a) orb. No glow, no sparkles.',
  ),
  icon(
    'role_melee',
    '근접 (앞열). 역할 아이콘의 기준',
    'element_water',
    'Melee role icon (fighters in the front row): two short chunky toy-like swords crossed in an X, blades pointing up, each with a plain flat light grey blade, a small yellow (#f3d36a) crossguard and a short brown grip. Symmetric and simple, nothing else.',
  ),
  icon(
    'role_ranged',
    '원거리 (뒷열)',
    'role_melee',
    'Ranged role icon (shooters in the back row): a round archery target, an outer soft red (#e46f5a) ring, a cream (#f6ebd5) ring inside it and a small soft red center dot, with one simple arrow (brown shaft, grey head, cream fletching) stuck into the center, coming in diagonally from the lower left. Nothing else.',
  ),
  icon(
    'role_healer',
    '힐러',
    'role_melee',
    'Healer role icon: one plump soft rounded heart in flat soft pink-red (#ea8a7e) with a small flat cream (#f6ebd5) plus sign in its middle. Nothing else, no sparkles.',
  ),
  icon(
    'star_bronze',
    '동별. 별 문양의 기준',
    'element_water',
    'Rank star icon, bronze: one plump five-pointed star with softly rounded points, standing upright, in one flat warm bronze-copper color (#c98a55). No inner lines, nothing else.',
    { max: STAR_MAX },
  ),
  icon(
    'star_silver',
    '은별',
    'star_bronze',
    'Rank star icon, silver: EXACTLY the same plump rounded five-pointed star as the second image (same shape, same size, same outline), only the fill color changes to one flat cool light silver grey (#c9cdd6). Nothing else.',
    { max: STAR_MAX },
  ),
  icon(
    'star_gold',
    '금별',
    'star_bronze',
    'Rank star icon, gold: EXACTLY the same plump rounded five-pointed star as the second image (same shape, same size, same outline), only the fill color changes to one flat bright warm gold (#f6c945). Nothing else.',
    { max: STAR_MAX },
  ),
  icon(
    'star_moon',
    '달 (금별 다음)',
    'star_bronze',
    'Rank mark icon, the moon (one rank above the gold star): one plump crescent moon, its round outer edge on the left and the opening to the right, fat and chunky with softly rounded tips, in one flat pale lemon-cream (#f5e3a0). Drawn at the same size and weight as the star in the second image so it sits in the same row. No stars around it, nothing else.',
    { max: STAR_MAX },
  ),
  icon(
    'star_sun',
    '해 (달 다음)',
    'star_bronze',
    'Rank mark icon, the sun (the highest rank, above the moon): one round flat warm orange (#f29a3f) disc with eight short rounded triangular rays around it in flat warm gold (#f6c945), each ray with its own outline. Drawn at the same size and weight as the star in the second image so it sits in the same row. Nothing else.',
    { max: STAR_MAX },
  ),
];

// ── 전체 목록 ───────────────────────────────────────────────────────────

const inGroup =
  (group: ArtGroup) =>
  (e: Entry): ArtAsset => ({ ...e, group });

/** 모든 에셋. 그룹 순서(ART_GROUPS), 그룹 안에서는 위에 적은 순서. */
export const ART_ASSETS: readonly ArtAsset[] = [
  ...SCENE.map(inGroup('scene')),
  ...UI.map(inGroup('ui')),
  ...[...CARDS_A, ...CARDS_B].map(inGroup('cards')),
  ...REFINE.map(inGroup('refine')),
  ...TOWN.map(inGroup('town')),
  ...HEROES.map(inGroup('heroes')),
  ...MONSTERS.map(inGroup('monsters')),
  ...ICONS.map(inGroup('icons')),
];

/** '그룹/키'. 키는 그룹 안에서만 겹치지 않는다 (bellows, quench는 scene과 cards에 다 있다). */
export function assetId(a: Pick<ArtAsset, 'group' | 'key'>): string {
  return `${a.group}/${a.key}`;
}

export function parseSize(size: ArtSize): { w: number; h: number } {
  const [w, h] = size.split('x').map(Number);
  return { w: w ?? 0, h: h ?? 0 };
}
