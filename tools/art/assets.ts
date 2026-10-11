// 아트 에셋 매니페스트. 그림의 원본은 이 파일이다.
// 그림을 다시 뽑을 때도, 게임에 넣을 때도 여기를 읽는다.
//   1. node tools/art/gen.ts <key> [--out <raw 폴더>]          Codex 이미지 생성으로 <raw>/<그룹>/<key>.png 를 뽑는다
//   2. node tools/art/process.ts --raw <raw 폴더> --only <key>   다듬어 src/assets/art/<그룹>/<key>.webp 와 meta.json 에 쓴다
// 프롬프트를 고쳤으면 그 키를 다시 뽑고 다시 처리한다.
//
// 화풍을 맞추려고 참조 그림(refs)을 함께 보낸다.
//   'name'  참조 폴더(gen.ts --ref)의 <name>.png. 무엇인지와 없을 때 대신 쓸 에셋은 REF_IMAGES에 있다.
//   '@key'  이 매니페스트의 다른 에셋(먼저 뽑아 둔 원본). 예: 카드 틀 네 장은 @frame_progress를 따라 그린다.
//
// 최종 프롬프트 = 화풍 머리말(STYLE) + [카드면 카드 구도(CARD_FRAMING)] + 에셋 프롬프트. buildPrompt가 붙인다.

export const ART_GROUPS = ['scene', 'ui', 'cards'] as const;
export type ArtGroup = (typeof ART_GROUPS)[number];

/** 'WxH' (px). */
export type ArtSize = `${number}x${number}`;

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
  /** 카드 일러스트: 카드 이름과 성격 (사람이 보는 메모, 프롬프트에 들어가지 않는다). */
  readonly label?: string;
  /** true면 이미 있는 원본을 그대로 쓴다. gen.ts는 --force 없이 다시 뽑지 않는다. */
  readonly copy?: boolean;
  readonly note?: string;
}

// ── 화풍 ────────────────────────────────────────────────────────────────

/** 모든 그림 앞에 붙는 화풍 머리말. */
export const STYLE =
  "Hand-painted 2D fantasy game art in the style of Slay the Spire: visible painterly brush strokes, bold readable silhouettes, slightly stylized chunky proportions, warm forge-lit palette (ember orange, soot brown, iron grey, parchment) with cool blue-grey shadows and soft orange rim light coming from the right. Mood: warm but quietly lonely, an old craftsman's workshop at dusk. No text, no letters, no numbers, no logos, no watermark, no signature, no UI, no border.";

/** UI 그룹(카드 틀, 버튼, 아이콘)은 그 자체가 UI이고 테두리라서 'no UI, no border'를 뺀다. */
export const STYLE_UI = STYLE.replace(', no UI, no border', '');

/** 카드 일러스트 구도. 화풍 머리말 다음, 카드별 주제 앞에 붙는다. */
export const CARD_FRAMING =
  "Card illustration for a fantasy card game, square composition, one clear subject centered with breathing room around it (the image will be cropped to a 4:3 window, so keep the subject inside the central area), dramatic forge lighting, dark warm vignette background (NOT transparent). Hands and tools only or objects; if a person appears, show only the dwarf's hands and forearms, never a full face.";

/** 카드 일러스트의 원본 크기·처리 크기. 투명 아님. */
export const CARD_SIZE: ArtSize = '1024x1024';
export const CARD_MAX = 520;

export function buildPrompt(a: ArtAsset): string {
  if (a.group === 'cards') return `${STYLE}\n\n${CARD_FRAMING}\n\nSubject: ${a.prompt}`;
  return `${a.group === 'ui' ? STYLE_UI : STYLE}\n\n${a.prompt}`;
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
  dwarf_idle: {
    file: 'dwarf_idle.png',
    fallback: 'scene/dwarf_idle',
    note: '드워프 대장장이의 기준 그림 (scene/dwarf_idle 원본과 같다). 모든 자세가 이 얼굴·옷·크기를 따른다.',
  },
  dwarf_raise: {
    file: 'dwarf_raise.png',
    fallback: 'scene/dwarf_raise',
    note: '망치를 머리 위로 든 첫 판 (raw/scene/dwarf_raise.rejected1.png와 같다). dwarf_strike를 뽑을 때 썼다. 지금의 scene/dwarf_raise는 다시 뽑은 것이다.',
  },
  style_anvil: {
    file: 'style_anvil.png',
    fallback: 'scene/anvil',
    note: '화풍 기준으로 처음 뽑은 모루 그림 (1254x1254, 어두운 배경이 있는 RGB, 프롬프트 기록 없음). 소품은 이 붓질과 색을 따른다.',
  },
};

// ── scene: 공방 배경, 드워프, 소품, 완성 무기 ─────────────────────────────

type Entry = Omit<ArtAsset, 'group'>;

const SCENE: readonly Entry[] = [
  {
    key: 'bg_workshop',
    size: '1536x1024',
    transparent: false,
    max: 1400,
    prompt:
      'Interior of an old dwarven smithy carved into a mountain, wide landscape view at eye level. Back wall of rough stone blocks with heavy wooden beams, iron tools hanging on the wall (tongs, hammers, files), shelves with ingots and clay jars, a small round window on the upper left with cold blue dusk light, a weapon rack with a few finished blades on the right wall, warm orange glow spilling in from off-screen right (a forge). Stone floor with soot. The lower-middle area of the floor is EMPTY and uncluttered because a character, an anvil and a furnace will be placed there later. Edges slightly darker, gentle vignette.',
  },
  {
    key: 'dwarf_idle',
    size: '1230x1278',
    transparent: true,
    max: 900,
    copy: true,
    note: '이미 있음(raw/scene/dwarf_idle.png). 다시 뽑지 마라. 프롬프트는 첫 시험 때 쓴 것을 기록해 둔 것이다.',
    prompt:
      'A stout old dwarf blacksmith, full body, side view facing right, holding a forging hammer at rest, leather apron, braided grey beard, warm painterly 2D game art style like Slay the Spire, soft rim light from a forge. Transparent background with a real alpha channel.',
  },
  {
    key: 'dwarf_raise',
    size: '1024x1536',
    transparent: true,
    max: 900,
    refs: ['dwarf_idle'],
    note: '첫 판(raw/scene/dwarf_raise.rejected1.png, 참조 폴더의 dwarf_raise.png와 같다)은 몸이 가늘고 머리가 작아 다른 네 자세와 체격이 달랐고, 팔을 끝까지 뻗어 망치가 게이지 판 밑으로 들어갔다. dwarf_idle 체격으로 다시 뽑았다.',
    prompt:
      'The attached image shows our dwarf blacksmith character standing. Draw the SAME character with the SAME build: the same large head, the same broad barrel-shaped torso and thick arms, the same grey braided beard with metal rings, the same cream shirt, leather apron, green trousers, leather bracers and boots, the same painterly style, full body, side view facing right. Same scale as the reference: he fills about 80 percent of the image height, boots near the bottom edge with a small margin. New pose: both hands grip the hammer handle and lift it overhead, ready to bring it down onto an anvil in front of him (do not draw the anvil). The hammer head is just above and slightly behind the top of his own head, NOT at full arm stretch: elbows clearly bent, upper body only slightly arched back, feet planted apart, so the silhouette stays compact and stocky like the reference. The whole hammer is visible with a small margin at the top. Transparent background with a real alpha channel. Lighting the same as the reference: warm orange forge rim light from the right.',
  },
  {
    key: 'dwarf_strike',
    size: '1024x1536',
    transparent: true,
    max: 900,
    refs: ['dwarf_idle', 'dwarf_raise'],
    prompt:
      'The attached images show our dwarf blacksmith character (image 1 standing, image 2 with the hammer raised). Draw the SAME character (same face, grey braided beard with metal rings, same clothes, apron, colors, same painterly style, full body, side view facing right) at the same scale as image 1: he fills about 80 percent of the image height, boots near the bottom edge with a small margin. New pose: the instant a hammer blow lands. Feet apart, knees slightly bent, upper body leaning forward. Both hands grip the hammer handle in front of his chest with the arms reaching forward; the handle slopes gently down from his hands, and the hammer head is in front of him at the height of his belt (about half of his own height above the floor, NOT down near his knees), its flat striking face pointing down, as if it just struck hot iron lying on an anvil top at belt height (do not draw the anvil or the iron). The whole hammer head is visible with a small margin on the right. Transparent background with a real alpha channel. Lighting the same as the references: warm orange forge rim light from the right.',
      note: '처음 뽑은 판(raw/scene/dwarf_strike.rejected1.png)은 망치 머리가 무릎 높이라 모루 위의 쇠에 닿지 않았다. 망치 머리를 허리띠 높이로 다시 뽑았다.',
  },
  {
    key: 'dwarf_work',
    size: '1024x1536',
    transparent: true,
    max: 900,
    refs: ['dwarf_idle'],
    prompt:
      'The attached image shows our dwarf blacksmith character. Draw the SAME character (same face, beard, clothes, colors, painterly style, scale, full body, side view facing right) in a new pose: leaning forward with focus, holding a small whetstone in one hand and a pair of tongs in the other at waist height in front of him, carefully polishing something (do not draw the object being polished). Transparent background with a real alpha channel.',
  },
  {
    key: 'dwarf_cheer',
    size: '1024x1536',
    transparent: true,
    max: 900,
    refs: ['dwarf_idle'],
    prompt:
      'The attached image shows our dwarf blacksmith character. Draw the SAME character (same face, beard, clothes, colors, painterly style, scale, full body, side view facing right) in a new pose: quiet satisfaction, standing straight and holding the hammer resting on his shoulder, a small proud smile under the beard. Transparent background with a real alpha channel.',
  },
  {
    key: 'anvil',
    size: '1024x1024',
    transparent: true,
    max: 600,
    refs: ['style_anvil'],
    prompt:
      'A heavy old iron anvil on a thick wooden stump, seen from the side at eye level with the horn pointing left, worn flat top face clearly visible. Same painterly style as the attached image. Transparent background with a real alpha channel.',
  },
  {
    key: 'furnace',
    size: '1024x1536',
    transparent: true,
    max: 800,
    refs: ['style_anvil'],
    prompt:
      'A dwarven stone forge furnace standing on the floor, front three-quarter view from the left: an arched opening full of glowing coals and lively flames, a brick hood and chimney going up, iron pokers leaning on the side. Same painterly style as the attached image. Transparent background with a real alpha channel.',
  },
  {
    key: 'bellows',
    size: '1024x1024',
    transparent: true,
    max: 450,
    refs: ['style_anvil'],
    prompt:
      'A large blacksmith bellows made of leather and dark wood with brass studs, lying horizontally on a small wooden stand, the nozzle pointing right. Same painterly style as the attached image. Transparent background with a real alpha channel.',
  },
  {
    key: 'quench',
    size: '1024x1024',
    transparent: true,
    max: 450,
    refs: ['style_anvil'],
    prompt:
      'A wooden quenching barrel bound with iron hoops, filled to the brim with dark still water, a pair of tongs resting on the rim. Side view. Same painterly style as the attached image. Transparent background with a real alpha channel.',
  },
  {
    key: 'iron_hot',
    size: '1536x1024',
    transparent: true,
    max: 420,
    prompt:
      'A single rough rectangular bar of glowing hot iron, lying horizontally, side view: bright yellow-orange core fading to deep red at the edges, small flakes of scale, faint heat shimmer. Nothing else. Transparent background with a real alpha channel.',
  },
  {
    key: 'iron_cracked',
    size: '1536x1024',
    transparent: true,
    max: 420,
    refs: ['@iron_hot'],
    note: '쇠가 갈라졌을 때(결과 화면, 장면의 갈라짐). 예전에는 iron_hot을 회색으로 칠하고 금을 선으로 그렸다.',
    prompt:
      'The attached image is the hot iron bar from the same game. Paint the SAME bar (same shape, size, side view, lying horizontally) after it has failed: it has gone cold, dull dark grey and soot brown with flaky scale, split in two by one jagged crack across the middle, the two halves slightly apart, a faint dull red glow deep inside the seam, a few small chips. Painted with the same brush strokes as the reference, not a line drawing. Nothing else. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_oneHandSword',
    size: '1024x1024',
    transparent: true,
    max: 640,
    prompt:
      'A finished one-handed arming sword, beautifully forged steel blade with a leather-wrapped grip and simple brass cross-guard, displayed diagonally from lower left to upper right, a soft gleam along the edge. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_greatsword',
    size: '1024x1024',
    transparent: true,
    max: 640,
    prompt:
      'A finished two-handed greatsword, long broad forged steel blade, long grip, heavy cross-guard, displayed diagonally from lower left to upper right, a soft gleam along the edge. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_dagger',
    size: '1024x1024',
    transparent: true,
    max: 640,
    prompt:
      'A finished dagger, short forged steel blade with a fine edge, wrapped grip and small guard, displayed diagonally from lower left to upper right, a soft gleam along the edge. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_bow',
    size: '1024x1024',
    transparent: true,
    max: 640,
    prompt:
      'A finished recurve longbow of dark wood reinforced with forged steel fittings and tips, string drawn straight, displayed diagonally, a soft gleam on the metal. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_crossbow',
    size: '1024x1024',
    transparent: true,
    max: 640,
    prompt:
      'A finished crossbow with a forged steel prod and iron-bound wooden stock, displayed diagonally, a soft gleam on the metal. Transparent background with a real alpha channel.',
  },
  {
    key: 'weapon_staff',
    size: '1024x1536',
    transparent: true,
    max: 640,
    prompt:
      'A finished mage staff: a straight shaft of dark wood bound with forged iron rings, the head a forged iron claw holding a softly glowing crystal, displayed diagonally. Transparent background with a real alpha channel.',
  },
];

// ── ui: 카드 틀, 카드 뒷면, 게이지, 버튼, 더미, 화로 상태, 작은 아이콘 ─────────

/** 카드 틀 다섯 장이 같이 쓰는 배치 설명. */
const FRAME_LAYOUT =
  'An ornate EMPTY fantasy trading card frame, portrait 2:3, front view, perfectly symmetric and flat (no perspective). Layout: a round empty socket at the top-left corner (for a cost number), a horizontal blank name banner across the top, a large rectangular art window in the upper half, a small blank ribbon right below the art window, and a blank parchment text panel filling the lower half. Everything blank, no text or symbols. The art window is an empty flat dark area. Transparent background outside the card with a real alpha channel.';

/** frame_progress를 참조로 보내고 재질만 바꾼 틀. */
function frameVariant(key: string, material: string): Entry {
  return {
    key,
    size: '1024x1536',
    transparent: true,
    max: 640,
    refs: ['@frame_progress'],
    prompt: `Make the SAME card frame as the attached image with IDENTICAL layout, proportions and positions of every part; only change the material: ${material}. ${FRAME_LAYOUT}`,
  };
}

/** 화로 상태 아이콘이 같이 쓰는 그림 설명. 매끈한 캐주얼 불꽃이 아니라 화로 그림의 붓질로. */
const FIRE_ICON =
  'Game UI status icon for the state of a forge fire, painted in the SAME painterly style as the attached forge furnace picture: textured oil-paint brush strokes, warm glowing coals and embers, soft painted glow, NOT glossy, NOT cartoon, no outline, no sparkle stars, no lens flare. One flame rising from a small bed of glowing coals, centered, the flame filling most of the height, readable at 48 pixels. States are told apart only by the flame\'s colour, height, shape and ember density. Transparent background with a real alpha channel.';

/** fire_normal을 기준으로 상태만 바꾼 화로 아이콘. */
function fireVariant(key: string, state: string): Entry {
  return {
    key,
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['@fire_normal', '@furnace'],
    prompt: `${FIRE_ICON} Keep the SAME framing, coal bed, scale and brushwork as the first attached image (the normal flame icon of the same set). State: ${state}.`,
  };
}

const UI: readonly Entry[] = [
  {
    key: 'frame_progress',
    size: '1024x1536',
    transparent: true,
    max: 640,
    prompt: `${FRAME_LAYOUT} Material: dark forged iron with ember-red enamel accents and rivets.`,
  },
  frameVariant('frame_quality', 'polished silver with pale blue enamel and small blue gems'),
  frameVariant('frame_support', 'warm bronze with amber enamel and leather accents'),
  frameVariant('frame_material', 'gold with veins of raw ore and small crystals'),
  frameVariant('frame_imprint', 'blackened steel with faint violet glowing rune engravings'),
  {
    key: 'card_back',
    size: '1024x1536',
    transparent: true,
    max: 400,
    prompt:
      'The back of a fantasy card, portrait 2:3, flat front view: dark brown tooled leather with an embossed iron emblem of a hammer crossing over an anvil in the center, ornate iron corner pieces and border. No text. Transparent background outside the card with a real alpha channel.',
  },
  {
    key: 'orb_durability',
    size: '1024x1024',
    transparent: true,
    max: 280,
    prompt:
      'A round game UI gauge orb, front view: a thick riveted iron ring holding a swirling molten ember core (orange and gold), the center fairly calm and evenly lit so a number can be drawn over it. Transparent background with a real alpha channel.',
  },
  {
    key: 'btn_reheat',
    size: '1536x1024',
    transparent: true,
    max: 420,
    prompt:
      'A wide horizontal game UI button plate, front view: blackened iron plate with riveted corners and glowing ember-red edges like metal pulled from a forge, the center is a blank flat area for a label. Transparent background with a real alpha channel.',
  },
  {
    key: 'pile_draw',
    size: '1024x1024',
    transparent: true,
    max: 180,
    prompt:
      'Game UI icon: a small neat stack of fantasy cards with dark leather backs held by an iron clasp, slightly tilted, readable at small size. Transparent background with a real alpha channel.',
  },
  {
    key: 'pile_discard',
    size: '1024x1024',
    transparent: true,
    max: 180,
    prompt:
      'Game UI icon: a small heap of grey ash with a few charred card fragments and two dying embers, readable at small size. Transparent background with a real alpha channel.',
  },
  {
    key: 'pile_exhaust',
    size: '1024x1024',
    transparent: true,
    max: 180,
    prompt:
      'Game UI icon: a single curl of pale smoke rising from a spent black coal, readable at small size. Transparent background with a real alpha channel.',
  },
  {
    key: 'fire_normal',
    size: '1024x1024',
    transparent: true,
    max: 140,
    refs: ['@furnace'],
    note: '화로 상태 아이콘 여덟 장의 기준. 첫 판(rejected1)은 매끈한 캐주얼 게임 불꽃이라 화로·장면의 붓질과 어긋났다. scene/furnace를 참조로 다시 칠했다.',
    prompt: `${FIRE_ICON} State: normal, a steady medium orange flame of middle height.`,
  },
  fireVariant('fire_good', 'good, a bright golden-yellow flame, taller and fuller than normal, lively, with a few drifting embers'),
  fireVariant(
    'fire_excellent',
    'excellent, the tallest and brightest flame of the set, a white-gold core, a soft warm halo of glow behind it and many rising embers (no star or cross shapes)',
  ),
  fireVariant('fire_poor', 'poor, a small dim blue-grey flame barely alive over grey ash and dark coals'),
  fireVariant('fire_sturdy', 'sturdy, a heavy, low, wide orange flame enclosed by a thick ring of rough stone blocks, solid and unmoving'),
  fireVariant('fire_surge', 'surge, a tall roaring crimson-red flame leaping upward in flickering tongues with a spray of embers'),
  fireVariant('fire_malleable', 'malleable, a soft wavy pink-orange flame with rounded curling tongues, flowing like molten honey'),
  fireVariant('fire_goodOmen', 'good omen, a small calm orange flame with one single bright golden ember floating high above its tip'),
  {
    key: 'icon_heat',
    size: '1024x1024',
    transparent: true,
    max: 110,
    prompt:
      'Game UI icon: a single red-hot glowing coal with faint heat waves above it. Readable at 32 pixels. Transparent background with a real alpha channel.',
  },
  {
    key: 'icon_progress',
    size: '1024x1024',
    transparent: true,
    max: 110,
    prompt:
      'Game UI icon: a small blacksmith hammer striking, with three short spark lines. Readable at 32 pixels. Transparent background with a real alpha channel.',
  },
  {
    key: 'icon_quality',
    size: '1024x1024',
    transparent: true,
    max: 110,
    refs: ['@icon_progress'],
    note: '첫 판(rejected1)은 반짝이는 캐주얼 게임 다이아몬드라 icon_progress, 카드 그림과 화풍이 달랐다.',
    prompt:
      'Game UI icon in the SAME painterly style, brushwork and lighting as the attached hammer icon (muted, hand-painted, not glossy, not cartoon): a small dwarven rune-cut gem of dull silver-blue steel set in a plain dark iron bezel, a soft warm orange rim light from the right and one quiet highlight on its top facet. No star sparkle, no lens flare, no outline. Readable at 32 pixels, centered. Transparent background with a real alpha channel.',
  },
];

// ── cards: 카드 일러스트 ([키, 카드 이름·성격, 주제]) ─────────────────────────
// 키는 sim의 카드 id와 같다. 프롬프트 = STYLE + CARD_FRAMING + 'Subject: ' + 주제.

/** 기본 카드와 해금 카드. */
export const CARDS_A: readonly (readonly [key: string, label: string, subject: string])[] = [
  ['hammer', '두드리기 (기본, 공정 카드)', 'a hammer striking a glowing iron bar on an anvil, a burst of bright sparks'],
  ['polish', '다듬기 (기본, 품질 카드)', 'a whetstone gliding along the edge of a cooling blade, a thin line of silver light'],
  ['precisePolish', '정밀 다듬기 (기본, 품질 카드)', 'precision work on the very tip of a blade: fingertips hold a small oil stone against the point, a round magnifying lens on a brass stand and a lit candle beside it, tight crop on the blade tip, minute silver glints, calm cool light'],
  ['bellows', '풀무질 (기본, 보조: 열기)', 'two hands pumping a leather bellows, the coals beyond flaring bright orange'],
  ['quench', '담금질 (기본, 보조)', 'a red-hot blade plunged into a barrel of water, an explosive cloud of white steam'],
  ['finisher', '마무리 (기본, 품질: 열기를 써서 마무리)', 'a finished blade held up toward warm light, a single long gleam running along its edge, embers drifting'],
  ['thrift', '아껴 치기 (해금, 보조: 다음 카드 비용을 줄임)', 'saving effort: a small light hammer giving one gentle tap to a thin strip of glowing iron at the edge of a workbench, beside a neat stack of unused iron offcuts and a few old coins, wide view, cooler blue-grey light with only a little forge glow, no big anvil in view'],
  ['carefulHammer', '신중한 두드리기 (해금, 공정)', 'a single precise tap: close-up of the narrow edge of a small hammer touching only the very tip of a glowing bar, the other hand steadying the bar with tongs, one tiny spark, low angle from the side of the anvil, calm blue-grey ambient light with a soft orange glow on the iron'],
  ['firstHammer', '첫 망치 (해금, 공정, 첫 손)', 'the first hammer blow of the day on fresh glowing iron, pale dawn light from a window mixing with forge light'],
  ['keepForging', '단조 유지 (해금, 보조: 내구도 회복)', 'tongs holding iron back into the glowing coals to keep it hot, patient work'],
  ['thickAnvil', '두꺼운 모루판 (해금, 각인: 영구 효과)', 'a massive thick anvil face engraved with a faint glowing rune, solid and immovable'],
  ['heatUp', '달구기 (해금, 보조: 열기)', 'an iron bar buried in white-hot coals, heat waves rising'],
  ['bigStrike', '크게 내려치기 (해금, 공정)', 'a huge sledgehammer coming down hard on glowing iron, a ring-shaped shockwave of sparks'],
  ['trainedArm', '단련된 팔 (해금, 각인)', 'a powerful scarred forearm wrapped in a worn leather bracer gripping a hammer handle, a faint rune glowing on the bracer'],
  ['lastStroke', '최후의 한 수 (해금, 공정, 간직)', 'the final blow: a hammer frozen at the instant of impact on an almost finished sword blade (a clearly recognisable sword with a point and a tang, not a plain bar) lying on the anvil, a perfect ring of golden sparks bursting outward, slight motion blur on the hammer, warm gold light'],
  ['firstTouch', '첫 손질 (해금, 품질, 첫 손)', 'a first touch: one bare calloused fingertip lightly testing the edge of a freshly cooled steel blade, a thin bright line of light running along the edge where the finger touches, extreme close-up, shallow depth of field with a soft blurred background, no whetstone, no file, no hammer'],
  ['allIn', '혼신 (해금, 보조: 다음 카드 강화)', 'two hands gripping a hammer with all their strength, an aura of flame wrapping around the arms'],
  ['kindle', '불씨 살리기 (해금, 보조)', 'cupped hands gently blowing on a small ember to bring a dying fire back to life'],
  ['reread', '불 다시 보기 (해금, 보조: 화로 상태 다시 굴리기)', 'an old dwarf seen from the side in profile, medium close-up of his brow, eye and the edge of his grey beard (never a front view of the face), calmly studying the forge flame in front of him, lit warmly by the furnace glow, the forge mouth glowing in the foreground, quiet and contemplative'],
  ['smithSense', '대장장이의 감 (해금, 보조)', 'an old weathered hand resting flat on an anvil, feeling the metal, a faint golden glow of intuition'],
  ['deftHand', '섬세한 손 (해금, 각인)', 'nimble hands holding fine engraving tools over a blade, a delicate violet rune glow'],
  ['flameReading', '불꽃 읽기 (해금, 각인)', 'a flame shaped like an eye inside the forge, ancient rune marks around it'],
];

/** 재료 카드, 전설 재료 카드, 가문 카드, 시즌 카드. */
export const CARDS_B: readonly (readonly [key: string, label: string, subject: string])[] = [
  ['ironMelt', '쇳물 고르기 (재료, 철)', 'a ladle of glowing molten iron being stirred, slag skimmed off'],
  ['steelFold', '강철 접기 (재료, 강철)', 'a glowing steel billet being folded over itself on the anvil, visible layers'],
  ['mithrilGrain', '미스릴 결 (재료, 미스릴)', 'a silvery-blue mithril ingot with a shimmering flowing grain pattern'],
  ['orichalcumGlow', '오리할콘 빛 (재료, 오리할콘)', 'a red-gold orichalcum ingot glowing from within like a sunset'],
  ['adamantCore', '아다만 심 (재료, 아다만)', 'a dark nearly black adamant crystal core set inside a block of steel, deep violet sheen'],
  ['dragonBreath', '용의 숨결 (전설 재료: 화룡의 심장)', 'a fiery dragon heart breathing flame into a forge, the coals turning white-hot'],
  ['rekindle', '다시 피는 불 (전설 재료: 불사조의 꼬리깃)', 'a phoenix tail feather rising from grey ashes and setting them alight again'],
  ['giantHammer', '거인의 망치 (전설 재료: 거인의 핵)', "an enormous stone-and-iron hammer with a glowing giant's core in its head"],
  ['layeredShell', '겹친 갑피 (전설 재료: 여왕의 갑피)', 'layered iridescent insect-queen carapace plates fused onto glowing metal'],
  ['stormBellows', '폭풍 풀무 (전설 재료: 폭풍 깃)', 'a storm feather crackling with lightning feeding a whirlwind into a forge'],
  ['tailwind', '순풍 (전설 재료: 정령왕의 숨결)', 'a gentle luminous green-white spirit breath flowing over glowing iron'],
  ['deepWater', '깊은 물 담금 (전설 재료: 심해룡의 비늘)', 'a deep-sea dragon scale sinking into dark abyssal water, a blade quenched with blue steam'],
  ['frostFinish', '서리 마무리 (전설 재료: 서리 왕관 조각)', 'a shard of a frost crown spreading ice crystals along a finished blade edge'],
  ['repayStrike', '갚는 일격 (가문 바일 — "외상은 반드시 갚는다", 한손검)', 'a one-handed sword striking, a small stack of old coins and a ledger with a ribbon at the side'],
  ['windRead', '바람 읽기 (가문 네아 — "먼저 보고 먼저 말한다", 활)', 'a single feather drifting in the wind beside a bowstring, light and quick'],
  ['downStrike', '내려찍기 (가문 오델 — "무거운 것을 먼저 든다", 대검)', 'a heavy greatsword chopping straight down, cracked stone below'],
  ['edgeHone', '잔날 세우기 (가문 아렌 — "보스 앞에서 휘파람을 분다", 단검)', 'two daggers side by side, one being honed to a razor edge, one old and unused'],
  ['emberWatch', '잿불 살피기 (가문 이솔 — 재가 묻은 회색 목도리, 석궁)', 'a hand in a grey ash-covered scarf sleeve stirring ashes to reveal glowing embers beneath'],
  ['ashHammer', '재 섞인 망치 (시즌 「재의 악마의 탑」)', 'a hammer coated in grey ash striking iron, grey and orange sparks mixed'],
  ['ashQuench', '재 담금질 (시즌 「재의 악마의 탑」)', 'a blade quenched in ash-grey water, a column of grey steam'],
];

function cardEntry([key, label, subject]: readonly [string, string, string]): Entry {
  return { key, size: CARD_SIZE, transparent: false, max: CARD_MAX, label, prompt: subject };
}

// ── 전체 목록 ───────────────────────────────────────────────────────────

const inGroup =
  (group: ArtGroup) =>
  (e: Entry): ArtAsset => ({ ...e, group });

/** 모든 에셋. 그룹 순서(scene, ui, cards), 그룹 안에서는 위에 적은 순서. */
export const ART_ASSETS: readonly ArtAsset[] = [
  ...SCENE.map(inGroup('scene')),
  ...UI.map(inGroup('ui')),
  ...[...CARDS_A, ...CARDS_B].map(cardEntry).map(inGroup('cards')),
];

/** '그룹/키'. 키는 그룹 안에서만 겹치지 않는다 (bellows, quench는 scene과 cards에 다 있다). */
export function assetId(a: Pick<ArtAsset, 'group' | 'key'>): string {
  return `${a.group}/${a.key}`;
}

export function parseSize(size: ArtSize): { w: number; h: number } {
  const [w, h] = size.split('x').map(Number);
  return { w: w ?? 0, h: h ?? 0 };
}
