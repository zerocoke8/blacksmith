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
// 최종 프롬프트 = 화풍 머리말(STYLE) + [UI·정제면 참조 안내(STYLE_REF_ONLY)] + [카드면 카드 구도(CARD_FRAMING)]
// + 에셋 프롬프트. buildPrompt가 붙인다. 드워프 자세(ownStyle)는 화풍을 프롬프트에 직접 적었다.
// 기록과 다른 점: UI 그림을 처음 뽑을 때는 참조 안내가 Codex 지시문 쪽에 "첨부 1은 화풍 참조일 뿐 …, 첨부 2는
// 그대로 따라 그릴 카드 틀 …"처럼 들어 있었다. 지금은 STYLE_REF_ONLY가 그림 프롬프트 안에 들어가고 gen.ts의
// 지시문은 참조 순서만 적으므로, gen.ts로 다시 뽑으면 낱말이 그때와 조금 다르다 (뜻은 같다). 드워프 6자세의
// 프롬프트는 그림 생성 기록에 없어 메인 세션이 보낸 codex 명령에서 옮겼다 (기록과 대조하지 못했다).
//
// 처리(process.ts)에서 키마다 더 하는 일은 process에 적는다: 카드 일러스트의 가장자리 메움(edge)과
// 양옆으로 넓히기(widen), 단색 배경 색 바꾸기(recolor), 다른 그림과 같은 자리에 맞추기(alignTo).
//
// 그룹 town(마을 지도 시안)은 아직 게임에 쓰지 않는다. 화면에 넣기 전까지 어떤 코드도 import하지 않는다 (아래 town 머리말).

export const ART_GROUPS = ['scene', 'ui', 'cards', 'refine', 'town'] as const;
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
  if (a.group === 'ui' || a.group === 'refine') return `${STYLE}\n\n${STYLE_REF_ONLY}\n\n${a.prompt}`;
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

// ── town: 마을 지도 시안 (기획서 3.8) ─────────────────────────────────────
// 홈 화면 마을 지도 시안의 바닥, 구름 띠, 건물, 탑, 소품. 바닥과 건물을 따로 뽑아 합친다(3.8).
// 아직 어떤 코드도 이 그림들을 import하지 않는다 (번들에 들어가지 않는다). 합친 시안과 합성 방법은
// docs/mockups/town (README.md), 다시 합성하는 스크립트는 tools/art/town/compose.ts.
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

// ── 전체 목록 ───────────────────────────────────────────────────────────

const inGroup =
  (group: ArtGroup) =>
  (e: Entry): ArtAsset => ({ ...e, group });

/** 모든 에셋. 그룹 순서(scene, ui, cards, refine, town), 그룹 안에서는 위에 적은 순서. */
export const ART_ASSETS: readonly ArtAsset[] = [
  ...SCENE.map(inGroup('scene')),
  ...UI.map(inGroup('ui')),
  ...[...CARDS_A, ...CARDS_B].map(inGroup('cards')),
  ...REFINE.map(inGroup('refine')),
  ...TOWN.map(inGroup('town')),
];

/** '그룹/키'. 키는 그룹 안에서만 겹치지 않는다 (bellows, quench는 scene과 cards에 다 있다). */
export function assetId(a: Pick<ArtAsset, 'group' | 'key'>): string {
  return `${a.group}/${a.key}`;
}

export function parseSize(size: ArtSize): { w: number; h: number } {
  const [w, h] = size.split('x').map(Number);
  return { w: w ?? 0, h: h ?? 0 };
}
