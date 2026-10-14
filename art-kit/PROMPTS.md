# Codex 프롬프트 모음 (낙서풍 D 화풍)

이 파일은 '용사의 대장간'의 그림 204장을 Codex로 뽑을 때 쓴 **그림 프롬프트 전부**를 모은 것이다.
그림 매니페스트(`tools/art/assets.ts`)를 스크립트로 읽어 만들었고, 손으로 옮겨 적은 프롬프트는 없다.
9장에는 매니페스트 밖에서 쓴 프롬프트를 같은 꼴로 모았다 (화풍 후보, 적다운 몬스터, 대형 보스, 얼굴 편집, 그때의 감싸기).

새 프로젝트에서 이 화풍으로 그림을 뽑을 때는 이 파일을 **예문집**으로 쓴다.
만들 그림과 비슷한 항목을 찾아 프롬프트의 짜임(문단 순서, 금지어, 비율 표현)을 따르고, 생김새 문단만 새로 쓴다.
화풍을 지키는 규칙과 그 이유는 `ART_STYLE_GUIDE.md`에 있다.
새 프로젝트에서 키트로 실제로 뽑아 본 그림 넷의 항목과 보낸 원문은 `ART_STYLE_GUIDE.md` 9.8과 `samples/new-project-examples/prompts/`에 있다 (이 파일에는 넣지 않았다: 이 게임의 그림이 아니다).

- 만든 날: 2026-10-14. 원본: `tools/art/assets.ts`(매니페스트)와 매니페스트 밖 프롬프트의 원문 모음. 크기의 '실제 원본'과 처리 뒤 크기는 `src/assets/art/meta.json`에서 왔다.
- 매니페스트 그림 204장 (scene 20, ui 23, cards 35, refine 14, town 29, heroes 36, monsters 25, icons 22). 9장의 기록 블록 58개.
- 조각 86개. 조각으로 줄여 매니페스트 프롬프트 384k자를 92k자로, 9장의 블록 90k자를 51k자로 적었다.
- 모든 블록은 조각을 풀면 원문과 글자까지 같다 (만든 스크립트가 하나씩 되돌려 확인했다).

## 차례

- [0. 이 파일을 읽는 법](#0-이-파일을-읽는-법)
  - [0.1 항목 하나의 꼴](#01-항목-하나의-꼴)
  - [0.2 Codex에 보내는 지시문 (감싸기)](#02-codex에-보내는-지시문-감싸기)
  - [0.3 그림 프롬프트를 짜는 순서](#03-그림-프롬프트를-짜는-순서)
  - [0.4 공용 조각](#04-공용-조각)
- [1. scene: 공방 장면 (드워프, 소품, 완성 무기)](#1-scene-공방-장면-드워프-소품-완성-무기)
  - [1.1 이 장의 조각](#11-이-장의-조각)
  - [1.2 드워프: 기준 그림과 자세 다섯 (6장)](#12-드워프-기준-그림과-자세-다섯-6장)
  - [1.3 공방 배경과 소품 (5장)](#13-공방-배경과-소품-5장)
  - [1.4 쇠 막대 (3장)](#14-쇠-막대-3장)
  - [1.5 완성 무기 (6장)](#15-완성-무기-6장)
- [2. ui: 카드 틀, 버튼, 상태 아이콘](#2-ui-카드-틀-버튼-상태-아이콘)
  - [2.1 이 장의 조각](#21-이-장의-조각)
  - [2.2 카드 틀과 뒷면 (6장)](#22-카드-틀과-뒷면-6장)
  - [2.3 계기, 버튼, 카드 더미 (5장)](#23-계기-버튼-카드-더미-5장)
  - [2.4 화로 상태 아이콘 (8장)](#24-화로-상태-아이콘-8장)
  - [2.5 작은 아이콘 (3장)](#25-작은-아이콘-3장)
  - [2.6 전투 화면: 필살기 불꽃 테 (1장)](#26-전투-화면-필살기-불꽃-테-1장)
- [3. cards: 카드 일러스트](#3-cards-카드-일러스트)
  - [3.1 이 장의 조각](#31-이-장의-조각)
  - [3.2 기본·해금 카드: 대개 드워프 장면 (22장)](#32-기본해금-카드-대개-드워프-장면-22장)
  - [3.3 재료·전설 재료 카드: 사물만 (13장)](#33-재료전설-재료-카드-사물만-13장)
- [4. refine: 광석 정제 화면](#4-refine-광석-정제-화면)
  - [4.1 이 장의 조각](#41-이-장의-조각)
  - [4.2 덩어리와 더미 (2장)](#42-덩어리와-더미-2장)
  - [4.3 결과 표 아이콘 (10장)](#43-결과-표-아이콘-10장)
  - [4.4 버튼과 가방 (2장)](#44-버튼과-가방-2장)
- [5. town: 마을 지도](#5-town-마을-지도)
  - [5.1 이 장의 조각](#51-이-장의-조각)
  - [5.2 바닥과 하늘 (2장)](#52-바닥과-하늘-2장)
  - [5.3 건물 (10장)](#53-건물-10장)
  - [5.4 탑 넷 (4장)](#54-탑-넷-4장)
  - [5.5 소품 (13장)](#55-소품-13장)
- [6. heroes: 용사 36명](#6-heroes-용사-36명)
  - [6.1 이 장의 조각](#61-이-장의-조각)
  - [6.2 예제 (10장)](#62-예제-10장)
  - [6.3 명단: 네 묶음 (26장)](#63-명단-네-묶음-26장)
- [7. monsters: 몬스터 25종](#7-monsters-몬스터-25종)
  - [7.1 이 장의 조각](#71-이-장의-조각)
  - [7.2 일반: 체형 4 × 속성 4 (16장)](#72-일반-체형-4--속성-4-16장)
  - [7.3 층 보스 (4장)](#73-층-보스-4장)
  - [7.4 일일 보스 (5장)](#74-일일-보스-5장)
- [8. icons: 작은 UI 아이콘](#8-icons-작은-ui-아이콘)
  - [8.1 이 장의 조각](#81-이-장의-조각)
  - [8.2 속성 (4장)](#82-속성-4장)
  - [8.3 무기 (6장)](#83-무기-6장)
  - [8.4 역할 (3장)](#84-역할-3장)
  - [8.5 별 문양 (5장)](#85-별-문양-5장)
  - [8.6 전투 화면의 단추와 상태 표시 (4장)](#86-전투-화면의-단추와-상태-표시-4장)
- [9. 매니페스트 밖의 프롬프트 (기록)](#9-매니페스트-밖의-프롬프트-기록)
  - [9.0 이 장의 조각](#90-이-장의-조각)
  - [9.1 화풍 v1: 슬레이 더 스파이어식 페인터리 (버림, 2026-10-11)](#91-화풍-v1-슬레이-더-스파이어식-페인터리-버림-2026-10-11)
  - [9.2 SD 후보 A·B·C (모두 버림, 2026-10-12)](#92-sd-후보-abc-모두-버림-2026-10-12)
  - [9.3 SD 후보 D·E·F·G (D 채택, 2026-10-12)](#93-sd-후보-defg-d-채택-2026-10-12)
  - [9.4 D 드워프 자세 5장 (실제로 보낸 글자, 2026-10-12)](#94-d-드워프-자세-5장-실제로-보낸-글자-2026-10-12)
  - [9.5 적다운 몬스터 12종 `foe_*` (2026-10-13)](#95-적다운-몬스터-12종-foe_-2026-10-13)
  - [9.6 대형 보스 6종 `boss_*` (2026-10-13)](#96-대형-보스-6종-boss_-2026-10-13)
  - [9.7 얼굴만 '살짝 멍청하게' 고치기 (편집, 2026-10-13)](#97-얼굴만-살짝-멍청하게-고치기-편집-2026-10-13)
  - [9.8 그때의 지시문 두 가지](#98-그때의-지시문-두-가지)
- [10. 조각 찾아보기](#10-조각-찾아보기)

## 0. 이 파일을 읽는 법

### 0.1 항목 하나의 꼴

그림마다 아래 순서로 적었다.

- **제목**: `그룹/키`, 그리고 이 게임에서의 이름과 쓰임(매니페스트의 label).
- **크기**: 요청한 크기, 실제로 나온 원본 크기, 투명 여부, 처리 뒤 크기. 요청 크기는 매니페스트가 지금 부탁하는 크기다(드워프처럼 처음 뽑을 때 크기를 적지 않은 그림도 있다).
  정사각 1024x1024를 부탁해도 1254x1254로 나올 때가 많았다. 크기는 믿지 말고 처리에서 맞춘다.
- **참조**: `codex exec`에 `-i`로 붙인 그림. 적은 순서가 첨부 순서다.
  프롬프트가 "first attached image", "second attached image"라고 부르므로 순서가 바뀌면 안 된다.
  - `d_dwarf_idle`: 화풍 기준 드워프(`ref/d_dwarf_idle.png`). **모든 그림의 첫 참조**이고, 드워프를 그리지 않는 그림에도 붙인다.
  - `d_dwarf_strike`, `d_dwarf_work`: 망치를 내려치는 드워프, 숫돌질하는 드워프(`ref/`). 카드 장면의 두 번째 참조로 썼다.
  - `@키`, `@그룹/키`: 같은 세트에서 **먼저 그린 그림**(세트 기준)의 원본 PNG. 선 굵기, 틀 안의 크기, 시점을 맞추려고 붙였다.
    새 프로젝트에서는 그 세트에서 처음 채택한 그림으로 바꿔 붙인다.
    이 게임의 세트 기준 몇 장은 키트의 `ref/`에 키 이름 그대로 들어 있다(예: `ref/hero_vail.png`, `ref/element_water.png`).
  - 자기 키(`town/ground_b`의 `@ground_b`처럼): 고쳐 그리기다. 다시 뽑기 직전의 원본을 보낸다.
- **조각**: 프롬프트 안의 `{{이름}}`. 여러 그림이 같이 쓰는 긴 문장이나 문단이다.
  원문은 0.4절(공용)과 각 장의 첫 절(그 장의 조각)에 있고, 10장에서 모두 찾아볼 수 있다.
  `<key>`, `<size>`가 든 조각은 그 자리를 항목의 키와 크기로 바꿔 넣는다.
- **처리**: 처리 단계(`process.ts`)가 그림마다 더 하는 일. 가장자리 메움(edge), 양옆 넓히기(widen), 배경색 바꾸기(recolor) 같은 것이다.
- **메모**: 매니페스트의 note 원문. 다시 뽑은 그림에는 "둘째 판. 첫 판은 …"처럼 **무엇이 틀려서 무슨 말을 더했는지**가 적혀 있다.
  이 파일에서 가장 쓸모 있는 기록이다.
- **프롬프트 블록**: Codex에 보낸 **그림 프롬프트**(image prompt).
  `{{이름}}`을 조각 원문으로 바꾸면 보낸 글자와 빈 줄까지 똑같아진다.
  이 파일을 만든 스크립트가 204장 모두를 이렇게 되돌려, 매니페스트가 만드는 프롬프트와 글자까지 같은지 확인했다.

### 0.2 Codex에 보내는 지시문 (감싸기)

그림 프롬프트를 그대로 보내지 않는다. 아래 지시문으로 감싸 `codex exec`의 표준 입력으로 보낸다. 이 게임에서는 `tools/art/gen.ts`가 만들었고, 키트의 `tools/gen.ts`도 같은 지시문을 쓴다.
`<key>`는 그림 키, `<size>`는 요청 크기, `<shape>`는 square·landscape·portrait 가운데 하나다.

```text
Use your built-in image generation tool (image_gen) to create exactly ONE image, then save it as <key>.png in the current directory.
- Size: <size> (<shape>). If the tool has a size parameter, use this size or the closest supported one.
- Background: TRANSPARENT, a real alpha channel in a PNG, no backdrop at all. If the tool has a background parameter, set it to transparent.
- Attached reference images, in order: 1) d_dwarf_idle, 2) <두 번째 참조>. Use them as the image prompt says.
- Generate once, then copy the generated file from where the tool saved it to ./<key>.png. Do not edit, crop, resize or post-process it, and do not create any other files.

Image prompt:
<그림 프롬프트: 이 파일의 블록에서 {{이름}}을 모두 조각 원문으로 바꾼 것>

Reply with only the saved file path.
```

- 불투명 그림이면 Background 줄이 `- Background: a fully painted, opaque image that fills the whole frame. No transparency.`로 바뀐다.
- 참조가 하나면 참조 줄이 `- Attached reference image: 1) d_dwarf_idle. Use it as the image prompt says.`로 바뀐다. 참조 이름 앞의 `@`는 뺀다.
- 실행 명령은 아래 꼴이다. 마지막 `-`는 프롬프트를 표준 입력에서 읽으라는 뜻이고, 프롬프트를 보낸 뒤 표준 입력을 닫는다.
  `<원본 폴더>`는 Codex 원본 PNG가 쌓이는 곳이다 (이 게임의 gen.ts는 `--out`, 키트의 gen.ts는 `--raw`나 프로젝트 파일의 `PROJECT_DIRS.raw`).

```text
codex exec --skip-git-repo-check -C <원본 폴더>/<그룹> -s workspace-write --color never [-m <모델>] -i <참조1> -i <참조2> -- -
```

지시문의 줄마다 이유가 있다 (자세한 것은 `ART_STYLE_GUIDE.md`).

- "built-in image generation tool (image_gen)": Codex가 내장 도구를 쓰게 한다. 그러지 않으면 API 키가 필요한 다른 길로 갈 수 있다.
- "Generate once": Codex가 자기 결과를 보고 다시 그려 파일을 덮어쓰는 일을 막는다.
- "copy the generated file": 내장 도구는 그림을 `~/.codex/generated_images/` 아래에만 저장하고 저장 위치를 받지 않는다. 그래서 Codex가 복사해 와야 한다.

**기록과 다른 점.** 매니페스트의 그림 상당수는 gen.ts가 생기기 전에 손으로 쓴 지시문으로 뽑았다.
예를 들어 끝 줄이 "Save the generated image as <key>.png in the current directory. Reply with only the saved file path."였거나, 크기 줄이 "use this size"였다.
그림 프롬프트는 같고 감싸기의 낱말만 다르다. 그때의 감싸기는 9장에 있다.

### 0.3 그림 프롬프트를 짜는 순서

매니페스트의 `buildPrompt`가 그룹에 따라 앞말을 붙인다.

| 그룹 | 그림 프롬프트 |
|---|---|
| `scene`, `town`, `heroes`(명단 26명), `monsters` | `{{STYLE}}` + 빈 줄 + 본문 |
| `ui`, `refine`, `icons` | `{{STYLE}}` + 빈 줄 + `{{STYLE_REF_ONLY}}` + 빈 줄 + 본문 |
| `cards` | `{{STYLE}}` + 빈 줄 + `{{CARD_FRAMING}}` + 빈 줄 + 본문 |
| 드워프 자세, 용사 예제 10명 (ownStyle) | 본문만. 화풍 문장이 본문 안에 있다 |

이 파일의 블록은 앞말까지 붙인 **최종 그림 프롬프트**다. 본문의 문단 순서는 세트마다 거의 같다.

1. 화풍 머리말 (`{{STYLE}}`)
2. 드워프는 화풍 참조일 뿐이고 그리지 말라는 안내
3. 두 번째 참조(세트 기준)를 무엇에 맞추고 무엇을 따라 그리지 말지
4. 세트 공통 문단 (자세, 보는 방향, 비례, 투명, 여백)
5. [등급, 보스, 틀 크기 문단]
6. 이 그림의 생김새
7. [다시 뽑으며 더한 "IMPORTANT …" 끝 문단. 다시 뽑을 때는 앞 문단을 고치지 않고 끝에 더했다]

### 0.4 공용 조각

#### 조각 STYLE

화풍 머리말(D 화풍). buildPrompt가 거의 모든 그림 앞에 붙인다. D 드워프를 고른 뒤 그 그림을 말로 옮겨 쓴 것이다. 새 프로젝트에서도 이 문장을 바꾸지 않는다.

```text
Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (cream, warm brown, soft grey, soft orange, a little muted). No text, no letters, no numbers, no watermark, no signature.
```

#### 조각 STYLE_REF_ONLY

드워프는 화풍만 따르고 그리지 말라는 안내. ui·refine·icons 그룹에는 buildPrompt가 붙이고, town 그룹은 본문에 직접 적었다. 드워프가 없는 그림에는 이 문장이 꼭 있어야 한다.

```text
The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only what is asked below.
```

## 1. scene: 공방 장면 (드워프, 소품, 완성 무기)

카드 제작 화면 위쪽의 공방 장면이다. 드워프 6자세(기준 그림 dwarf_idle과 자세 5), 공방 배경, 모루·화로·풀무·물통, 쇠 막대 셋, 완성 무기 여섯.

- `dwarf_idle`은 **화풍의 뿌리**다. 참조 없이 글로만 뽑은 후보 D(9.3절)이고, `ref/d_dwarf_idle.png`와 같은 그림이다. 다시 뽑지 않는다(copy).
  이 항목만 조각으로 줄이지 않고 원문 그대로 적었다.
- 자세 다섯은 d_dwarf_idle 하나만 참조로 `{{DWARF_SAME}}` + " New pose: …"로 뽑았고, 모두 첫 판을 채택했다.
  원본이 모두 1227x1282로 같은 캔버스라 게임은 몸 높이로 크기를 맞춘다.
- 소품은 모루(`@anvil`)를, 무기는 한손검(`@weapon_oneHandSword`)을 두 번째 참조로 받아 선 굵기를 맞췄다.
  작은 물건은 외곽선이 얇아지기 쉬워서 "물건 너비의 약 3%"처럼 비율로 적었다.

### 1.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 DWARF_SAME

드워프 자세 다섯 장의 앞말(참조 d_dwarf_idle 하나). 뒤에 " New pose: <자세>"가 붙는다. STYLE을 붙이지 않는다(ownStyle).

```text
The attached image is our dwarf blacksmith in the final art style. Draw the SAME character in EXACTLY the same style: super simple flat doodle, the grey beard is one big round blob with two tiny braids, grey hair blob, two dot eyes, small nose, tiny stick-like arms and legs, little brown boots, brown apron, cream shirt, uneven hand-drawn dark outline, flat colors, NO shading, NO extra detail. Same size and proportions (about 2 heads tall), side view facing right. Transparent background with a real alpha channel. No text.
```

#### 조각 SCENE_PROP_TAIL

공방 소품(풀무·물통·달군 쇠)의 끝 문단. 첫 판 풀무의 외곽선이 드워프보다 얇아서, 모루(@anvil)의 외곽선을 "물건 너비의 약 3%"로 따라 그리게 했다.

```text
It belongs in the same scene as the attached dwarf and the attached anvil. Copy the outline of the attached anvil image exactly: a VERY fat, bold dark brown marker line, roughly 3 percent of the object's width, just as heavy as on the anvil. Plain flat fills, no extra lines, no texture lines. Center it with empty margin around it, filling about 60 percent of the image width. Transparent background with a real alpha channel.
```

#### 조각 WEAPON_TAIL

완성 무기의 끝 문단: 굵은 마커 외곽선, 광택·장식 없음, 틀의 약 70%.

```text
Draw it with the same VERY fat, bold dark brown marker outline as the attached reference images (as heavy as on the dwarf and the anvil), plain flat fills, no shading, no metal shine, no engravings, no gems, no extra lines. The sparkle is a tiny simple four-point star. Keep the whole weapon inside the frame with empty margin around it, filling about 70 percent of the image. Transparent background with a real alpha channel.
```

### 1.2 드워프: 기준 그림과 자세 다섯 (6장)

#### `scene/dwarf_idle`

- **크기**: 원본 1227x1282 (세로, 이미 있는 그림이라 요청 크기가 없다) · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 713x815
- **참조**: 없음
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다 · 이미 있는 원본을 그대로 쓴다(copy): 생성 스크립트가 --force 없이는 다시 뽑지 않는다
- **메모**: 화풍 기준 그림(참조 d_dwarf_idle과 같다). 네 화풍 후보(D~G) 가운데 사용자가 D를 골랐다. 다시 뽑지 마라.

```text
Character design for a cozy comic mobile game: an old dwarf blacksmith (grey hair and a big grey beard with two small braids, cream shirt, brown leather apron, little boots, holding a forging hammer). Make him SILLY, HUMBLE and a bit pathetic-cute (the Korean 'hachanhan' meme vibe): tiny and stubby, very LOW detail, very simple shapes, few colors, comic deadpan expression. Full body, side view facing right, standing. Transparent background with a real alpha channel. No text. Style D: super simple flat doodle, about 2 heads tall, the beard is one big round blob covering most of the body, two dot eyes peeking above the beard, tiny stick-like arms and legs, uneven hand-drawn dark outline, flat colors with no shading at all. Looks like a cute doodle drawn in a minute.
```

#### `scene/dwarf_raise`

- **크기**: 요청 1227x1282 (세로) · 실제 원본 1227x1282 · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 518x900
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`DWARF_SAME`](#조각-dwarf_same)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다

```text
{{DWARF_SAME}} New pose: both tiny arms holding the hammer raised high above his head, ready to strike down in front of him, beard blob bouncing up a little.
```

#### `scene/dwarf_strike`

- **크기**: 요청 1227x1282 (세로) · 실제 원본 1227x1282 · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 661x761
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`DWARF_SAME`](#조각-dwarf_same)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다

```text
{{DWARF_SAME}} New pose: the moment right after a hammer blow, both tiny arms holding the hammer brought down in front of him at belly height (the hammer head is in front of the beard, as if it just hit an anvil top, do not draw the anvil), body leaning forward, eyes squeezed shut as two short lines.
```

#### `scene/dwarf_work`

- **크기**: 요청 1227x1282 (세로) · 실제 원본 1227x1282 · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 581x788
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`DWARF_SAME`](#조각-dwarf_same)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다

```text
{{DWARF_SAME}} New pose: leaning forward with focus, a small grey whetstone in his tiny hands held out in front of him, polishing something (do not draw the object), tongue sticking out a little in concentration.
```

#### `scene/dwarf_cheer`

- **크기**: 요청 1227x1282 (세로) · 실제 원본 1227x1282 · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 663x814
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`DWARF_SAME`](#조각-dwarf_same)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 완성 연출.

```text
{{DWARF_SAME}} New pose: satisfied, the hammer resting on his shoulder, eyes closed as two happy upward arcs, a tiny blush, standing a bit proudly.
```

#### `scene/dwarf_slump`

- **크기**: 요청 1227x1282 (세로) · 실제 원본 1227x1282 · 투명 · 여백을 자르고 긴 변 900px까지 줄임 → 721x762
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`DWARF_SAME`](#조각-dwarf_same)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 실패 연출: 쇠가 갈라졌을 때, 망치를 내려놓았을 때.

```text
{{DWARF_SAME}} New pose: disappointed, shoulders drooped, head hanging down, the hammer dragging on the floor from one hand, a small sigh puff near his face.
```

### 1.3 공방 배경과 소품 (5장)

#### `scene/bg_workshop`

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 불투명 · 긴 변 1400px까지 줄임 → 1400x933
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style)
- **메모**: 벽과 바닥의 경계가 그림 높이의 약 53%(1024px 원본에서 y≈545). 그 아래는 평평한 갈색 바닥이라 소품을 놓기 좋다.

```text
{{STYLE}}

A cozy little dwarf smithy interior as a simple flat doodle, wide landscape: back wall of big simple stone blocks in muted warm grey-brown, two wooden beams, a few tools hanging on the wall (one hammer, one pair of tongs) as simple shapes, a small round window with a dark blue night sky and one tiny star on the upper left, a small shelf with two ingots on the right, the floor a flat warm brown. Calm, uncluttered, a little muted and darker than the characters so they pop in front. The lower middle of the floor is EMPTY (a character, an anvil and a furnace will be placed there). Opaque background, no characters.
```

#### `scene/anvil`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 600px까지 줄임 → 534x474
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style)
- **메모**: 둘째 판. 첫 판은 그루터기에 나뭇결을 그렸다.

```text
{{STYLE}}

A chunky little grey anvil sitting on a short round wooden stump, side view, the horn pointing left, flat top. Cute proportions, very simple. Draw it with the SAME fat marker pen as the dwarf: the dark brown outline must be very thick and bold (about as thick as on the dwarf's beard and hammer), so draw the anvil fairly small and centered in the canvas, filling only about half of the image width, with lots of empty space around it. The stump is a plain flat brown cylinder with a flat lighter top ellipse, NO wood grain lines, NO rings; the anvil is a plain flat grey shape with no extra lines. Transparent background with a real alpha channel.
```

#### `scene/furnace`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 800px까지 줄임 → 709x800
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@anvil` = `scene/anvil` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style)

```text
{{STYLE}}

A small round stone forge furnace with a short chimney, front three-quarter view, an arched mouth with simple flat orange and yellow flames inside, a few stone blocks drawn as simple rounded shapes. Cute and chunky. It belongs in the same scene as the attached dwarf and the attached anvil, so draw it with the SAME fat dark brown marker outline as them (very thick and bold) and the same flat fills: only about 8 to 10 big rounded stones in total, no cracks, no soot, no texture, no glow, no light on the stones; the flames are two or three flat cartoon flame shapes. Keep the furnace centered with empty space around it, filling about two thirds of the image height. Transparent background with a real alpha channel.
```

#### `scene/bellows`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 450px까지 줄임 → 450x261
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@anvil` = `scene/anvil` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`SCENE_PROP_TAIL`](#조각-scene_prop_tail)
- **메모**: 둘째 판. 첫 판은 외곽선이 드워프보다 얇았다.

```text
{{STYLE}}

A small chunky round brown leather bellows on a tiny wooden stand, lying horizontally, the nozzle pointing right, simple shapes. Only two simple fold lines on the leather, no stitches, no studs. {{SCENE_PROP_TAIL}}
```

#### `scene/quench`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 450px까지 줄임 → 450x335
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@anvil` = `scene/anvil` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`SCENE_PROP_TAIL`](#조각-scene_prop_tail)

```text
{{STYLE}}

A small wooden bucket with two iron bands, filled with flat blue water, a pair of tongs leaning on its rim. Side view, simple. The bucket is a plain flat brown shape with no plank lines (or at most two), the water is one flat blue ellipse with no ripples, the tongs are one simple dark grey shape. {{SCENE_PROP_TAIL}}
```

### 1.4 쇠 막대 (3장)

#### `scene/iron_hot`

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 420px까지 줄임 → 420x170
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@anvil` = `scene/anvil` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`SCENE_PROP_TAIL`](#조각-scene_prop_tail)
- **처리**: 기준점을 재 meta.json에 적음(measure: bar, 이 게임 전용)

```text
{{STYLE}}

A small rectangular bar of glowing hot iron lying horizontally, side view, flat orange-yellow fill with a lighter yellow center stripe, two or three tiny sparkle marks around it. The bar is a simple rounded rectangle, the sparkles are tiny simple four-point stars or dashes with the same outline. Nothing else. {{SCENE_PROP_TAIL}}
```

#### `scene/iron_cracked`

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 420px까지 줄임 → 420x170
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@iron_hot` = `scene/iron_hot` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style)
- **처리**: 막대를 `iron_hot`와 같은 캔버스·자리에 맞춤(alignTo) · 기준점을 재 meta.json에 적음(measure: bar, crack, 이 게임 전용)
- **메모**: iron_hot과 짝이 되게 iron_hot을 참조로 다시 그렸다. 처리할 때 막대를 iron_hot에 맞춰 같은 캔버스에 놓는다(process.alignTo).

```text
{{STYLE}}

The SAME small iron bar as in the second attached image (same long rounded-rectangle shape, same length and thickness, same position in the frame, and EXACTLY the same very fat dark brown marker outline as that bar), but gone cold: one flat dark grey fill, no stripe, no sparkles. One jagged zigzag crack across its middle drawn as a fat dark brown zigzag line with a thin muted dull red line inside it. One tiny simple grey smoke puff (a small round cloud with the same fat outline) just above the crack. Nothing else, no shading, no texture.
```

#### `scene/iron_cold`

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 420px까지 줄임 → 420x170
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@iron_hot` = `scene/iron_hot` (먼저 그린 같은 세트 그림) · 3) `@iron_cracked` = `scene/iron_cracked` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style)
- **처리**: 막대를 `iron_hot`와 같은 캔버스·자리에 맞춤(alignTo) · 기준점을 재 meta.json에 적음(measure: bar, 이 게임 전용)
- **메모**: 망치를 내려놓았을 때(그만둠)의 식은 쇠. 갈라지지 않고 반짝이도 없다. 결과 화면과 장면이 iron_hot을 회색으로 칠하던 것(반짝이·밝은 띠가 남았다)을 바꾼다. 처리할 때 막대를 iron_hot에 맞춘다.

```text
{{STYLE}}

The SAME small iron bar as in the second attached image (same long rounded-rectangle shape, same length and thickness, same position in the frame, and EXACTLY the same very fat dark brown marker outline as that bar), but gone cold and left whole: one flat soft grey fill, the same grey as the cold bar in the third attached image, no stripe, no crack, no sparkles, no shine, no highlight. One tiny thin wisp of steam (a small round puff with the same fat outline) rising just above its right end. Nothing else, no shading, no texture.
```

### 1.5 완성 무기 (6장)

#### `scene/weapon_oneHandSword`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 640x638
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@anvil` = `scene/anvil` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`WEAPON_TAIL`](#조각-weapon_tail)

```text
{{STYLE}}

A cute chunky one-handed sword, diagonal from lower left to upper right, simple grey blade, brown grip, small yellow guard, one tiny sparkle on the blade. A short, stubby, slightly wide blade with a rounded tip, cute toy-like proportions. {{WEAPON_TAIL}}
```

#### `scene/weapon_greatsword`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 640x614
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@weapon_oneHandSword` = `scene/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`WEAPON_TAIL`](#조각-weapon_tail)
- **메모**: 둘째 판. 첫 판은 날이 가늘었다(날 너비를 비율로 적어 고쳤다).

```text
{{STYLE}}

A cute but big, heavy two-handed greatsword, diagonal from lower left to upper right, one tiny sparkle. Chunky and heavy: a VERY WIDE simple flat grey blade (the blade is about twice as wide as the blade of the attached one-handed sword, roughly one quarter as wide as it is long) with a blunt rounded-square tip, a wide flat yellow guard, a long thick brown two-hand grip with a round yellow pommel. Same cute toy-like style and same yellow and brown colors as the attached sword, and exactly the same fat dark brown outline thickness as the attached sword. {{WEAPON_TAIL}}
```

#### `scene/weapon_dagger`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 556x551
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@weapon_oneHandSword` = `scene/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`WEAPON_TAIL`](#조각-weapon_tail)

```text
{{STYLE}}

A cute small dagger, diagonal from lower left to upper right, short grey blade, wrapped brown grip, tiny guard, one tiny sparkle. It must clearly read as a small knife compared with the attached one-handed sword: a short leaf-shaped pointed blade about as long as the grip, a tiny yellow guard, a brown grip with two or three simple wrap lines, a small round yellow pommel. Same cute toy-like style, same colors and exactly the same fat dark brown outline thickness as the attached sword. {{WEAPON_TAIL}}
```

#### `scene/weapon_bow`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 603x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@weapon_oneHandSword` = `scene/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style)
- **메모**: 셋째 판. 앞 판들은 활대가 가늘었다.

```text
{{STYLE}}

A cute chunky toy-like bow, diagonal, one tiny sparkle. The bow arc runs from the lower left to the upper right and curves toward the upper left. The two limbs are FAT rounded brown wooden shapes, about as wide as the brown grip of the attached sword (never thin sticks), with small rounded grey tips and a cream wrapped grip in the middle. The string is one straight dark brown line between the two tips. No arrow. The sparkle is a tiny simple four-point star. Same cute toy-like style, colors and exactly the same VERY fat, bold dark brown marker outline as the attached sword (second image), plain flat fills, no shading, no wood grain, no extra lines. Keep the whole bow inside the frame with empty margin around it, filling about 70 percent of the image.
```

#### `scene/weapon_crossbow`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 640x569
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@weapon_oneHandSword` = `scene/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`WEAPON_TAIL`](#조각-weapon_tail)

```text
{{STYLE}}

A cute simple crossbow, brown wooden stock and a grey bow arm, a loaded bolt, pointing to the upper right, one tiny sparkle. Seen from above at a diagonal: a chunky straight brown stock from the lower left to the upper right, a short thick grey bow arm crossing it near the front end, a straight thin string, one short bolt with a grey head lying on the stock. Very few parts, no trigger details, no screws. Same cute toy-like style, colors and exactly the same fat dark brown outline thickness as the attached sword. {{WEAPON_TAIL}}
```

#### `scene/weapon_staff`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 463x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@weapon_oneHandSword` = `scene/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style)
- **메모**: 둘째 판. 첫 판은 자루가 가늘고 울퉁불퉁했다.

```text
{{STYLE}}

A cute chunky toy-like mage staff, diagonal from the lower left to the upper right, one tiny sparkle. The shaft is FAT and short-ish, a plain brown rounded stick about as wide as the brown grip of the attached sword (never thin), with two simple grey rings; the head is one simple chunky curled wooden hook holding one round flat orange orb (one flat orange, no glow). The sparkle is a tiny simple four-point star. Same cute toy-like style, colors and exactly the same VERY fat, bold dark brown marker outline as the attached sword (second image), plain flat fills, no shading, no wood grain, no extra lines. Keep the whole staff inside the frame with empty margin around it, filling about 70 percent of the image height.
```

## 2. ui: 카드 틀, 버튼, 상태 아이콘

- 카드 틀 다섯 장은 `frame_progress`가 기준이다. 나머지 넷은 그 그림을 두 번째 참조로 받아 **테두리 색만** 바꿨다.
  칸 위치를 게임 배치에 맞추려고 대략의 비율(%)을 프롬프트에 적었다.
- 화로 상태 일곱 장은 `fire_normal`이 기준이다. 상태끼리 색으로 구별하므로 색을 세게 적는다(`fire_malleable`의 메모).
- `ult_ready`(전투 화면, 2026-10-14)는 필살기가 찬 용사 카드 뒤에 까는 불꽃 테다. 가운데를 **처음부터 빈 투명 구멍**으로 부탁했다.
  투명 그림 속의 큰 평면은 매팅 구멍이 뚫리기 쉬워서, 구멍이 필요한 자리는 처음부터 구멍으로 부탁한다.

### 2.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 FRAME_SAME

카드 틀 네 장의 앞말(두 번째 참조 @frame_progress). 바로 뒤에 테두리 색이 온다.

```text
Make the SAME card frame as the second attached image with IDENTICAL layout, proportions and positions of every part; only change the border color to
```

#### 조각 FRAME_BODY

카드 틀 다섯 장이 같이 쓰는 생김새 문단.

```text
A simple cute EMPTY card frame drawn as a flat doodle, portrait 2:3, front view, flat and symmetric: a rounded rectangle with a thick uneven dark brown outline and a colored border band, a round cost bubble at the top-left corner, a name banner strip across the top, a big rectangular art window in the upper half filled with flat cream, a small ribbon tab right below the art window, and a cream paper text area in the lower half. All blank, no text or symbols. Transparent background outside the card with a real alpha channel.
```

#### 조각 FIRE_SAME

화로 상태 아이콘 여섯 장의 앞말(두 번째 참조 @fire_normal). 바로 뒤에 이 상태의 불꽃이 온다.

```text
Same icon style, size and framing as the second attached flame icon:
```

### 2.2 카드 틀과 뒷면 (6장)

#### `ui/frame_progress`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 439x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FRAME_BODY`](#조각-frame_body)
- **처리**: 기준점을 재 meta.json에 적음(measure: frame, 이 게임 전용)
- **메모**: 틀 다섯 장의 기준. 칸 위치를 layout.ts CARD_FACE에 가깝게 맞추려고 대략의 비율을 프롬프트에 적었다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FRAME_BODY}} Border color: warm orange-red. The card fills almost the whole canvas with only a thin transparent margin. Rough proportions (fractions of the card): the cost bubble is centred about 12% from the left and 8% from the top, overlapping the corner; the name banner runs from about 23% to 89% of the width near the top (about 6% to 12% of the height); the art window spans about 12% to 89% of the width and 16% to 53% of the height; the ribbon tab is centred just under it (about 54% to 59% of the height, about half the card width); the text area spans about 10% to 91% of the width and 61% to 92% of the height. Every inner part has its own thick dark brown outline.
```

#### `ui/frame_quality`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 436x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@frame_progress` = `ui/frame_progress` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FRAME_SAME`](#조각-frame_same), [`FRAME_BODY`](#조각-frame_body)
- **처리**: 기준점을 재 meta.json에 적음(measure: frame, 이 게임 전용)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FRAME_SAME}} soft sky blue. {{FRAME_BODY}}
```

#### `ui/frame_support`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 437x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@frame_progress` = `ui/frame_progress` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FRAME_SAME`](#조각-frame_same), [`FRAME_BODY`](#조각-frame_body)
- **처리**: 기준점을 재 meta.json에 적음(measure: frame, 이 게임 전용)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FRAME_SAME}} mint green. {{FRAME_BODY}}
```

#### `ui/frame_material`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 435x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@frame_progress` = `ui/frame_progress` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FRAME_SAME`](#조각-frame_same), [`FRAME_BODY`](#조각-frame_body)
- **처리**: 기준점을 재 meta.json에 적음(measure: frame, 이 게임 전용)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FRAME_SAME}} golden yellow. {{FRAME_BODY}}
```

#### `ui/frame_imprint`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 640px까지 줄임 → 435x640
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@frame_progress` = `ui/frame_progress` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FRAME_SAME`](#조각-frame_same), [`FRAME_BODY`](#조각-frame_body)
- **처리**: 기준점을 재 meta.json에 적음(measure: frame, 이 게임 전용)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FRAME_SAME}} soft lavender purple. {{FRAME_BODY}}
```

#### `ui/card_back`

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 274x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The back of a cute doodle card, portrait 2:3, flat: a brown rounded rectangle with a thick outline and a simple cream hammer-over-anvil emblem in the middle, a few dots around it. Transparent background outside the card with a real alpha channel.
```

### 2.3 계기, 버튼, 카드 더미 (5장)

#### `ui/orb_durability`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 280px까지 줄임 → 280x280
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)
- **처리**: 기준점을 재 meta.json에 적음(measure: ring, 이 게임 전용)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A round doodle game gauge seen from the front: a thick grey iron ring with four rivet dots, holding a flat orange molten center with a lighter yellow middle, plain enough for a number to be drawn over it. Transparent background with a real alpha channel.
```

#### `ui/btn_reheat`

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 420px까지 줄임 → 420x91
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@orb_durability` = `ui/orb_durability` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)
- **메모**: 셋째 판. 첫 판은 짙은 숯색에 외곽선이 흐린 번짐이었고(검토: 외곽선이 묻혀 덩어리로 읽힌다), 둘째 판도 외곽선 없이 번졌다. 외곽선을 또렷한 선으로, 채움을 계기의 쇠고리 회색으로 적어 다시 뽑았다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A wide rounded doodle game button plate seen from the front, a long pill shape about four times as wide as it is tall. IMPORTANT: the whole plate is surrounded by one VERY fat, solid, crisp dark brown marker line (the same dark brown and the same heavy weight as the outline of the iron ring in the second attached image), drawn right on the plate's edge, a clean hard line with no glow, no blur, no soft halo and no shadow outside it. Inside the line: one flat warm light grey fill, the same grey as the iron ring in the second attached image. Two little orange flame marks with the same fat outline sit just inside the left and right ends. A blank flat center for a label. Plain flat fills, no shading, no rivets, no texture. Transparent background with a real alpha channel.
```

#### `ui/pile_draw`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 180px까지 줄임 → 180x169
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle icon: a small neat stack of three brown cards, slightly tilted, readable at small size. Transparent background with a real alpha channel.
```

#### `ui/pile_discard`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 180px까지 줄임 → 180x162
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@pile_draw` = `ui/pile_draw` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)
- **메모**: 둘째 판. 첫 판은 재 더미에 잔점이 많고(질감) 외곽선이 얇았다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle game icon (discard pile): a small rounded mound of ash drawn as ONE simple flat mid-grey blob (no specks, no dots, no pebbles, no texture, no inner lines), with one torn cream card corner sticking up out of it and one small flat orange ember on its side. Chunky and compact, about as tall as it is wide, centered, filling about 60 percent of the canvas so it reads at 40 pixels. Use the second attached image (a card-stack icon of the same icon set) for size, framing and outline: the SAME very fat dark brown marker outline on every shape, as heavy as on the dwarf.
```

#### `ui/pile_exhaust`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 180px까지 줄임 → 99x180
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle icon: a single curly puff of pale grey smoke over a small black coal, readable at small size. Transparent background with a real alpha channel.
```

### 2.4 화로 상태 아이콘 (8장)

#### `ui/fire_normal`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 114x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle status icon: one simple orange flame with a tiny calm face (two dot eyes), centered, readable at 48 pixels. Transparent background with a real alpha channel.
```

#### `ui/fire_good`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 138x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a bright yellow-orange flame with a happy smiling face and two little sparkle marks. Transparent background with a real alpha channel.
```

#### `ui/fire_excellent`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 138x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a big bright golden-white flame with a beaming face (closed happy eyes) and a simple star burst behind it. Transparent background with a real alpha channel.
```

#### `ui/fire_poor`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 114x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a small droopy pale blue-grey flame with a sad sleepy face, a little ash under it. Transparent background with a real alpha channel.
```

#### `ui/fire_sturdy`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 131x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a stubborn orange flame with a determined face, sitting inside a thick grey stone ring. Transparent background with a real alpha channel.
```

#### `ui/fire_surge`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 106x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a tall wild red flame with an excited shouting face, leaping up. Transparent background with a real alpha channel.
```

#### `ui/fire_malleable`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 100x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)
- **메모**: 둘째 판. 첫 판은 fire_normal과 거의 같은 주황이라 48px에서 구별이 약했다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a soft wobbly melty flame in a clearly PINK color (soft rose pink, NOT orange, so it looks different from the orange flame) with a relaxed smiling face (closed happy eyes), drooping and dripping like honey with a few round drips at its base. Keep it simple, very few details. Transparent background with a real alpha channel.
```

#### `ui/fire_goodOmen`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 140px까지 줄임 → 100x140
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`FIRE_SAME`](#조각-fire_same)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{FIRE_SAME}} a small calm flame with a curious face looking up at a tiny yellow star floating above it. Transparent background with a real alpha channel.
```

### 2.5 작은 아이콘 (3장)

#### `ui/icon_heat`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 110px까지 줄임 → 80x110
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle icon: one small red-orange glowing coal with a tiny face (dot eyes) and two little wavy heat lines above. Readable at 32 pixels. Transparent background with a real alpha channel.
```

#### `ui/icon_progress`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 110px까지 줄임 → 110x93
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle icon: a small hammer tilted as if striking, with three short spark lines. Readable at 32 pixels. Transparent background with a real alpha channel.
```

#### `ui/icon_quality`

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 110px까지 줄임 → 110x102
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle icon: a simple faceted gem in soft blue with one small star glint. Readable at 32 pixels. Transparent background with a real alpha channel.
```

### 2.6 전투 화면: 필살기 불꽃 테 (1장)

#### `ui/ult_ready` 필살기가 찬 카드 뒤의 불꽃 테

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 360px까지 줄임 → 237x360
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@ui/fire_normal` = `ui/fire_normal` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

A doodle ring of cartoon fire that goes around an EMPTY portrait card shape. Picture an invisible rounded rectangle (portrait 2:3, corners well rounded) filling the middle two thirds of the canvas, and chunky flat cartoon flames growing outward from all four of its edges: small low flames along the sides and the bottom, taller tongues licking up from the top edge. The flames are drawn in the same style as the flame in the second attached image but have NO face: flat warm orange (#f2a65a) outer flames with flat butter yellow (#f3d36a) inner tongues, each with the same fat dark brown outline. The inside of the rounded rectangle is completely EMPTY and fully transparent (a clean hole where a card will sit), and everything outside the flames is transparent too. Symmetric left and right. Transparent background with a real alpha channel.
```

## 3. cards: 카드 일러스트

카드 틀의 그림 창에 들어가는 그림 35장이다. 불투명 정사각으로 뽑고, 처리에서 가장자리 2px을 메우고(edge) 양옆을 1.35:1로 넓혀(widen) 540x400으로 만든다.

- 배경은 카드 종류마다 **평면 한 색**이다. 공정 #F2B279, 품질 #BFDDEB, 보조 #CBE6C1, 각인 #D8CBEA,
  재료는 노랑(처리에서 #F3DC8F로), 전설 재료는 금색에 보라 원 하나(처리에서 #E9C46A로).
  Codex가 덱의 파스텔보다 쨍하게 칠해서, 다시 뽑지 않고 처리에서 색을 바꿨다(recolor).
- 드워프가 나오는 카드는 자세 그림(`d_dwarf_strike`는 망치 카드, `d_dwarf_work`는 손일 카드)을 두 번째 참조로 붙이고, `{{CARD_DWARF_KEEP}}`로 생김새를 다시 적었다.
  그래도 다시 디자인하면 "Draw him EXACTLY like the first attached image, do not redesign him"을 더했다(`trainedArm`).
- 드워프가 없는 카드는 참조가 드워프 하나뿐이면 음영이 있는 페인터리 쪽으로 돌아갔다.
  같은 화풍의 카드 그림(`@cards/hammer` 같은)을 두 번째 참조로 주고 "ONE flat fill per shape"를 적어 고쳤다.

### 3.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 CARD_FRAMING

카드 일러스트 구도. buildPrompt가 cards 그룹에 STYLE 다음에 붙인다. 4:3 창으로 잘리므로 가운데에 모으고, 배경은 평면 한 색이다.

```text
Card illustration, square composition: one clear subject in the center with breathing room (it will be cropped to a 4:3 window, so keep everything important inside the central area), a single flat warm background color block (no scenery detail). Funny and charming.
```

#### 조각 CARD_DWARF

드워프가 나오는 카드 장면의 첫 말. 바로 뒤에 동작이 온다.

```text
Scene: the little dwarf blacksmith from the attached image (same design: big grey beard blob, dot eyes, tiny limbs)
```

#### 조각 CARD_DWARF_KEEP

드워프 생김새를 고정하는 문장. 카드에서 드워프가 곱슬머리·정면으로 다시 디자인되는 것을 막았다.

```text
Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round pink nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), small and chunky, whole body visible.
```

#### 조각 BG_PROCESS

공정 카드 배경(#F2B279).

```text
Background: the whole canvas is one single flat solid color, a soft warm orange (like #F2B279), edge to edge, no pattern, no frame, no border.
```

#### 조각 BG_QUALITY

품질 카드 배경(#BFDDEB).

```text
Background: the whole canvas is one single flat solid color, a pale soft sky blue (like #BFDDEB), edge to edge, no pattern, no frame, no border.
```

#### 조각 BG_SUPPORT

보조 카드 배경(#CBE6C1).

```text
Background: the whole canvas is one single flat solid color, a soft pale mint green (like #CBE6C1), edge to edge, no pattern, no frame, no border.
```

#### 조각 BG_IMPRINT

각인 카드 배경(#D8CBEA).

```text
Background: the whole canvas is one single flat solid color, a soft pale lavender (like #D8CBEA), edge to edge, no pattern, no frame, no border.
```

#### 조각 BG_MATERIAL

재료 카드 배경. Codex가 레몬색(약 253,224,90)으로 칠해 처리에서 #F3DC8F로 바꾼다(recolor).

```text
Background: one flat soft warm yellow color.
```

#### 조각 BG_LEGEND

전설 재료 카드 배경(금색에 보라 원 하나). Codex가 진한 금색(약 253,197,4)으로 칠해 처리에서 #E9C46A로 바꾼다.

```text
Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), so it feels a little more special.
```

#### 조각 OPAQUE_OBJECTS

재료·전설 재료 카드의 끝: 불투명, 사물만.

```text
Opaque image: the flat background color fills the whole square edge to edge (not transparent, no white margin, no border). Only objects (and at most a simple cartoon hand); no human faces.
```

### 3.2 기본·해금 카드: 대개 드워프 장면 (22장)

#### `cards/hammer` 두드리기 (기본, 공정 카드)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_PROCESS`](#조각-bg_process)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} whacking a glowing orange iron bar on a tiny anvil, a burst of simple spark marks. {{CARD_DWARF_KEEP}} {{BG_PROCESS}}
```

#### `cards/polish` 다듬기 (기본, 품질 카드)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_QUALITY`](#조각-bg_quality)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} rubbing a whetstone along a blade, a small shine mark on the edge. {{CARD_DWARF_KEEP}} {{BG_QUALITY}}
```

#### `cards/precisePolish` 정밀 다듬기 (기본, 품질 카드)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_QUALITY`](#조각-bg_quality)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} squinting through a big round magnifying glass at the tip of a blade, holding a tiny file. {{CARD_DWARF_KEEP}} {{BG_QUALITY}}
```

#### `cards/bellows` 풀무질 (기본, 보조: 열기)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} squashing a bellows with both arms, a puff of wind making the forge flames jump up. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/quench` 담금질 (기본, 보조)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} dunking a hot blade into a bucket of water, a huge comic cloud of steam. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/finisher` 마무리 (기본, 품질: 열기를 써서 마무리)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_QUALITY`](#조각-bg_quality)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} holding up a finished shiny sword proudly, sparkle marks around the blade. {{CARD_DWARF_KEEP}} {{BG_QUALITY}}
```

#### `cards/thrift` 아껴 치기 (해금, 보조: 다음 카드 비용을 줄임)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)
- **메모**: 둘째 판. 첫 판은 망치와 쇠가 너무 작아 카드 크기에서 동작이 안 읽혔다.

```text
{{STYLE}}

{{CARD_FRAMING}}

Scene (card "thrifty tapping"): the little dwarf blacksmith from the attached images standing at a small anvil, holding his hammer daintily with only two fingers and giving the glowing orange iron bar on the anvil a very gentle little tap, ONE single small spark; his eyes narrowed into a stingy, careful squint, and a small round brown coin pouch tied to his apron. The anvil and the glowing bar are clearly visible and not tiny. Keep the dwarf exactly the same character design as the attached images (big grey hair blob, huge round grey beard with two little braided tips, two dot eyes, big round nose, small pointy ear, cream short-sleeve shirt, brown apron, little brown boots), the same three-quarter view facing right, small and chunky, whole body visible. {{BG_SUPPORT}}
```

#### `cards/carefulHammer` 신중한 두드리기 (해금, 공정)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_PROCESS`](#조각-bg_process)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} aiming a hammer carefully at a small chalk X mark on glowing iron, tongue out. {{CARD_DWARF_KEEP}} {{BG_PROCESS}}
```

#### `cards/firstHammer` 첫 망치 (해금, 공정, 첫 손)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_PROCESS`](#조각-bg_process)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} giving the first hammer blow of the day, a little rising sun peeking through a window behind. {{CARD_DWARF_KEEP}} {{BG_PROCESS}}
```

#### `cards/keepForging` 단조 유지 (해금, 보조: 내구도 회복)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} putting the iron back into the forge flames with tongs, patiently. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/thickAnvil` 두꺼운 모루판 (해금, 각인: 영구 효과)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@cards/hammer` = `cards/hammer` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_IMPRINT`](#조각-bg_imprint)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

Scene: a comically extra-thick, squat, chubby cartoon anvil, its body twice as tall and fat as a normal anvil (like a fat heavy block with a short rounded horn), sitting heavily with two tiny 'thud' marks at its base, sturdy and proud, with a simple glowing purple rune drawn on its side. Draw it in the same way as the small anvil in the second attached image: rounded soft corners, ONE single flat dark grey fill for the whole anvil (no lighter top face, no two-tone planes, no shading), and outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines. The rune is just a few simple flat purple strokes. Keep the anvil compact, about 60% of the canvas width, centered. No character in this card. {{BG_IMPRINT}}
```

#### `cards/heatUp` 달구기 (해금, 보조: 열기)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@cards/keepForging` = `cards/keepForging` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

Scene: a long thin rectangular iron bar (clearly a blacksmith's metal bar, long and straight, poking out diagonally) resting in a small pile of glowing coals; the half of the bar inside the coals is bright orange-hot, the other half is grey; the coals are a few round dark-red and orange lumps with two or three small simple flame tips between them; three simple wavy heat lines rising. No character in this card. Draw it with outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, chunky rounded shapes, ONE flat fill per shape (no shading, no two-tone planes, no glow gradients), like the fire and iron in the second attached image. Keep it compact, about 65% of the canvas width, centered. {{BG_SUPPORT}}
```

#### `cards/bigStrike` 크게 내려치기 (해금, 공정)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_PROCESS`](#조각-bg_process)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} swinging a comically huge sledgehammer down, a big circular whoosh line and sparks. {{CARD_DWARF_KEEP}} {{BG_PROCESS}}
```

#### `cards/trainedArm` 단련된 팔 (해금, 각인)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`BG_IMPRINT`](#조각-bg_imprint)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)
- **메모**: 보라 룬이 카드 크기에서 작다.

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} flexing one tiny arm proudly, a small purple rune glowing on his bracer. Draw him EXACTLY like the first attached image, do not redesign him: the same three-quarter view facing right, the same smooth grey hair blob, the same two tiny dot eyes, the same big round nose, the same huge round smooth grey beard covering his body with two little braided tips, cream short-sleeve shirt, brown apron, little brown boots. He bends one tiny arm up to flex a small bicep; on that forearm a plain brown wristband with a simple purple diamond rune (a diamond with a dot in the middle, never a letter or number) and three tiny glow strokes. Small and chunky, whole body visible. {{BG_IMPRINT}}
```

#### `cards/lastStroke` 최후의 한 수 (해금, 공정, 간직)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_PROCESS`](#조각-bg_process)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} with a sweat drop giving one last decisive hammer blow, one big star-shaped spark. {{CARD_DWARF_KEEP}} {{BG_PROCESS}}
```

#### `cards/firstTouch` 첫 손질 (해금, 품질, 첫 손)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_QUALITY`](#조각-bg_quality)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} gently poking the edge of a fresh blade with one finger, a tiny shine mark. {{CARD_DWARF_KEEP}} {{BG_QUALITY}}
```

#### `cards/allIn` 혼신 (해금, 보조: 다음 카드 강화)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_strike` 망치를 내려치는 드워프 (`ref/d_dwarf_strike.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} gripping a hammer with all his strength, a comic flame aura around him, determined face. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/kindle` 불씨 살리기 (해금, 보조)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} with puffed cheeks blowing on a tiny ember to bring it back to life. His cheeks are comically puffed up round like balloons and his mouth is a tiny round 'o' circle (not a '3' shape); he holds up in both palms, in front of his face, a small dark lump of coal with a little orange ember flame on top, clearly readable (about the size of his nose or a bit bigger); three simple breath strokes go from his mouth to the ember. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/reread` 불 다시 보기 (해금, 보조: 화로 상태 다시 굴리기)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} peering into the forge mouth, flames reflected as tiny stars in his dot eyes. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/smithSense` 대장장이의 감 (해금, 보조)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`CARD_DWARF`](#조각-card_dwarf), [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep), [`BG_SUPPORT`](#조각-bg_support)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

{{CARD_DWARF}} resting one hand on the anvil with eyes closed, a little lightbulb-like glow above his head. {{CARD_DWARF_KEEP}} {{BG_SUPPORT}}
```

#### `cards/deftHand` 섬세한 손 (해금, 각인)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `d_dwarf_work` 숫돌질하는 드워프 (`ref/d_dwarf_work.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_IMPRINT`](#조각-bg_imprint)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)
- **메모**: 보라 룬이 카드 크기에서 작다.

```text
{{STYLE}}

{{CARD_FRAMING}}

Scene: two small hands holding a tiny engraving tool over a blade, a little purple rune glowing. Only the two chubby little hands and short forearms with cream sleeve cuffs (same skin color and outline as the attached dwarf), no full character, no face. The blade lies flat and horizontal, a simple grey sword blade; the little purple rune on it is a simple diamond with a dot (never a letter or number) with two or three tiny glow strokes. Outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, ONE flat fill per shape (no shading, no two-tone planes, no gradients). Keep it compact, about 65% of the canvas width, centered. {{BG_IMPRINT}}
```

#### `cards/flameReading` 불꽃 읽기 (해금, 각인)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@cards/keepForging` = `cards/keepForging` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_IMPRINT`](#조각-bg_imprint)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen)

```text
{{STYLE}}

{{CARD_FRAMING}}

Scene: a cute flame with one big round eye and a simple purple rune circle around it. No dwarf in this card. The flame is a chubby rounded orange flame shape with a soft yellow inner flame, one big round cartoon eye (white with a black dot pupil), looking a bit sleepy-silly. Around it, a simple purple ring with four small diamond marks on it (never letters or numbers). Outlines exactly as thick and as dark (near-black brown) as the dwarf's outlines, ONE flat fill per shape (no shading, no glow gradients). IMPORTANT size: the whole design, ring and diamonds included, must be small and fit inside the middle 55% of the canvas height and width, with wide empty margins of flat background on every side. {{BG_IMPRINT}}
```

### 3.3 재료·전설 재료 카드: 사물만 (13장)

#### `cards/ironMelt` 쇳물 고르기 (재료, 철)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_MATERIAL`](#조각-bg_material), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #F3DC8F로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a small ladle of glowing orange molten iron with a little bubble. {{BG_MATERIAL}} {{OPAQUE_OBJECTS}}
```

#### `cards/steelFold` 강철 접기 (재료, 강철)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_MATERIAL`](#조각-bg_material), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #F3DC8F로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a glowing steel bar folded over itself like a sandwich, visible stripes. {{BG_MATERIAL}} {{OPAQUE_OBJECTS}}
```

#### `cards/mithrilGrain` 미스릴 결 (재료, 미스릴)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_MATERIAL`](#조각-bg_material), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #F3DC8F로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a silvery-blue ingot with simple wavy grain lines and a sparkle. {{BG_MATERIAL}} {{OPAQUE_OBJECTS}}
```

#### `cards/orichalcumGlow` 오리할콘 빛 (재료, 오리할콘)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_MATERIAL`](#조각-bg_material), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #F3DC8F로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a red-gold ingot glowing warmly with simple radiating lines. {{BG_MATERIAL}} {{OPAQUE_OBJECTS}}
```

#### `cards/adamantCore` 아다만 심 (재료, 아다만)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_MATERIAL`](#조각-bg_material), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #F3DC8F로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a chunky grey metal block with one pointy dark purple crystal sticking out of the middle of its front face (the crystal is a simple tall pointed gem shape with one or two straight facet lines, clearly a gem, NOT an oval; no cracks, no lines around it). {{BG_MATERIAL}} {{OPAQUE_OBJECTS}}
```

#### `cards/dragonBreath` 용의 숨결 (전설 재료: 화룡의 심장)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a cute little red dragon heart with tiny wings breathing a puff of fire into a forge. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

#### `cards/rekindle` 다시 피는 불 (전설 재료: 불사조의 꼬리깃)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a bright orange phoenix feather popping up from a grey ash pile and lighting it up. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

#### `cards/giantHammer` 거인의 망치 (전설 재료: 거인의 핵)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)
- **메모**: 아주 단순해 간판처럼 보인다. 화풍은 맞아서 두었다.

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a comically enormous stone hammer with a glowing core in its head, a tiny anvil next to it for scale. Keep the hammer very simple: the head is ONE plain rounded grey block (no segments, no chips, no notches) with one round soft-orange core dot in its middle, and a short thick brown handle; the hammer and the tiny anvil together fill only about two thirds of the frame, leaving plain background all around. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

#### `cards/layeredShell` 겹친 갑피 (전설 재료: 여왕의 갑피)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@cards/dragonBreath` = `cards/dragonBreath` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)
- **메모**: 셋째 판. 첫 판은 돌·마카롱처럼 읽혀 딱정벌레 여왕으로 바꿨다. 보라 원이 다른 전설 카드보다 크다(4:3 창에서 위아래가 잘린다).

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject (card "the queen's layered carapace"): a cute chubby round beetle queen seen from the side, with a tiny yellow crown, two dot eyes and two little curly antennae; her back shell is made of three overlapping rounded sage-green shell plates like roof tiles, each plate with a thin muted purple rim; she sits proudly on top of a short thick hot iron bar drawn as ONE flat orange rounded rectangle seen straight from the side (no top face, no second tone). Muted colors, not neon. Draw EVERY shape with a VERY fat, bold dark brown marker outline, as heavy as on the dwarf and on the dragon in the second attached image (about 3 percent of the subject width). Keep the beetle and bar compact, about 55 percent of the canvas width. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject, the circle about 70 percent of the canvas width so plenty of yellow shows around it (just two flat colors, no gradient, no glow), exactly like the background of the second attached card image. Only objects and the beetle; no humans.
```

#### `cards/stormBellows` 폭풍 풀무 (전설 재료: 폭풍 깃)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a blue feather with little lightning zigzags blowing a swirl of wind. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

#### `cards/tailwind` 순풍 (전설 재료: 정령왕의 숨결)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a gentle pale green swirl of breath with a tiny spirit face flowing over a glowing bar. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

#### `cards/deepWater` 깊은 물 담금 (전설 재료: 심해룡의 비늘)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@cards/dragonBreath` = `cards/dragonBreath` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)
- **메모**: 둘째 판. 첫 판은 기타 피크 모양 비늘이라 안 읽혔다.

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject (card "deep water quench", from the scale of an abyssal sea dragon): a glowing orange-hot short sword blade dunked point-first into a tall round wooden barrel full of flat dark blue water; next to the blade, a cute little light-blue sea-dragon head with two dot eyes and a small fin peeks out of the water, looking surprised; three round bubbles and two little steam puffs rise. Simple, chunky, very few details. Background: one flat deep golden yellow color with a single simple flat muted purple circle behind the subject (just two flat colors, no gradient, no glow), exactly like the background of the second attached card image. Only objects and the little dragon; no humans.
```

#### `cards/frostFinish` 서리 마무리 (전설 재료: 서리 왕관 조각)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 불투명 · 긴 변 540px까지 줄임 → 540x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`CARD_FRAMING`](#조각-card_framing), [`BG_LEGEND`](#조각-bg_legend), [`OPAQUE_OBJECTS`](#조각-opaque_objects)
- **처리**: 가장자리 2px 메움(edge) · 양옆을 1.35:1로 넓힘(widen) · 배경색을 #E9C46A로 바꿈(recolor)

```text
{{STYLE}}

{{CARD_FRAMING}}

Subject: a small pale blue crown shard spreading little ice crystals along a blade. {{BG_LEGEND}} {{OPAQUE_OBJECTS}}
```

## 4. refine: 광석 정제 화면

광석 덩어리, 덩어리 더미, 결과 표의 아이콘(광석 5, 골드, 선물 4), 망치 버튼, 가방.

- 아이콘은 `ore_iron`이 기준이다(`{{SAME_ITEM_SET}}`). 화면에서 32~48px로 쓰므로 "readable at 40px", "fills about two thirds of the canvas"를 적었다.
- 철광석 첫 판은 덩어리와 똑같아 보였다. 덩어리를 참조로 주고 "clearly DIFFERENT … a different color, a different value and a different silhouette"를 적어 고쳤다.
- 망치 버튼은 공방의 `ui/btn_reheat`를 따른다(`{{SAME_UI_SET}}`).

### 4.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 SAME_ITEM_SET

정제 아이콘의 두 번째 참조(ore_iron) 안내.

```text
The second attached image is an item icon from the same set (iron ore). Match it exactly in drawing style, outline weight and how big the object sits in the frame (same scale and margin, centered), so the icons look like one set. Do NOT redraw the iron ore; draw only the new object described below.
```

#### 조각 SAME_UI_SET

버튼 세트의 두 번째 참조(ui/btn_reheat) 안내.

```text
The second attached image is an existing button from the same game UI. Match its very fat, crisp dark brown outline, its flat warm light grey fill and its little flat orange flame marks, so it looks like the same UI set. Do NOT redraw that button; draw only the new object described below.
```

#### 조각 ALPHA_MARGIN

투명 배경과 여백(정제 그림 모두).

```text
Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges.
```

#### 조각 ITEM_TAIL

정제 아이콘의 끝: 부위마다 평면 한 색, 철광석과 같은 크기.

```text
One flat color per part: no lighter or darker patches, no shadow tone. Same scale as the iron ore in the second image (fills about two thirds of the canvas).
```

### 4.2 덩어리와 더미 (2장)

#### `refine/ore_chunk` 광석 덩어리 (모루 위, 더미에서 모루로 튀는 한 덩이)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x139
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ALPHA_MARGIN`](#조각-alpha_margin)
- **메모**: 둘째 판. 첫 판(ore_chunk.rejected1.png)은 밝고 어두운 면으로 음영이 들어가고 화면의 40%만 차지했다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

One rough lumpy grey-brown ore chunk (an unrefined rock lump with a few tiny metal flecks drawn as simple dots), small and round. {{ALPHA_MARGIN}} Paint the whole rock in ONE single flat grey-brown color: no lighter or darker patches, no facets, no shadow tone; the only marks inside are a few tiny orange-yellow fleck dots and one or two short crack lines. The rock fills about two thirds of the canvas.
```

#### `refine/chunk_pile` 광석 덩어리 더미 (모루 옆, 덩어리 수에 따라 크기가 바뀐다)

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 420px까지 줄임 → 420x232
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_chunk` = `refine/ore_chunk` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ALPHA_MARGIN`](#조각-alpha_margin)
- **메모**: 덩어리 8개의 낮은 언덕. 덩어리 색이 ore_chunk보다 조금 밝은 회색이다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The second attached image is the single ore chunk from the same set. Draw the heap out of chunks that look exactly like it (same colors, same fleck dots, same outline weight). Do NOT just redraw one chunk.

A heap of many rough grey-brown ore chunks piled into a little mound, wider than tall, simple rounded lumps. {{ALPHA_MARGIN}} About eight to ten chunks, every chunk one single flat grey-brown color with its own outline and at most one or two tiny orange fleck dots: no lighter or darker patches, no shadow tone, no ground shadow. The heap fills about three quarters of the canvas width.
```

### 4.3 결과 표 아이콘 (10장)

#### `refine/ore_iron` 철광석 (흔함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x142
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_chunk` = `refine/ore_chunk` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ALPHA_MARGIN`](#조각-alpha_margin)
- **메모**: 아이콘 세트의 기준 그림. 나머지 아이콘이 이 그림을 두 번째 참조로 받는다 (그 아이콘들은 첫 판을 보고 뽑았다). 둘째 판 (v0.8 검토). 첫 판(ore_iron.rejected1.png, 회색 바위에 녹슨 줄)은 40px에서 날 덩어리(ore_chunk)와 거의 같아 보여, "덩어리를 쳤더니 덩어리가 나왔다"로 읽혔다. 덩어리를 두 번째 참조로 주고 색과 모양을 다르게 했다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The second attached image is the raw unrefined ore chunk from the same set. Match its drawing style, outline weight and how big it sits in the frame, but the new object must look clearly DIFFERENT from it: a different color, a different value and a different silhouette, so the two never get mixed up at 40px. Do NOT redraw the chunk.

A small refined piece of iron ore: a chunky angular iron nugget, already knocked clean of rock. Item icon, readable at 40px. {{ALPHA_MARGIN}} Angular and blocky with straight edges and a few corners (NOT a round lumpy rock), in one single flat dark rusty red-brown color (much darker and redder than the grey-brown chunk), with one flat freshly cut face on its front-top painted one single flat light silver grey, and one tiny white shine mark on that cut face. Facet edges are drawn only as outline lines. One flat color per part: no lighter or darker patches, no shadow tone. It fills about two thirds of the canvas, so it reads clearly when shrunk to a tiny icon.
```

#### `refine/ore_steel` 강철 덩이 (드묾)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x108
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small chunky steel nugget/ingot in blue-grey with one tiny shine mark. Item icon, readable at 40px. {{ALPHA_MARGIN}} It is clearly a smooth chunky metal bar (a rounded rectangular ingot block), not a rock, in one single flat blue-grey color with one tiny white shine mark. {{ITEM_TAIL}}
```

#### `refine/ore_mithril` 미스릴 원석 (귀함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 142x160
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small mithril ore crystal cluster in pale silvery blue with one tiny sparkle. Item icon, readable at 40px. {{ALPHA_MARGIN}} Three or four chunky pointed crystals growing from a tiny grey rock base; the crystals are one single flat pale silvery blue with one tiny white four-point sparkle beside them. {{ITEM_TAIL}}
```

#### `refine/ore_orichalcum` 오리할콘 원석 (귀함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x126
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)
- **메모**: 둘째 판. 첫 판(ore_orichalcum.rejected1.png)은 매끈한 주황 덩어리라 해나 얼룩처럼 보였다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small orichalcum ore lump in warm red-gold with simple short glow lines around it. Item icon, readable at 40px. {{ALPHA_MARGIN}} A lumpy chunky metal nugget with a few bumps and one short crack line (clearly an ore lump like the iron ore, not a plain blob), in one single flat rosy red-gold color (a warm mix of copper and gold), with two or three tiny pale gold fleck dots on it and five short straight pale yellow glow dashes radiating around it (dashes with the same dark brown outline). {{ITEM_TAIL}}
```

#### `refine/ore_adamant` 아다만 원석 (아주 귀함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 137x160
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small adamant ore: a dark purple-black crystal set in grey rock, two tiny star sparkles (very rare item). Item icon, readable at 40px. {{ALPHA_MARGIN}} One big dark purple-black pointed crystal sticking up out of a small flat grey rock base, and two tiny white four-point star sparkles beside it. {{ITEM_TAIL}}
```

#### `refine/gold_coins` 골드 (흔함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x126
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small pile of three round gold coins, flat yellow with a darker edge. Item icon, readable at 40px. {{ALPHA_MARGIN}} Three thick round coins overlapping in a little heap, each a flat bright warm yellow face with a darker orange-gold rim ring and NO symbol on the face. {{ITEM_TAIL}}
```

#### `refine/gift_flowers` 들꽃 다발 (선물, 드묾)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 129x160
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A tiny bouquet of wild flowers tied with a string, a gift for a hero. Item icon, readable at 40px. {{ALPHA_MARGIN}} Three or four simple round wild flowers (soft pink, white, soft yellow) on green stems with two leaves, tied together with a small brown string bow. {{ITEM_TAIL}}
```

#### `refine/gift_honey` 꿀 과자 (선물, 드묾)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x131
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small round honey biscuit in a paper wrap, a gift for a hero. Item icon, readable at 40px. {{ALPHA_MARGIN}} One round golden-brown biscuit, half wrapped in a cream paper wrap twisted at one side, with a tiny amber honey drip on top. {{ITEM_TAIL}}
```

#### `refine/gift_pebble` 반짝 조약돌 (선물, 귀함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x121
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)
- **메모**: 다른 아이콘보다 조금 작게 나왔다 (여백을 잘라 내 크기를 맞춘다).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small shiny smooth pebble with a little star glint, a keepsake gift. Item icon, readable at 40px. {{ALPHA_MARGIN}} One smooth flat oval pebble in a soft warm lilac-grey color, with one tiny white four-point star glint beside it. {{ITEM_TAIL}}
```

#### `refine/gift_gloves` 손뜨개 장갑 (선물, 귀함)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 160x120
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A pair of small hand-knitted mittens, a warm gift for a hero. Item icon, readable at 40px. {{ALPHA_MARGIN}} Two small mittens side by side, soft warm red-orange with a cream cuff band each and one or two simple knit stitch marks. {{ITEM_TAIL}}
```

### 4.4 버튼과 가방 (2장)

#### `refine/btn_hammer` 정제 버튼 (망치)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 360px까지 줄임 → 360x355
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@ui/btn_reheat` = `ui/btn_reheat` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_UI_SET`](#조각-same_ui_set), [`ALPHA_MARGIN`](#조각-alpha_margin)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_UI_SET}}

A big chunky game button shaped like a blacksmith hammer seen from the side (head on top, short handle), flat grey head and brown handle, thick outline, made to be pressed, front view. {{ALPHA_MARGIN}} The hammer is drawn big and bold like a pressable button: a wide chunky rectangular flat grey head (the same warm light grey as the button in the second image) on top of a short thick brown handle, the whole thing wrapped in the same very fat crisp dark brown outline, slightly tilted for a playful look, no glow and no shadow outside the outline. One flat color per part: no lighter or darker patches. It fills about three quarters of the canvas.
```

#### `refine/bag` 가방 (얻은 것)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 160px까지 줄임 → 137x160
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@refine/ore_iron` = `refine/ore_iron` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`SAME_ITEM_SET`](#조각-same_item_set), [`ALPHA_MARGIN`](#조각-alpha_margin), [`ITEM_TAIL`](#조각-item_tail)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{SAME_ITEM_SET}}

A small brown cloth sack tied with a string, slightly bulging with things inside, the inventory bag icon. Readable at 40px. {{ALPHA_MARGIN}} A round-bottomed warm brown cloth sack, the top gathered and tied with a lighter tan string, plump and bulging, nothing sticking out. {{ITEM_TAIL}}
```

## 5. town: 마을 지도

홈 화면 마을 지도의 바닥, 구름 띠, 건물, 탑, 소품이다. 바닥과 건물을 **따로** 뽑아 합친다.
모두 아늑한 타이쿤 지도처럼 3/4 위에서 본 시점(약 40°)이고, 빛은 왼쪽 위, 그림자는 오른쪽 아래에 평면 한 덩이다.

- 두 회차로 뽑았다. 첫 회차는 바닥·건물·탑·소품이다. 첫 합성을 검토한 뒤 둘째 회차에 대장간, 마을 문, 바닥, 구름 띠, 광장 소품 셋을 다시 그렸다.
- 세트 기준: 건물은 `@bld_forge`(첫 회차 때는 첫 판 대장간), 탑은 `@tower_water`, 첫 회차 소품은 `@prop_tree_round`, 광장 소품은 `@bld_market`이다.
  둘째 판 대장간은 길드(`@bld_guild`)를 참조로 다시 그렸다.
- 지도에서 크게 키울 바닥은 선을 일부러 얇게("about 3px at 1024px width") 했다. 작게 놓을 소품은 "EVEN FEWER details than usual and BOLD, thick outlines"로 그렸다.
- 굴뚝 연기와 간판은 **의미 표시**다. 연기는 대장간만, 간판은 들어갈 수 있는 건물만 단다. 다른 건물에 연기를 그리면 대장간이 둘로 보였다(`bld_shop`, `bld_house_b`의 메모).
- 이 그룹은 buildPrompt가 `{{STYLE}}`만 붙인다. 참조 안내(`{{STYLE_REF_ONLY}}` 또는 `{{TOWN_PROP_REF_ONLY}}`)부터는 본문에 직접 적었다.
- 바닥 키우기, 탑 쌓기, 구름·연기·그림자 그리기 같은 합성은 이 게임 전용 도구가 했다. 여기에는 그림 프롬프트만 있다.

### 5.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 TOWN_SAME_FORGE

첫 회차 건물과 물의 탑의 두 번째 참조(대장간) 안내. "문 크기가 같게"로 건물끼리 축척을 맞췄다.

```text
The second attached image is the forge building from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail, and the same scale (a door of the same size, so the buildings line up on one map). Do NOT redraw the forge; draw only the new object described below.
```

#### 조각 TOWN_SAME_TOWER

불·땅·바람의 탑의 두 번째 참조(물의 탑) 안내.

```text
The second attached image is the water tower from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills, the same silhouette and the same size and position in the frame. Do NOT redraw the water theme; change only the theme as described below.
```

#### 조각 TOWN_SAME_STALLS

둘째 회차 광장 소품의 두 번째 참조(시장 노점) 안내. 매니페스트의 townSameSet("a pair of market stalls").

```text
The second attached image is a pair of market stalls from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail. Do NOT redraw it; draw only the new object described below.
```

#### 조각 TOWN_VIEW_FORGE

시점: 대장간(첫 판)처럼 조금 돌려 문 벽이 왼쪽 아래를 본다. 첫 회차 건물과 탑.

```text
Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the forge: the building is turned a little, so its front (door) wall faces the viewer toward the lower left, one narrow side wall shows on the right, and a little of the top surface of the roof is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.
```

#### 조각 TOWN_VIEW_TURNED

시점: 두 번째 참조처럼 조금 돌려. 둘째 회차의 대장간과 광장 소품.

```text
Camera: the same viewpoint as a cozy village tycoon / management game map, a 3/4 top-down view looking down at roughly 40 degrees, exactly like the second attached image: the object is turned a little, so its front faces the viewer toward the lower left, one narrow side shows on the right, and a little of the top surface is visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground tile, no grass patch, no base platform, no road, no scenery around it: the object stands alone on the transparent background.
```

#### 조각 TOWN_VIEW_FRONT

시점: 정면 대칭(마을 문만). 길이 문을 곧장 지나 화면 쪽으로 온다.

```text
Camera: a cozy village tycoon / management game map seen from above at roughly 40 degrees, but this object is seen STRAIGHT-ON FROM THE FRONT: it is perfectly symmetric left to right, its front faces the viewer squarely, and the flat top surfaces are a little visible. Light comes from the upper left, but there is NO shading on the object at all (flat fills only); at most one single flat soft-grey shadow shape on the ground at the lower right. No ground, no road, no grass, no scenery: the object stands alone on the transparent background.
```

#### 조각 TOWN_VIEW_MAP

시점: 지도 바닥.

```text
View: like a cozy tycoon / management game map, seen from above at a gentle 3/4 top-down angle. Light comes from the upper left. Everything flat-colored; no cast shadows on the ground.
```

#### 조각 TOWN_FRAME

투명 배경, 여백, 간판에 글자 없음(건물·탑과 둘째 회차 소품의 끝).

```text
Transparent background with a real alpha channel. The object is centered with a comfortable empty margin on every side; nothing is cut off at the edges. Signs carry only simple picture symbols, never letters or numbers.
```

#### 조각 TOWN_PROP_REF_ONLY

첫 회차 소품의 참조 안내(STYLE_REF_ONLY와 끝 낱말만 다르다).

```text
The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only the object asked below.
```

#### 조각 TOWN_PROP_SAME_TREE

첫 회차 소품의 두 번째 참조(둥근 나무) 안내.

```text
The second attached image is another prop from the SAME town map set (a round tree): match its outline thickness, its flat muted colors, its viewing angle and its flat shadow exactly, so all props look like one consistent set. Do NOT redraw that tree unless asked.
```

#### 조각 TOWN_PROP_FRAMING

첫 회차 소품의 구도: 지도에 작게 놓으므로 "EVEN FEWER details than usual and BOLD, thick outlines".

```text
This is a small decoration prop for the town map of a cozy tycoon / management game, seen in a 3/4 top-down view (the camera looks down at about 45 degrees: the front side is visible and a little of the top surface is visible). Light comes from the upper left. It will be placed small, like an icon, on a big map, so use EVEN FEWER details than usual and BOLD, thick outlines; simple chunky readable silhouette. Flat colors only, no shading, no gradient. A single flat darker shadow blob may sit under the object on the ground (one flat color, offset slightly toward the lower right), nothing else on the ground. One object only, centered, the whole object fully inside the frame with generous empty margin on all sides, nothing cropped. No text, no letters, no symbols.
```

#### 조각 TOWER_SAME_KIND

불·땅·바람의 탑 본문의 첫 말. 바로 뒤에 주제가 온다.

```text
Same kind of tower as the second attached image (same shape language, size, view and style), but its theme is
```

#### 조각 TOWER_RETHEME

불·땅·바람의 탑: 물의 탑과 같은 짜임에 색과 주제만 바꾼다. 바로 뒤에 벽 색이 온다.

```text
Keep the same tower structure as the second image (round base with a small arched door, two ring ledges, arched windows, a pointed spire wrapped in flat cloud puffs), only recolor and re-theme it. Just as the water tower's whole wall is blue stone, this tower's whole wall is
```

### 5.2 바닥과 하늘 (2장)

#### `town/ground_b` 마을 바닥 (위 탑 고원, 광장, 오른쪽 연못, 아래로 이어지는 큰길)

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 불투명 · 긴 변 2400px까지 줄임 → 1024x1536
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@ground_b` 고쳐 그리기: 다시 뽑기 직전의 이 그림 원본
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_VIEW_MAP`](#조각-town_view_map)
- **메모**: 둘째 판 (둘째 회차). 첫 판(ground_b.rejected1.png, 참조 d_dwarf_idle과 scene/bg_workshop)은 2배로 키우면 길·절벽 선이 건물보다 두 배 굵었고, 덤불·바위를 그려 넣었고(배치로 다룰 수 없다), 탑 고원이 얕았다 (검토). 첫 판을 두 번째 참조로 주고 구성은 그대로, 선은 얇게, 고원은 지도 높이의 약 22%로 깊게, 큰길은 아래 끝 밖으로 이었다. 합성에서는 2.4배로 키워 하늘 아래에 깐다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The second attached image is the old version of this same village ground map. Keep its LAYOUT (the tower plateau at the top with a road climbing up onto it, the oval plaza a little below the middle, the pond on the right, the long main street going down, the side roads going out to the left and right), but change it as described below.

{{TOWN_VIEW_MAP}}

An EMPTY village ground map, portrait, as one flat doodle: plain flat soft green grass and light sandy dirt roads. Use THIN dark brown ink outlines on the road edges and the cliff edges, about 3px at 1024px width, much thinner than the outline of the reference character. Layout from top to bottom: (1) a raised grassy plateau for towers fills the top quarter of the map (about 25% of the image height) and runs off the TOP EDGE and both side edges of the image; its front edge is a low grey-brown cliff face of a few simple blocks; a sandy road climbs from the plaza up through a gap in the cliff onto the plateau. (2) Below the cliff, wide empty grass lots on both sides of the up road, and a small flat blue pond on the right side. (3) An oval sandy plaza a little below the middle of the image, with one road going out to the left edge and one road going out to the right edge. (4) A long straight main street going down from the plaza and running off the BOTTOM EDGE of the image. Big empty grass lots on both sides of every road. NO bushes, NO rocks, NO flowers, NO trees, NO buildings, NO people, NO fences, NO bridge, NO text: only flat grass with a few tiny grass tufts, flat sandy roads with a few tiny pebble dots, the flat blue pond and the cliff. A fully painted, opaque image that fills the whole frame.
```

#### `town/cloud_band` 구름 띠 (지도 위 끝, 탑이 들어가는 구름)

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 1100px까지 줄임 → 1100x377
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only)
- **메모**: 둘째 회차. 첫 합성은 구름을 캔버스에 크림색으로 그렸는데 UI 종이색과 같아 탑이 구름으로 들어가지 않고 지도 끝이나 빈 머리글처럼 보였다 (검토). 합성에서는 윗부분(원본 0~530행)을 360px 높이로 줄여 지도 폭만큼 좌우로 뒤집어 가며 이어 붙인다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

View: the sky at the very top of a cozy tycoon / management game village map. Flat colors only, no shading, no gradients.

A long horizontal band of big fluffy cartoon cumulus clouds that fills the FULL WIDTH of the image from the left edge to the right edge with no gap at either side (copies will be placed side by side, so the band must be horizontally tileable). The upper part of the band is solid cloud that reaches the top edge of the image. The lower edge of the band is a bumpy, uneven row of big and small round cloud heaps hanging down, with the transparent background showing below and between them; a few heaps hang lower than others. Colours, all perfectly flat: the upper parts of the puffs almost white (#FFFFFF to #F4F7F8); the lower part of each heap a second flat pale blue-grey (#DCE4EA), divided from the white by one simple curved line; in a few small gaps between puffs a flat pale sky blue (#CFE3EA). The same thick dark brown hand-drawn outline around every puff as the reference character. No shading, no gradients, no sun, no birds, no ground, no buildings, no towers. The cloud band covers roughly the top 55% of the image; below that the image is fully transparent except for the lowest hanging puffs. Transparent background with a real alpha channel.
```

### 5.3 건물 (10장)

#### `town/bld_forge` 대장간 (마을의 주인공 건물)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x537
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_guild` = `town/bld_guild` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_VIEW_TURNED`](#조각-town_view_turned), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 판 (둘째 회차). 첫 판(bld_forge.rejected1.png, 첫 회차 건물들의 기준)은 집만 한 돌집이라 멀리서 대장간으로 읽히지 않았고, 간판 그림이 한글(全·숫)처럼 읽혔다 (검토). 길드를 참조로 집보다 넓은 열린 작업장으로 다시 그렸다. 굴뚝 연기는 넣지 않고 합성에서 그린다. 길드나 집보다 조금 더 아이소메트릭 쪽으로 돌아 있다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The second attached image is the guild hall from the same village map set. Match it exactly: the same 3/4 top-down camera angle, the same thick dark brown outline weight, the same flat fills and palette, the same small amount of detail, and the same scale (a door of the same size, so the buildings line up on one map). Do NOT redraw the guild; draw only the new building described below.

{{TOWN_VIEW_TURNED}}

A big dwarf blacksmith forge workshop, the main hero building of the village. It is clearly much WIDER than a house: as wide as the guild hall in the second image or wider, but lower, one storey. A long low building of grey stone and wooden beams with a dark brown wooden plank roof. The LEFT part of the front is an OPEN-FRONTED workshop with no front wall: a deep roof overhang held up by two thick wooden posts, and inside it, plainly visible, a big round stone forge hearth with a bright flat orange fire, a black iron anvil on a wooden tree stump standing under the eave, a hammer and a pair of tongs hanging on the back wall, and a wooden water barrel. The RIGHT part of the front is a closed stone wall with a wooden door and one small window with warm orange light. ONE thick round stone chimney rises from the roof right above the hearth, with NO smoke at all (just an empty dark chimney opening). A wooden sign hangs from an iron bracket at the front corner, painted with a pictogram of a hammer above an anvil: pictogram only, no letters, no text, no glyph-like shapes, nothing that could be read as a letter or a character. {{TOWN_FRAME}}
```

#### `town/bld_guild` 모험가 길드

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x637
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 게시판 종이에는 읽히지 않는 구불선만 있다. 대장간 첫 판보다 크다 (둘째 판 대장간이 이 그림을 참조로 받았다).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

An adventurer guild hall, same game, same 3/4 top-down view and style as the second attached image: a big two-story wooden hall with a red-brown roof, a large banner with a simple sword-and-shield symbol (no letters), a notice board with a few pinned papers (no readable text) beside the double doors, two little flag poles. Bigger than the forge. {{TOWN_FRAME}}
```

#### `town/bld_shop` 재료 상점

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x639
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 판. 첫 판(bld_shop.rejected1.png)은 굴뚝 연기, 대장간과 같은 지붕, 빛나는 문간과 연장 걸이라 대장간이 하나 더 있는 것처럼 보였다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A small general goods and materials shop, same 3/4 top-down view and style as the second attached image: a cozy small wooden shop with a striped cloth awning, crates of ore and sacks out front, a hanging sign with a simple coin symbol (no letters). {{TOWN_FRAME}} It must NOT look like the forge: no chimney and no smoke at all, no glowing doorway, no tools inside; instead a plain closed wooden shop door with a small window and a wide shop counter window under the awning. Give it a soft muted green roof so it reads as a different building at a glance.
```

#### `town/bld_inn` 여관

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x613
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A village inn and tavern, same 3/4 top-down view and style as the second attached image: a two-story timber house with a warm lit window, a hanging sign with a simple mug symbol (no letters), a bench by the door. {{TOWN_FRAME}} No smoke; the door is a normal wooden door (not a glowing doorway) so it does not look like the forge.
```

#### `town/bld_house_a` 집 A (초가 오두막)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 671x720
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둥근 벽이라 거의 정면으로 보인다. 지도에서는 좌우로 뒤집어서도 쓴다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A small cute villager cottage, same 3/4 top-down view and style as the second attached image: round-ish walls, a straw-colored roof, one round window, a tiny flower box. Smaller than the shop. {{TOWN_FRAME}}
```

#### `town/bld_house_b` 집 B (좁은 이층집)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 590x720
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 판. 첫 판(bld_house_b.rejected1.png)은 집 모양 간판과 굴뚝 연기를 그렸다. 지도에서 간판은 들어갈 수 있는 건물, 연기는 대장간의 표시다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A small villager house, same 3/4 top-down view and style as the second attached image: a narrow two-story house with a blue-grey roof and a little chimney, a small fence corner. Different from a straw cottage. {{TOWN_FRAME}} It is just a private home: NO hanging sign and no symbol anywhere, and no smoke from the chimney (only the forge has smoke).
```

#### `town/bld_market` 시장 (노점 둘)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x562
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 사과와 빵 그림 간판(글자 없음)을 스스로 더했다. 둘째 회차 광장 소품의 기준.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

Two small market stalls side by side, same 3/4 top-down view and style as the second attached image: wooden stalls with cloth roofs (one orange, one green), baskets of fruit and a few bread loaves. {{TOWN_FRAME}} No people, no sellers.
```

#### `town/bld_mine` 광산 입구

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x605
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 바닥 그림자가 없다 (합성에서 접지 타원만 깐다).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A small mine entrance in a rocky hillside, same 3/4 top-down view and style as the second attached image: a dark tunnel framed by wooden beams, a little rail track coming out with one cart full of grey-brown ore lumps, a lantern. This is where the ore lumps come from. {{TOWN_FRAME}} The rocky hillside is a small self-contained mound of rounded grey-brown rocks (flat fills), not a whole landscape; no people.
```

#### `town/bld_gate` 마을 문 (큰길을 가로지르는 문)

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x219
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_gate` 고쳐 그리기: 다시 뽑기 직전의 이 그림 원본
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_VIEW_FRONT`](#조각-town_view_front), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 다섯째 판 (둘째 회차). 첫 회차의 셋째 판(bld_gate.rejected3.png)은 대장간처럼 대각선으로 놓여, 첫 합성에서 기울이고 1.35배로 늘려 큰길에 맞췄다 (기둥 머리가 찌그러졌다, 검토). 정면 대칭으로 다시 뽑은 넷째 판(rejected4)은 문 안쪽이 그림 폭의 35%뿐이라, 그 판을 두 번째 참조로 주고 비율을 적어 넓혔다(약 49%). 다른 건물과 달리 이것만 정면을 본다. 첫 판(rejected1)은 기둥이 비뚤고 홈이 있었고, 둘째 판(rejected2)은 선이 얇고 나뭇결·금이 있었다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

The second attached image is the previous drawing of this same village gate. Keep its parts, colours, outline weight and straight-on symmetric front view exactly, but move the two pillars much FARTHER APART so the opening is much wider, as described below.

{{TOWN_VIEW_FRONT}}

A small, low, cute village gate seen straight-on from the front, symmetric, the road runs straight toward the viewer through the arch: two short upright stone pillars (each a stack of three big rounded grey stone blocks with a flat stone cap), a curved wooden arch beam joining the tops of the pillars, and a small blank wooden plaque hanging from the middle of the arch with NOTHING on it (no letters, no symbols). On the outer side of each pillar, a short wooden palisade of three or four pointed logs held by one crossbar, running straight out to the left and to the right. The open passage between the two pillars is wide: about 45% of the whole image width. The gate is short and wide, not tall. Plain flat fills, no wood grain, no cracks, no scratch marks, the same very thick dark brown outline. No road drawn, no people. {{TOWN_FRAME}} Proportions from left to right across the whole gate: left palisade about 15%, left pillar about 12%, EMPTY OPENING about 46%, right pillar about 12%, right palisade about 15%. The arch beam is long and only gently curved to span this wide opening, with the small blank plaque hanging from its middle. One flat soft-grey shadow shape on the ground at the lower right of each pillar is allowed.
```

#### `town/bld_fountain` 분수 (광장 가운데)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 720px까지 줄임 → 720x544
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 바닥 그림자가 없다. 돌이 대장간보다 조금 따뜻한 회갈색이다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A round stone fountain for the village plaza, same 3/4 top-down view and style as the second attached image: a round stone basin with flat blue water and a small spout in the middle, a couple of stone benches is NOT needed, just the fountain. {{TOWN_FRAME}} Seen from the same 40-degree top-down angle as the forge, so the round basin looks like a wide oval and its flat water surface is clearly visible from above. The water is drawn as flat blue shapes with thick outlines (a simple little splash at the spout), no gradients. No benches, no people.
```

### 5.4 탑 넷 (4장)

#### `town/tower_water` 물의 탑

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 1000px까지 줄임 → 365x1000
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_forge` = `town/bld_forge` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_FORGE`](#조각-town_same_forge), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 탑 넷의 기준 (둥근 받침과 아치 문, 고리 턱 둘, 아치 창, 구름에 감긴 뾰족 지붕). 합성: 원본 580~908행 한 층을 8번 쌓는다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_FORGE}}

{{TOWN_VIEW_FORGE}}

A tall mysterious tower for heroes to climb, seen in the distance, same 3/4 top-down view and doodle style as the second attached image: a tall slim round stone tower with a pointed top, its theme is WATER: blue stones, a little waterfall line and wave marks, the top fades into a few flat cloud puffs (the tower is endless). {{TOWN_FRAME}} Keep the silhouette simple and chunky with the SAME very thick dark brown outline as the forge and plain flat fills. The tower fills most of the frame height; its bottom is a round stone base with one small arched door, standing on the ground with one flat grey shadow to the lower right; flat cloud puffs wrap only around the very top. Stones are simple rounded blocks like the forge chimney. No people.
```

#### `town/tower_fire` 불의 탑

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 1000px까지 줄임 → 377x1000
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@tower_water` = `town/tower_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_TOWER`](#조각-town_same_tower), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWER_SAME_KIND`](#조각-tower_same_kind), [`TOWN_FRAME`](#조각-town_frame), [`TOWER_RETHEME`](#조각-tower_retheme)
- **메모**: 둘째 판. 첫 판(tower_fire.rejected1.png)은 벽이 크림색에 붉은 테만 둘러 등대처럼 보였다. 합성: 원본 585~904행 한 층을 9번 쌓는다 (불꽃 띠의 이음매가 조금 비친다).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_TOWER}}

{{TOWN_VIEW_FORGE}}

{{TOWER_SAME_KIND}} FIRE: red-orange stones and a few flat flame shapes, the top fades into flat cloud puffs. {{TOWN_FRAME}} {{TOWER_RETHEME}} warm red-orange stone (NOT cream or white), with darker brick-red ledges; instead of the waterfall stripe there is a stripe of flat lava-orange with flame shapes, and a few small flat flame shapes lick up from the base ring. Flames are simple flat shapes with thick outlines, no glow, no gradients. No people.
```

#### `town/tower_earth` 땅의 탑

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 1000px까지 줄임 → 383x1000
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@tower_water` = `town/tower_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_TOWER`](#조각-town_same_tower), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWER_SAME_KIND`](#조각-tower_same_kind), [`TOWN_FRAME`](#조각-town_frame), [`TOWER_RETHEME`](#조각-tower_retheme)
- **메모**: 합성: 원본 580~900행 한 층을 8번 쌓는다 (쌓은 이음매에서 덩굴이 조금 어긋난다).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_TOWER}}

{{TOWN_VIEW_FORGE}}

{{TOWER_SAME_KIND}} EARTH: brown and moss-green stones with a few roots and rocks, the top fades into flat cloud puffs. {{TOWN_FRAME}} {{TOWER_RETHEME}} warm brown stone with patches of flat moss-green, darker brown ledges and a moss-green spire; instead of the waterfall stripe, a few thick brown roots climb up the wall, and a couple of round rocks and a small sprout sit at the base. Plain flat fills with thick outlines, no gradients. No people.
```

#### `town/tower_wind` 바람의 탑

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 1000px까지 줄임 → 369x1000
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@tower_water` = `town/tower_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_TOWER`](#조각-town_same_tower), [`TOWN_VIEW_FORGE`](#조각-town_view_forge), [`TOWER_SAME_KIND`](#조각-tower_same_kind), [`TOWN_FRAME`](#조각-town_frame), [`TOWER_RETHEME`](#조각-tower_retheme)
- **메모**: 소용돌이는 외곽선 없는 가는 청록 선이다. 깃발 때문에 그림 상자의 가운데가 조금 오른쪽이다. 합성: 원본 590~908행 한 층을 9번 쌓는다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_TOWER}}

{{TOWN_VIEW_FORGE}}

{{TOWER_SAME_KIND}} WIND: pale mint and white stones with swirl lines and a little flag, the top fades into flat cloud puffs. {{TOWN_FRAME}} {{TOWER_RETHEME}} pale mint and off-white stone with soft teal ledges; instead of the waterfall stripe, a few curly swirl lines (wind) wrap around the tower, and a small triangular flag on a thin pole flutters from the spire. Plain flat fills with thick outlines, no gradients. No people.
```

### 5.5 소품 (13장)

#### `town/prop_tree_round` 둥근 나무

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 290x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)
- **메모**: 소품 세트의 기준 (나머지 첫 회차 소품이 두 번째 참조로 받았다). 혼자 바닥 그림자가 없다 (합성에서 접지 타원을 깐다).

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_FRAMING}}

One round fluffy deciduous tree, 3/4 top-down view, a big round green crown blob and a short brown trunk. Transparent background with a real alpha channel.
```

#### `town/prop_tree_pine` 뾰족 나무

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 223x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One small pine tree, 3/4 top-down view, three stacked dark green triangles and a short trunk. Transparent background with a real alpha channel.
```

#### `town/prop_bush` 덤불

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x292
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One small round green bush with two tiny flowers, 3/4 top-down view. Transparent background with a real alpha channel.
```

#### `town/prop_rocks` 바위

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x259
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

A small cluster of three grey rounded rocks, 3/4 top-down view. Transparent background with a real alpha channel.
```

#### `town/prop_fence` 울타리 (옆으로 이어 붙인다)

- **크기**: 요청 1536x1024 (가로) · 실제 원본 1536x1024 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x83
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)
- **메모**: 둘째 판. 첫 판(prop_fence.rejected1.png)은 대각선 아이소메트릭에 옆면 음영이 있었다.

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One short straight section of a low wooden picket fence (four posts), 3/4 top-down view, horizontal. Transparent background with a real alpha channel.

IMPORTANT: the fence runs perfectly HORIZONTALLY from left to right, parallel to the bottom edge of the image, NOT diagonal and NOT isometric. We see its front face straight on, from slightly above, so only a thin sliver of the top of each post shows. Four separate posts with clear gaps between them, joined by two straight horizontal rails. Every post and rail is ONE single flat warm brown color: no darker side faces, no lighter top faces, no inner lines. Low and wide, about four times wider than tall.
```

#### `town/prop_lamp` 가로등

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 145x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)
- **메모**: 지붕과 받침 오른쪽에 조금 어두운 면이 하나 있다 (작게 쓰면 보이지 않아 두었다).

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One little street lamp post with a warm lit lantern on top, 3/4 top-down view. Transparent background with a real alpha channel.
```

#### `town/prop_flowers` 꽃

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x242
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

A small patch of wild flowers (a few pink, yellow and white blobs) on grass, flat, 3/4 top-down view. Transparent background with a real alpha channel.
```

#### `town/prop_crates` 상자와 통

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 298x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

A small stack of two wooden crates and one barrel, 3/4 top-down view. Transparent background with a real alpha channel.
```

#### `town/prop_signpost` 이정표

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 247x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)
- **메모**: 둘째 판. 첫 판(prop_signpost.rejected1.png)은 나뭇결, 못 자국 점, 옆면 음영, 발치의 음영 진 바위가 있었다.

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One wooden signpost with two arrow boards pointing different ways (no letters, just blank boards), 3/4 top-down view. Transparent background with a real alpha channel.

IMPORTANT: keep it as plain and chunky as the round tree reference. NO wood grain lines, NO thin inner lines, NO scratches, NO nails or dots on the boards. The post and each arrow board are each ONE single flat color with only the thick dark brown outline: no darker side faces, no lighter top faces, no shading planes. Nothing else at its foot (no rocks, no grass), only one flat shadow blob. The two blank arrow boards point to opposite sides (one left, one right).
```

#### `town/prop_cart` 광석 수레

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x238
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@prop_tree_round` = `town/prop_tree_round` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only), [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree), [`TOWN_PROP_FRAMING`](#조각-town_prop_framing)
- **메모**: 둘째 판. 첫 판(prop_cart.rejected1.png)은 광석에 면과 음영, 바큇살, 판자 선, 어두운 옆면이 있었다. 지도에서는 대장간 앞마당에 둔다.

```text
{{STYLE}}

{{TOWN_PROP_REF_ONLY}}

{{TOWN_PROP_SAME_TREE}}

{{TOWN_PROP_FRAMING}}

One small wooden hand cart loaded with grey-brown ore lumps, 3/4 top-down view. Transparent background with a real alpha channel.

IMPORTANT: keep it as plain and chunky as the round tree reference, a simple toy-like cart. The cart body is one simple box in ONE flat warm brown color with no plank lines, no darker side faces, no lighter top faces. Two simple round wheels, each a plain flat circle with a small center dot (no spokes). Two short handles. The ore lumps on top are 3 or 4 simple round blobs, each ONE flat grey-brown color with NO facets, NO darker sides, NO highlights. Only one flat shadow blob under it. Whole cart fully inside the frame with a generous margin.
```

#### `town/prop_bench` 벤치

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x283
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_market` = `town/bld_market` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_STALLS`](#조각-town_same_stalls), [`TOWN_VIEW_TURNED`](#조각-town_view_turned), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 회차. 첫 합성의 광장이 분수와 사람 둘뿐이라 비어 보였다 (검토).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_STALLS}}

{{TOWN_VIEW_TURNED}}

A small wooden park bench for a village plaza: a simple bench of a few warm brown wooden planks with a backrest and two stubby legs at each end, nothing on it. Small, chunky and simple. {{TOWN_FRAME}}
```

#### `town/prop_planter` 꽃 화분

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 320x291
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_market` = `town/bld_market` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_STALLS`](#조각-town_same_stalls), [`TOWN_VIEW_TURNED`](#조각-town_view_turned), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 회차. 첫 합성의 광장이 분수와 사람 둘뿐이라 비어 보였다 (검토).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_STALLS}}

{{TOWN_VIEW_TURNED}}

A square wooden flower planter box for a village plaza: a low square box of brown wooden planks, filled with one small round green bush and a few simple pink and yellow flowers. Small, chunky and simple. {{TOWN_FRAME}}
```

#### `town/prop_stall` 노점 수레

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 320px까지 줄임 → 308x320
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@bld_market` = `town/bld_market` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`TOWN_SAME_STALLS`](#조각-town_same_stalls), [`TOWN_VIEW_TURNED`](#조각-town_view_turned), [`TOWN_FRAME`](#조각-town_frame)
- **메모**: 둘째 회차. 첫 합성의 광장이 분수와 사람 둘뿐이라 비어 보였다 (검토).

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{TOWN_SAME_STALLS}}

{{TOWN_VIEW_TURNED}}

A small cute street vendor hand cart for a village plaza: a wooden cart with two big wooden wheels and two handles, a small striped cloth canopy (cream and soft red stripes) on two thin poles, a few round apples and loaves of bread on top. Small, chunky and simple, no sign. {{TOWN_FRAME}}
```

## 6. heroes: 용사 36명

모두 **왼쪽**을 본다. 오른쪽을 보는 드워프와 마주 보고, 전투에서는 오른쪽의 몬스터와 마주 본다. 원본은 모두 1024x1536이다.

- **예제 10명**(2026-10-13): 명단보다 먼저 "지금 그림체로 용사 예제"로 뽑았다.
  프롬프트 = `{{HERO_STYLE}}` + `{{HERO_REF_NOTE}}` + `{{HERO_COMMON}}` + 용사마다의 문단.
  HERO_STYLE은 STYLE에서 팔레트 괄호와 'no signature'를 뺀 판이라 ownStyle로 적었다. 네아와 오델은 공통 문단의 첫 판(`{{HERO_COMMON_V1}}`)으로 뽑았다.
- **명단 26명**: 네 묶음으로 나눠 뽑았다. 참조는 드워프(화풍)와 바일(`@heroes/hero_vail`: 비례, 선 굵기, 틀 안의 크기)이다.
  묶음마다 참조 안내와 공통 문단의 낱말이 조금 다르다(ROSTER_B1~B4).
  프롬프트 = `{{STYLE}}` + 묶음의 참조 안내 + "A hero character for the game: " + 생김새 + 묶음의 공통 문단 + [등급 문단] + [다시 뽑으며 더한 끝 문단].
- 첫 판들이 오른쪽을 보거나 2.8~4등신으로 나와 다시 그렸다. 그래서 지금 문장이 "body and face turned slightly toward the LEFT edge",
  "about 2.3 to 2.5 heads tall … a big round head that is about 40% of the total height"다.

### 6.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 HERO_STYLE

용사 예제의 화풍 머리말(STYLE에서 팔레트 괄호와 "no signature"를 뺀 판).

```text
Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (a little muted). No text, no letters, no numbers, no watermark.
```

#### 조각 HERO_REF_NOTE

용사 예제: 드워프는 화풍 참조일 뿐이라는 안내.

```text
The attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. Draw only the new character described below.
```

#### 조각 HERO_COMMON

용사 예제의 공통 문단(여덟 명). 왼쪽을 보고, 2.3~2.5등신, 머리가 키의 약 40%, 덩어리 머리, 튜브 팔다리, 벙어리장갑 손.

```text
Draw ONE human adventurer hero, full body from head to boots, standing, front three-quarter view: body and face turned slightly toward the LEFT edge of the image (the character looks toward the viewer's left). Chibi proportions about 2.3 to 2.5 heads tall (a little less squat than the dwarf: a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow.
```

#### 조각 HERO_COMMON_V1

공통 문단의 첫 판(네아, 오델). 덩어리 머리·튜브 팔다리 줄을 더하기 전이다.

```text
Draw ONE human adventurer hero, full body from head to boots, standing, front three-quarter view with the body turned slightly toward the LEFT side of the image. Chibi proportions about 2.3 to 2.5 heads tall (a little less squat than the dwarf: big round head, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal: plain clothes made of a few flat color blocks, no patterns, no ornaments beyond what is described. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow.
```

#### 조각 ROSTER_B1_REF

명단 묶음 1(특급 9명)의 참조 안내. 두 번째 참조는 바일(hero_vail).

```text
The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its proportions (about 2.3 to 2.5 heads tall, a big round head), its outline thickness, its flat fills and its small amount of detail exactly, but do NOT draw that hero. Draw only the new character described below.
```

#### 조각 ROSTER_B1_COMMON

명단 묶음 1의 공통 문단.

```text
Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. Holding their weapon. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.
```

#### 조각 ROSTER_B2_REF

명단 묶음 2(특급 5, 일반 2)의 참조 안내.

```text
The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same roster: match its body proportions (big round head, small body, about 2.3 to 2.5 heads tall), its outline thickness, its flat fills and how large the character sits in the frame, but do NOT redraw that hero. Draw only the new character described below.
```

#### 조각 ROSTER_B2_COMMON

명단 묶음 2의 공통 문단.

```text
Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, the character looks toward the viewer's left). About 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Holding their weapon. Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, ONE clear expression. Keep details minimal like the dwarf: hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.
```

#### 조각 ROSTER_B2_SPECIAL

명단 묶음 2의 특급 등급 문단.

```text
This is a special-rank hero: make the design a little more distinctive (a clear, memorable silhouette and one signature prop), while keeping the same super simple doodle style.
```

#### 조각 ROSTER_B2_NORMAL

명단 묶음 2의 일반 등급 문단.

```text
This is a common-rank hero: keep the design plain and humble (simple everyday clothes, a plain weapon, nothing fancy).
```

#### 조각 ROSTER_B3_REF

명단 묶음 3(일반 6명)의 참조 안내. 바일을 따라 그리지 않게 "no red tunic, no book, no sword unless asked"를 적었다.

```text
The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its body proportions, head size, outline thickness and amount of detail exactly, but do NOT draw that hero (no red tunic, no book, no sword unless asked). Draw only the new character described below.
```

#### 조각 ROSTER_B3_COMMON

명단 묶음 3의 공통 문단.

```text
Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head about 40% of the total height, small body, short legs). Holding their weapon. Very simple face: two dot eyes and a tiny mouth, ONE clear expression. Hair is one or two big simple blob shapes, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns. Thick outlines, flat colors. The whole character fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.
```

#### 조각 ROSTER_B4_REF

명단 묶음 4(검토 때 다시 그린 넷)의 참조 안내.

```text
The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes, same simple stick-like arms and legs and little boots), but do NOT draw the dwarf. The second attached image is another hero from the same game: match its proportions (about 2.3 to 2.5 heads tall, a big round head), its outline thickness, its flat fills, its small amount of detail and how large the character sits in the frame exactly, but do NOT draw that hero (no red tunic, no ledger, no sword unless asked). Draw only the new character described below.
```

#### 조각 ROSTER_B4_COMMON

명단 묶음 4의 공통 문단. 틀 안의 크기를 바일에 맞추려고 "wide empty margin … fills only the middle of the image"를 적었다.

```text
Full body from head to boots, standing, body turned slightly to the left in a front 3/4 view (body and face turned slightly toward the LEFT edge of the image, looking toward the viewer's left). Chibi proportions about 2.3-2.5 heads tall (a big round head that is about 40% of the total height, small body). Very simple face: two dot eyes (or very simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Hair is one or two big simple blob shapes with at most two inner lines, arms and legs are simple tubes, hands are simple mitten shapes, plain clothes made of a few flat color blocks, no patterns, no stitching, no ornaments beyond what is described. Holding their weapon. Thick outlines, flat colors. The whole character fits inside the frame with wide empty margin on all sides (the character fills only the middle of the image, like the second reference), nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow. No text.
```

#### 조각 SPECIAL_ONE_IDEA

특급 등급 문단(묶음 1·4): 기억에 남는 실루엣 하나, 그래도 다른 용사만큼 단순하게.

```text
This is a special-rank hero: make the design a little more distinctive (one memorable silhouette idea), but keep it just as simple and doodle-like as the others.
```

#### 조각 NORMAL_TAIL

일반 용사의 생김새 끝 문장(묶음 3·4: 등급 문단 대신).

```text
An ordinary common hero: plain and humble, simple clothes, nothing fancy.
```

### 6.2 예제 (10장)

#### `heroes/hero_vail` 바일 (특급 · 불 · 한손검) 처음 대장간에 온 용사. 명단 용사들의 두 번째 참조

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 283x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 둘째 판. 첫 판(hero_vail.rejected1.png)은 혼자 오른쪽을 보고 약 2.8등신에 머리카락 가닥이 많았다. 새 판은 왼쪽을 보고 약 2.3등신, 드워프처럼 덩어리 머리다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: Vail, a young man, the first hero who ever came to the forge. Broad square shoulders and a sturdy build, chibi 2.4 heads tall. Short dark brown hair as one simple tufty blob. Blunt but honest: a straight flat serious mouth and steady dot eyes, slight frown. Rust-red tunic (#b5523b), brown belt, brown trousers, little brown boots. A small worn brown ledger book tucked into the front of his tunic, its top corner sticking out. One old burn scar shown as a simple pale pink patch on the back of his right hand. He holds a plain one-handed sword (simple grey blade, brown grip) pointing down at his side.
```

#### `heroes/hero_nea` 네아 (특급 · 바람 · 활) 먼저 보고 먼저 말하는 궁수

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 359x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON_V1`](#조각-hero_common_v1)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. 화살통, 머리 가닥이 조금 많지만 화풍 안이다. 활 끝 깃털이 오른쪽 끝에서 12px 떨어져 있다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON_V1}}

The hero: Nea, a slim young woman archer who always sees first and speaks first. Narrow eyes drawn as two short flat lines, wind-tousled hair blowing to one side in a few big simple tufts (dark teal-brown). Her mouth is open mid-sentence, eager, and her free hand points ahead with one finger as if saying "over there!". Short teal-blue hooded cloak (#4f8a9e) over a cream shirt, brown boots, a small quiver with three arrows on her back. She holds a simple wooden longbow, and a single white feather is tied to the top tip of the bow with a tiny string.
```

#### `heroes/hero_odel` 오델 (특급 · 땅 · 대검) 남의 짐까지 지는 큰 사람

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 349x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON_V1`](#조각-hero_common_v1)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. 드워프의 둥근 덩어리 화풍에 가장 가깝다. 좌우 여백이 16~20px로 빠듯하지만 잘리지 않았다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON_V1}}

The hero: Odel, a very big, broad, gentle man, the heaviest and roundest of all the heroes, slow and calm. Huge round body, short buzzed hair, small calm sleepy dot eyes, tiny closed mouth, a slight nodding tilt of the head. Earthy khaki-brown clothes (#7a6a4f) and a simple leather strap across his chest. On his back an oversized bulging backpack, with one EXTRA bundle tied on top of it (someone else's luggage he is carrying for them). He rests a big plain greatsword (wide grey blade, brown grip) on his shoulder with one hand.
```

#### `heroes/hero_aren` 아렌 (특급 · 불 · 단검) 가볍고 겁 없는, 단검 둘

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 270x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 둘째 판. 첫 판(hero_aren.rejected1.png)은 오른쪽을 보고 다리가 길어 약 3.2등신이었다. 휘파람 부는 입이 숫자 3처럼 보이는 만화 기호다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: Aren, a skinny wiry young man, light and carefree but brave. A thin narrow body and thin arms and legs, but still the same chibi 2.5-heads-tall proportions (big head, short legs). Messy light-brown hair as one big tufty blob, a relaxed grin, and he is whistling (lips puckered in a small round "o", NO music notes, no symbols). Amber-ochre short jacket (#a8743a), cream shirt, dark brown trousers, little boots. TWO daggers at his belt: he spins one dagger casually in his raised hand, while the second dagger stays sheathed at his hip, its handle wrapped in a faded cloth strip because he never uses it (it was his older brother's). One hand on his hip, a cocky relaxed stance.
```

#### `heroes/hero_isol` 이솔 (특급 · 불 · 석궁) 지붕을 걷는 아이

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 329x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. 한 발로 서서 위를 본다 (탑을 오래 올려다보는 아이).

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: Isol, a small, light young girl (about 12), quiet and careful, light on her feet like a child who walks on rooftops. She stands on tiptoe on one foot, arms slightly out for balance, and looks UP with a quiet curious face (two dot eyes looking upward, tiny mouth). Short grey-black hair. A long grey scarf (#8a8a8f) wrapped around her neck with long ends fluttering, smudged with a few small darker grey ash spots. Simple grey-brown tunic, little boots. A small crossbow is slung on her back by a strap, its bow limbs clearly visible sticking out behind her shoulders.
```

#### `heroes/hero_toma` 토마 (특급 · 땅 · 석궁) 한 발을 오래 겨누는

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 346x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. 모자와 석궁이 조금 자세하지만 화풍 안이다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: Toma, a stocky calm middle-aged man, an unhurried patient sniper who aims one shot for a long time. Half-closed relaxed sleepy eyes, one eye shut as if quietly aiming, a short stalk of grass in the corner of his mouth, a small stubble chin drawn as a flat darker patch. A wide-brimmed soft hat, olive and mud-brown earthy clothes, a sturdy brown vest. He holds a big heavy wooden crossbow low at his hip with both hands, pointing it slightly forward, perfectly still and unbothered.
```

#### `heroes/hero_yuna` 유나 (특급 · 물 · 지팡이 · 힐러) 원소 결정을 모으는 마법사

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 309x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: Yuna, a small cheerful young woman mage who collects elemental crystals. A soft blue hooded robe (water color), short dark hair peeking out, a proud happy smile with closed happy eyes (two upward arcs). LOTS of tiny round pouches hang all over her: from her belt, her shoulder strap and her staff, each pouch with a small crystal peeking out in different colors (red, blue, green, yellow). She holds a simple wooden staff topped with one blue crystal. Her pose shows off her collection a little.
```

#### `heroes/hero_rookie` 신참 검사 비코 (일반 · 땅 · 한손검) 가장 낮은 등급의 이름 없는 신참으로 그렸다

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 312x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. '하찮은' 결에 가장 가깝다. 투구 눈구멍이 조금 눈처럼 읽힌다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: a nameless rookie adventurer, the lowest rank, a nervous teenage boy. A way-too-big dented iron helmet slides down over his eyes so his eyes are hidden; only his small wobbly worried mouth shows. Three big sweat drops flying off his head (nervous cold sweat). Thin body, a cheap padded cream vest, patched brown trousers, knock-kneed trembling stance. He grips a rusty one-handed sword with both hands, held up stiffly in front of him; the blade is grey with a few orange-brown rust spots and a small chip in the edge.
```

#### `heroes/hero_ace` 하엘 (특급 · 바람 · 지팡이) S급 마법사로 그렸다

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 308x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 둘째 판. 첫 판(hero_ace.rejected1.png)은 선이 얇고 4등신이 넘는 보통 일러스트 같았고 구슬에 광택이 있었다. 새 판은 선이 드워프만큼 굵고 약 3등신이다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: a top-rank (S rank) mage, a tall slim woman, a bit taller and slimmer than the other chibi heroes but STILL a chibi: about 3 heads tall and NOT more, with a big round head. Draw her with outlines exactly as thick and bold as the dwarf's and the same chunky simple rounded shapes (not a thin elegant illustration). Short chestnut-brown bob haircut as one simple blob, round human ears (NOT an elf, NOT white or silver hair, no twin tails, no hair ornaments). Calm, composed, expressionless face: two dot eyes and a small straight mouth. A plain cream robe and a long deep-forest-green cape billowing far out to one side in the wind. She holds a tall plain wooden staff, taller than her, topped with a small round amber stone drawn as one flat amber circle (no shine, no highlight dot). Quiet confident stance, not posing. She must NOT resemble any famous anime or game character.
```

#### `heroes/hero_veteran` 베르다 (특급 · 불 · 대검) 은퇴를 앞둔 할머니 전사

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 212x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`HERO_STYLE`](#조각-hero_style), [`HERO_REF_NOTE`](#조각-hero_ref_note), [`HERO_COMMON`](#조각-hero_common)
- **표시**: 화풍 머리말을 붙이지 않는다(ownStyle): 화풍 문장이 프롬프트 안에 있다
- **메모**: 첫 판 채택. 칼집째 세운 대검에 두 손을 얹고 지팡이처럼 기댄다.

```text
{{HERO_STYLE}}

{{HERO_REF_NOTE}}

{{HERO_COMMON}}

The hero: an old grandmother warrior about to retire, still strong. Short stocky body, grey hair in a round bun, kind gentle eyes drawn as two soft smiling crescents, a warm small smile, ONE scar as a single short line across her cheek. Worn simple armor: a dull steel breastplate over a faded maroon tunic, a short faded cape. Instead of a walking cane she leans on her sheathed greatsword: the big greatsword in its long brown leather scabbard is planted point-down on the ground in front of her and she rests both hands on its crossguard and pommel like an old lady leaning on a cane.
```

### 6.3 명단: 네 묶음 (26장)

#### `heroes/hero_sien` 시엔 (특급 · 물 · 한손검) 검을 쓴 날보다 닦은 날이 많다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 278x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 포니테일까지 재면 약 2.6~2.7등신으로 예제보다 조금 길다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A neat, slim young woman (about 20) with a high black ponytail and a calm, tidy face with a small satisfied smile, in a clean sea-blue tunic with a white collar and grey trousers. She holds a plain one-handed sword in one hand and a small white cloth in the other as if polishing it, and a tiny wooden bucket with a scrub brush hangs from her belt.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_dowin` 도윈 (특급 · 땅 · 한손검) 힘은 장사인데, 말을 걸면 귀가 빨개진다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 178x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 다리가 길어 약 2.9등신이다 (아주 크고 호리호리한 성격이라 일부러 둔 예외). 다른 용사와 키를 맞추고 싶으면 다시 뽑을 후보다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A very tall, lanky, shy young man with long arms and big mitten hands, a short olive-brown mop of hair, eyes glancing away and pink blushing cheeks and ears, in an ochre-brown tunic and khaki trousers. He holds a plain one-handed sword awkwardly close to his chest, and one small white daisy is tucked behind his ear.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_kio` 키오 (특급 · 바람 · 한손검) 바람개비가 안 돌면 하루 쉰다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 291x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 튜닉이 잎 초록보다 올리브에 가깝다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A cheerful scrawny boy of about 14 with spiky light-brown hair and a wide open grin, in a leaf-green short tunic and rolled-up brown trousers. He raises a plain one-handed sword high, and a small four-blade paper pinwheel (plain mint and cream blades) sticks up from his headband.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_rona` 로나 (특급 · 물 · 대검) 뱃멀미가 심해서 탑에 왔다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 332x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 대검 끝과 손잡이 쪽 여백이 빠듯하지만 잘리지 않았다. 얼굴만으로는 성별이 조금 모호하다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A tall, broad-shouldered woman in her forties, a former ferry rower, with a navy-blue knit cap over short sandy hair and a relaxed lopsided half-smile, in a navy-blue sleeveless vest over a cream shirt with the sleeves rolled up. She carries a big plain greatsword over her shoulder the way a rower carries an oar, with a coil of rope looped over her other shoulder.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_daro` 다로 (특급 · 바람 · 대검) 칼보다 키가 작다. 아직은.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x361
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 둘째 판. 첫 판(hero_daro.rejected1.png)은 칼이 아이 키보다 짧아 '칼보다 키가 작다'가 살지 않아 끝 문단을 더했다. 둘째 판의 칼은 키보다 조금 길다 (부탁한 1.5배까지는 아니다).

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A tiny boy of about 8, the smallest hero of all, with round cheeks, a determined pouting mouth and a mint-green headband over messy black hair, in a leaf-green tunic and little boots. He grips a plain greatsword that is much TALLER than he is with both hands, its tip resting on the ground behind him as he drags it along.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}

IMPORTANT, the main joke of this character: the greatsword is clearly LONGER than the boy is tall, about one and a half times his whole height from head to boots. He holds its grip with both hands up near his chest, and the long blade slants down behind him toward the right side of the image so its tip rests on the ground far behind his heels, as if he is dragging it. Make the boy small in the frame so the whole long sword fits inside the image with empty margin on all sides.
```

#### `heroes/hero_seon` 세온 (특급 · 물 · 단검) 머리 위 개구리와 말이 잘 통한다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 235x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A slim, easygoing young man with wavy blue-black hair and sleepy, contented half-closed eyes, in a short sky-blue hooded rain cape over a grey tunic. He holds a small plain dagger loosely in one hand, and a small round green frog sits calmly on top of his head.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_hern` 헤른 (특급 · 땅 · 단검) 잡초에게도 이름을 지어 준다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 248x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 허리가 굽은 느낌은 약하다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A short, slightly hunched old grandpa gardener with a neat little white moustache (no beard) and kind crinkled eyes, in a khaki-olive gardener's apron over a brown shirt. He holds a small curved dagger like a pruning knife, and a little green sprout grows out of the top of his floppy brown sun cap.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_pia` 피아 (특급 · 바람 · 단검) 편지는 꼭 전한다. 가끔 옆집에.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 330x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 까치발보다는 웅크린 출발 자세다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A quick, skinny courier girl of about 14 with two short dark-brown pigtails and a busy, determined face, standing on her toes and leaning forward as if about to dash off, in a mint-green short jacket and brown shorts. She holds a small plain dagger in one hand, and a big brown satchel stuffed with plain blank envelopes (no writing) hangs at her hip.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_nua` 누아 (특급 · 물 · 활) 눈물이 많다. 화살은 똑바로 간다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 361x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B1_REF`](#조각-roster_b1_ref), [`ROSTER_B1_COMMON`](#조각-roster_b1_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 첫 판 채택. 명단 검토에서 유나와 덜 닮게 두 번 다시 그렸으나 (외곽선이 가늘거나, 남색 모자가 오토와 겹쳤다. 둘째 판이 hero_nua.rejected2.png) 쓰지 않고 이 판으로 되돌렸다.

```text
{{STYLE}}

{{ROSTER_B1_REF}}

A hero character for the game: A small girl of about 10 in a big pale-blue raincoat with the hood down, with a short black bob, big watery eyes with one single tear drop on her cheek and a wobbly but brave mouth. She holds a simple wooden bow with an arrow nocked, aimed perfectly straight and steady, in funny contrast to her teary face.

{{ROSTER_B1_COMMON}}

{{SPECIAL_ONE_IDEA}}
```

#### `heroes/hero_boro` 보로 (특급 · 불 · 활) 불화살로 고구마를 굽는다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 353x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special)
- **메모**: 첫 판 채택. 김 한 줄기는 빠졌고 몸이 거의 정면을 본다. 틀을 바일보다 조금 크게 채운다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A round, chubby young man with closed happy eyes and a big cheerful grin, a red bandana over short ginger hair, in an orange-red tunic and brown trousers. He holds a simple wooden shortbow in one hand and a single arrow in the other with a whole roasted sweet potato skewered on its tip, one tiny curl of steam rising from it.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_SPECIAL}}
```

#### `heroes/hero_elda` 엘다 (특급 · 땅 · 활) 머리에 새가 둥지를 틀었다. 그냥 둔다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 243x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special)
- **메모**: 첫 판 채택. 새가 갈색이 아니라 연노랑으로 나왔다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A tall, slender, quiet woman ranger in her thirties with one long dark-brown braid, calm half-closed eyes and a straight mouth, in a moss-olive hooded cloak and brown leggings, holding a tall plain longbow upright beside her. A small round bird's nest with one little brown bird in it sits on top of her head, and she does not mind it at all.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_SPECIAL}}
```

#### `heroes/hero_liv` 리브 (특급 · 물 · 석궁) 석궁을 고칠수록 복잡해진다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 288x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special)
- **메모**: 둘째 판. 첫 판(hero_liv.rejected1.png)은 파랑이 쨍하고 석궁이 석궁으로 읽히지 않았으며 틀을 꽉 채워 끝 문단을 더했다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A small, bookish young woman tinkerer with huge round glasses, a messy auburn bun with a pencil stuck in it and a proud grin, in blue work overalls over a cream shirt with a brown tool belt. She hugs a home-made crossbow with a few extra gears, a lever and a little crank bolted on, still drawn as a few simple flat shapes.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_SPECIAL}}

Important fixes: keep the colors muted and soft like the dwarf (her overalls are a soft muted denim blue, NOT bright saturated blue). Her crossbow must clearly read as a crossbow: a wooden stock pointing toward the left with a short curved bow (the prod) set crosswise across its front end, a visible bowstring, and a loaded bolt; the extra gears, the lever and the crank are small simple add-ons on the stock. Proportions about 2.4 heads tall like the second image (the body plus legs clearly taller than the head), and the character sits at about the same size in the frame as the second image, with wide empty margins on all sides.
```

#### `heroes/hero_milo` 밀로 (특급 · 바람 · 석궁) 바람 부는 날만 일한다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 326x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B4_REF`](#조각-roster_b4_ref), [`ROSTER_B4_COMMON`](#조각-roster_b4_common), [`SPECIAL_ONE_IDEA`](#조각-special_one_idea)
- **메모**: 둘째 판 (명단 검토). 첫 판(hero_milo.rejected1.png, 묶음 2)은 틀을 꽉 채우고 머리가 컸으며 눈썹·혀처럼 세부가 많았다.

```text
{{STYLE}}

{{ROSTER_B4_REF}}

A hero character for the game: A stocky, jolly middle-aged miller with a big bushy brown moustache (no beard), rosy cheeks and a dab of white flour on his nose, in a pale-green work shirt with rolled sleeves and a white apron dusted with flour. He holds a sturdy wooden crossbow at his side, and a small white flour sack is slung over his back.

{{ROSTER_B4_COMMON}}

{{SPECIAL_ONE_IDEA}}

Important: keep him the same size in the frame as the second reference hero, with wide empty margins all around (he must NOT fill the frame). His head is about 40% of his height, NOT bigger. Keep the face as simple as the dwarf: two plain black dot eyes, NO eyebrows, NO tongue, NO open mouth; the bushy moustache is ONE simple flat brown blob shape under a small round nose with one small white flour dot on it, plus two small flat pink cheek circles. Flour on the apron is at most two small pale smudges. Hair is one simple brown blob with at most one inner line. The crossbow hangs low at his side pointing down toward the left: a plain straight wooden stock with a curved wooden bow limb across its front end and a clearly visible straight string between the limb tips (a clear T shape). The small white flour sack peeks over his shoulder from his back.
```

#### `heroes/hero_karel` 카렐 (특급 · 불 · 지팡이) 주문을 외면 앞머리가 조금 탄다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 253x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special)
- **메모**: 첫 판 채택. 연기가 위쪽 끝에 가깝지만 잘리지 않았다. 묘사보다 덜 호리호리하다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A lanky young man mage with a big puffy frizzy hairdo whose tips are singed black, a single small puff of grey smoke above it, and a startled-but-proud face (round dot eyes, small round mouth), in a rust-red robe with slightly scorched sleeve ends. He holds a crooked wooden staff topped with a small flat orange flame shape.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_SPECIAL}}
```

#### `heroes/hero_mora` 모라 (특급 · 땅 · 지팡이 · 힐러) 안 다쳐도 약초를 발라 준다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 300x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special)
- **메모**: 첫 판 채택. 지팡이가 짧지 않고 길다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A plump, kind middle-aged herbalist woman with round rosy cheeks and a warm closed-eye smile, brown hair tied up in an olive kerchief, in an ochre-brown dress with a big olive apron. She leans on a short gnarled wooden staff with two green leaves sprouting from its top and carries a small woven basket of green herbs on her arm.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_SPECIAL}}
```

#### `heroes/hero_rita` 양치기 리타 (일반 · 바람 · 한손검) 양을 세다가 먼저 잠든다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 300x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B4_REF`](#조각-roster_b4_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B4_COMMON`](#조각-roster_b4_common)
- **메모**: 셋째 판 (명단 검토). 첫 판(rejected1)은 머리 가닥이 많고 머리가 컸다. 둘째 판(rejected2, 묶음 2의 끝 문단)은 기울어진 감은 눈이 화나 보였고, 갈색 단발에 초록 옷이라 하엘·솜과 겹쳤다.

```text
{{STYLE}}

{{ROSTER_B4_REF}}

A hero character for the game: A plain teenage shepherd girl with a short brown bob and sleepy half-closed eyes in the middle of a yawn, in a simple mint-green tunic with a cream wool shawl. She holds a plain one-handed sword in one hand and a short wooden shepherd's crook in the other. {{NORMAL_TAIL}}

{{ROSTER_B4_COMMON}}

Important: she must NOT look like the second reference hero or like any famous game or anime character. Her head is about 40% of her height, NOT bigger, and she sits the same size in the frame as the second reference hero with wide empty margins. Her hair is ONE simple short brown rounded blob (a plain rounded bob) with at most one inner line, NO strands. Her memorable silhouette: the cream wool shawl is big and fluffy, drawn as one puffy scalloped cloud shape wrapped around her shoulders like a sheep's fleece. She is in the middle of a big sleepy yawn: eyes closed as two small relaxed downward-curving arcs (sleepy and peaceful, NOT angry, no slanted brows), mouth a small open oval. She leans a little on a short wooden shepherd's crook held upright in one hand, and a small plain one-handed sword hangs loosely pointing down in her other hand.
```

#### `heroes/hero_bri` 빨래꾼 브리 (일반 · 물 · 대검) 대검은 빨랫방망이보다 조금 무겁다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 366x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_NORMAL`](#조각-roster_b2_normal)
- **메모**: 첫 판 채택. 좌우 여백이 빠듯하지만 잘리지 않았다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A plump middle-aged washerwoman with a blue headscarf, sleeves rolled up and a cheerful no-nonsense face, in a plain blue dress with a white apron. She carries a plain greatsword over her shoulder the same easy way she would carry a laundry paddle.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_NORMAL}}
```

#### `heroes/hero_peno` 빵집 아들 페노 (일반 · 불 · 대검) 칼보다 반죽을 더 잘 친다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 315x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B2_REF`](#조각-roster_b2_ref), [`ROSTER_B2_COMMON`](#조각-roster_b2_common), [`ROSTER_B2_NORMAL`](#조각-roster_b2_normal)
- **메모**: 첫 판 채택. 칼끝이 왼쪽 끝에 가깝지만 잘리지 않았다.

```text
{{STYLE}}

{{ROSTER_B2_REF}}

A hero character for the game: A broad, cheerful young man with a short orange-brown crew cut and a smudge of flour on one cheek, in a plain brick-red shirt and a white baker's apron. He holds a plain greatsword out in front of him with both hands like a big bread peel.

{{ROSTER_B2_COMMON}}

{{ROSTER_B2_NORMAL}}
```

#### `heroes/hero_shu` 정찰병 슈 (일반 · 바람 · 단검) 숨바꼭질에서 진 적이 없다. 다들 먼저 집에 가서.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 261x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A small, quiet girl of about 13 in an oversized pale-green hood that hides most of her hair, with shy dot eyes peeking out, in a simple green-grey tunic. She holds a small plain dagger close to her chest. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}
```

#### `heroes/hero_pori` 버섯꾼 포리 (일반 · 땅 · 단검) 먹는 버섯을 반쯤 안다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 277x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 둘째 판. 첫 판(hero_pori.rejected1.png)은 바일과 같은 덥수룩한 머리여서 바가지 머리가 아니었다.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A small round-faced boy of about 10 with a bowl haircut and a curious open mouth, in a plain ochre-brown tunic. He holds a small plain dagger and carries a little basket with a few brown mushrooms on his arm. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}

Important: his hair is a smooth round BOWL CUT (one smooth dome-shaped blob with perfectly straight blunt bangs cut straight across his forehead, like an upside-down bowl on his head, NOT tufty or messy), so he looks clearly different from the second reference hero. He is smaller and rounder than the reference hero, a little kid. The basket hangs from the crook of his bent arm by its handle.
```

#### `heroes/hero_tori` 견습 궁수 토리 (일반 · 불 · 활) 과녁보다 사과를 더 많이 맞혔다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 295x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 둘째 판. 첫 판(hero_tori.rejected1.png)은 활을 당기는 자세에 머리 가닥·속눈썹이 많았다. 시위가 가늘게 보여 활이 조금 막대처럼 보일 수 있다.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A plain girl archer of about 15 with a short orange-red ponytail and a determined squint, in a simple rust-orange tunic and brown trousers. She holds a small plain shortbow, and a red apple with an arrow stuck through it hangs from her belt. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}

Important: keep her as simple as the dwarf. Her hair is one simple orange-red blob with a SHORT little stubby ponytail (a small round tuft at the back of the head, not long), at most two inner lines. The determined squint is drawn as two short flat straight lines for eyes plus one small straight mouth, NO eyelashes, NO extra marks on the face. She stands calmly holding the plain shortbow upright in one hand at her side (not drawing it, no arrow on the bow), the other hand in a small determined fist. The red apple with one arrow stuck through it hangs clearly from her belt.
```

#### `heroes/hero_otto` 어부 오토 (일반 · 물 · 활) 놓친 물고기 이야기가 제일 길다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 292x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 둘째 판. 첫 판(hero_otto.rejected1.png)은 활 대신 낚싯대를 들었다.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A thin, slightly stooped old fisherman with grey stubble (no beard), a floppy navy-blue hat and calm patient eyes, in a faded blue shirt and rolled-up trousers. He holds a simple wooden bow, and a small empty fishing basket hangs at his hip. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}

Important: his weapon is a BOW, NOT a fishing rod: a simple curved wooden archery bow (a D-shaped arc with a clearly visible straight bowstring), held upright in one hand at his side. There is NO fishing rod, NO line, NO bobber anywhere. He is thin and old: a narrow body, a slightly bent back with his head pushed a little forward, grey hair tufts under the floppy navy hat, grey stubble dots on the chin. Calm, patient half-closed eyes. A small woven fishing basket (empty) hangs at his hip on a strap.
```

#### `heroes/hero_tessa` 문지기 테사 (일반 · 물 · 석궁) 문은 잘 지킨다. 열쇠는 자주 잃는다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 282x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 셋째 판. 첫 판(rejected1)은 시위 없는 석궁이 곡괭이처럼 보였고, 둘째 판(rejected2)은 눈 하이라이트·나뭇결·투구 리벳으로 자세했다. 틀을 꽤 채운다.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A sturdy, round young woman town gatekeeper with a plain round iron helmet and a broad friendly grin, in a simple blue padded tunic. She holds a plain crossbow at her side, and one big iron key dangles from her belt on a string. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}

Important: the crossbow must read clearly as a CROSSBOW, not a pickaxe or hammer: a plain straight wooden stock held horizontally at her hip in both hands, pointing toward the left, with a short curved bow limb across its front end and a clearly visible straight bowstring, forming a clear T or cross shape. She is sturdy and round (a wide round body) with a broad happy grin (a simple wide curved smile line, mouth may be slightly open). Keep everything as simple as the dwarf: eyes are two plain black dots with NO white highlights, the helmet is a plain smooth grey dome with NO rivets and NO bands, the crossbow stock is one flat brown color with NO wood grain lines, the tunic is one flat blue block with at most one or two lines. One big old iron key dangles from her belt on a string. Leave generous empty margin around her (she fills only the middle of the frame, like the second reference hero).
```

#### `heroes/hero_hob` 광부 호브 (일반 · 땅 · 석궁) 탑도 결국 큰 굴이라고 생각한다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 307x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B4_REF`](#조각-roster_b4_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B4_COMMON`](#조각-roster_b4_common)
- **메모**: 넷째 판 (명단 검토). 묶음 3의 세 판은 석궁이 곡괭이처럼 보이거나(rejected1), 소년처럼 보여 포리와 겹치거나(rejected2), 같은 땅·석궁인 토마와 겹쳤다(rejected3: 수염 자국, 모자, 허리 아래 석궁). 석궁을 곡괭이처럼 어깨에 메어 작게 보면 곡괭이로 읽힐 여지가 조금 있다.

```text
{{STYLE}}

{{ROSTER_B4_REF}}

A hero character for the game: A short, stocky middle-aged miner with dirt smudges on his cheeks and a plain brown mining helmet with a small lamp on its front, in a khaki work shirt and brown trousers. He holds a sturdy plain crossbow in both hands. {{NORMAL_TAIL}}

{{ROSTER_B4_COMMON}}

Important: he must look clearly different from another hero in this game, a stubbly man in a wide-brim hat who holds a crossbow low at his hip. So: NO stubble, NO beard, NO dots or texture on the face; a clean round face with two small flat grey-brown dirt smudges on the cheeks, two plain black dot eyes and a big cheerful open smile (he loves digging); small grey hair tufts above his ears show he is middle-aged. Pose: he carries the crossbow resting on his shoulder the way a miner carries a pickaxe, one mitten hand holding its stock. It must still read clearly as a CROSSBOW, NOT a pickaxe: a plain straight wooden stock, at its front end a curved brown wooden bow limb crossing it like a small bow laid crosswise, and a clearly visible straight cream bowstring between the two limb tips (a clear T or cross shape), no grey metal head shapes. His plain brown round mining helmet has a small flat cream lamp circle on its front (no glow, no light beam). Short, stocky, barrel-shaped body, head about 40% of his height, same size in the frame as the second reference hero with wide empty margins.
```

#### `heroes/hero_nono` 견습 마법사 노노 (일반 · 불 · 지팡이) 불은 켤 줄 안다. 끄는 건 배우는 중.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 301x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B3_REF`](#조각-roster_b3_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B3_COMMON`](#조각-roster_b3_common)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{ROSTER_B3_REF}}

A hero character for the game: A small apprentice mage boy of about 11 with a nervous but proud smile, in a rust-red robe far too long for him (the hem pools around his boots) and a floppy pointed hat. He holds a short wooden staff with a tiny flat orange flame on top. {{NORMAL_TAIL}}

{{ROSTER_B3_COMMON}}
```

#### `heroes/hero_som` 견습 치유사 솜 (일반 · 바람 · 지팡이 · 힐러) 붕대는 잘 감는다. 너무 잘 감는다.

- **크기**: 요청 1024x1536 (세로) · 실제 원본 1024x1536 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 291x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@heroes/hero_vail` = `heroes/hero_vail` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`ROSTER_B4_REF`](#조각-roster_b4_ref), [`NORMAL_TAIL`](#조각-normal_tail), [`ROSTER_B4_COMMON`](#조각-roster_b4_common)
- **메모**: 둘째 판 (명단 검토). 첫 판(hero_som.rejected1.png, 묶음 3)은 갈색 단발·흰 옷·초록 망토·지팡이로 하엘과 실루엣이 거의 같았다. '붕대를 너무 잘 감는다'를 살렸다.

```text
{{STYLE}}

{{ROSTER_B4_REF}}

A hero character for the game: A gentle teenage apprentice healer girl with short light-brown hair and a soft smile, in a white dress with a short mint-green cape. She holds a simple wooden staff with one small green leaf on top, and a roll of white bandage hangs from her belt with one end trailing down. {{NORMAL_TAIL}}

{{ROSTER_B4_COMMON}}

Important: she must look clearly different from a brown-bob girl in a cream robe with a long green cape. Her memorable joke is that she wraps bandages TOO well: her own arm is wrapped in white bandage from wrist to shoulder, a strip of white bandage is tied around her head like a headband with a small bow knot on the side, and from the bandage roll on her belt one long loose white bandage end trails down to the ground in a few simple loops. Her hair: ONE simple rounded short light honey-brown blob with at most one inner line, NO strands, NO long side locks. Her cape is only a tiny round pale mint capelet that covers just her shoulders (not a long cape). Her white dress is short and plain. Gentle closed-eye smile (two small upward arcs and a tiny smile). Her head is about 40% of her height, not bigger, and she sits the same size in the frame as the second reference hero with wide empty margins.
```

## 7. monsters: 몬스터 25종

귀여운 몬스터 명단이다. 일반 16(체형 4 × 속성 4), 층 보스 4(체형마다 하나), 일일 보스 5. 모두 왼쪽(용사 쪽)을 본다.

- 체형마다 생김새는 하나다. 인간형은 '냄비 고블린', 갑각은 '동글게', 비행은 '통통박쥐', 영체는 '꼬마 유령'이다.
  속성은 **몸 색과 머리 위 표식 하나만** 바꾼다. 아래 블록에서 `{{GOBLIN_A}} <피부색> {{GOBLIN_B}} {{MARK_FIRE}} …`처럼 같은 문장에 색과 표식만 갈아 끼운 것이 보인다.
- 속성 색은 hex로 고정했다. 물 #8ec8ee, 불 #e8875a, 땅 #c9995f, 바람 #bfe6d2.
- 체형마다 물 변형을 먼저 드워프만 참조로 그려 기준으로 삼았다. 나머지 셋은 그 그림을 두 번째 참조로 받았다(`{{MON_SAME_SPECIES}}`).
- 층 보스는 같은 체형의 물 변형을 참조로 받되 물 색과 물방울은 따르지 않는다(`{{FLOOR_BOSS_NOTE}}`). 일일 보스는 드워프만 참조로 받고 틀을 크게 채운다(`{{DAILY_BOSS_FRAME}}`).
- 이 몬스터들은 '귀엽고 해롭지 않게' 그렸다(`{{MON_COMMON}}`의 "NOT scary").
  사용자가 "몬스터가 너무 귀엽다"고 해서 적다운 몬스터와 대형 보스를 따로 그렸다. 그 프롬프트는 9.5절과 9.6절에 있다.

### 7.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 MON_REF_NOTE

드워프는 화풍 참조일 뿐이라는 안내(몬스터 모두).

```text
The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail, same two dot eyes), but do NOT draw the dwarf or any person. Draw only the monster described below.
```

#### 조각 MON_COMMON

귀여운 몬스터 공통 문단: 왼쪽을 보고, 귀엽고 해롭지 않게("NOT scary").

```text
Draw ONE monster for a cozy, silly idle RPG, full body, as one character. It faces LEFT: body and face turned three-quarters toward the LEFT edge of the image (it looks at the heroes standing on the left). Cute, silly and harmless, NOT scary: no sharp teeth, no sharp claws, no spikes, no blood, no angry or glowing eyes; round chunky shapes; a very simple face with two dot eyes (or simple line eyes) and a tiny mouth, the personality shown by the silhouette and ONE clear expression. Keep details minimal like the dwarf: a few flat color blocks, at most a few inner lines, no patterns, no texture, no ornaments beyond what is described. The whole monster fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects around it.
```

#### 조각 MON_SAME_SPECIES

불·땅·바람 변형: 같은 체형의 물 변형(두 번째 참조)과 같은 몸에 색과 표식만 바꾼다.

```text
The second attached image is the SAME monster species already drawn in another element color. Draw the SAME creature: same silhouette, same pose, same proportions, same face and expression, same size and position in the frame and the same outline weight. Change ONLY the main body color (and its matching darker shade, if any) and the one small element mark on top, which replaces the mark shown in the second image, as described below.
```

#### 조각 CRAB_ONE_COLOR

동글게 넷의 끝 문장. 물 변형의 첫 판이 집게·다리를 다른 속성 색으로 칠해서 더했다.

```text
Its claws, eye stalks and stubby legs are the SAME color as its shell (no other body color), so the whole crab reads as one element color; only the shell rim is cream.
```

#### 조각 FLOOR_BOSS_NOTE

층 보스: 두 번째 참조(같은 체형의 물 변형)에서 모양만 따르고 색과 물방울은 따르지 않는다.

```text
The second attached image is an ordinary member of this monster species (its sky-blue water-element variant). Draw its BOSS: clearly the same species with the same face style, the same shapes, the same outline weight and the same clothes or parts, but bigger, rounder and heavier, with the one boss mark described below. Do NOT copy its sky-blue body color or the small water-droplet mark on its head: the boss is element-neutral and uses the colors described below.
```

#### 조각 FLOOR_BOSS_FRAME

층 보스의 크기 줄.

```text
Draw it large in the frame (it is a boss), centered, with a small empty margin on every side and nothing cut off.
```

#### 조각 DAILY_BOSS_FRAME

일일 보스의 크기 줄: 전투 화면을 크게 채운다.

```text
This is a BIG daily BOSS that fills the battle screen: draw it LARGE so it fills most of the square frame (roughly 85% of the frame width or height, whichever is larger), centered, still with a small empty margin on every side and nothing cut off.
```

#### 조각 GOBLIN_A

냄비 고블린 생김새의 앞(속성 넷이 같다). 바로 뒤에 피부색이 온다.

```text
A small chubby goblin monster, a little shorter and much rounder than the heroes (about 2 heads tall): a big round head with two long droopy pointed ears sticking out sideways, two dot eyes, a small wobbly mouth with one tiny square tooth poking up, a round potbelly, short tube arms and legs, small bare round feet. Skin:
```

#### 조각 GOBLIN_B

냄비 고블린 생김새의 뒤. 바로 뒤에 속성 표식이 온다.

```text
It wears an old dented cooking pot upside down as a helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. It holds a wooden spoon up in front of it like a sword, trying very hard to look brave. Turned three-quarters toward the LEFT. Element mark:
```

#### 조각 CRAB_A

동글게 생김새의 앞. 바로 뒤에 등딱지 색이 온다.

```text
A small chubby round crab monster, wider than tall: a big smooth dome-shaped shell like an upturned bowl in
```

#### 조각 CRAB_B

동글게 생김새의 뒤. 바로 뒤에 속성 표식이 온다.

```text
a plain cream rim (#f6ebd5) along the bottom edge of the shell, two short eye stalks on top with dot eyes, a tiny content smile under the shell rim, three short stubby round legs on each side, and two round mitten-like claws (no sharp points): one tiny claw and one comically oversized claw held up proudly toward the left. Turned three-quarters toward the LEFT. Element mark:
```

#### 조각 BAT_A

통통박쥐 생김새의 앞. 바로 뒤에 털 색이 온다.

```text
A small round chubby bat monster that is basically one fluffy ball: the body and head are one round blob of
```

#### 조각 BAT_B

통통박쥐 생김새의 가운데. 바로 뒤에 날개 색이 온다.

```text
fur, two big pointy ears, two dot eyes, a tiny open mouth with ONE small cute fang, a plain cream oval belly (#f6ebd5), comically TINY bat wings in a slightly darker
```

#### 조각 BAT_C

통통박쥐 생김새의 뒤. 바로 뒤에 속성 표식이 온다.

```text
flapping hard on both sides (clearly too small to carry its round body), two tiny feet dangling below. It hovers in the air with a determined little face. Turned three-quarters toward the LEFT. Element mark:
```

#### 조각 GHOST_A

꼬마 유령 생김새의 앞. 바로 뒤에 몸 색이 온다.

```text
A small floating ghost monster: one soft round blob for the head and body (like an upside-down gumdrop), the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms held up, two dot eyes and a small round "o" mouth, shy and a little surprised. Its body is ONE solid flat color,
```

#### 조각 GHOST_B

꼬마 유령 생김새의 뒤. 바로 뒤에 속성 표식이 온다.

```text
with the dark outline (NOT see-through, no transparency, no glow, no sparkles). It floats in the air above the ground. Turned three-quarters toward the LEFT. Element mark:
```

#### 조각 MARK_WATER

물 속성 표식(물방울). 바로 뒤에 얹는 자리(투구, 등딱지, 머리)가 온다.

```text
one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on top of its
```

#### 조각 MARK_FIRE

불 속성 표식(작은 불꽃). 바로 뒤에 얹는 자리가 온다. 끝에 "like a little tuft, no glow"를 붙였다.

```text
one small flat flame (orange #f2a65a with a small yellow #f3d36a inner flame) flickering on top of its
```

#### 조각 MARK_EARTH

땅 속성 표식(새싹 난 조약돌). 바로 뒤에 얹는 자리가 온다.

```text
one small round grey pebble (#b3aea8) with a tiny two-leaf moss-green sprout (#8fae6b) on it, sitting on top of its
```

#### 조각 MARK_WIND

바람 속성 표식(소용돌이). 바로 뒤에 떠 있는 자리가 온다.

```text
one small curly teal wind swirl (#5fa8a0, a spiral line with a little tail) floating just above its
```

### 7.2 일반: 체형 4 × 속성 4 (16장)

#### `monsters/mon_humanoid_water` 물방울 고블린 (일반 · 인간형 · 물)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 357x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`GOBLIN_A`](#조각-goblin_a), [`GOBLIN_B`](#조각-goblin_b), [`MARK_WATER`](#조각-mark_water)
- **메모**: 첫 판 채택. 고블린의 기준 그림: 같은 체형의 다른 속성 셋과 층 보스가 두 번째 참조로 받는다. bestiary의 무속성 기준(mon_humanoid_base)은 그리지 않고 물 변형을 먼저 그려 기준으로 썼다 (체형 넷 모두 같다).

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{GOBLIN_A}} soft sky blue (#8ec8ee). {{GOBLIN_B}} {{MARK_WATER}} pot helmet.
```

#### `monsters/mon_humanoid_fire` 불씨 고블린 (일반 · 인간형 · 불)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 352x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_humanoid_water` = `monsters/mon_humanoid_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GOBLIN_A`](#조각-goblin_a), [`GOBLIN_B`](#조각-goblin_b), [`MARK_FIRE`](#조각-mark_fire)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GOBLIN_A}} soft red-orange (#e8875a). {{GOBLIN_B}} {{MARK_FIRE}} pot helmet like a little tuft, no glow.
```

#### `monsters/mon_humanoid_earth` 조약돌 고블린 (일반 · 인간형 · 땅)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 356x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_humanoid_water` = `monsters/mon_humanoid_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GOBLIN_A`](#조각-goblin_a), [`GOBLIN_B`](#조각-goblin_b), [`MARK_EARTH`](#조각-mark_earth)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GOBLIN_A}} warm ochre brown (#c9995f). {{GOBLIN_B}} {{MARK_EARTH}} pot helmet.
```

#### `monsters/mon_humanoid_wind` 산들 고블린 (일반 · 인간형 · 바람)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 354x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_humanoid_water` = `monsters/mon_humanoid_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GOBLIN_A`](#조각-goblin_a), [`GOBLIN_B`](#조각-goblin_b), [`MARK_WIND`](#조각-mark_wind)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GOBLIN_A}} pale mint (#bfe6d2). {{GOBLIN_B}} {{MARK_WIND}} pot helmet.
```

#### `monsters/mon_armored_water` 물방울 동글게 (일반 · 갑각 · 물)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x233
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`CRAB_A`](#조각-crab_a), [`CRAB_B`](#조각-crab_b), [`MARK_WATER`](#조각-mark_water), [`CRAB_ONE_COLOR`](#조각-crab_one_color)
- **메모**: 둘째 판. 첫 판(mon_armored_water.rejected1.png)은 파란 등딱지에 집게·다리를 주황(불 색)으로 그려 속성이 헷갈렸다. 몸을 모두 등딱지 색으로 칠하라는 끝 문장(CRAB_ONE_COLOR)을 동글게 넷에 더했다. 동글게의 기준 그림.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{CRAB_A}} soft sky blue (#8ec8ee), {{CRAB_B}} {{MARK_WATER}} shell, just behind its eye stalks. {{CRAB_ONE_COLOR}}
```

#### `monsters/mon_armored_fire` 불씨 동글게 (일반 · 갑각 · 불)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x233
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_armored_water` = `monsters/mon_armored_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`CRAB_A`](#조각-crab_a), [`CRAB_B`](#조각-crab_b), [`MARK_FIRE`](#조각-mark_fire), [`CRAB_ONE_COLOR`](#조각-crab_one_color)
- **메모**: 첫 판 채택. 불꽃 바깥 주황이 등딱지 색과 가깝지만 외곽선과 노란 속불로 읽힌다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{CRAB_A}} soft red-orange (#e8875a), {{CRAB_B}} {{MARK_FIRE}} shell, just behind its eye stalks like a little tuft, no glow. {{CRAB_ONE_COLOR}}
```

#### `monsters/mon_armored_earth` 조약돌 동글게 (일반 · 갑각 · 땅)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x233
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_armored_water` = `monsters/mon_armored_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`CRAB_A`](#조각-crab_a), [`CRAB_B`](#조각-crab_b), [`MARK_EARTH`](#조각-mark_earth), [`CRAB_ONE_COLOR`](#조각-crab_one_color)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{CRAB_A}} warm ochre brown (#c9995f), {{CRAB_B}} {{MARK_EARTH}} shell, just behind its eye stalks. {{CRAB_ONE_COLOR}}
```

#### `monsters/mon_armored_wind` 산들 동글게 (일반 · 갑각 · 바람)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x234
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_armored_water` = `monsters/mon_armored_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`CRAB_A`](#조각-crab_a), [`CRAB_B`](#조각-crab_b), [`MARK_WIND`](#조각-mark_wind), [`CRAB_ONE_COLOR`](#조각-crab_one_color)
- **메모**: 첫 판 채택. 소용돌이는 외곽선 없는 선이다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{CRAB_A}} pale mint (#bfe6d2), {{CRAB_B}} {{MARK_WIND}} shell, just behind its eye stalks. {{CRAB_ONE_COLOR}}
```

#### `monsters/mon_flying_water` 물방울 박쥐 (일반 · 비행 · 물)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x357
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`BAT_A`](#조각-bat_a), [`BAT_B`](#조각-bat_b), [`BAT_C`](#조각-bat_c), [`MARK_WATER`](#조각-mark_water)
- **메모**: 첫 판 채택. 통통박쥐의 기준 그림. 날개 옆에 짧은 움직임 선이 있다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{BAT_A}} soft sky blue (#8ec8ee) {{BAT_B}} blue (#6fa9cf) {{BAT_C}} {{MARK_WATER}} head, between its ears.
```

#### `monsters/mon_flying_fire` 불씨 박쥐 (일반 · 비행 · 불)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x355
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_flying_water` = `monsters/mon_flying_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`BAT_A`](#조각-bat_a), [`BAT_B`](#조각-bat_b), [`BAT_C`](#조각-bat_c), [`MARK_FIRE`](#조각-mark_fire)
- **메모**: 첫 판 채택. 틀 안에서 다른 박쥐보다 약 10% 크다 (처리에서 여백을 잘라 내 맞춘다).

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{BAT_A}} soft red-orange (#e8875a) {{BAT_B}} red-orange (#c96a43) {{BAT_C}} {{MARK_FIRE}} head, between its ears like a little tuft, no glow.
```

#### `monsters/mon_flying_earth` 조약돌 박쥐 (일반 · 비행 · 땅)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x376
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_flying_water` = `monsters/mon_flying_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`BAT_A`](#조각-bat_a), [`BAT_B`](#조각-bat_b), [`BAT_C`](#조각-bat_c), [`MARK_EARTH`](#조각-mark_earth)
- **메모**: 첫 판 채택. 박쥐 가운데 혼자 움직임 선이 없다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{BAT_A}} warm ochre brown (#c9995f) {{BAT_B}} brown (#a8774e) {{BAT_C}} {{MARK_EARTH}} head, between its ears.
```

#### `monsters/mon_flying_wind` 산들 박쥐 (일반 · 비행 · 바람)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 400x358
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_flying_water` = `monsters/mon_flying_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`BAT_A`](#조각-bat_a), [`BAT_B`](#조각-bat_b), [`BAT_C`](#조각-bat_c), [`MARK_WIND`](#조각-mark_wind)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{BAT_A}} pale mint (#bfe6d2) {{BAT_B}} mint (#8fcab0) {{BAT_C}} {{MARK_WIND}} head, between its ears.
```

#### `monsters/mon_spirit_water` 물방울 유령 (일반 · 영체 · 물)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 295x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`GHOST_A`](#조각-ghost_a), [`GHOST_B`](#조각-ghost_b), [`MARK_WATER`](#조각-mark_water)
- **메모**: 첫 판 채택. 꼬마 유령의 기준 그림. 넷 가운데 가장 좁다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{GHOST_A}} soft sky blue (#8ec8ee), {{GHOST_B}} {{MARK_WATER}} head.
```

#### `monsters/mon_spirit_fire` 불씨 유령 (일반 · 영체 · 불)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 297x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_spirit_water` = `monsters/mon_spirit_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GHOST_A`](#조각-ghost_a), [`GHOST_B`](#조각-ghost_b), [`MARK_FIRE`](#조각-mark_fire)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GHOST_A}} soft red-orange (#e8875a), {{GHOST_B}} {{MARK_FIRE}} head like a little tuft, no glow.
```

#### `monsters/mon_spirit_earth` 조약돌 유령 (일반 · 영체 · 땅)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 294x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_spirit_water` = `monsters/mon_spirit_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GHOST_A`](#조각-ghost_a), [`GHOST_B`](#조각-ghost_b), [`MARK_EARTH`](#조각-mark_earth)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GHOST_A}} warm ochre brown (#c9995f), {{GHOST_B}} {{MARK_EARTH}} head.
```

#### `monsters/mon_spirit_wind` 산들 유령 (일반 · 영체 · 바람)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1024x1024 · 투명 · 여백을 자르고 긴 변 400px까지 줄임 → 289x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_spirit_water` = `monsters/mon_spirit_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`MON_SAME_SPECIES`](#조각-mon_same_species), [`GHOST_A`](#조각-ghost_a), [`GHOST_B`](#조각-ghost_b), [`MARK_WIND`](#조각-mark_wind)
- **메모**: 둘째 판. 첫 판(mon_spirit_wind.rejected1.png)은 머리 위 물방울 자리가 오목하게 남아 머리 꼭대기를 매끈하게 하라는 끝 문장을 더했다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{MON_SAME_SPECIES}}

{{GHOST_A}} pale mint (#bfe6d2), {{GHOST_B}} {{MARK_WIND}} head. The top of its head is one smooth, unbroken round dome (no dent, notch or flat spot where the droplet of the second image sat); the wind swirl floats above it with a small clear gap and does not touch the head.
```

### 7.3 층 보스 (4장)

#### `monsters/boss_humanoid` 고블린 두목 (층 보스 · 인간형)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 552x560
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_humanoid_water` = `monsters/mon_humanoid_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`FLOOR_BOSS_NOTE`](#조각-floor_boss_note), [`FLOOR_BOSS_FRAME`](#조각-floor_boss_frame)
- **메모**: 첫 판 채택. 냄비 손잡이가 국자 머리에 조금 겹친다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{FLOOR_BOSS_NOTE}}

{{FLOOR_BOSS_FRAME}}

The BOSS of the pot goblins: the same chubby goblin species (big round head, two long droopy pointed ears, two dot eyes, one tiny square tooth poking up, warm light grey skin #cfc8c0, a plain cream tunic #f6ebd5 tied with a brown rope, small bare round feet), but about twice as big, much rounder and heavier, with a huge round belly and a proud, grumpy pout. Boss mark: its upside-down cooking-pot helmet (grey #8e8984) has two big curved cream-colored bull horns tied onto it with a rope. It rests a giant wooden soup ladle on its shoulder like a battle club. Turned three-quarters toward the LEFT.
```

#### `monsters/boss_armored` 투구게 (층 보스 · 갑각)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x407
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_armored_water` = `monsters/mon_armored_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`FLOOR_BOSS_NOTE`](#조각-floor_boss_note), [`FLOOR_BOSS_FRAME`](#조각-floor_boss_frame)
- **메모**: 첫 판 채택. 표정은 '아주 진지함'보다 만족스러운 얼굴이다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{FLOOR_BOSS_NOTE}}

{{FLOOR_BOSS_FRAME}}

The BOSS of the round crabs: the same chubby dome-shelled crab (a smooth dome shell like an upturned bowl in warm light grey #cfc8c0, a plain cream rim #f6ebd5 along the bottom of the shell, short stubby round legs, round mitten-like claws with no sharp points), but about twice as big and heavier, with BOTH claws oversized and raised in a proud guard pose toward the left. Boss mark: a round iron knight's helmet (grey #8e8984) with a short soft red plume (#c9614a) is jammed on top of its shell, and its two eye stalks poke out through two round holes in the helmet, dot eyes looking very serious. Turned three-quarters toward the LEFT.
```

#### `monsters/boss_flying` 박쥐 비행대장 (층 보스 · 비행)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x504
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_flying_water` = `monsters/mon_flying_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`FLOOR_BOSS_NOTE`](#조각-floor_boss_note), [`FLOOR_BOSS_FRAME`](#조각-floor_boss_frame)
- **메모**: 첫 판 채택.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{FLOOR_BOSS_NOTE}}

{{FLOOR_BOSS_FRAME}}

The BOSS of the chubby bats: the same round fluffy ball of a bat (warm grey-brown fur #a4968a, a plain cream oval belly #f6ebd5, big pointy ears, ONE small cute fang, comically tiny flapping wings in darker grey-brown #857769, two tiny dangling feet), but about twice as big and even rounder, so its tiny wings look even more hopeless; it hovers with a proud, confident face. Boss mark: a brown leather aviator cap (#8a5a3a) with ear flaps and a pair of round goggles pushed up on the forehead; its two pointy ears poke out through holes in the cap. Turned three-quarters toward the LEFT.
```

#### `monsters/boss_spirit` 유령 임금 (층 보스 · 영체)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 454x560
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@monsters/mon_spirit_water` = `monsters/mon_spirit_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`FLOOR_BOSS_NOTE`](#조각-floor_boss_note), [`FLOOR_BOSS_FRAME`](#조각-floor_boss_frame)
- **메모**: 첫 판 채택. 금관이 머리에 닿지 않고 떠 있다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{FLOOR_BOSS_NOTE}}

{{FLOOR_BOSS_FRAME}}

The BOSS of the little ghosts: the same floating gumdrop-shaped ghost (one soft round blob for the head and body, a short wavy tail curling toward the right instead of legs, tiny nub arms, ONE solid flat cream-white body #f6ebd5 that is NOT see-through, no glow), but about twice as big and plumper, with a dignified but sleepy face (half-closed dot eyes, a small calm mouth). Boss mark: a simple golden crown (#f3d36a, three rounded points, no jewels) floating a little above its head, tilted to one side, not touching it. Turned three-quarters toward the LEFT.
```

### 7.4 일일 보스 (5장)

#### `monsters/daily_turtle` 연못 거북 (일일 보스 1일째 · 물 · 갑각)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x334
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame)
- **메모**: 첫 판 채택. 등딱지 줄이 조금 많고 외곽선이 드워프보다 조금 가늘다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{DAILY_BOSS_FRAME}}

A HUGE chubby old turtle boss, much wider than tall, standing on four short stumpy round legs, its round head stretched forward toward the LEFT with sleepy half-closed eyes and a calm tiny smile. Soft blue-grey skin (#a9c3cc). Its giant dome shell is soft sky blue (#8ec8ee) with only a few big simple plate lines, and the TOP of the shell is a tiny round pond: a flat pale-blue water oval (#d4ecf9) with one round moss-green lily pad (#8fae6b) and one very small green frog sitting on it. Two small water droplets fly off the edge of the shell. Calm, slow, harmless and a little silly. Turned three-quarters toward the LEFT.
```

#### `monsters/daily_mole` 두더지 광부 (일일 보스 2일째 · 땅 · 인간형)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x509
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame)
- **메모**: 첫 판 채택. 곡괭이를 어깨에 메지 않고 앞에 비스듬히 든다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{DAILY_BOSS_FRAME}}

A HUGE round chubby mole boss standing upright on two short legs like a miner: warm ochre-brown fur (#c9995f), a big round pink nose (#e8a5a0), eyes drawn as two tiny squinting lines (it can barely see), a puzzled little mouth, two big round pink paws like mittens (no claws). It wears a dented yellow miner's helmet (#f3d36a) with a small round headlamp drawn as a flat cream circle (no light beam, no glow) and moss-green overalls (#8fae6b). It carries a big pickaxe (grey head, brown handle) over one shoulder and a bulging brown sack of round grey ore lumps on its back, with one tiny green sprout growing out of the sack. It squints hard toward the LEFT, a little confused. Turned three-quarters toward the LEFT.
```

#### `monsters/daily_dragon` 딸꾹 드래곤 (일일 보스 3일째 · 불 · 비행)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x400
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame)
- **메모**: 첫 판 채택. 꼬리 불꽃이 오른쪽 끝에 가깝지만 잘리지 않았다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{DAILY_BOSS_FRAME}}

A HUGE round chubby baby dragon boss hovering in the air: a big round body in soft red-orange (#e8875a), a cream belly (#f6ebd5) with three simple stripe lines, two short round cream horns, a short tail ending in a small flame-shaped tip, round stubby arms and legs (no claws, no teeth). Its bat-like wings in darker red-orange (#c96a43) flap hard but are a bit too small for its round body. It is in the middle of a hiccup: eyes squeezed shut, cheeks puffed, and a small flat flame (orange #f2a65a with a yellow #f3d36a inner flame) plus one round grey smoke puff popping out of its mouth toward the left. Not scary at all, a little embarrassed. Turned three-quarters toward the LEFT.
```

#### `monsters/daily_cloud` 뭉게 정령 (일일 보스 4일째 · 바람 · 영체)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x388
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame)
- **메모**: 첫 판 채택. 몸에 비해 얼굴이 작다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{DAILY_BOSS_FRAME}}

A HUGE fluffy cumulus cloud spirit boss floating in the air, no legs: one big puffy cloud body made of a few big round bumps, pale mint (#cfeadb) with a few off-white (#f4f7f2) bumps, solid flat fills (NOT see-through, no glow). A face in the middle of the cloud: determined dot eyes and cheeks puffed out hard, lips pushed into a small round "o", blowing a gust toward the LEFT: three curly teal wind swirl lines (#5fa8a0) stream out of its mouth to the left. Two small cloud-puff arms, and a smaller cloud tail trailing behind it on the right. Silly and harmless. Turned three-quarters toward the LEFT.
```

#### `monsters/daily_gamasot` 가마솥 대감 (일일 보스 5일째 · 불 · 갑각)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 560px까지 줄임 → 560x396
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`MON_COMMON`](#조각-mon_common), [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame)
- **메모**: 둘째 판. 첫 판(daily_gamasot.rejected1.png)은 뚜껑 꼭지가 떠 있고, 한쪽 팔이 귀처럼 말렸고, 테가 모자 챙처럼 위에 있어 끝 문단을 더했다. 짙은 회색이라 다른 보스보다 무거워 보인다.

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{MON_COMMON}}

{{DAILY_BOSS_FRAME}}

A HUGE Korean cast-iron rice cauldron (gamasot) come alive as a boss, wider than tall: a wide round pot body in flat charcoal grey (#6b6461, clearly lighter than the dark outline), a wide flat rim sticking out all around its middle like a brim, two short stubby legs and two short stick arms. Its face is on the pot belly below the rim: two dot eyes and a long thin droopy mustache, looking like a pompous old nobleman. A heavy dark lid sits on top, its round knob shaped like a little topknot, lifted slightly with two round cream steam puffs escaping. A few small flat flames (orange #f2a65a with yellow #f3d36a inner flames) flicker around its feet, no glow. It holds a big wooden rice paddle up like a royal scepter, pointing toward the left. Turned three-quarters toward the LEFT.

Important details: the wide flat rim goes around the WIDEST MIDDLE of the round pot body (like the brim of a traditional Korean iron cauldron), with the upper half of the pot above it and the face on the lower half below it. The lid knob is firmly ATTACHED to the top center of the lid (not floating). Both arms are the same: two short simple stick arms coming out of the sides of the pot, one holding the rice paddle up, the other a stubby little arm resting at its side. The mustache is long, thin and droopy, hanging down past its chin on both sides. Body and face turned three-quarters toward the LEFT.
```

## 8. icons: 작은 UI 아이콘

용사 카드와 편성·전투 화면의 아이콘이다. 속성 4, 무기 6, 역할 3, 별 문양 5, 전투 화면의 단추와 상태 표시 4. 화면에서 20~32px로 쓴다.

- 모두 `{{ICON_FRAME}}`을 쓴다. 24px에서 읽히는 굵은 한 덩어리이고, 뒤판·광택·그림자·얼굴이 없다.
- 세트 기준은 `element_water`다. 무기는 `weapon_oneHandSword`, 역할은 `role_melee`, 별은 `star_bronze`를 따른다(`{{ICON_SAME_SET}}`).
  묶음마다 첫 아이콘은 element_water를 따라 그려 네 묶음이 한 벌로 보이게 했다.
- 원본은 모두 1254x1254로 나왔다. 처음 18장은 gen.ts가 생기기 전에 그림 프롬프트 끝에 빈 줄과 "Save the generated image as <key>.png in the current directory."를 붙여 바로 보냈다.
  전투 화면의 넷(ui_auto, ui_speed, status_fast, status_slow)은 gen.ts로 뽑았다. 그때 실제로 보낸 글자 전체가 9.8절에 있다.

### 8.1 이 장의 조각

공용 조각(0.4절)은 다시 적지 않았다.

#### 조각 ICON_SAME_SET

아이콘 세트의 두 번째 참조 안내.

```text
The second attached image is another icon from the same game UI icon set. Match it exactly in drawing style, outline weight and how big the shape sits in the frame (same scale and margin, centered), so all the icons look like one set. Do NOT redraw that icon; draw only the new icon described below.
```

#### 조각 ICON_FRAME

아이콘 모두: 24px에서 읽히는 굵은 한 덩어리, 투명 배경, 뒤판·광택·그림자·얼굴 없음.

```text
A small game UI icon that must read clearly at 24px: one simple bold shape, centered, filling about three quarters of the square canvas with a comfortable empty margin on every side, nothing cut off. Transparent background with a real alpha channel: no backdrop, no badge or circle behind it, no ground shadow, no glow. Draw it with the same VERY fat, bold dark brown marker outline as the dwarf, one flat color per part (no lighter or darker patches, no shading, no gradient, no glossy shine), and at most one or two inner lines. No face.
```

### 8.2 속성 (4장)

#### `icons/element_water` 물 속성 (물방울). 아이콘 모두의 기준

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 88x96
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_FRAME}}

Water element icon: one plump round water droplet (a teardrop shape: a round full bottom rising to one soft rounded point at the top), in one flat soft sky blue (#8ec8ee), with one small flat white curved mark inside near its upper left. Nothing else.
```

#### `icons/element_fire` 불 속성 (불꽃)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 81x96
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Fire element icon: one chunky cartoon flame (a round full bottom rising into three soft rounded flame tips, the middle tip tallest), in one flat soft red-orange (#e8875a), with one smaller flat warm yellow (#f3d36a) inner flame inside it. Nothing else: no sparks, no embers, no glow. The same size and weight as the droplet in the second image.
```

#### `icons/element_earth` 땅 속성 (바위)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x77
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)
- **메모**: 둘째 판. 첫 판(element_earth.rejected1.png)은 둥글고 말랑한 언덕이라 작게 보면 자루(정제의 가방 아이콘)나 감자처럼 읽혔다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Earth element icon: one chunky boulder that clearly reads as a hard ROCK, not a sack, a bun or a potato: a blocky rounded-angular shape a little wider than tall, sitting flat, with a few straight edges and blunt corners, in one flat warm ochre brown (#c9995f), with one short zigzag crack line and a tiny two-leaf moss-green (#8fae6b) sprout growing from one corner of its top. Nothing else, no pebbles around it. The same size and weight as the droplet in the second image.
```

#### `icons/element_wind` 바람 속성 (소용돌이)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x85
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Wind element icon: one curly wind swirl: a fat ribbon that curls inward into a round spiral at the upper right and sweeps out into a long tail toward the lower left, with one shorter curved gust ribbon under it. The ribbons are filled with one flat teal (#5fa8a0) inside the fat dark brown outline. Nothing else, no leaves, no clouds. The same size and weight as the droplet in the second image.
```

### 8.3 무기 (6장)

#### `icons/weapon_oneHandSword` 한손검. 무기 아이콘의 기준

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x92
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)
- **메모**: 둘째 판. 첫 판(weapon_oneHandSword.rejected1.png)은 날이 길이의 3분의 1쯤으로 넓어 대검과 갈리지 않아 날 너비를 비율로 적었다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

One-handed sword icon: a short chunky toy-like sword lying diagonally, the grip at the lower left and the rounded tip at the upper right: a plain flat light grey blade (#c9c9cf), a small flat yellow (#f3d36a) crossguard, a short brown (#8a5a3a) grip and a small round yellow pommel. No sparkle, no engravings, no gems. The blade is straight and fairly SLIM: about one sixth as wide as it is long (a greatsword icon in the same set will have a much wider blade, so this one must not look wide).
```

#### `icons/weapon_greatsword` 대검

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x88
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/weapon_oneHandSword` = `icons/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)
- **메모**: 셋째 판. 첫 판(weapon_greatsword.rejected1.png)은 날이 한손검과 거의 같은 너비이고 외곽선이 가늘었다. 둘째 판(rejected2)은 끝이 각지고 선은 맞았지만 날이 여전히 좁았다.

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Greatsword icon: a big, heavy two-handed sword lying diagonally the same way as the sword in the second image (grip at the lower left, tip at the upper right). Its blade is a huge, heavy, VERY WIDE slab: the blade is nearly as wide as the crossguard is long, only about two and a half times as long as it is wide, and clearly more than twice as wide as the blade of the sword in the second image; flat light grey, with a blunt squared-off tip with rounded corners. A flat yellow crossguard, a thick brown two-hand grip and a big round yellow pommel. The outline must be exactly as fat as in the second image (the same marker), not thinner. At a glance it must read as a much bigger, heavier sword than the second image's, while filling the frame the same way.
```

#### `icons/weapon_dagger` 단검

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x93
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/weapon_oneHandSword` = `icons/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Dagger icon: a small knife lying diagonally the same way as the sword in the second image: a short leaf-shaped pointed light grey blade only about as long as its grip, a tiny yellow crossguard, a brown grip with two simple wrap lines and a small round yellow pommel. Drawn at the same icon size as the second image (it fills the frame the same way), but it must read clearly as a short knife, not a sword.
```

#### `icons/weapon_bow` 활

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 85x96
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/weapon_oneHandSword` = `icons/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Bow icon: a chunky toy-like wooden bow, standing diagonally: the bow arc runs from the lower left to the upper right and bulges toward the upper left. The two limbs are FAT rounded brown (#a8703e) shapes (never thin sticks) with small rounded grey tips and a cream wrapped grip in the middle; one straight dark brown string joins the two tips. No arrow.
```

#### `icons/weapon_crossbow` 석궁

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x88
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/weapon_oneHandSword` = `icons/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Crossbow icon: a crossbow seen from above, pointing to the upper right: a chunky straight brown wooden stock from the lower left to the upper right, a short thick curved brown bow limb crossing its front end, a straight string between the limb tips and one short bolt with a grey head lying on the stock, so it forms a clear cross shape. Very few parts, no trigger details, no screws.
```

#### `icons/weapon_staff` 지팡이

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x91
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/weapon_oneHandSword` = `icons/weapon_oneHandSword` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Mage staff icon: a fat short brown wooden staff lying diagonally from the lower left to the upper right (the shaft about as wide as the grip of the sword in the second image, never thin), one simple grey ring on the shaft, and its head a chunky curled wooden hook holding one round flat orange (#f2a65a) orb. No glow, no sparkles.
```

### 8.4 역할 (3장)

#### `icons/role_melee` 근접 (앞열). 역할 아이콘의 기준

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x84
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Melee role icon (fighters in the front row): two short chunky toy-like swords crossed in an X, blades pointing up, each with a plain flat light grey blade, a small yellow (#f3d36a) crossguard and a short brown grip. Symmetric and simple, nothing else.
```

#### `icons/role_ranged` 원거리 (뒷열)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x85
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/role_melee` = `icons/role_melee` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Ranged role icon (shooters in the back row): a round archery target, an outer soft red (#e46f5a) ring, a cream (#f6ebd5) ring inside it and a small soft red center dot, with one simple arrow (brown shaft, grey head, cream fletching) stuck into the center, coming in diagonally from the lower left. Nothing else.
```

#### `icons/role_healer` 힐러

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x76
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/role_melee` = `icons/role_melee` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Healer role icon: one plump soft rounded heart in flat soft pink-red (#ea8a7e) with a small flat cream (#f6ebd5) plus sign in its middle. Nothing else, no sparkles.
```

### 8.5 별 문양 (5장)

#### `icons/star_bronze` 동별. 별 문양의 기준

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 64px까지 줄임 → 64x63
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Rank star icon, bronze: one plump five-pointed star with softly rounded points, standing upright, in one flat warm bronze-copper color (#c98a55). No inner lines, nothing else.
```

#### `icons/star_silver` 은별

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 64px까지 줄임 → 64x63
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/star_bronze` = `icons/star_bronze` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Rank star icon, silver: EXACTLY the same plump rounded five-pointed star as the second image (same shape, same size, same outline), only the fill color changes to one flat cool light silver grey (#c9cdd6). Nothing else.
```

#### `icons/star_gold` 금별

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 64px까지 줄임 → 64x63
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/star_bronze` = `icons/star_bronze` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Rank star icon, gold: EXACTLY the same plump rounded five-pointed star as the second image (same shape, same size, same outline), only the fill color changes to one flat bright warm gold (#f6c945). Nothing else.
```

#### `icons/star_moon` 달 (금별 다음)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 64px까지 줄임 → 57x64
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/star_bronze` = `icons/star_bronze` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Rank mark icon, the moon (one rank above the gold star): one plump crescent moon, its round outer edge on the left and the opening to the right, fat and chunky with softly rounded tips, in one flat pale lemon-cream (#f5e3a0). Drawn at the same size and weight as the star in the second image so it sits in the same row. No stars around it, nothing else.
```

#### `icons/star_sun` 해 (달 다음)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 64px까지 줄임 → 64x64
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/star_bronze` = `icons/star_bronze` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Rank mark icon, the sun (the highest rank, above the moon): one round flat warm orange (#f29a3f) disc with eight short rounded triangular rays around it in flat warm gold (#f6c945), each ray with its own outline. Drawn at the same size and weight as the star in the second image so it sits in the same row. Nothing else.
```

### 8.6 전투 화면의 단추와 상태 표시 (4장)

#### `icons/ui_auto` 자동 (필살기 AUTO 켜기·끄기)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x91
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/role_melee` = `icons/role_melee` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Auto mode icon: two fat chunky curved arrows chasing each other around in a circle (a round "repeat" loop), each arrow a thick ribbon ending in a big rounded arrowhead, both in one flat warm orange (#f2a65a). The middle of the loop is empty. Nothing else.
```

#### `icons/ui_speed` 배속 (빨리 감기)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x60
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/ui_auto` = `icons/ui_auto` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Fast-forward icon: two fat triangles with softly rounded corners pointing right, side by side and just touching (a "fast forward" sign), both in one flat warm butter yellow (#f3d36a). Nothing else.
```

#### `icons/status_fast` 빠름 (공격 속도가 오른 동안)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x89
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/element_water` = `icons/element_water` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Speed-up status icon: the round head of a little bunny seen from the front with two tall upright rounded ears, in one flat cream white (#fbf7ef) with soft pink (#f2b8b0) inner ears, and three short straight horizontal speed lines in flat warm orange (#f2a65a) trailing off its left side. Nothing else.
```

#### `icons/status_slow` 느림 (공격 속도가 내린 동안)

- **크기**: 요청 1024x1024 (정사각) · 실제 원본 1254x1254 · 투명 · 여백을 자르고 긴 변 96px까지 줄임 → 96x68
- **참조**: 1) `d_dwarf_idle` 화풍 기준 드워프 (`ref/d_dwarf_idle.png`) · 2) `@icons/status_fast` = `icons/status_fast` (먼저 그린 같은 세트 그림)
- **조각**: [`STYLE`](#조각-style), [`STYLE_REF_ONLY`](#조각-style_ref_only), [`ICON_SAME_SET`](#조각-icon_same_set), [`ICON_FRAME`](#조각-icon_frame)

```text
{{STYLE}}

{{STYLE_REF_ONLY}}

{{ICON_SAME_SET}}

{{ICON_FRAME}}

Slow-down status icon: a little snail seen from the side, crawling to the right: a big round spiral shell in one flat soft blue (#8ec8ee) with one spiral line, on a soft cream (#f6ebd5) body with two short round-tipped eye stalks. Nothing else.
```

## 9. 매니페스트 밖의 프롬프트 (기록)

화풍을 고르던 때의 후보, 적다운 몬스터 12종(`foe_*`), 대형 보스 6종(`boss_*`), 얼굴만 고친 편집, 그리고 그때 쓴 감싸기를 모았다.
적다운 몬스터와 대형 보스는 아직 게임의 매니페스트에 들어가지 않았다(기획서 B.19 '반영 대기').

- 프롬프트는 세션 기록과 작업 폴더의 파일에서 기계적으로 옮겼다.
- 1~8장과 달리 **Codex 지시문(감싸기)까지 포함한, 실제로 보낸 글자 전체**인 블록이 많다. 항목마다 무엇이 들어 있는지 적었다.
- 결과는 채택 또는 버림과 그 이유다. 버린 판은 원본 옆에 `<key>.rejected<n>.png`로, 옛 화풍 판은 `<key>.painterly.png`로 남겼다.
- 날짜는 한국 시간이다.
- 그때의 호출은 늘 아래 꼴이었다. 끝의 `< /dev/null`이 없으면 Codex가 `Reading additional input from stdin...`에서 표준 입력을 기다리다 멈출 수 있다.

```text
codex exec --skip-git-repo-check -s workspace-write -C <출력 폴더> -i <참조1> [-i <참조2>] -o <로그 파일> "<프롬프트>" < /dev/null
```

### 9.0 이 장의 조각

9장의 블록이 같이 쓰는 조각이다. `STYLE`, `DWARF_SAME`, `MON_REF_NOTE`와 속성 표식(`MARK_*`)처럼 앞 장의 조각도 쓴다.

#### 조각 STYLE_V1

버린 v1 화풍(슬레이 더 스파이어식 페인터리)의 머리말. 매니페스트에 STYLE_V1로 남아 있다. 쓰지 않는다.

```text
Hand-painted 2D fantasy game art in the style of Slay the Spire: visible painterly brush strokes, bold readable silhouettes, slightly stylized chunky proportions, warm forge-lit palette (ember orange, soot brown, iron grey, parchment) with cool blue-grey shadows and soft orange rim light coming from the right. Mood: warm but quietly lonely, an old craftsman's workshop at dusk. No text, no letters, no numbers, no logos, no watermark, no signature, no UI, no border.
```

#### 조각 SD_ABC_COMMON

SD 후보 A·B·C의 공통 문단(페인터리 드워프를 -i로 붙였다). 세 블록의 같은 앞부분을 스크립트가 잘라 냈다.

```text
The attached image is our current dwarf blacksmith character (too realistic and serious). Redesign the SAME character (old dwarf blacksmith, grey braided beard with metal rings, cream shirt with rolled sleeves, brown leather apron with a pocket, leather bracers, boots, holding a forging hammer) in a CUTE SD / chibi style. Full body, side view facing right, standing next to nothing. Transparent background with a real alpha channel. No text.
```

#### 조각 SD_DG_COMMON

SD 후보 D·E·F·G의 공통 문단(참조 없이 글로만). 지금 화풍의 뿌리이고, scene/dwarf_idle 프롬프트도 이 문단으로 시작한다. 네 블록의 같은 앞부분을 스크립트가 잘라 냈다.

```text
Character design for a cozy comic mobile game: an old dwarf blacksmith (grey hair and a big grey beard with two small braids, cream shirt, brown leather apron, little boots, holding a forging hammer). Make him SILLY, HUMBLE and a bit pathetic-cute (the Korean 'hachanhan' meme vibe): tiny and stubby, very LOW detail, very simple shapes, few colors, comic deadpan expression. Full body, side view facing right, standing. Transparent background with a real alpha channel. No text.
```

#### 조각 FOE_INTRO

적다운 몬스터 감싸기 ①·②에서 생김새 앞에 붙인 말.

```text
An enemy monster for the game, facing left, a bit menacing but still drawn in the same flat doodle style and coloring as the second attached image:
```

#### 조각 FOE_W1_TAIL

적다운 몬스터 감싸기 ①·③의 끝(그림 프롬프트 뒤에 붙인 Codex 지시문). <key>는 그림 키.

```text
Attached images: 1) the doodle dwarf = drawing style reference only (do not draw the dwarf); 2) an existing monster from the same game = reference for coloring, outline weight and size in the frame. Use your image generation tool to create exactly ONE image, size 1024x1024. The background must be genuinely transparent (real alpha channel, PNG, no backdrop, no floor, no cast shadow, no glow); if the tool has a background parameter set it to transparent and preserve the generated alpha. Keep the whole monster inside the frame with some empty margin, nothing cropped. Save the generated image as <key>.png in the current directory (do not overwrite or modify any other file). Reply with only the saved file path.
```

#### 조각 FOE_W2_PRE

적다운 몬스터 감싸기 ②의 앞(그림 프롬프트 앞에 둔 Codex 지시문).

```text
Use your built-in image generation tool to create exactly ONE image, size 1024x1024 (square). Attached reference images, in order: 1) our doodle dwarf (style reference only, do not draw it), 2) an existing monster of ours (style, coloring and size reference). The background must be genuinely transparent: a real alpha channel in a PNG, no backdrop, no floor, no cast shadow, no glow; if the tool has a background parameter set it to transparent and keep the generated alpha. Do not edit, crop or post-process the image; just copy the generated file.
```

#### 조각 SAVE_KEEP

저장 줄. <key>는 그림 키.

```text
Save the generated image as <key>.png in the current directory (do not overwrite or modify any other file). Reply with only the saved file path.
```

#### 조각 FOE_COMMON

적다운 몬스터 공통 문단(설계 파일 list.json의 common). 위협은 몇 가지 특징으로만 보이고 공포는 아니게. 적다운 그림을 새로 그릴 때 먼저 가져다 쓸 문단이다.

```text
Draw ONE monster for a cozy, silly idle RPG, full body, as one character. It faces LEFT: body and face turned three-quarters toward the LEFT edge of the image (it glares at the heroes standing on the left). This one is a real ENEMY, a little mean and threatening, but drawn in exactly the same simple chunky cartoon style as our cute monsters: round chunky shapes, thick dark brown outline, flat fills, a very simple face. Show the menace ONLY through the few features described below (frowning brows, narrowed eyes, small pointed fangs, blunt spikes, claws, horns, a weapon in hand, a crouched or lunging pose, a few flat dark puffs). It should look petty and small-time, but like it would really hurt if you picked a fight with it. NOT horror: no blood, no wounds, no gore, no skulls, no bones, no glowing eyes, no realistic anatomy, no glow effects, no gradients. Keep details minimal like the dwarf: a few flat color blocks, at most a few inner lines, no patterns, no texture. The whole monster fits inside the frame with empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects around it except what is described.
```

#### 조각 FOE_SECOND_REF

적다운 몬스터의 두 번째 참조 안내(list.json의 refNote2).

```text
The second attached image is one of our existing cute monsters of the same body type and element. Use it to match the drawing style, outline weight, flat colors, element color and the size in the frame. Draw the creature described below: if the description says it is the SAME species as the second image, keep that species recognizable; otherwise draw a new creature and do not copy the one in the second image.
```

#### 조각 BOSS_INTRO_A

대형 보스 첫 넷의 생김새 앞말. "새 생물이고 색만 바꾼 변형이 아니다".

```text
A big boss monster for the game, facing left, drawn in the same flat doodle style and coloring as the second attached image but much bigger and heavier, and a completely new creature (not a recolor of the attached monster):
```

#### 조각 BOSS_INTRO_B

리치·요새 바위 거북의 생김새 앞말.

```text
A big boss monster for the game, facing left, drawn in the same flat doodle style, line weight and coloring as the second attached image, a completely new creature:
```

#### 조각 BOSS_W2_TAIL

대형 보스 둘째 묶음(트윈헤드, 가고일)의 감싸기 끝. "용사 키의 2~3배"로 덩치를 정한 문단이 들어 있다. <key>는 그림 키, <size>는 요청 크기.

```text
Attached images: 1) the doodle dwarf = drawing style reference only (do not draw the dwarf); 2) an existing enemy monster from the same game = reference for the flat coloring, the thick dark brown outline weight and the level of detail only. Do NOT copy its species, body or gear: draw the new boss described above. This boss will stand 2 to 3 times as tall as the heroes on screen, so give it huge, heavy proportions: a small head (or heads) on very broad shoulders, thick arms and legs, a big heavy silhouette. It is a step more threatening than the attached monster (big, heavy, angry), but it stays a silly flat doodle: no blood, no wounds, no gore, no skulls, no horror, no realistic anatomy, no glow effects, no gradients, and very few details (do not pile on decorations). Use your image generation tool to create exactly ONE image, size <size>. The background must be genuinely transparent (real alpha channel, PNG, no backdrop, no floor, no cast shadow); if the tool has a background parameter set it to transparent and preserve the generated alpha. Keep the whole boss inside the frame with some empty margin on all sides, nothing cropped. Save the generated image as <key>.png in the current directory (do not overwrite or modify any other file). Reply with only the saved file path.
```

#### 조각 FACE_EDIT

얼굴만 고치는 편집의 앞말. 원본 한 장만 -i로 붙이고, 바로 뒤에 새 얼굴을 적는다.

```text
Edit the attached image. Keep EVERYTHING exactly the same — the same creature, body shape, pose, size, position in the frame, colors, outline weight, flat doodle style, equipment and background transparency — and change ONLY the face so it looks a little dumb and silly (a slightly stupid, dopey expression):
```

### 9.1 화풍 v1: 슬레이 더 스파이어식 페인터리 (버림, 2026-10-11)

사용자 요청(원문):

> 일단 제작을 조금 더 아트를 넣어서 제작부분의 재미를 더 확립하고싶어.
> 첨부한 이미지대로 슬레이 더 스파이어 같은 느낌으로 실제 카드덱을 아래쪽에 표시해주고,
> 위에 실제 캐릭터와, 모루, 공방등을 그리고, 카드를 사용할때도 실제 동작을 하는것처럼 이펙트를 해줘.
> UI도 실제 게임처럼 해줘.
> 코덱스 이미지생성을 사용해줘.

그보다 앞서 Codex 사용을 허락한 말: "이미지 리소스를 위해 코덱스 이미지생성기능을 써도 좋아. 로그인이 되어있을꺼야."

#### `anvil_test` (첫 시험)

- **참조**: 없음 · **크기**: 지정 없음
- **결과**: 한 번에 나왔다.
- **배운 것**: 표준 오류에 아래 한 줄이 남았다. Codex는 표준 입력이 터미널이 아니면 이 말을 찍고 입력을 더 읽는다.
  이번에는 바로 넘어갔지만, 백그라운드 실행이나 `while read` 반복 안에서는 여기서 멈추거나 반복 목록을 삼켰다.
  그래서 이후 모든 호출에 `< /dev/null`을 붙였다. gen.ts는 프롬프트를 표준 입력으로 보낸 뒤 닫는다.

```text
Use your image generation tool to create ONE image: a small iron anvil on a wooden stump, side view, warm painterly 2D game art style like Slay the Spire, plain transparent or flat dark background. Save the generated image file as anvil_test.png in the current directory. Then reply with only the saved file path.
```

```text
Reading additional input from stdin...
```

#### `dwarf_idle` (페인터리 시험)

- **참조**: 없음 · **크기**: 지정 없음, 투명
- **결과**: 투명 배경을 부탁했고 처음부터 진짜 알파(PNG 25번째 바이트 = 6)로 나왔다.

```text
Use your image generation tool to create ONE image with a TRANSPARENT background (real alpha channel, PNG, no backdrop at all): a stout old dwarf blacksmith, full body, side view facing right, holding a forging hammer at rest, leather apron, braided grey beard, warm painterly 2D game art style like Slay the Spire, soft rim light from a forge. If the tool has a background parameter, set it to transparent. Save it as dwarf_idle.png in the current directory. Reply with only the saved file path and whether the background is transparent.
```

#### `dwarf_raise` (페인터리 시험)

- **참조**: 1) 위의 페인터리 dwarf_idle

```text
The attached image is our dwarf blacksmith character sprite. Use your image generation tool to create ONE new image of the SAME character (same face, beard braids, clothes, apron, colors, same painterly style, same scale and side view facing right) in a new pose: both hands gripping the hammer raised high above his head, about to strike down onto an anvil in front of him (do not draw the anvil). Transparent background with a real alpha channel. Save it as dwarf_raise.png in the current directory. Reply with only the saved path.
```

#### v1 장면 감싸기

- 프롬프트 = 머리말 `{{STYLE_V1}}` + 본문 + 끝(TAIL) + 저장 줄. 투명 그림이면 TAIL이 투명 문장이다.
- **조각**: [`STYLE_V1`](#조각-style_v1)

```text
HEAD="{{STYLE_V1}}"
BODY="$(cat "$W/prompts/$KEY.txt")"
if [ "$TR" = "1" ]; then
  TAIL="Use your image generation tool to create exactly ONE image, size $SIZE. The background must be genuinely transparent (real alpha channel, PNG, no backdrop, no floor, no cast shadow box); if the tool has a background parameter set it to transparent and preserve the generated alpha. Keep the whole subject inside the frame with some empty margin, nothing cropped."
else
  TAIL="Use your image generation tool to create exactly ONE image, size $SIZE, fully opaque."
fi
ARGS=()
for r in $REFS; do ARGS+=(-i "$ART/ref/$r.png"); done
PROMPT="$HEAD $BODY $TAIL Save the generated image as $KEY.png in the current directory (do not overwrite any other file). Reply with only the saved file path."
```

#### v1 카드 감싸기

- **참조**: 페인터리 모루 한 장(`style_anvil.png`). 카드 종류마다 강조색 문장(ACC)을 붙였다.
- **조각**: [`STYLE_V1`](#조각-style_v1)

```text
HEADER="{{STYLE_V1}}"
CARD="Card illustration for a fantasy card game, square composition, one clear subject centered with breathing room around it (the image will be cropped to a 4:3 window, so keep the subject inside the central area), dramatic forge lighting, dark warm vignette background (NOT transparent). Hands and tools only or objects; if a person appears, show only the dwarf's hands and forearms, never a full face."
case "$type" in
  process) ACC="Accent color for this card family: fierce orange and red fire glow." ;;
  quality) ACC="Accent color for this card family: cool silver and pale icy-blue light gleaming on the metal, against the warm dark forge." ;;
  support) ACC="Accent color for this card family: warm amber glow, a meeting of fire and water." ;;
  imprint) ACC="Accent color for this card family: mystic violet glowing rune light, against the warm dark forge." ;;
esac
PROMPT="$HEADER $CARD Scene: $idea. $ACC Use the attached image only as a style reference for brushwork, lighting, texture and palette; do not copy its subject or composition. Fill the whole square canvas with the painted scene. Save the generated image as $key.png in the current directory. Reply with only the saved file path."
```

**결과: 버림.** 사용자(2026-10-12, 원문): "그리고 캐릭터의 그림체는 조금 더 카툰스럽고 sd캐릭스러운 느낌을 원했어. 지금은 너무 진지한 그럼체야."
레이아웃(위 공방 장면, 아래 부채꼴 손패)은 남기고 그림체만 바꿨다. 이 시절 그림 약 80장은 `<key>.painterly.png`로 남았다.

### 9.2 SD 후보 A·B·C (모두 버림, 2026-10-12)

- **참조**: 9.1의 페인터리 드워프 한 장. 세 장을 동시에 뽑았다.
- 프롬프트 = `{{SD_ABC_COMMON}}` + "Style X: …" + 저장 문장. 셸 변수를 풀어 실제로 보낸 글자다.

#### `sd_a`: 모바일 RPG 치비

- **조각**: [`SD_ABC_COMMON`](#조각-sd_abc_common)

```text
{{SD_ABC_COMMON}} Style A: mobile RPG chibi, about 2.5 heads tall (very big head, small round body, stubby limbs), clean bold dark outlines, flat cel shading with one soft shadow tone, bright warm colors, big friendly expressive eyes under bushy brows, rosy nose, a warm grumpy-but-kind expression. Save as sd_a.png in the current directory.
```

#### `sd_b`: 페인터리 카툰 (슬레이 더 스파이어, Cult of the Lamb 결)

- **조각**: [`SD_ABC_COMMON`](#조각-sd_abc_common)

```text
{{SD_ABC_COMMON}} Style B: hand-painted cartoon like Slay the Spire or Cult of the Lamb, about 3 heads tall (large head, chunky body), thick textured brush outlines, simple painterly shading with warm forge rim light, small dot eyes almost hidden under huge bushy eyebrows, round potato nose, the beard is a big soft shape. Charming and a little funny. Save as sd_b.png in the current directory.
```

#### `sd_c`: 부드러운 애니 치비 (프리렌 결)

- **조각**: [`SD_ABC_COMMON`](#조각-sd_abc_common)

```text
{{SD_ABC_COMMON}} Style C: soft anime chibi like the chibi side illustrations of a gentle fantasy anime (Frieren style mood), about 2.5 heads tall, thin soft colored outlines, light watercolor-like shading, pastel warm palette, gentle sleepy eyes, calm and a little lonely but cute. Save as sd_c.png in the current directory.
```

Codex의 마지막 답이다. Codex가 그린 뒤 스스로 "다듬었다(refined)"고 답했다.
지금 감싸기의 "Generate once … Do not edit, crop, resize or post-process it"는 이런 덧그리기를 막는다.

```text
Saved [sd_a.png](sd_a.png) in the current directory. Verified real alpha transparency.

Created with built-in imagegen using your Style A prompt, then refined to simplify textures and cel shading.

Saved [sd_b.png](sd_b.png) with a verified real alpha channel.

Created with built-in imagegen using your reference and requested Style B: cute painterly chibi proportions, right-facing pose, preserved costume and hammer, and warm forge rim light.

Saved [sd_c.png](./sd_c.png). Verified real alpha transparency.

Created with built-in imagegen using your character reference and the soft anime chibi prompt: right-facing, full body, pastel watercolor shading, sleepy eyes, and preserved blacksmith details.
```

**결과: 셋 다 버림.** 사용자(원문): "조금 더 하찮은! 디테일을 줄이고 코믹스럽게.다시 후보를 줘봐".
셋 모두 2.5~3등신에 셀 채색이나 붓질 음영이 있어 아직 자세했다. 페인터리 드워프를 참조로 붙여 그 디테일과 음영을 물려받았다.

### 9.3 SD 후보 D·E·F·G (D 채택, 2026-10-12)

- **참조: 없음.** 글로만 뽑았다(9.2와 달리 `-i`가 없다). 네 장을 동시에 뽑았다.
- 공통 문단 `{{SD_DG_COMMON}}`에 "SILLY, HUMBLE and a bit pathetic-cute (the Korean 'hachanhan' meme vibe)", "very LOW detail"이 처음 들어갔다.

#### `sd_d`: 낙서 (채택, 지금 화풍의 뿌리)

- **결과**: 1227x1282, 진짜 알파. 사용자(원문): "D 로 해봐줘."
- 이 그림이 그대로 `ref/d_dwarf_idle.png`(= `scene/dwarf_idle`)가 되었다. 1장의 `scene/dwarf_idle` 프롬프트는 이 글에서 끝의 "Save as sd_d.png in the current directory."만 뺀 것이다.
- **조각**: [`SD_DG_COMMON`](#조각-sd_dg_common)

```text
{{SD_DG_COMMON}} Style D: super simple flat doodle, about 2 heads tall, the beard is one big round blob covering most of the body, two dot eyes peeking above the beard, tiny stick-like arms and legs, uneven hand-drawn dark outline, flat colors with no shading at all. Looks like a cute doodle drawn in a minute. Save as sd_d.png in the current directory.
```

#### `sd_e`: 동글 마스코트 (1374x1145)

- **조각**: [`SD_DG_COMMON`](#조각-sd_dg_common)

```text
{{SD_DG_COMMON}} Style E: round gumdrop mascot, about 1.8 heads tall, egg-shaped body, short nubby limbs without fingers (mitten hands), the hammer is comically big compared to him, a small sweat drop and a determined pout, clean thick outline, flat colors with one soft shadow. Sticker / emoji style. Save as sd_e.png in the current directory.
```

#### `sd_f`: 웹툰 치비 (1220x1289)

- **조각**: [`SD_DG_COMMON`](#조각-sd_dg_common)

```text
{{SD_DG_COMMON}} Style F: simple comic webtoon chibi, about 2 heads tall, big bushy eyebrows completely hiding the eyes, a round red nose, beard like a fluffy cloud, tiny body, slightly droopy shoulders and a tired grumpy face, simple flat colors with a light warm shade, thick soft outline. Save as sd_f.png in the current directory.
```

#### `sd_g`: 크레파스 그림책 낙서 (1234x1275)

- **조각**: [`SD_DG_COMMON`](#조각-sd_dg_common)

```text
{{SD_DG_COMMON}} Style G: crayon / colored-pencil kids-book doodle, about 2 heads tall, wobbly lines, simple shapes, visible crayon texture, dot eyes, beard a big scribbled cloud, cheerful but slightly clueless face, warm limited palette. Save as sd_g.png in the current directory.
```

Codex의 마지막 답:

```text
Saved `sd_d.png` in the current directory. Verified a real alpha channel with transparent background.

Created with built-in imagegen using your Style D prompt, refined for simpler shapes and tiny limbs.

Saved `sd_e.png` in the current directory. Verified real alpha transparency.

Created with built-in imagegen using your Style E prompt, with a simplification pass for the gumdrop silhouette.

Saved `sd_f.png` in the current directory. Verified it has a real alpha channel with a transparent background.

Saved `sd_g.png` in the current directory. Verified a real transparent alpha channel.

Created with built-in imagegen using your crayon-style dwarf prompt.
```

**결과: D 채택.** 이어서 사용자(원문): "배경 소품 ui 카드 다 새로 그려줘". 그래서 약 77장을 D로 다시 그렸다.
다음 날 사용자(2026-10-13, 원문): "1.지금 아트 매우 좋아. 앞으로 만드는것들은 다 지금 아트 기준으로 만들어주면 될거같아."

- 다른 그림에 붙이는 화풍 머리말 `{{STYLE}}`은 D를 고른 뒤에 D를 말로 옮겨 새로 쓴 것이다. D를 뽑을 때 쓴 문장이 아니다.
- **교훈**: 새 화풍을 찾을 때는 옛 화풍 그림을 참조로 붙이지 말고 분위기를 말로 적는다("hachanhan", "drawn in a minute", "very LOW detail").
  후보 3~4장을 그림으로 먼저 보여 주고 고르게 한다. 정해지면 그 한 장을 모든 생성의 첫 `-i`로 붙여 화풍을 잇는다.

### 9.4 D 드워프 자세 5장 (실제로 보낸 글자, 2026-10-12)

- **참조**: 1) sd_d(= d_dwarf_idle) 한 장. raise·strike·work·cheer를 동시에, slump를 그 뒤에 뽑았다.
- **결과**: 다섯 장 모두 첫 판 채택, 모두 1227x1282.
- 1장의 드워프 자세 그림 프롬프트에 저장 문장이 붙은 꼴이다.
- "Same size and proportions"라고 적어도 자세마다 그림 안의 키가 흔들린다. 페인터리 시절 자세는 키가 16%쯤 달랐다. 그래서 자세 그림은 처리 뒤 몸 높이로 맞춰 쓴다.

#### `dwarf_raise`

- **조각**: [`DWARF_SAME`](#조각-dwarf_same)

```text
{{DWARF_SAME}} New pose: both tiny arms holding the hammer raised high above his head, ready to strike down in front of him, beard blob bouncing up a little. Save as dwarf_raise.png in the current directory.
```

#### `dwarf_strike`

- **조각**: [`DWARF_SAME`](#조각-dwarf_same)

```text
{{DWARF_SAME}} New pose: the moment right after a hammer blow, both tiny arms holding the hammer brought down in front of him at belly height (the hammer head is in front of the beard, as if it just hit an anvil top, do not draw the anvil), body leaning forward, eyes squeezed shut as two short lines. Save as dwarf_strike.png in the current directory.
```

#### `dwarf_work`

- **조각**: [`DWARF_SAME`](#조각-dwarf_same)

```text
{{DWARF_SAME}} New pose: leaning forward with focus, a small grey whetstone in his tiny hands held out in front of him, polishing something (do not draw the object), tongue sticking out a little in concentration. Save as dwarf_work.png in the current directory.
```

#### `dwarf_cheer`

- **조각**: [`DWARF_SAME`](#조각-dwarf_same)

```text
{{DWARF_SAME}} New pose: satisfied, the hammer resting on his shoulder, eyes closed as two happy upward arcs, a tiny blush, standing a bit proudly. Save as dwarf_cheer.png in the current directory.
```

#### `dwarf_slump`

- **조각**: [`DWARF_SAME`](#조각-dwarf_same)

```text
{{DWARF_SAME}} New pose: disappointed, shoulders drooped, head hanging down, the hammer dragging on the floor from one hand, a small sigh puff near his face. Save as dwarf_slump.png in the current directory.
```

### 9.5 적다운 몬스터 12종 `foe_*` (2026-10-13)

사용자(원문): "몬스터가 너무 귀엽다. 조금 더 적같은 느낌의 몬스터도 추가로 그려줘. 채색이나 스타일은 유지한채로"
그 뒤(원문): "그래 일단 낮은층 귀여운몬스터, / 점점 위협적인게 나오도록 하자. / 일단 더이상 일반 몬스터는 안그려도 되고."

- 체형 4(인간형·갑각·비행·영체) × 3종이다. 위협 단계(약간·꽤·확실히)가 체형마다 하나씩 있다.
- 체형마다 한 종은 귀여운 종족(고블린·동글게·박쥐·유령)의 '적 버전'(SAME species)이고, 나머지 둘은 새 생물이다.
- **두 번째 참조는 늘 같은 체형·속성의 귀여운 몬스터**(7장의 `mon_<체형>_<속성>`)였다.
  새 생물이면 생김새 끝에 "(The second image is only a style, color and size reference: do NOT draw that …)"를 붙였다.
  새 프로젝트에 그런 귀여운 몬스터가 없으면 키트의 `foe(..., { secondRef: 'style' })`(FOE_STYLE_REF, 키트에서 새로 쓴 문단)를 쓴다 (`ART_STYLE_GUIDE.md` 3.5).
- 첫 참조는 모두 `d_dwarf_idle`, 크기는 1024x1024 투명이다. 비행·영체는 Codex가 1254x1254로 내서 1024로 줄였다.
- 검수에서 외곽선 굵기를 픽셀로 쟀다(짙은 외곽선 픽셀이 가로·세로로 이어지는 길이의 중앙값). 아래 "12px, 기존 14px" 같은 숫자가 그 값이다.

세 가지 감싸기로 뽑았다. 같은 STYLE 머리말을 쓰고, 문단 순서와 낱말만 다르다.

**감싸기 ①** 인간형·갑각 첫 회차. 다시 뽑을 때는 extra 문장을 생김새 뒤에 붙였다.
그림 프롬프트 = `{{STYLE}}` + 빈 줄 + `{{FOE_INTRO}}` + 생김새 + [extra] + " Transparent background with a real alpha channel." 그 뒤에 빈 줄과 `{{FOE_W1_TAIL}}`.

```text
IMG="$STYLE

An enemy monster for the game, facing left, a bit menacing but still drawn in the same flat doodle style and coloring as the second attached image: $LOOK$EXTRA Transparent background with a real alpha channel."
PROMPT="$IMG

Attached images: 1) the doodle dwarf = drawing style reference only (do not draw the dwarf); 2) an existing monster from the same game = reference for coloring, outline weight and size in the frame. Use your image generation tool to create exactly ONE image, size 1024x1024. The background must be genuinely transparent (real alpha channel, PNG, no backdrop, no floor, no cast shadow, no glow); if the tool has a background parameter set it to transparent and preserve the generated alpha. Keep the whole monster inside the frame with some empty margin, nothing cropped. Save the generated image as $KEY.png in the current directory (do not overwrite or modify any other file). Reply with only the saved file path."
```

**감싸기 ②** 비행·영체. `{{FOE_W2_PRE}}` + 빈 줄 + "Image prompt:" + 그림 프롬프트 + 빈 줄 + `{{SAVE_KEEP}}`.
그림 프롬프트는 ①과 같은 조립이지만 문단 사이가 빈 줄이 아니라 띄어쓰기 하나다. 다시 뽑을 때 붙인 문장은 투명 문장 뒤에 온다.

```text
PRE="Use your built-in image generation tool to create exactly ONE image, size 1024x1024 (square). Attached reference images, in order: 1) our doodle dwarf (style reference only, do not draw it), 2) an existing monster of ours (style, coloring and size reference). The background must be genuinely transparent: a real alpha channel in a PNG, no backdrop, no floor, no cast shadow, no glow; if the tool has a background parameter set it to transparent and keep the generated alpha. Do not edit, crop or post-process the image; just copy the generated file.

Image prompt:"
PROMPT="$PRE
$BODY

Save the generated image as $KEY.png in the current directory (do not overwrite or modify any other file). Reply with only the saved file path."
```

```text
let prompt =
  STYLE +
  ' An enemy monster for the game, facing left, a bit menacing but still drawn in the same flat doodle style and coloring as the second attached image: ' +
  m.look +
  ' Transparent background with a real alpha channel.';
if (extra) prompt += ' ' + extra;
```

**감싸기 ③** 검수 때 다시 그린 둘. 설계 파일(list.json)에 적어 둔 조립 순서를 그대로 썼다.
`{{STYLE}}` + `{{MON_REF_NOTE}}` + `{{FOE_COMMON}}` + `{{FOE_SECOND_REF}}` + 생김새 + extra, 그 뒤에 `{{FOE_W1_TAIL}}`.
`{{FOE_COMMON}}`은 '위협은 몇 가지 특징으로만, 공포는 아니게'를 정한 문단이라, 적다운 그림을 새로 그릴 때 가장 먼저 가져다 쓸 문단이다.

| 키 | 이름 | 체형·속성 | 위협 | 두 번째 참조 | 결과 |
|---|---|---|---|---|---|
| foe_humanoid_wind | 고블린 돌격병 | 인간형·바람 (고블린의 적 버전) | 약간 | mon_humanoid_wind | 둘째 판 채택 |
| foe_humanoid_water | 메기 창병 | 인간형·물 | 꽤 | mon_humanoid_water | 셋째 판 채택 |
| foe_humanoid_earth | 엄니 오크 | 인간형·땅 | 확실히 | mon_humanoid_earth | 첫 판 채택 (검수 때 다시 그린 둘은 버림) |
| foe_armored_earth | 톱니게 | 갑각·땅 (동글게의 적 버전) | 약간 | mon_armored_earth | 넷째 판(검수 때 다시 그린 둘째) 채택 |
| foe_armored_fire | 불전갈 | 갑각·불 | 꽤 | mon_armored_fire | 첫 판 채택 |
| foe_armored_water | 가시 소라게 | 갑각·물 | 확실히 | mon_armored_water | 첫 판 채택 |
| foe_flying_fire | 송곳니 박쥐 | 비행·불 (박쥐의 적 버전) | 약간 | mon_flying_fire | 둘째 판 채택 |
| foe_flying_earth | 돌 가고일 | 비행·땅 | 꽤 | mon_flying_earth | 첫 판 채택 |
| foe_flying_wind | 칼깃 매 | 비행·바람 | 확실히 | mon_flying_wind | 둘째 판 채택 |
| foe_spirit_water | 으름장 유령 | 영체·물 (유령의 적 버전) | 약간 | mon_spirit_water | 첫 판 채택 |
| foe_spirit_wind | 회오리 귀신 | 영체·바람 | 꽤 | mon_spirit_wind | 첫 판 채택 |
| foe_spirit_fire | 도깨비불 | 영체·불 | 확실히 | mon_spirit_fire | 첫 판 채택 |

#### `foe_humanoid_wind` 고블린 돌격병 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_humanoid_wind` · **크기**: 1024x1024 투명 · **감싸기**: ①, extra 있음
- **결과**: 둘째 판 채택(선 15px). 첫 판(rejected1)은 외곽선이 기존보다 가늘고(12px, 기존 14px) 투구 점·옷 주름 같은 잔선이 많고 틀을 크게 차지했다.
  그래서 "Match the second image's drawing exactly: the SAME very thick, bold dark brown outline weight … almost no interior lines … about 70% of the frame width"를 더했다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_WIND`](#조각-mark_wind), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A small chubby goblin monster of the SAME species as the second image (big round head, two long pointed ears sticking out sideways, round potbelly, short tube arms and legs, small bare round feet, about 2 heads tall), but this one is a grumpy little soldier: two heavy dark eyebrows slanted down into a V over its dot eyes, a scowling mouth with two small pointed fangs poking up from the lower lip, ears perked up and back. Skin: pale mint (#bfe6d2). It wears the same old dented cooking-pot helmet (plain grey #8e8984, one short handle sticking out to the side) and a plain cream tunic (#f6ebd5) tied with a brown rope. Instead of a wooden spoon it grips a real short iron sword (grey blade #b3aea8 with one small chip in the edge, brown hilt) pointed toward the left, and holds a round grey pot lid (#8e8984) as a shield in the other hand. It leans forward on one bent leg, about to charge. Turned three-quarters toward the LEFT. Element mark: {{MARK_WIND}} pot helmet. Match the second image's drawing exactly: the SAME very thick, bold dark brown outline weight as the second image (clearly bolder than a normal pen line), almost no interior lines (no dents or dots on the helmet, no fold lines on the tunic, no inner rim line on the shield, no lines inside the ears), and the same size in the frame as the second image (the goblin with its sword takes only about 70% of the frame width, centred, with wide empty margins). Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_humanoid_water` 메기 창병 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_humanoid_water` · **크기**: 1024x1024 투명 · **감싸기**: ①, extra 있음
- **결과**: 셋째 판 채택. 첫 판(rejected1)은 선이 가장 가늘었다(11px, 기존 15px).
  둘째 판(rejected2)은 선은 맞았지만 입이 작아 덜 위협적이었고 수염이 입에서 늘어진 국수나 침처럼 보였다.
  셋째 판은 입이 머리를 가로질러 크게 벌어지고 위아래로 뾰족한 이가 줄지어 메기로 확실히 읽힌다. 남은 흠: 선이 13px로 조금 가늘고, 수염이 속 빈 관이고, 조금 상어 같다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_WATER`](#조각-mark_water), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A chubby catfish-man monster standing upright on two short stubby legs, about the same size as the goblins (about 2 heads tall): a big wide flat catfish head merged with a round body, a very wide mouth turned down at the corners in a frown with a row of small blunt triangle teeth showing, two long droopy whiskers on each side of the mouth, two small narrowed eyes under heavy slanted brows giving a cold glare, a short dorsal fin with three blunt points running from the top of its head down its back, two small fin-shaped ears, a cream belly (#f6ebd5). Skin: soft sky blue (#8ec8ee) with slightly darker blue fins (#6fa9cf). It wears a brown rope belt with a small seaweed-green (#8fae6b) cloth flap. It holds a long wooden fishing trident with three short pointed grey prongs (#b3aea8) in both hands, the prongs aimed forward toward the left in a guard stance, feet planted wide. Turned three-quarters toward the LEFT. Element mark: {{MARK_WATER}} head, just in front of the dorsal fin. Face like a real mean catfish: a VERY wide mouth stretching across the whole front of its flat head, turned down at the corners and slightly open, with a row of small sharp white triangle teeth along the top and the bottom; two long thin pointed whiskers on each side growing OUT sideways from the corners of the mouth and curving down at the tips (clearly whiskers, not drool); small narrow glaring eyes under heavy slanted brows. Its cream belly is part of its body (no apron). Match the second image's drawing exactly: the SAME very thick, bold dark brown outline weight as the second image (clearly bolder than a normal pen line), very few interior lines (no muscle lines, no lines inside the fins), and about the same size in the frame as the second image (the whole figure including the trident about 75% of the frame width, centred, with clear empty margins on every side). Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_humanoid_earth` 엄니 오크 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_humanoid_earth` · **크기**: 1024x1024 투명 · **감싸기**: ①, extra 없음
- **결과**: 첫 판 채택(선 14px, 기존과 같음). 표정이 잔뜩 성난 쪽보다 '심술 난 덩치'라 하찮은 맛이 남았다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_EARTH`](#조각-mark_earth), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A stocky, heavy orc brute monster, a bit taller and much wider than the goblins (about 2.5 heads tall), still built from round chunky shapes: a big round head sunk into broad rounded shoulders, a jutting lower jaw with two big upward tusks (cream #f6ebd5, rounded tips), a heavy brow slanting down into a deep scowl over two small narrow angry eyes, a snarling mouth, short pointed ears, thick arms with big round fists, short thick legs planted wide in a crouched, growling stance. Skin: warm ochre brown (#c9995f). It wears a dented iron helmet (grey #8e8984) with two short stubby cream horns, and a rough brown leather vest (#8a5a3a) with one iron shoulder plate (#8e8984) studded with three short blunt spikes. One fist grips a huge wooden club whose head is a big round grey stone (#b3aea8) tied on with rope, resting heavily on the ground beside it. Two small flat puffs of breath (warm dark grey #6b6461, with outline) snort out of its nose toward the left. Turned three-quarters toward the LEFT. Element mark: {{MARK_EARTH}} helmet between the horns. Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_humanoid_earth` 검수 때 다시 그린 판 (버림)

- **참조**: 위와 같다 · **감싸기**: ③
- **결과**: 근육선·조끼 끝·리벳을 줄이려고 두 번 다시 그렸지만 둘 다 버렸다.
  rejected1은 틀을 꽉 채운 보디빌더가 됐고(폭 964px), rejected2는 단순해졌지만 선이 가늘어졌다(11px, 고블린 14px).
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`FOE_COMMON`](#조각-foe_common), [`FOE_SECOND_REF`](#조각-foe_second_ref), [`MARK_EARTH`](#조각-mark_earth), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{FOE_COMMON}}

{{FOE_SECOND_REF}}

A stocky, heavy orc brute monster, a bit taller and much wider than the goblins (about 2.5 heads tall), still built from round chunky shapes: a big round head sunk into broad rounded shoulders, a jutting lower jaw with two big upward tusks (cream #f6ebd5, rounded tips), a heavy brow slanting down into a deep scowl over two small narrow angry eyes, a snarling mouth, short pointed ears, thick arms with big round fists, short thick legs planted wide in a crouched, growling stance. Skin: warm ochre brown (#c9995f). It wears a dented iron helmet (grey #8e8984) with two short stubby cream horns, and a rough brown leather vest (#8a5a3a) with one iron shoulder plate (#8e8984) studded with three short blunt spikes. One fist grips a huge wooden club whose head is a big round grey stone (#b3aea8) tied on with rope, resting heavily on the ground beside it. Two small flat puffs of breath (warm dark grey #6b6461, with outline) snort out of its nose toward the left. Turned three-quarters toward the LEFT. Element mark: {{MARK_EARTH}} helmet between the horns. Keep it as SIMPLE and as SMALL as the goblin in the second image: a squat, round, chubby toy-like brute (big round head, round belly, short thick limbs), not a bodybuilder; only a little bigger than the goblin. NO muscle lines on the arms, legs or chest, no knuckle or toe lines, no rivets or dots on the helmet or shoulder plate, no lines on the stone except the rope; the vest has smooth simple rounded edges; the face has just the heavy brow, two small dark dot eyes, the two tusks and one scowling mouth line. IMPORTANT outline weight: the SAME very thick, bold dark brown outline as the second image (about twice as thick as a normal pen line) on every shape. Flat fills, no shading. IMPORTANT size: the whole figure including the club and the breath puffs takes only about 70% of the frame width and 75% of the frame height, centred, with wide empty margins on every side (like the second image). Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_armored_earth` 톱니게 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_armored_earth` · **크기**: 1024x1024 투명 · **감싸기**: ③
- **결과**: 검수 때 다시 그린 둘째 판 채택(선 17px). 지나온 판:
  - rejected1(첫 회차 첫 판): 눈자루가 눈 아래로 늘어져 우는 게처럼 보였고, 선이 가늘었고(12px, 기존 19px), 몸통이 거북 등딱지 같았다.
  - rejected2(첫 회차 둘째 판, 한때 채택): 기존 게와 같은 종이고 선도 굵었지만(22px) 검수에서 '적답지 않다'로 버렸다. 앞 집게가 얼굴을 가리고, 찡그림이 작고, 톱니 집게가 부러진 것처럼 보였다.
  - rejected3(검수 때 다시 그린 첫 판): 훨씬 적다웠지만 선이 가늘었다(13px).
- **조각**: [`STYLE`](#조각-style), [`MON_REF_NOTE`](#조각-mon_ref_note), [`FOE_COMMON`](#조각-foe_common), [`FOE_SECOND_REF`](#조각-foe_second_ref), [`MARK_EARTH`](#조각-mark_earth), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{MON_REF_NOTE}}

{{FOE_COMMON}}

{{FOE_SECOND_REF}}

A small chubby round crab monster of the SAME species as the second image (wider than tall, a big dome-shaped shell like an upturned bowl, a plain cream rim #f6ebd5 along the bottom edge of the shell, two short eye stalks on top with dot eyes, three short stubby round legs on each side), but this one is a grumpy brawler: each eye on its stalk has a short heavy brow slanted down into a glare, a small down-turned scowl under the shell rim, and a row of four short blunt rocky bumps along the top of the shell. Shell: warm ochre brown (#c9995f). Its two claws are now real pincers, both the same medium size, opened wide, the inner edge of each pincer cut into a simple zigzag sawtooth, raised and snapping toward the left. It crouches low, sidling toward the left. Turned three-quarters toward the LEFT. Element mark: {{MARK_EARTH}} shell, just behind its eye stalks. Make the menace clearly readable even at small size (it must look like an angry enemy, not our cute crab with a frown): its face is on the front cream rim and is clearly visible, NOT covered by any claw: a wide grumpy frown with two small pointed fangs poking up from the lower lip. The two eye stalks are short, thick, filled stalks standing straight UP from the top of the shell exactly like in the second image, with simple round eyeballs and dot pupils like the second image; each eyeball is topped by a thick heavy brow slanted down hard into a V glare. Both pincers are raised high and wide to the sides, ABOVE the shell and NOT in front of the body or face, both opened wide; the inner edge of each pincer is a neat regular zigzag of three small triangle teeth (a clean sawtooth, not broken or chipped looking). Along the top back of the shell, four short blunt rounded rock bumps in a row. Low wide crouch, body and face turned a little toward the LEFT. IMPORTANT outline weight: use the SAME very thick, bold dark brown outline as the second image, about twice as thick as a normal pen line, on every shape including the legs, stalks and pincers. Very few interior lines, flat fills, and about the same size and position in the frame as the second image. Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_armored_earth` rejected2 (버림)

- **감싸기**: ①. 위 '지나온 판'의 rejected2다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_EARTH`](#조각-mark_earth), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A small chubby round crab monster of the SAME species as the second image (wider than tall, a big dome-shaped shell like an upturned bowl, a plain cream rim #f6ebd5 along the bottom edge of the shell, two short eye stalks on top with dot eyes, three short stubby round legs on each side), but this one is a grumpy brawler: each eye on its stalk has a short heavy brow slanted down into a glare, a small down-turned scowl under the shell rim, and a row of four short blunt rocky bumps along the top of the shell. Shell: warm ochre brown (#c9995f). Its two claws are now real pincers, both the same medium size, opened wide, the inner edge of each pincer cut into a simple zigzag sawtooth, raised and snapping toward the left. It crouches low, sidling toward the left. Turned three-quarters toward the LEFT. Element mark: {{MARK_EARTH}} shell, just behind its eye stalks. Keep the body exactly like the second image: the two eye stalks stand straight UP from the top of the shell like in the second image (round eyeballs at the top ends of the stalks), each heavy brow sits on top of its eyeball, and there is NOTHING hanging below the eyes (no drips, no tear shapes). The scowl mouth is on the cream rim at the front, like the smile in the second image. Match the second image's drawing exactly: the SAME very thick, bold dark brown outline weight as the second image (clearly bolder than a normal pen line), very few interior lines, and the same size and position in the frame as the second image. Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_armored_fire` 불전갈 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_armored_fire` · **크기**: 1024x1024 투명 · **감싸기**: ①
- **결과**: 첫 판 채택(선 18px, 기존 20px). 앞 집게가 얼굴을 조금 가린다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_FIRE`](#조각-mark_fire), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A chubby round scorpion monster, wider than tall, built from round chunky shapes: a plump oval armored body made of three wide rounded shell segments in soft red-orange (#e8875a) with a cream underside (#f6ebd5), four short stubby legs on each side, two big round pincers held up and open in front of it toward the left, and a thick tail made of four round bead-like segments curling high up over its back, ending in one curved pointed stinger (cream #f6ebd5) aimed forward over its head. Darker red-orange (#c96a43) on the pincer tips and the tail joints. Its face is on the front of the body: two narrowed dot eyes under heavy slanted brows and a small fierce frown with two tiny pointed fangs. It crouches, ready to strike. Turned three-quarters toward the LEFT. Element mark: {{MARK_FIRE}} head, just above its eyes, like a little tuft, no glow. Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_armored_water` 가시 소라게 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_armored_water` · **크기**: 1024x1024 투명 · **감싸기**: ①
- **결과**: 첫 판 채택(선 16px, 기존 19px). 틀을 거의 채워(974x824) 오른쪽 여백이 19px뿐이지만 잘리지 않았다. 껍데기에 나선 대신 고리 선이 나왔다.
- **조각**: [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`FOE_W1_TAIL`](#조각-foe_w1_tail)

```text
{{STYLE}}

{{FOE_INTRO}} A hermit crab monster carrying a big spiky sea shell: a tall round spiral conch shell in soft sky blue (#8ec8ee) with two or three simple spiral lines and a row of big blunt cream cone spikes (#f6ebd5) sticking out of it, the shell taller than the crab itself. The crab's chunky front half pokes out of the shell opening toward the left: darker blue body (#6fa9cf), short stubby legs, two mean narrow eyes on short stalks with heavy brows slanted into a hard glare, a grim down-turned mouth. One claw is HUGE and raised high, its pincer open wide with a jagged sawtooth inner edge; the small claw is held up like a fist, as if it wants a fight. The inside of the shell opening behind it is flat dark warm grey (#6b6461). Hunched and leaning forward, clearly ready to pinch hard. Turned three-quarters toward the LEFT. Element mark: one plump water droplet (pale blue #d4ecf9 with the same dark outline) sitting on the top tip of its shell. (The second image is only a style, color and size reference: do NOT draw that round crab.) Transparent background with a real alpha channel.

{{FOE_W1_TAIL}}
```

#### `foe_flying_fire` 송곳니 박쥐 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_flying_fire` · **크기**: 1024x1024 투명 · **감싸기**: ②, 끝 문장 있음
- **결과**: 둘째 판 채택. 첫 판(rejected1)은 털이 삐죽한 외곽선, 귓속 음영, 틀에 닿을 만큼 큰 날개로 기존 세트의 매끈한 둥근 외곽을 깼다.
  그래서 "Keep the body outline SMOOTH … NO fur tufts …" 끝 문장을 더했다.
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_FIRE`](#조각-mark_fire), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A round chubby bat monster of the SAME species as the second image (the body and head are one round fluffy ball, two big pointy ears, a plain cream oval belly #f6ebd5, two tiny feet), but this one is a mean little biter: two dot eyes under short heavy brows slanted into a glare, a wide open snarl showing TWO small pointed fangs, and its bat wings are now properly sized (each about as wide as its body), spread wide with pointed tips, in darker red-orange (#c96a43). Fur: soft red-orange (#e8875a). It swoops down toward the left mid-dive, as if about to nip. Turned three-quarters toward the LEFT. Element mark: {{MARK_FIRE}} head, between its ears, like a little tuft, no glow. Transparent background with a real alpha channel. Keep the body outline SMOOTH and clean like the second image: one simple round shape, NO fur tufts, NO fuzzy or jagged fur edges, no inner-ear color, no extra lines inside the wings except two or three simple ribs. The wings are each only about as wide as the body (not huge). Keep a wide empty margin on every side.

{{SAVE_KEEP}}
```

#### `foe_flying_earth` 돌 가고일 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_flying_earth` · **크기**: 1024x1024 투명 · **감싸기**: ②
- **결과**: 첫 판 채택. 몸 외곽이 조금 울퉁불퉁하지만 낙서풍 안이다.
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_EARTH`](#조각-mark_earth), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A small chubby stone gargoyle monster flapping in the air: a round squat body and a big round head in warm ochre brown (#c9995f) like carved sandstone (just two or three small crack lines, no texture), two short curved cream horns (#f6ebd5), pointed ears, a wide grin with a row of small pointed teeth, two narrow sly eyes under a heavy brow ledge, a short stubby tail with an arrow-shaped tip, small round arms with three short blunt claws on each hand reaching forward toward the left, stubby legs tucked under. Rigid stone bat wings in darker brown (#a8774e), spread wide with pointed tips. It hovers in a hunched, pouncing pose. Turned three-quarters toward the LEFT. Element mark: {{MARK_EARTH}} head, between its horns. (The second image is only a style, color and size reference: do NOT draw that bat.) Transparent background with a real alpha channel.

{{SAVE_KEEP}}
```

#### `foe_flying_wind` 칼깃 매 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_flying_wind` · **크기**: 1024x1024 투명 · **감싸기**: ②, 끝 문장 있음
- **결과**: 둘째 판 채택. 첫 판(rejected1)은 화풍은 맞았지만 날개 끝이 둥글고 부리가 작아 '화난 잉꼬'처럼 보였다. '확실히' 단계가 아니었다.
  그래서 "Make this one clearly the fiercest … blade-like feathers (sharp points, NOT rounded tips)" 끝 문장을 더했다.
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_WIND`](#조각-mark_wind), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A chubby round hawk monster in a fast attack dive: a plump round body and head as one shape in pale mint (#bfe6d2) with a cream chest (#f6ebd5), a big sharp hooked beak in yellow (#f3d36a), two fierce narrow eyes under a hard flat brow line that slants down toward the beak in a mean glare, a short fan tail. Its wings are spread wide and swept back, the wing tips made of a few long blade-like pointed feathers in darker mint (#8fcab0). Both feet thrust forward toward the left with talons wide open, each foot with three hooked dark grey claws (#6b6461). Two or three short teal speed lines (#5fa8a0) trail behind it on the right. It swoops down toward the left. Turned three-quarters toward the LEFT. Element mark: {{MARK_WIND}} head. (The second image is only a style, color and size reference: do NOT draw that bat.) Transparent background with a real alpha channel. Make this one clearly the fiercest of our flying monsters (still flat doodle, still chubby): the hooked beak is BIG and sharp, slightly open in a screech; the eyes are narrow angry slits under a hard V-shaped brow; each wing ends in three or four long, straight, sharply pointed blade-like feathers (sharp points, NOT rounded tips); the talons are long and hooked. Smooth clean outline, flat fills, no fur or feather texture.

{{SAVE_KEEP}}
```

#### `foe_spirit_water` 으름장 유령 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_spirit_water` · **크기**: 1024x1024 투명 · **감싸기**: ②
- **결과**: 첫 판 채택. 몸이 비치지 않는 한 가지 색이다("NOT see-through, no transparency, no glow"가 먹혔다).
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`GHOST_B`](#조각-ghost_b), [`MARK_WATER`](#조각-mark_water), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A small floating ghost monster of the SAME species as the second image (one soft round blob for the head and body like an upside-down gumdrop, the bottom tapering into a short wavy tail that curls toward the right instead of legs, two tiny stubby nub arms), but this one is trying hard to scare you: two dot eyes under short heavy brows slanted down into a glare, a wide jagged grin showing a row of small pointed teeth, both nub arms thrown up high above its head in a 'boo!' pose, the body leaning forward toward the left. Its body is ONE solid flat color, soft sky blue (#8ec8ee), {{GHOST_B}} {{MARK_WATER}} head. Transparent background with a real alpha channel.

{{SAVE_KEEP}}
```

#### `foe_spirit_wind` 회오리 귀신 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_spirit_wind` · **크기**: 1024x1024 투명 · **감싸기**: ②
- **결과**: 첫 판 채택. 민트 두 톤의 평면 띠다(픽셀로 확인).
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`MARK_WIND`](#조각-mark_wind), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A floating whirlwind spirit monster with no legs: its body is a short chubby tornado funnel, wide and round at the top and twisting down to a thin curling point at the bottom, made of three or four flat stacked swirl bands in pale mint (#bfe6d2) and darker mint (#8fcab0) with simple curved lines (solid flat fills, NOT see-through, no glow). A face on the wide top part: two narrow slanted angry eyes under heavy brows and a wide snarling mouth with two small pointed fangs. Two thin wispy arms made of wind curl out to the sides, each ending in three pointed claw-like tips, one reaching toward the left. Two short teal gust lines (#5fa8a0) whip around its body. It leans toward the left as if about to rush in. Turned three-quarters toward the LEFT. Element mark: {{MARK_WIND}} head. (The second image is only a style, color and size reference: do NOT draw that ghost.) Transparent background with a real alpha channel.

{{SAVE_KEEP}}
```

#### `foe_spirit_fire` 도깨비불 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `mon_spirit_fire` · **크기**: 1024x1024 투명 · **감싸기**: ②
- **결과**: 첫 판 채택. 열둘 가운데 가장 위협적이지만 여전히 하찮은 낙서다. 흠: 연기 덩어리에 외곽선이 없다.
- **조각**: [`FOE_W2_PRE`](#조각-foe_w2_pre), [`STYLE`](#조각-style), [`FOE_INTRO`](#조각-foe_intro), [`SAVE_KEEP`](#조각-save_keep)

```text
{{FOE_W2_PRE}}

Image prompt:
{{STYLE}} {{FOE_INTRO}} A floating will-o'-the-wisp fire spirit monster with no legs: one round chubby flame-shaped body in soft red-orange (#e8875a) with an inner flame shape in orange (#f2a65a) and a small yellow (#f3d36a) core, its top rising into three or four big flickering flame points like wild hair, its bottom tapering into a short flame tail curling toward the right (solid flat fills, NOT see-through, no glow, no gradient). A face in the middle: two narrow slanted angry dark eyes under heavy brows and a wide jagged grin full of small pointed teeth. Two little flame arms with three pointed flame fingers reach forward toward the left like grabbing claws. Two or three small flat dark smoke puffs (warm dark grey #6b6461, with outline) curl up off its top. It lunges toward the left with a wicked grin. Turned three-quarters toward the LEFT. Element mark: its own flame hair is the fire mark, so no separate mark. (The second image is only a style, color and size reference: do NOT draw that ghost.) Transparent background with a real alpha channel.

{{SAVE_KEEP}}
```

### 9.6 대형 보스 6종 `boss_*` (2026-10-13)

사용자(원문, 기획서 부록 B.19에도 있다):

> 보스몬스터급 몬스터는 새로 그려줘. 기존의 변형이 아닌 아예 좀 덩치가 큰 버전으로. 오우거, 오크 로드, 트윈헤드오우거, 가고일.
> 일일보스를 대형으로 할 생각이야. 스테이지도 50단위에서는 큰 보스가 나오고.
> (리치·요새 바위 거북 추가 제안에) 너의 추천으로 해줘. 리치, 요새 바위 거북

- 규칙: **기존 몬스터의 색만 바꾼 변형이 아닌 새 생물**, 속성 색이 없는 본래 색, 전투에서 용사 키의 약 2.2~2.6배.
- 두 번째 참조는 적다운 몬스터 한 장(선 굵기·채색 기준)이고, 프롬프트에 "do NOT copy … not a recolor"를 꼭 넣었다.
- 덩치감은 일부러 "SMALL head on a huge tall body (about 4 heads tall, NOT chibi)"로 냈다. 머리가 큰 판은 치비처럼 보여 버렸다.
- 처음 넷은 두 묶음으로 동시에 뽑았고, 리치와 거북은 따로 뽑았다. 그래서 감싸기가 다섯 가지다.

| 키 | 이름 | 크기 | 두 번째 참조 | 결과 |
|---|---|---|---|---|
| boss_ogre | 오우거 | 1024x1536 | foe_humanoid_earth | 둘째 판 채택, 뒤에 얼굴만 고침 (9.7) |
| boss_orc_lord | 오크 로드 | 1024x1536 (결과 1302x1208) | foe_humanoid_earth | 넷째 판(검수 때 새로 그림) 채택 |
| boss_twinhead_ogre | 트윈헤드 오우거 | 1536x1024 | foe_humanoid_earth | 첫 판 채택 |
| boss_gargoyle | 가고일 | 1024x1536 | foe_flying_earth | 둘째 판 채택 |
| boss_lich | 리치 | 1024x1536 | 첫 판 foe_spirit_fire → 둘째 판 boss_twinhead_ogre | 둘째 판 채택 |
| boss_fortress_turtle | 요새 바위 거북 | 1536x1024 | foe_armored_water | 둘째 판 채택, 뒤에 얼굴만 고침 (9.7) |

#### `boss_ogre` 오우거 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `foe_humanoid_earth` · **크기**: 1024x1536 투명
- **감싸기**: 블록의 첫 문단(지시문)과 끝 줄이 감싸기다. 가운데가 그림 프롬프트다.
- **결과**: 둘째 판 채택(1024x1536, 투명 65.7%). 첫 판(rejected1)은 잘 그렸지만 '화남'보다 '삐침'으로 읽혔고, 끈 버클·이빨 목걸이·바늘땀 같은 잔장식이 있었다.
  그래서 "Make it look clearly ANGRY and threatening, not sulky … no muscle lines, no stitches, no pendants, no belt buckle, no skulls, no bones"를 더했다. 근육선 몇 줄은 남았다.
  이 그림의 얼굴을 9.7절에서 '살짝 멍청하게' 고쳤다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_A`](#조각-boss_intro_a), [`SAVE_KEEP`](#조각-save_keep)

```text
Use your built-in image generation tool to create exactly ONE image, size 1024x1536 (portrait). Attached reference images, in order: 1) our doodle dwarf (style reference only, do not draw it), 2) an existing enemy monster of ours (reference for drawing style, outline weight and flat coloring only; do not copy or recolor that creature). Keep the whole creature inside the frame with an empty margin on all sides, nothing cropped. The background must be genuinely transparent: a real alpha channel in a PNG, no backdrop, no floor, no cast shadow, no glow; if the tool has a background parameter set it to transparent and keep the generated alpha. Do not edit, crop or post-process the image; just copy the generated file.

Image prompt:
{{STYLE}}

{{BOSS_INTRO_A}} A huge hulking ogre boss: very big round belly, tiny head with a single heavy unibrow and an underbite with two blunt teeth, thick sausage arms, a crude spiked wooden club as big as a hero dragged in one hand, a rough hide loincloth and one leather strap, bare feet, muddy grey-green skin. Lumbering and angry. Transparent background with a real alpha channel. Make it look clearly ANGRY and threatening, not sulky: it leans forward toward the left with its small head lowered, the unibrow pulled down hard into a deep V over two small glaring eyes, the underbite teeth bared in a snarl, the free hand clenched into a big fist. Keep the details minimal like the dwarf: no muscle lines, no stitches, no pendants, no belt buckle, no skulls, no bones.

{{SAVE_KEEP}}
```

#### `boss_ogre` 쓰지 않은 대안

- **참조**: 위와 같다 · **결과**: 1254x1254
- 검수 때 근육선 없이 통나무 곤봉을 머리 위로 든 오우거를 새로 그렸다(결과 좋음). 같은 때 얼굴 고치기 작업이 원래 그림을 쓰고 있어서 채택하지 않았다.
- 두 번째 참조의 디자인을 하나씩 금지한 문장("do NOT copy its design: no helmet, no horns, no tusks …")과 금지어 목록(NO muscle lines, NO pecs …)의 좋은 예다.
- **조각**: [`STYLE`](#조각-style)

```text
{{STYLE}}

The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail), but do NOT draw the dwarf or any person. The second attached image is one of our existing enemy monsters (a small tusked orc): match its drawing style, outline weight and flat coloring, but do NOT copy its design: no helmet, no horns, no tusks, no spiked shoulder plate, no stone club, no vest.

A big boss monster for the game, facing LEFT (body and face turned three-quarters toward the LEFT edge, glaring at the heroes on the left), a completely new creature drawn much bigger and heavier than the attached orc: a huge OGRE. Proportions: a tiny head on an enormous pear-shaped body (about 4 heads tall, NOT chibi), a giant round belly, very wide sloping shoulders, very long thick arms that hang down to its knees, short stumpy thick legs, big flat bare feet. Skin: muddy grey-green (#9aa58a) with a lighter cream-green belly patch (#c9cfae). Head: bald and lumpy, small round ears, one thick dark unibrow pulled down hard into a deep V over two small fierce dot eyes, a big wide underbite jaw with two short blunt square teeth poking up, the mouth open in a roaring snarl. Clothes: only a simple brown hide loincloth (#8a5a3a) with a ragged hem, held by a rope; nothing on the chest. Weapon: ONE whole small tree trunk used as a club (a thick brown log #8a5a3a with two stubby cut-off branch stumps and one little green leaf tuft), gripped in one huge fist and raised up over its shoulder ready to smash, the other hand a big clenched fist. Angry, heavy and a little silly, like a grumpy giant who just woke up. Keep the details minimal like the dwarf even though it is a boss: big flat color blocks, NO muscle lines, NO pecs, NO abs, NO body hair, NO stitches, NO straps, NO buckles, NO pendants, NO skulls, NO bones, no blood, no wounds. Thick dark brown outlines as thick as in the attached images. The whole monster fits inside the frame with clear empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects.

Save the generated image as boss_ogre.png in the current directory. Reply with only the saved file path.
```

#### `boss_orc_lord` 오크 로드 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `foe_humanoid_earth` · **결과 크기**: 1302x1208, 투명 60.5%
- **감싸기**: 없음. 이 블록이 보낸 글자 전부다.
- **결과**: 넷째 판 채택. 짙은 이끼색 피부, 대머리 상투, 작은 금관, 갈색 털망토, 무늬 없는 가슴판, 어깨에 멘 식칼 대검, 앞으로 내민 주먹.
  '엄니 오크를 업그레이드한 것'처럼 보이지 않게 두 번째 참조의 디자인을 하나하나 금지했다("do NOT copy its design: no horned helmet, no cream horns, no spiked shoulder plate, no stone club").
- 지나온 판:
  - rejected1: 갑옷에 해골 문양 둘과 리벳·판이 너무 많았다.
  - rejected2: 깔끔하고 귀여웠지만 머리가 커서 치비처럼 보여 덩치감이 없었다(더 귀여운 오크 로드를 원하면 대안이 된다).
  - rejected3(한때 채택): 회색 뿔 투구·크림색 뿔·회색 어깨판이 엄니 오크와 겹쳐 '업그레이드한 엄니 오크'로 보였다. 도끼가 자루 양끝에 날이 달린 이상한 모양이었고, 표정이 능글맞았다.
- **조각**: [`STYLE`](#조각-style)

```text
{{STYLE}}

The first attached image is our dwarf blacksmith and is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, same flat fills, same tiny amount of detail), but do NOT draw the dwarf or any person. The second attached image is one of our existing enemy monsters (a small tusked orc): match its drawing style, outline weight and flat coloring, but do NOT copy its design: no horned helmet, no cream horns, no spiked shoulder plate, no stone club.

A big boss monster for the game, facing LEFT (body and face turned three-quarters toward the LEFT edge, glaring at the heroes on the left), a completely new creature drawn much bigger and heavier than the attached orc: an ORC WARLORD, the king of the orcs. Proportions: a SMALL head on a huge, tall, heavy body (about 4 heads tall, NOT chibi), very wide shoulders, a big round chest, thick arms and thick short legs in a wide planted stance; it towers like a boss. Skin: dark moss green (#7f9a5a). Head: bald with one black topknot tied with a red band, a small plain golden-yellow iron crown (#d9b44a, a simple band with three blunt points) sitting on top, a heavy jutting jaw with two big upward cream tusks, a deep angry scowl: heavy brows pulled down hard into a V over two small fierce eyes, the mouth open in a shouting snarl. Body: a thick dark brown fur mantle (#6b4a33, a simple lumpy flat shape) over both shoulders, one big plain dark iron chest plate (#6f6a66) with no decoration, a wide brown leather belt, a short dark-red cloth skirt (#9c3b2e), bare feet. Weapon: ONE huge single-edged butcher-cleaver greatsword (a wide flat rectangular grey blade #b3aea8 with a square tip and one small notch, a short brown wrapped grip) held in one fist and resting on its shoulder, the other hand a big clenched fist held forward. Angry, heavy and a little silly, like a grumpy king. Keep the details minimal like the dwarf even though it is a boss: big flat color blocks, NO rivets, NO studs, NO buckles, NO pendants, NO earrings, NO patterns, NO muscle lines, NO skulls, NO bones, no blood, no wounds. Thick dark brown outlines as thick as in the attached images. The whole monster fits inside the frame with clear empty margin on all sides, nothing cropped. Transparent background with a real alpha channel: no backdrop, no ground, no floor shadow, no effects.

Save the generated image as boss_orc_lord.png in the current directory. Reply with only the saved file path.
```

#### `boss_orc_lord` rejected3 (버림)

- **감싸기**: `boss_ogre`와 같은 첫 묶음 감싸기. 아래는 그림 프롬프트만이다. 첫 판과 둘째 판의 프롬프트는 덮어써서 남지 않았다.
- 이 판의 "NO skulls"와 "SMALL head … about 4 heads tall"이 그 두 판을 고친 문장이다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_A`](#조각-boss_intro_a)

```text
{{STYLE}}

{{BOSS_INTRO_A}} An orc warlord boss: tall and broad, heavy iron armor plates on the shoulders and chest with a few blunt spikes, a big horned iron helmet with a crown-like rim, two large tusks, a long ragged dark-red cape, a huge double-headed battle axe held across the body, green-ochre skin, a commanding scowl. Clearly the leader of the orcs, not just a bigger orc. Transparent background with a real alpha channel. Proportions: a SMALL head on a huge tall body (the whole body is about 4 heads tall, not chibi), very wide armored shoulders, thick arms and thick legs, a tall wide stance; it towers over everyone like a boss. Important: NO skulls and NO bones anywhere (no skull emblems on the armor, belt or cape). Keep the details minimal like the dwarf even though it is a boss: a few large plain flat armor plates with NO rivets, NO studs, NO buckles, NO pendants, NO earrings, at most four blunt spikes in total, and the cape is one simple flat dark-red shape with just a few ragged notches along its bottom edge. Glaring toward the left with a deep angry scowl.
```

#### `boss_twinhead_ogre` 트윈헤드 오우거 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `foe_humanoid_earth` · **크기**: 1536x1024 투명
- **감싸기**: 그림 프롬프트 뒤에 `{{BOSS_W2_TAIL}}`("This boss will stand 2 to 3 times as tall as the heroes on screen …")이 붙는다.
- **결과**: 첫 판 채택. 왼쪽 머리는 입을 벌려 고함치고, 오른쪽 머리는 졸린 찡그림이다. 외곽선이 엄니 오크보다 조금 가늘고, 기워 붙인 천과 고리가 조금 많다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_A`](#조각-boss_intro_a), [`BOSS_W2_TAIL`](#조각-boss_w2_tail)

```text
{{STYLE}}

{{BOSS_INTRO_A}} A two-headed ogre boss: one massive body with TWO heads side by side that look different (one head shouting with an open mouth, the other head grumpy and sleepy with a squint), huge shoulders, a big stone hammer in one hand and a chunk of chain in the other, patched hide clothes, dusty purple-grey skin. Wide and heavy. Transparent background with a real alpha channel.

{{BOSS_W2_TAIL}}
```

#### `boss_gargoyle` 가고일 (채택)

- **참조**: 1) `d_dwarf_idle` 2) `foe_flying_earth` · **크기**: 1024x1536 투명 · **감싸기**: 트윈헤드와 같다, extra 있음
- **결과**: 둘째 판 채택. 첫 판(rejected1)은 만화책식 근육 해부(가슴·복근·힘줄), 가는 외곽선, 한쪽 눈만 보임, 하찮음보다 진지함이었다.
  그래서 "Important style fix: draw it as a chunky, rounded boulder of a beast, NOT a muscular comic-book monster … The dark brown outlines must be just as THICK …"를 더했다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_A`](#조각-boss_intro_a), [`BOSS_W2_TAIL`](#조각-boss_w2_tail)

```text
{{STYLE}}

{{BOSS_INTRO_A}} A big stone gargoyle boss (NOT the small stone gargoyle monster): a crouching muscular stone beast on all fours ready to pounce, large bat-like stone wings spread wide, curved horns, a heavy jaw with fangs, long clawed fingers gripping a broken stone pedestal, cracks drawn as simple lines on its grey-blue stone body, a tail ending in a spade tip, glowing yellow eyes drawn as flat shapes. Important style fix: draw it as a chunky, rounded boulder of a beast, NOT a muscular comic-book monster: big simple round lumpy shapes like the attached monsters, NO muscle lines, NO pecs, NO abs, NO bicep or tendon lines, only three or four short crack lines on the whole body. The dark brown outlines must be just as THICK as in the attached images. Its face is turned three-quarters toward the LEFT so BOTH flat yellow eyes show, under heavy angry brows, with a petty grumpy scowl showing a few blunt fangs. The wings, horns and tail stay well inside the frame with clear empty margin on every side. Transparent background with a real alpha channel.

{{BOSS_W2_TAIL}}
```

#### `boss_lich` 리치

- **감싸기**: 아래 지시문의 `$P` 자리에 그림 프롬프트가 들어간다. 둘째 판 때의 글자다. 첫 판 때는 두 번째 참조가 foe_spirit_fire였다.

```text
"Generate one image. Image size: 1024x1536 (portrait). Attached images in order: 1) the doodle dwarf (style reference only), 2) another big boss from the same game (style, line weight, coloring and boss scale reference only; do NOT draw an ogre). Image prompt: $P Save the generated image as $KEY.png in the current directory. Reply with only the saved file path."
```

**첫 판 (버림)**

- **참조**: 1) `d_dwarf_idle` 2) `foe_spirit_fire`. 그때 대형 보스 폴더가 비어 있어 적다운 영체를 썼다.
- **버린 이유**: 이빨 달린 진짜 해골 얼굴, 뼈 손, 그리고 참조(도깨비불)에서 옮아온 주황 눈·수정·룬. "bony pale face"라는 말과 불 속성 참조가 겹친 탓이다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_B`](#조각-boss_intro_b)

```text
{{STYLE}}

{{BOSS_INTRO_B}} A lich boss (spirit body type): a tall floating undead sorcerer whose lower body fades into a ragged wispy tail instead of legs, a hooded tattered robe in muted grey-violet, a bony pale face drawn simply (two glowing flat round eyes, no gore, more spooky-silly than horrifying), a tall crooked staff topped with a floating crystal, one hand raised casting with a few flat floating rune marks around it, a small crown on the hood. Menacing, ancient, but still a cute flat doodle. Neutral natural colors (no strong elemental tint). Transparent background with a real alpha channel.
```

**둘째 판 (채택)**

- **참조**: 1) `d_dwarf_idle` 2) `boss_twinhead_ogre`. 같은 대형 보스 세트로 선·채색·덩치를 맞췄다.
- **결과**: 1024x1536. 두건 그늘 속의 크림색 가면 얼굴, 작은 금관, 회보라 누더기 로브, 오른쪽으로 말린 꼬리, 크림색 룬 원. 해골과 피가 없고 중립색이다. 트윈헤드와 한 세트로 보인다.
- **고친 말**: "NOT a skull (no nose hole, no teeth, no jaw, no bones)", 손은 "mitten hands … (no bones, no claws)", 색은 "no orange, no red, no fire colors, no blue magic".
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_B`](#조각-boss_intro_b)

```text
{{STYLE}}

{{BOSS_INTRO_B}} A lich boss (spirit body type): a tall floating undead sorcerer built from big chunky rounded shapes, whose lower body fades into a ragged wispy tail instead of legs (the tail curls toward the right), a big hooded tattered robe in muted grey-violet with a few ragged points at the sleeves and hem, a small muted-gold crown on top of the hood. Its face is drawn very simply inside the dark shadow of the hood: a pale cream rounded face like a smooth mask, NOT a skull (no nose hole, no teeth, no jaw, no bones), just two big flat round pale eyes (flat pale cream fill with a tiny dark dot, no glow) under a heavy frowning brow line and a tiny grumpy mouth line, more spooky-silly than horrifying. Its hands are simple pale cream mitten hands with three thin fingers (no bones, no claws). One hand is raised and reaching toward the LEFT, casting, with a few flat floating rune marks around it (small pale cream circles, dots and short curved strokes with outlines, not letters). The other hand grips a tall crooked warm-brown wooden staff topped with a floating milky pale lavender-grey crystal. Body and face turned three-quarters toward the LEFT edge of the image (glaring at the heroes on the left). Menacing, ancient, but still a cute flat doodle, as chunky and plain as the second attached image. The whole creature fits inside the frame with empty margin on all sides, nothing cropped. Neutral natural colors (no strong elemental tint): no orange, no red, no fire colors, no blue magic; only muted grey-violet, cream, warm brown, soft grey and a little muted gold. Transparent background with a real alpha channel.
```

#### `boss_fortress_turtle` 요새 바위 거북

- **감싸기**: 그림 프롬프트 뒤에 아래 두 줄을 붙였다.

```text
Image size: 1536x1024 (landscape). Save the generated image as boss_fortress_turtle.png in the current directory. Reply with only the saved file path.
```

**첫 판 (버림)**

- **참조**: 1) `d_dwarf_idle` 2) `foe_armored_water`
- **버린 이유**: 몸 전체가 수십 개의 작은 벽돌로 쪼개지고 이끼가 약 20개라 '아주 적은 디테일' 규칙을 깼다. 게임 크기에서는 잡음이 된다. 탑도 네모였다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_B`](#조각-boss_intro_b)

```text
{{STYLE}}

{{BOSS_INTRO_B}} A fortress rock turtle boss (armored body type): a gigantic slow turtle whose shell is a small stone fortress (two short round towers with tiny pointed roofs and a little wall with crenellations on its back, a tiny closed wooden gate), thick stone-plated legs like pillars, a heavy beaked head with a stern frowning brow and small angry eyes, moss patches drawn as flat green blobs, grey-brown stone colors. Huge, heavy, wide. Neutral natural colors (no strong elemental tint). Transparent background with a real alpha channel.
```

**둘째 판 (채택)**

- **참조**: 같다
- **결과**: 1536x1024, 투명 49%. 매끈한 큰 돌판 몇 장, 둥근 크림색 탑 둘에 회색 원뿔 지붕, 이끼 셋. 이 그림의 얼굴을 9.7절에서 고쳤다.
- 첫 판의 글을 그대로 두고 끝 문단 하나("Keep the details very low … a FEW big smooth stone plates … only three or four small moss blobs in total")만 더했다.
- **조각**: [`STYLE`](#조각-style), [`BOSS_INTRO_B`](#조각-boss_intro_b)

```text
{{STYLE}}

{{BOSS_INTRO_B}} A fortress rock turtle boss (armored body type): a gigantic slow turtle whose shell is a small stone fortress (two short round towers with tiny pointed roofs and a little wall with crenellations on its back, a tiny closed wooden gate), thick stone-plated legs like pillars, a heavy beaked head with a stern frowning brow and small angry eyes, moss patches drawn as flat green blobs, grey-brown stone colors. Huge, heavy, wide. Neutral natural colors (no strong elemental tint). Transparent background with a real alpha channel.

Keep the details very low, like the second attached image: the turtle's shell, head and legs are made of a FEW big smooth stone plates (not many small bricks or cobbles), the two towers are ROUND with simple cone roofs, only three or four small moss blobs in total. Big simple readable shapes. The whole turtle fits inside the frame with empty margin on all sides.
```

### 9.7 얼굴만 '살짝 멍청하게' 고치기 (편집, 2026-10-13)

사용자(원문): "요새 바위 거북이랑 오우거의 얼굴만 좀 수정해줘 살짝 멍청하게"

- 방법: 고치기 전 원본을 `<key>.before_face.png`로 두고, **그 그림 한 장만** `-i`로 붙여 `{{FACE_EDIT}}` + 얼굴 지시로 보냈다.
  화풍 기준 드워프는 붙이지 않았다. 원본 자체가 화풍 기준이다. 판마다 출력 이름을 `face1`, `face2`, `face3`으로 했다.
- Codex는 **편집이라도 그림 전체를 새로 그린다**. 전체가 8~15 RGB 단계 밝아지고 테두리 번짐도 바뀐다.
  그래서 차이가 크면 고친 얼굴만 오려 원본에 붙였다(오우거). 차이가 작으면 그대로 썼다(거북).

#### `boss_ogre` face1 (버림)

- **버린 이유**: 크고 동그란 왕눈, 걱정스럽게 기운 눈썹, 빨간 입. 너무 만화 같다.
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} small eyes looking slightly in two different directions (a bit cross-eyed), the heavy unibrow raised in a confused way instead of angry, mouth hanging half open in a dopey way with the two blunt underbite teeth still visible. No drool. It should still read as a big, heavy boss ogre, just a bit dim-witted, not cute and not a full cartoon idiot. Do not make it scary. Transparent background with a real alpha channel. Save the generated image as boss_ogre.face1.png in the current directory. Reply with only the saved file path.
```

#### `boss_ogre` face2 (채택, 얼굴만 오려 붙임)

- **결과**: face2를 썼지만 그대로 쓰지 않았다. Codex가 그림 전체를 새로 그려 전체가 조금 밝아졌다.
  face2의 얼굴만 부드러운 타원 가장자리로 잘라 원본 위에 붙였다. 붙이기 전에 피부·외곽선·눈과 이빨의 크림색을 원본 색에 맞췄고,
  눈썹을 원본의 눈썹 갈색(약 80,52,32)으로 다시 어둡게 했다(Codex가 밝게 바꿨다). 얼굴 밖은 원본과 픽셀까지 같다.
- 새 얼굴: 성난 V 대신 평평한 외눈썹 하나, 반쯤 감긴 작은 눈의 눈동자가 서로 다른 쪽, 반쯤 벌린 입(속은 짙은 갈색), 아래 송곳니 둘은 그대로.
- face1을 고친 말: 눈은 "SMALL … NOT big round googly eyes", 눈썹은 "raised, puzzled, blank … (not a sad or worried slant)", 입속은 "dark brown (no bright red or pink)", 정도는 "only slightly dumb, not cute, not a full cartoon idiot, not scared".
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} keep the eyes SMALL, about the same small size as in the original (small narrow eyes with tiny dot pupils, NOT big round googly eyes), with the two pupils pointing slightly in different directions (a bit cross-eyed); keep the ONE heavy dark-brown unibrow block but lift it up into a raised, puzzled, blank shape instead of the angry V (not a sad or worried slant); the jaw hangs slack with the mouth half open in a dopey way, the mouth inside dark brown (no bright red or pink), and the two blunt underbite teeth still poking up from the lower lip. The overall look is dim-witted and vacant, like he just forgot what he was doing. It must still read as a big, heavy boss ogre — only slightly dumb, not cute, not a full cartoon idiot, not scared. Do not make it scary. Transparent background with a real alpha channel. Save the generated image as boss_ogre.face2.png in the current directory. Reply with only the saved file path.
```

#### `boss_ogre` face3 (버림)

- **버린 이유**: 눈썹이 가는 물결선이 됐고, 처진 눈이 멍청하기보다 슬프거나 졸려 보였고, 배경 테두리 번짐이 넓어졌다.
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} small eyes with heavy, half-lowered upper lids and tiny dot pupils that point slightly in two different directions (a bit cross-eyed, vacant stare); ONE thick continuous unibrow in the SAME dark chocolate brown as the original eyebrow (not lighter), lifted up off the eyes and gently arched upward in the middle like a puzzled 'huh?' (not angry, not sad); the jaw hangs slack with the mouth half open in a dopey way, the inside of the mouth dark brown (no red or pink tongue), and the two blunt underbite teeth still poking up from the lower lip. Dim-witted and blank, like he just forgot what he was doing. It must still read as a big, heavy boss ogre — only slightly dumb, not cute, not a full cartoon idiot, not scared. Do not make it scary. Transparent background with a real alpha channel. Save the generated image as boss_ogre.face3.png in the current directory. Reply with only the saved file path.
```

#### `boss_fortress_turtle` face1 (채택, 그대로 씀)

- **감싸기**: 아래 글 뒤에 "Save the generated image as boss_fortress_turtle.face<n>.png in the current directory. Reply with only the saved file path."를 붙였다.
- **결과**: 그대로 썼다. 얼굴 밖은 외곽선의 1px 미만 흔들림뿐이고, 배·목의 크림색이 약 8단계 밝아진 정도라 오려 붙이지 않았다.
  새 얼굴: 반쯤 감긴 심드렁한 눈, 한쪽 눈썹이 조금 높음, 조금 벌린 부리에 분홍 혀끝.
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} the stern frown replaced by a blank dopey look: small round eyes half-lidded and a bit unfocused, one brow slightly higher than the other, the beak hanging a little open with the tip of a small tongue showing, still grumpy-ish but clearly not very bright. Do not make it scary. Keep the castle, shell plates, moss, legs and tail untouched. Transparent background with a real alpha channel.
```

#### `boss_fortress_turtle` face2 (버림)

- **버린 이유**: 돌 눈썹은 남았지만 흰자가 크림색이 되어 작게 보면 눈이 안 읽혔고, 크림색 부분이 약 15단계 밝아졌다.
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} the stern frown replaced by a blank dopey look. Keep the heavy grey stone brow slabs over the eyes (same shape and size as now), but tilt them so one sits slightly higher than the other instead of an angry V. Under them, small round eyes, half-lidded, with tiny pupils that look slightly in different directions so the gaze is a bit unfocused and vacant. The beak hangs a little open in a slack, blank way with the tip of a small pink tongue showing. Still a big grumpy-ish boss, but clearly not very bright. Do not make it scary and do not make it cute or babyish. Keep the head outline, the beak shape, the castle, shell plates, moss, legs and tail untouched. Transparent background with a real alpha channel.
```

#### `boss_fortress_turtle` face3 (버림)

- **버린 이유**: 크게 뜬 눈이 서로 다른 쪽을 보고 혀가 늘어져 '살짝'보다 많이 멍청했다. 크림색과 꼬리가 약 11단계 밝아졌다. 더 멍청하게를 원하면 다음 후보다.
- **조각**: [`FACE_EDIT`](#조각-face_edit)

```text
{{FACE_EDIT}} the stern frown replaced by a blank dopey look. Keep the two heavy grey stone brow slabs over the eyes with the same shape, size and color as now, but tilt them so one sits slightly higher than the other instead of an angry V. Under them, small round eyes with pure white eye whites (same white as now), half-lidded, with tiny dark pupils that look slightly in different directions so the gaze is a bit unfocused and vacant. The beak hangs a little open in a slack, blank way with the tip of a small pink tongue showing. Still a big grumpy-ish boss, but clearly not very bright. Do not make it scary and do not make it cute or babyish. Do not recolor or brighten anything: the cream of the beak, neck and belly, its soft shading, the grey stone and the green moss must keep exactly their current tones. Keep the head outline, the beak shape, the castle, shell plates, moss, legs and tail untouched. Transparent background with a real alpha channel.
```

### 9.8 그때의 지시문 두 가지

#### 용사 예제 10명의 감싸기 (2026-10-13)

사용자(원문): "5.지금 그림체로 영웅들 그림 예제를 그려줘 아직 넣을곳은 없는데 그림체를 보고싶어서. 10종류정도 뽑아줘."
그림 프롬프트는 6.2절에 있다. 이 감싸기만 매니페스트에 없어 옮긴다. 참조는 `d_dwarf_idle` 하나다. 지금 gen.ts 감싸기의 원형이다.

```text
export function taskFor(key) {
  const hero = HEROES[key];
  if (!hero) throw new Error(`unknown key ${key}`);
  return [
    `Use your built-in image generation tool (image_gen) to create exactly ONE image, then save it as ${key}.png in the current directory.`,
    '- Size: 1024x1536 (portrait). If the tool has a size parameter, use this size.',
    '- Background: TRANSPARENT, a real alpha channel in a PNG, no backdrop at all. If the tool has a background parameter, set it to transparent.',
    '- Attached reference image: the dwarf style reference. Use it as the image prompt says.',
    `- Generate once, then copy the generated file from where the tool saved it to ./${key}.png. Do not edit, crop, resize or post-process it, and do not create any other files.`,
    '',
    'Image prompt:',
    `${STYLE}\n\n${REF_NOTE}\n\n${COMMON}\n\n${hero}`,
    '',
    `Save the generated image as ${key}.png in the current directory. Reply with only the saved file path.`,
  ].join('\n');
```

#### gen.ts가 실제로 보낸 글자 전체 (예: `icons/status_fast`, 2026-10-14)

매니페스트 항목은 gen.ts가 0.2절의 꼴로 감싸 표준 입력으로 보낸다. 아래가 실제 기록이다 (참조: `d_dwarf_idle`, `icons/element_water`).
조각으로 줄이지 않았다. 감싸기와 조각을 모두 푼 최종 글자가 어떻게 생겼는지 보는 예다.

```text
Use your built-in image generation tool (image_gen) to create exactly ONE image, then save it as status_fast.png in the current directory.
- Size: 1024x1024 (square). If the tool has a size parameter, use this size or the closest supported one.
- Background: TRANSPARENT, a real alpha channel in a PNG, no backdrop at all. If the tool has a background parameter, set it to transparent.
- Attached reference images, in order: 1) d_dwarf_idle, 2) icons/element_water. Use them as the image prompt says.
- Generate once, then copy the generated file from where the tool saved it to ./status_fast.png. Do not edit, crop, resize or post-process it, and do not create any other files.

Image prompt:
Super simple flat doodle cartoon in EXACTLY the same style as the attached dwarf character image: thick, slightly uneven hand-drawn dark brown outlines, flat colors, NO shading, NO gradients, NO texture, NO highlights, very few details, simple round chunky shapes, cute and silly (the Korean "hachanhan" meme vibe), warm cozy palette (cream, warm brown, soft grey, soft orange, a little muted). No text, no letters, no numbers, no watermark, no signature.

The first attached image (a doodle dwarf character) is a STYLE REFERENCE ONLY: copy its drawing style exactly (same thick dark brown outline weight, flat fills, tiny amount of detail), but do NOT draw the dwarf or any person; draw only what is asked below.

The second attached image is another icon from the same game UI icon set. Match it exactly in drawing style, outline weight and how big the shape sits in the frame (same scale and margin, centered), so all the icons look like one set. Do NOT redraw that icon; draw only the new icon described below.

A small game UI icon that must read clearly at 24px: one simple bold shape, centered, filling about three quarters of the square canvas with a comfortable empty margin on every side, nothing cut off. Transparent background with a real alpha channel: no backdrop, no badge or circle behind it, no ground shadow, no glow. Draw it with the same VERY fat, bold dark brown marker outline as the dwarf, one flat color per part (no lighter or darker patches, no shading, no gradient, no glossy shine), and at most one or two inner lines. No face.

Speed-up status icon: the round head of a little bunny seen from the front with two tall upright rounded ears, in one flat cream white (#fbf7ef) with soft pink (#f2b8b0) inner ears, and three short straight horizontal speed lines in flat warm orange (#f2a65a) trailing off its left side. Nothing else.

Reply with only the saved file path.
```

사용자(원문, 2026-10-14): "일관적인 Ui디자인을 위해 코덱스 이미지생성이 필요하면 써"

## 10. 조각 찾아보기

이 파일의 모든 조각이다. 이름을 누르면 원문으로 간다. '쓰는 곳'은 그 조각을 쓰는 프롬프트 블록의 수다.

| 조각 | 실린 곳 | 쓰는 곳 | 글자 수 | 무엇 |
|---|---|---|---|---|
| [`STYLE`](#조각-style) | 0.4 공용 | 212 | 455 | 화풍 머리말(D 화풍). |
| [`STYLE_REF_ONLY`](#조각-style_ref_only) | 0.4 공용 | 78 | 256 | 드워프는 화풍만 따르고 그리지 말라는 안내. |
| [`DWARF_SAME`](#조각-dwarf_same) | 1.1 scene | 10 | 526 | 드워프 자세 다섯 장의 앞말(참조 d_dwarf_idle 하나). |
| [`SCENE_PROP_TAIL`](#조각-scene_prop_tail) | 1.1 scene | 3 | 427 | 공방 소품(풀무·물통·달군 쇠)의 끝 문단. |
| [`WEAPON_TAIL`](#조각-weapon_tail) | 1.1 scene | 4 | 426 | 완성 무기의 끝 문단: 굵은 마커 외곽선, 광택·장식 없음, 틀의 약 70%. |
| [`FRAME_SAME`](#조각-frame_same) | 2.1 ui | 4 | 149 | 카드 틀 네 장의 앞말(두 번째 참조 @frame_progress). |
| [`FRAME_BODY`](#조각-frame_body) | 2.1 ui | 5 | 529 | 카드 틀 다섯 장이 같이 쓰는 생김새 문단. |
| [`FIRE_SAME`](#조각-fire_same) | 2.1 ui | 7 | 68 | 화로 상태 아이콘 여섯 장의 앞말(두 번째 참조 @fire_normal). |
| [`CARD_FRAMING`](#조각-card_framing) | 3.1 cards | 35 | 265 | 카드 일러스트 구도. |
| [`CARD_DWARF`](#조각-card_dwarf) | 3.1 cards | 17 | 115 | 드워프가 나오는 카드 장면의 첫 말. |
| [`CARD_DWARF_KEEP`](#조각-card_dwarf_keep) | 3.1 cards | 16 | 295 | 드워프 생김새를 고정하는 문장. |
| [`BG_PROCESS`](#조각-bg_process) | 3.1 cards | 5 | 142 | 공정 카드 배경(#F2B279). |
| [`BG_QUALITY`](#조각-bg_quality) | 3.1 cards | 4 | 144 | 품질 카드 배경(#BFDDEB). |
| [`BG_SUPPORT`](#조각-bg_support) | 3.1 cards | 9 | 146 | 보조 카드 배경(#CBE6C1). |
| [`BG_IMPRINT`](#조각-bg_imprint) | 3.1 cards | 4 | 144 | 각인 카드 배경(#D8CBEA). |
| [`BG_MATERIAL`](#조각-bg_material) | 3.1 cards | 5 | 44 | 재료 카드 배경. |
| [`BG_LEGEND`](#조각-bg_legend) | 3.1 cards | 6 | 191 | 전설 재료 카드 배경(금색에 보라 원 하나). |
| [`OPAQUE_OBJECTS`](#조각-opaque_objects) | 3.1 cards | 11 | 188 | 재료·전설 재료 카드의 끝: 불투명, 사물만. |
| [`SAME_ITEM_SET`](#조각-same_item_set) | 4.1 refine | 10 | 299 | 정제 아이콘의 두 번째 참조(ore_iron) 안내. |
| [`SAME_UI_SET`](#조각-same_ui_set) | 4.1 refine | 1 | 289 | 버튼 세트의 두 번째 참조(ui/btn_reheat) 안내. |
| [`ALPHA_MARGIN`](#조각-alpha_margin) | 4.1 refine | 14 | 152 | 투명 배경과 여백(정제 그림 모두). |
| [`ITEM_TAIL`](#조각-item_tail) | 4.1 refine | 10 | 157 | 정제 아이콘의 끝: 부위마다 평면 한 색, 철광석과 같은 크기. |
| [`TOWN_SAME_FORGE`](#조각-town_same_forge) | 5.1 town | 9 | 390 | 첫 회차 건물과 물의 탑의 두 번째 참조(대장간) 안내. |
| [`TOWN_SAME_TOWER`](#조각-town_same_tower) | 5.1 town | 3 | 330 | 불·땅·바람의 탑의 두 번째 참조(물의 탑) 안내. |
| [`TOWN_SAME_STALLS`](#조각-town_same_stalls) | 5.1 town | 3 | 305 | 둘째 회차 광장 소품의 두 번째 참조(시장 노점) 안내. |
| [`TOWN_VIEW_FORGE`](#조각-town_view_forge) | 5.1 town | 12 | 663 | 시점: 대장간(첫 판)처럼 조금 돌려 문 벽이 왼쪽 아래를 본다. |
| [`TOWN_VIEW_TURNED`](#조각-town_view_turned) | 5.1 town | 4 | 648 | 시점: 두 번째 참조처럼 조금 돌려. |
| [`TOWN_VIEW_FRONT`](#조각-town_view_front) | 5.1 town | 1 | 543 | 시점: 정면 대칭(마을 문만). |
| [`TOWN_VIEW_MAP`](#조각-town_view_map) | 5.1 town | 1 | 184 | 시점: 지도 바닥. |
| [`TOWN_FRAME`](#조각-town_frame) | 5.1 town | 17 | 219 | 투명 배경, 여백, 간판에 글자 없음(건물·탑과 둘째 회차 소품의 끝). |
| [`TOWN_PROP_REF_ONLY`](#조각-town_prop_ref_only) | 5.1 town | 10 | 259 | 첫 회차 소품의 참조 안내(STYLE_REF_ONLY와 끝 낱말만 다르다). |
| [`TOWN_PROP_SAME_TREE`](#조각-town_prop_same_tree) | 5.1 town | 9 | 264 | 첫 회차 소품의 두 번째 참조(둥근 나무) 안내. |
| [`TOWN_PROP_FRAMING`](#조각-town_prop_framing) | 5.1 town | 10 | 770 | 첫 회차 소품의 구도: 지도에 작게 놓으므로 "EVEN FEWER details than usual and BOLD, thick outlines". |
| [`TOWER_SAME_KIND`](#조각-tower_same_kind) | 5.1 town | 3 | 109 | 불·땅·바람의 탑 본문의 첫 말. |
| [`TOWER_RETHEME`](#조각-tower_retheme) | 5.1 town | 3 | 275 | 불·땅·바람의 탑: 물의 탑과 같은 짜임에 색과 주제만 바꾼다. |
| [`HERO_STYLE`](#조각-hero_style) | 6.1 heroes | 10 | 398 | 용사 예제의 화풍 머리말(STYLE에서 팔레트 괄호와 "no signature"를 뺀 판). |
| [`HERO_REF_NOTE`](#조각-hero_ref_note) | 6.1 heroes | 10 | 335 | 용사 예제: 드워프는 화풍 참조일 뿐이라는 안내. |
| [`HERO_COMMON`](#조각-hero_common) | 6.1 heroes | 8 | 971 | 용사 예제의 공통 문단(여덟 명). |
| [`HERO_COMMON_V1`](#조각-hero_common_v1) | 6.1 heroes | 2 | 718 | 공통 문단의 첫 판(네아, 오델). |
| [`ROSTER_B1_REF`](#조각-roster_b1_ref) | 6.1 heroes | 9 | 579 | 명단 묶음 1(특급 9명)의 참조 안내. |
| [`ROSTER_B1_COMMON`](#조각-roster_b1_common) | 6.1 heroes | 9 | 939 | 명단 묶음 1의 공통 문단. |
| [`ROSTER_B2_REF`](#조각-roster_b2_ref) | 6.1 heroes | 7 | 605 | 명단 묶음 2(특급 5, 일반 2)의 참조 안내. |
| [`ROSTER_B2_COMMON`](#조각-roster_b2_common) | 6.1 heroes | 7 | 887 | 명단 묶음 2의 공통 문단. |
| [`ROSTER_B2_SPECIAL`](#조각-roster_b2_special) | 6.1 heroes | 5 | 176 | 명단 묶음 2의 특급 등급 문단. |
| [`ROSTER_B2_NORMAL`](#조각-roster_b2_normal) | 6.1 heroes | 2 | 118 | 명단 묶음 2의 일반 등급 문단. |
| [`ROSTER_B3_REF`](#조각-roster_b3_ref) | 6.1 heroes | 6 | 564 | 명단 묶음 3(일반 6명)의 참조 안내. |
| [`ROSTER_B3_COMMON`](#조각-roster_b3_common) | 6.1 heroes | 6 | 790 | 명단 묶음 3의 공통 문단. |
| [`ROSTER_B4_REF`](#조각-roster_b4_ref) | 6.1 heroes | 4 | 671 | 명단 묶음 4(검토 때 다시 그린 넷)의 참조 안내. |
| [`ROSTER_B4_COMMON`](#조각-roster_b4_common) | 6.1 heroes | 4 | 1022 | 명단 묶음 4의 공통 문단. |
| [`SPECIAL_ONE_IDEA`](#조각-special_one_idea) | 6.1 heroes | 10 | 161 | 특급 등급 문단(묶음 1·4): 기억에 남는 실루엣 하나, 그래도 다른 용사만큼 단순하게. |
| [`NORMAL_TAIL`](#조각-normal_tail) | 6.1 heroes | 9 | 73 | 일반 용사의 생김새 끝 문장(묶음 3·4: 등급 문단 대신). |
| [`MON_REF_NOTE`](#조각-mon_ref_note) | 7.1 monsters | 27 | 294 | 드워프는 화풍 참조일 뿐이라는 안내(몬스터 모두). |
| [`MON_COMMON`](#조각-mon_common) | 7.1 monsters | 25 | 840 | 귀여운 몬스터 공통 문단: 왼쪽을 보고, 귀엽고 해롭지 않게("NOT scary"). |
| [`MON_SAME_SPECIES`](#조각-mon_same_species) | 7.1 monsters | 12 | 436 | 불·땅·바람 변형: 같은 체형의 물 변형(두 번째 참조)과 같은 몸에 색과 표식만 바꾼다. |
| [`CRAB_ONE_COLOR`](#조각-crab_one_color) | 7.1 monsters | 4 | 167 | 동글게 넷의 끝 문장. |
| [`FLOOR_BOSS_NOTE`](#조각-floor_boss_note) | 7.1 monsters | 4 | 466 | 층 보스: 두 번째 참조(같은 체형의 물 변형)에서 모양만 따르고 색과 물방울은 따르지 않는다. |
| [`FLOOR_BOSS_FRAME`](#조각-floor_boss_frame) | 7.1 monsters | 4 | 113 | 층 보스의 크기 줄. |
| [`DAILY_BOSS_FRAME`](#조각-daily_boss_frame) | 7.1 monsters | 5 | 247 | 일일 보스의 크기 줄: 전투 화면을 크게 채운다. |
| [`GOBLIN_A`](#조각-goblin_a) | 7.1 monsters | 4 | 322 | 냄비 고블린 생김새의 앞(속성 넷이 같다). |
| [`GOBLIN_B`](#조각-goblin_b) | 7.1 monsters | 4 | 321 | 냄비 고블린 생김새의 뒤. |
| [`CRAB_A`](#조각-crab_a) | 7.1 monsters | 4 | 107 | 동글게 생김새의 앞. |
| [`CRAB_B`](#조각-crab_b) | 7.1 monsters | 4 | 376 | 동글게 생김새의 뒤. |
| [`BAT_A`](#조각-bat_a) | 7.1 monsters | 4 | 107 | 통통박쥐 생김새의 앞. |
| [`BAT_B`](#조각-bat_b) | 7.1 monsters | 4 | 165 | 통통박쥐 생김새의 가운데. |
| [`BAT_C`](#조각-bat_c) | 7.1 monsters | 4 | 207 | 통통박쥐 생김새의 뒤. |
| [`GHOST_A`](#조각-ghost_a) | 7.1 monsters | 4 | 330 | 꼬마 유령 생김새의 앞. |
| [`GHOST_B`](#조각-ghost_b) | 7.1 monsters | 5 | 171 | 꼬마 유령 생김새의 뒤. |
| [`MARK_WATER`](#조각-mark_water) | 7.1 monsters | 6 | 92 | 물 속성 표식(물방울). |
| [`MARK_FIRE`](#조각-mark_fire) | 7.1 monsters | 6 | 102 | 불 속성 표식(작은 불꽃). |
| [`MARK_EARTH`](#조각-mark_earth) | 7.1 monsters | 9 | 115 | 땅 속성 표식(새싹 난 조약돌). |
| [`MARK_WIND`](#조각-mark_wind) | 7.1 monsters | 7 | 99 | 바람 속성 표식(소용돌이). |
| [`ICON_SAME_SET`](#조각-icon_same_set) | 8.1 icons | 21 | 299 | 아이콘 세트의 두 번째 참조 안내. |
| [`ICON_FRAME`](#조각-icon_frame) | 8.1 icons | 22 | 539 | 아이콘 모두: 24px에서 읽히는 굵은 한 덩어리, 투명 배경, 뒤판·광택·그림자·얼굴 없음. |
| [`STYLE_V1`](#조각-style_v1) | 9.0 기록 | 2 | 468 | 버린 v1 화풍(슬레이 더 스파이어식 페인터리)의 머리말. |
| [`SD_ABC_COMMON`](#조각-sd_abc_common) | 9.0 기록 | 3 | 443 | SD 후보 A·B·C의 공통 문단(페인터리 드워프를 -i로 붙였다). |
| [`SD_DG_COMMON`](#조각-sd_dg_common) | 9.0 기록 | 4 | 479 | SD 후보 D·E·F·G의 공통 문단(참조 없이 글로만). |
| [`FOE_INTRO`](#조각-foe_intro) | 9.0 기록 | 12 | 147 | 적다운 몬스터 감싸기 ①·②에서 생김새 앞에 붙인 말. |
| [`FOE_W1_TAIL`](#조각-foe_w1_tail) | 9.0 기록 | 8 | 715 | 적다운 몬스터 감싸기 ①·③의 끝(그림 프롬프트 뒤에 붙인 Codex 지시문). |
| [`FOE_W2_PRE`](#조각-foe_w2_pre) | 9.0 기록 | 6 | 550 | 적다운 몬스터 감싸기 ②의 앞(그림 프롬프트 앞에 둔 Codex 지시문). |
| [`SAVE_KEEP`](#조각-save_keep) | 9.0 기록 | 7 | 144 | 저장 줄. |
| [`FOE_COMMON`](#조각-foe_common) | 9.0 기록 | 2 | 1207 | 적다운 몬스터 공통 문단(설계 파일 list.json의 common). |
| [`FOE_SECOND_REF`](#조각-foe_second_ref) | 9.0 기록 | 2 | 412 | 적다운 몬스터의 두 번째 참조 안내(list.json의 refNote2). |
| [`BOSS_INTRO_A`](#조각-boss_intro_a) | 9.0 기록 | 4 | 223 | 대형 보스 첫 넷의 생김새 앞말. |
| [`BOSS_INTRO_B`](#조각-boss_intro_b) | 9.0 기록 | 4 | 164 | 리치·요새 바위 거북의 생김새 앞말. |
| [`BOSS_W2_TAIL`](#조각-boss_w2_tail) | 9.0 기록 | 2 | 1294 | 대형 보스 둘째 묶음(트윈헤드, 가고일)의 감싸기 끝. |
| [`FACE_EDIT`](#조각-face_edit) | 9.0 기록 | 6 | 308 | 얼굴만 고치는 편집의 앞말. |
