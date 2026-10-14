# art-kit: 낙서풍(D 화풍) 그림을 Codex로 똑같이 뽑는 키트

'용사의 대장간'의 그림(게임에 들어간 204장과 아직 넣지 않은 몬스터·보스 18장)을 그린 방법을 다른 프로젝트로 옮기기 쉽게 한 폴더에 모았다.
**이 폴더를 통째로 복사하면** 같은 화풍(굵은 갈색 외곽선, 평면 채색, 음영 없음, 하찮고 귀엽게)으로
Codex CLI의 이미지 생성을 써서 계속 그릴 수 있다. 게임 코드는 들어 있지 않고 npm 패키지도 쓰지 않는다.

![기준 그림](ref/d_dwarf_idle.png)

## 무엇이 있나

| 경로 | 내용 |
|---|---|
| [`ART_STYLE_GUIDE.md`](ART_STYLE_GUIDE.md) | **본 안내서.** 화풍 정의, Codex에 보내는 지시문 원문, 프롬프트 조립 순서, 범주별 템플릿, 참조 그림 전략, 크기·투명, 후처리, 검수, 이 게임에서 겪은 일과 교훈, 새 프로젝트에서 실제로 해 본 예(9.8) |
| [`PROMPTS.md`](PROMPTS.md) | 이 게임에서 실제로 쓴 프롬프트 전부 (그림마다 최종 원문, 크기·투명·참조·메모). 매니페스트 밖에서 손으로 보낸 프롬프트(화풍 후보, 적다운 몬스터, 대형 보스, 얼굴 편집)도 있다 |
| [`ref/`](ref/README.md) | 참조 그림 16장. 화풍 기준 드워프 셋(`d_dwarf_idle.png`는 **모든 그림의 첫 참조**)과 범주마다 세트의 기준 그림. 표는 `ref/README.md` |
| `tools/` | 도구 (Node + 헤드리스 크롬 + Codex CLI, npm 패키지 없음) |
| `tools/init.ts` | 새 프로젝트의 **프로젝트 파일**(`art-assets.ts`: 그림 목록과 폴더)을 키트 밖에 만든다. 한 번만 |
| `tools/manifest.ts` | 화풍 머리말(STYLE)과 공통 문단(원래 게임과 글자까지 같다), 범주별 도움 함수, 예제 19개. **고치지 않는다** (프로젝트 파일이 import해 쓴다) |
| `tools/gen.ts` | 뽑기: `codex exec`를 띄워 참조를 붙이고 프롬프트를 보낸다 → `<원본 폴더>/<그룹>/<key>.png` |
| `tools/inspect.ts` | 원본 검사: 알파, 모서리, 여백, 외곽선 굵기 |
| `tools/sheet.ts` | 비교 시트: 여러 장을 크림색 바탕 한 장에 (기준 그림을 첫 칸에) |
| `tools/process.ts` | 다듬기: 알파 정리, 여백 자르기, 줄이기, WebP → `<출력 폴더>/<그룹>/<key>.webp`, `meta.json` |
| `tools/chrome.ts`, `tools/common.ts` | 크롬 띄우기, 공용 (프로젝트 파일 읽기, 폴더, 인자, 그림 머리 읽기) |
| `samples/` | 지금 그림을 모은 시트 11장과, 새 프로젝트에서 키트만으로 뽑아 본 예 (`samples/new-project-examples/`) |

## 준비물

- **Codex CLI**, 로그인한 상태 (`npm i -g @openai/codex`, `codex login`). 이 게임은 codex-cli 0.162.0을 썼다.
  - 내장 이미지 생성 도구를 쓴다: `codex features list`에서 `image_generation`이 `true`여야 한다 (0.162.0은 기본으로 켜져 있다).
  - `OPENAI_API_KEY`는 필요 없다. Codex의 출력 기록에 이미지 스킬 설명이 들어가는데, 거기 나오는 `OPENAI_API_KEY` 이야기는 쓰지 않는 다른 길(CLI 대체 경로)의 것이라 무시한다.
  - 모델은 `~/.codex/config.toml`의 것을 쓴다. 이 게임은 `model = "gpt-6.1-sol"`, `model_reasoning_effort = "medium"`이었다.
    다른 모델·버전·계정에서는 결과가 조금 다를 수 있으니 처음에 '시험 한 장'(아래)을 뽑아 비교한다. `--model`로 바꿀 수 있다.
- **Node 22.6 이상.** `.ts`를 바로 돌린다 (타입 지우기).
  - Node 22.18 이상, 23.6 이상: 그대로 `node tools/gen.ts ...`
  - Node 22.6~22.17: `node --experimental-strip-types tools/gen.ts ...`
- **Chrome 또는 Edge** (`process.ts`, `sheet.ts`가 헤드리스로 띄워 그림을 디코딩·인코딩한다). 흔한 설치 위치에서 찾는다.
  못 찾으면 `--chrome <경로>` 또는 환경 변수 `CHROME_PATH`.
- (선택) ffmpeg. 도구는 쓰지 않는다. 손으로 초록 바탕에 얹어 보거나(투명 확인) 동작 영상을 자를 때만.

## 새 프로젝트에 넣기

키트 폴더와 **프로젝트 파일**을 나란히 둔다. 키트는 고치지 않고, 그 프로젝트의 그림 목록과 폴더는 프로젝트 파일에만 적는다.
그래야 키트를 새 판으로 통째로 바꿔도 그림 목록과 원본이 남는다.

```text
<프로젝트>/tools/
  art-kit/            이 키트. 안의 파일은 고치지 않는다 (새 판이 나오면 폴더째 바꾼다)
  art-assets.ts       프로젝트 파일: 그림 목록 PROJECT_ASSETS, 폴더 PROJECT_DIRS (init.ts가 만든다)
  art-raw/<그룹>/     Codex 원본 PNG (지우지 않는다. 백업한다)
  art-out/            다듬은 WebP와 meta.json (게임 에셋 폴더로 바꿔도 된다)
```

1. `art-kit/` 폴더를 통째로 복사한다 (예: `<프로젝트>/tools/art-kit/`). `ref/`를 빼면 화풍이 이어지지 않는다.
2. 키트 폴더에서 프로젝트 파일을 만든다:

   ```bash
   cd <프로젝트>/tools/art-kit
   node tools/init.ts                                    # → ../art-assets.ts (원본 ../art-raw, 출력 ../art-out)
   node tools/init.ts --out ../../src/assets/art         # 출력을 게임 에셋 폴더로 바로 (경로는 지금 폴더 기준으로 준다)
   ```

   도구(`gen.ts`, `process.ts`)는 키트 폴더 옆의 `art-assets.ts`를 저절로 찾는다. 다른 곳에 두었으면 `--assets <파일>`이나 환경 변수 `ART_ASSETS_FILE`.
   프로젝트의 `package.json`이 `"type": "commonjs"`면 Node가 `.ts`의 import 문을 읽지 못하므로 `init.ts`가 `art-assets.mts`로 만든다 (도구는 `.mts`도 찾는다).
3. 폴더는 아래 순서로 정해진다. 보통은 프로젝트 파일의 `PROJECT_DIRS`만 쓴다.

   | 무엇 | 명령줄 | 환경 변수 | 프로젝트 파일 | 아무것도 없으면 |
   |---|---|---|---|---|
   | Codex 원본 PNG | `--raw` | `ART_RAW_DIR` | `PROJECT_DIRS.raw` | `art-kit/raw` |
   | 다듬은 WebP와 `meta.json` | `--out` | `ART_OUT_DIR` | `PROJECT_DIRS.out` | `art-kit/out` |
   | 참조 그림 | `--ref` | `ART_REF_DIR` | `PROJECT_DIRS.ref` | `art-kit/ref` |

   프로젝트 파일 안의 경로는 그 파일이 있는 폴더 기준, 명령줄과 환경 변수의 경로는 명령을 실행한 폴더 기준이다.
   **원본 폴더는 임시 폴더에도, 키트 폴더 안에도 두지 않는다.** 같은 프롬프트로도 같은 그림은 다시 나오지 않는다. 원래 게임은 원본을 임시 폴더 여러 곳에 흩어 두었다.
   `gen.ts`는 원본 폴더가 OS 임시 폴더 안이면 경고한다. 원본은 한 장에 0.3~1.5MB다. 저장소에 넣을지는 프로젝트가 정한다 (넣지 않으면 따로 백업한다).
4. 프로젝트 파일에서 할 수 있는 것 (모두 `tools/manifest.ts`의 `ArtProjectModule`):
   - `PROJECT_ASSETS` (꼭): 그림 목록. 도움 함수(`character`, `monster`, `foe`, `icon`, `itemIcon`, `card`, `building`, `prop` …)를 import해 쓴다. 키트 예제와 같은 `그룹/key`를 적으면 예제 대신 그 항목을 쓴다.
   - `PROJECT_DIRS`: 위 표의 폴더.
   - `PROJECT_GROUPS`: 그룹(출력 폴더) 더하기. 예: `{ portraits: 'style' }`. 규칙은 `'style'`, `'style+refOnly'`, `'style+card'` (안내서 2.6).
   - `PROJECT_REFS`: 참조 그림을 이름으로 더하기. 그 프로젝트 안에서만 쓰는 세트 기준은 `'@그룹/key'`로 부르면 되므로 보통 필요 없다.
5. 프로젝트의 TypeScript 검사에 키트를 넣어도 된다 (strict, `erasableSyntaxOnly`, `noUncheckedIndexedAccess`로 검사했다). `tools/package.json`은 `"type": "module"`만 정한다.

**키트를 새 판으로 바꿀 때**: `art-kit/` 폴더만 지우고 새 판을 복사한다. `art-assets.ts`, `art-raw/`, `art-out/`은 키트 밖이라 그대로다.
프로젝트 파일이 import하는 이름(도움 함수, 상수)이 바뀌었으면 `node tools/gen.ts <키> --dry`가 알려 준다.

## 5분 시작

아래 명령은 **키트 폴더(`art-kit/`)에서** 실행한다고 보고 적었다 (프로젝트 파일은 `../art-assets.ts`, 원본은 `../art-raw`).

**1. 보낼 것을 미리 본다** (Codex를 부르지 않는다):

```bash
node tools/gen.ts characters/hero_vail --dry
```

Codex 명령(`codex exec --skip-git-repo-check -C <원본 폴더>/<그룹> -s workspace-write --color never -i <참조>... -- -`)과
표준 입력으로 보낼 지시문·프롬프트 전문이 찍힌다.

**2. 시험 한 장**: 화풍이 이 컴퓨터·계정·모델에서도 같게 나오는지 본다. 원본이 `ref/hero_vail.png`에 있어 비교하기 쉽다.
프로젝트 원본과 섞이지 않게 `--raw probe`로 키트 안의 `probe/`에 뽑는다 (확인한 뒤 지워도 된다).

```bash
node tools/gen.ts characters/hero_vail --raw probe       # 1~3분
node tools/inspect.ts ref/hero_vail.png probe/characters/hero_vail.png
node tools/sheet.ts ref/d_dwarf_idle.png ref/hero_vail.png probe/characters/hero_vail.png --trim --canvas-scale --out probe/probe.png
```

외곽선 굵기('짧은 변 1024 환산')가 기준과 1~2px 안이고, 시트에서 선·채색·비례·틀 안의 크기가 같아 보이면 된다. 똑같은 그림이 나오지는 않는다.
시트의 칸 이름은 `ref/hero_vail`과 `characters/hero_vail`로 갈린다 (파일 이름이 겹치면 폴더 이름을 붙인다. `--labels 드워프,기준,새것`처럼 그림 수만큼 직접 줄 수도 있다).
2026-10-14에 이 키트로 해 본 결과는 `samples/new-project-examples/probe.png`에 있다 (외곽선 23px 대 21px).

**3. 새 그림 하나**: 프로젝트 파일(`../art-assets.ts`)의 `PROJECT_ASSETS`에 적는다.

```ts
import { type ArtAsset, type ProjectDirs, icon, inGroup } from './art-kit/tools/manifest.ts';

// export const PROJECT_DIRS: ProjectDirs = { ... };   ← init.ts가 적어 둔 그대로

export const PROJECT_ASSETS: readonly ArtAsset[] = [
  ...inGroup('icons',
    icon('element_light', '빛 속성', 'element_water',
      'Light element icon: one plump round little sun disc in one flat warm butter yellow (#f3d36a) with six short rounded rays, ' +
      'each ray with its own outline. Nothing else. The same size and weight as the droplet in the second image.'),
  ),
];
```

```bash
node tools/gen.ts icons/element_light                    # → ../art-raw/icons/element_light.png
node tools/inspect.ts ../art-raw/icons/element_light.png ref/element_water.png
node tools/sheet.ts ref/d_dwarf_idle.png ref/element_water.png ../art-raw/icons/element_light.png --trim --canvas-scale --out ../art-raw/look.png
```

`gen.ts`는 Codex의 출력 전부(한 장에 약 25KB)를 `<원본 폴더>/<그룹>/_logs/<key>-<시각>.log`에 남기고, 화면에는 30초마다 진행과 결과(크기, 알파, 걸린 시간, 토큰)만 찍는다.
다 보고 싶으면 `--verbose`. 끝나면 다음에 돌릴 `inspect.ts`와 `process.ts` 명령을 그대로 찍어 준다 (명령줄로 준 `--raw`·`--out`·`--assets`도 넘긴다).

**4. 눈으로 본다.** 한 장마다 반드시 본다 (Codex가 끝난 뒤에. 한 호출 안에서 다시 그려 파일을 덮어쓴 적이 있다).
선이 기준보다 가늘거나, 디테일이 늘었거나, 글자·숫자가 생겼거나, 잘렸거나, 방향이 틀렸으면:
`element_light.png`를 `element_light.rejected1.png`로 이름을 바꿔 두고, 프롬프트 **끝에** 고칠 말을 한 문단 더하고
(`IMPORTANT ...`, 앞 문단은 그대로), 항목의 `note`에 "둘째 판. 첫 판은 …"을 적고 다시 뽑는다.

- 원본 PNG를 **검은 바탕 뷰어**로 보면 그림 둘레가 갈색으로 번져 보일 수 있다. 거의 투명한 픽셀(알파 1~8) 아래 남은 색이 보이는 것이고 해롭지 않다 (`process.ts`가 지운다).
  투명은 `inspect.ts`(RGBA, 모서리 0)와 크림색 시트, 또는 초록 바탕(안내서 5.2)으로 확인한다.

**5. 다듬는다.**

```bash
node tools/process.ts --only icons/element_light         # → ../art-out/icons/element_light.webp, ../art-out/meta.json
```

`--only` 없이 돌리면 프로젝트 파일의 그림을 모두 다듬는다 (키트 예제는 `--only`로 부를 때만).

## 무엇을 그리나: 범주별 빠른 길

한 범주만 뽑을 때는 이 표의 절만 읽어도 된다: **안내서 2.6(조립 순서) → 그 범주의 3장 절 → 7.2(체크리스트)**, 틀리면 7.4(고치는 문장).

| 그리고 싶은 것 | 도움 함수 (`tools/manifest.ts`) | 두 번째 참조 (키트 `ref/`) | 안내서 | 실제 예 |
|---|---|---|---|---|
| 주인공의 다른 자세 | `pose` | (없음: `d_dwarf_idle` 하나) | 3.1 | PROMPTS 1.2 |
| 사람 캐릭터 세트의 첫 장 | `leadCharacter` | (없음) | 3.2 (가) | PROMPTS 6장 `hero_vail` |
| 사람 캐릭터 나머지 | `character` | `hero_vail` (기본) 또는 `'@characters/<첫 장>'` | 3.2 (나) | PROMPTS 6장, 안내서 9.8 `hero_baker` |
| 귀여운 몬스터 / 같은 종의 색 변형 | `monster` / `monster(..., { sameAs })` | (없음) / 그 종의 첫 장 | 3.3 | PROMPTS 7장 |
| 같은 종의 보스, 화면을 채우는 보스 | `speciesBoss`, `screenBoss` | 그 종의 첫 장 / (없음) | 3.4 | PROMPTS 7장 |
| 적다운 몬스터 | `foe` (맞는 귀여운 몬스터가 없으면 `{ secondRef: 'style' }`) | 같은 체형의 귀여운 몬스터. 없으면 `mon_armored_earth`(둥근 짐승)·`foe_humanoid_earth`(사람 꼴) | 3.5 | PROMPTS 9.5, 안내서 9.8 `foe_iron_hedgehog` |
| 대형 보스 | `bigBoss` | `foe_humanoid_earth` 또는 `boss_twinhead_ogre` | 3.6 | PROMPTS 9.6 |
| 아이콘 (속성, 역할, 단추) | `icon` | `element_water`, `role_melee` | 3.8 | PROMPTS 8장, 안내서 9.8 `element_lightning` |
| 아이템 아이콘 | `itemIcon` | `ore_iron` | 3.9 | PROMPTS 4장 |
| UI 그림 (틀, 버튼, 테) | (항목을 직접) | `frame_progress` | 3.10 | PROMPTS 2장 |
| 카드 일러스트 | `card`, `cardBackground` | `d_dwarf_strike`·`d_dwarf_work` (주인공 장면) | 3.11 | PROMPTS 3장 |
| 배경, 소품, 무기 | (항목을 직접) | `weapon_oneHandSword` (무기) | 3.12 | PROMPTS 1장 |
| 마을 지도 건물, 작은 소품 | `building`, `prop` | `bld_forge`, `prop_tree_round` | 3.13 | PROMPTS 5장 |

## 명령 요약

| 명령 | 하는 일 | 자주 쓰는 옵션 |
|---|---|---|
| `node tools/init.ts` | 프로젝트 파일 `../art-assets.ts`를 만든다 (있으면 멈춘다) | `--to <파일>`, `--raw`, `--out` |
| `node tools/gen.ts <그룹/키>...` | Codex로 원본 PNG를 뽑는다. 키를 여럿 주면 차례로. 있던 원본은 `<원본>/<그룹>/_old/`로 옮긴다. 키 없이 돌리면 쓸 수 있는 키와 폴더를 보여 준다 | `--dry`, `--verbose`, `--force`(기준 그림 `copy`), `--model`, `--assets`, `--raw`, `--out`, `--ref` |
| `node tools/inspect.ts <png/폴더>...` | 원본 검사 (RGBA인가, 모서리 0인가, 여백, 외곽선 px와 '짧은 변 1024 환산') | `--json` |
| `node tools/sheet.ts <그림/폴더>... --out x.png` | 비교 시트 | `--trim`, `--canvas-scale`(원본끼리 틀 안 크기), `--same-scale`(다듬은 WebP끼리), `--labels`, `--cols`, `--tile`, `--title` |
| `node tools/process.ts` | WebP로 다듬기와 `meta.json` | `--only a,b`, `--assets`, `--raw`, `--out`, `--quality` |

- 실행 파일 찾기: 환경 변수 `CODEX_BIN`(실행 파일 또는 `codex.js`) → Windows는 npm 전역의 `codex.js`를 node로 바로 → `PATH`의 `codex`.
- 한 장에 1~3분 (원래 게임 62번 측정: 중앙값 99초, 최대 171초), 토큰 약 16~18k.
- **동시에 돌리기**: 다른 키라면 `gen.ts`를 2~3개 따로 띄워도 된다. 같은 그룹 폴더여도 된다 (Codex마다 자기 `<key>.png`만 쓴다).
  원래 게임도 용사들을 한 폴더에 2~3개씩 동시에 뽑았고, 수백 장 동안 사용량 제한 오류가 없었다.
  같은 키를 동시에 두 번 돌리지는 않는다: `gen.ts`가 `_logs/<key>.running`을 보고 멈춘다 (15분 넘은 것은 남은 찌꺼기로 보고 무시한다).
- Codex가 1024×1024를 부탁받고 1254×1254로 낼 때가 많다. `process.ts`는 `meta.json`의 `trim`을 요청 크기(1024) 단위로 적고 실제 크기는 `raw`에 남긴다 (안내서 5.1, 6.4).
- Codex는 그림을 `~/.codex/generated_images/<세션>/`에 남기고 복사해 온다. 그 폴더는 저절로 비워지지 않는다 (이 게임으로 663장, 675MB). 가끔 지운다.
- 원본 이름 규칙: 버린 판 `<key>.rejected1.png`, 후보 `<key>.try1.png`, 옛 화풍 `<key>.painterly.png`는 `process.ts`가 건너뛴다.

## 꼭 지킬 것 (자세한 것은 안내서)

1. **`ref/d_dwarf_idle.png`를 늘 첫 참조로 붙인다.** 드워프가 없는 그림에도. 그리지 말라는 문장과 함께.
2. **참조 순서와 프롬프트의 낱말을 맞춘다** ("first attached image" = 드워프, "second attached image" = 세트 기준 그림).
3. **세트마다 기준 그림 한 장**을 먼저 뽑아 나머지의 두 번째 참조로 붙인다. 그 그림 자신은 드워프만 참조한다.
4. **한 번에 한 장.** 지시문에 "exactly ONE image", "Generate once"가 들어 있다. 끝난 뒤에 본다.
5. **외곽선 굵기가 가장 큰 위험이다.** 작은 물건일수록 "draw it fairly small … filling only about half"로 작게 그리게 해서 선을 굵게 지킨다. `inspect.ts`로 잰다.
6. **금지할 것은 이름으로 적는다** (나뭇결, 리벳, 근육선, 글자·숫자, 그라데이션 …). 참조가 원하지 않는 것까지 베끼면 그것도 하나씩 금지한다.

## samples/

지금 그림을 범주별로 모은 시트다 (크림 #f6ebd5 바탕, `tools/sheet.ts`로 만들었다). 새 그림을 옆에 두고 비교한다.

| 시트 | 내용 |
|---|---|
| `style_candidates.png` | 화풍을 고른 과정: 페인터리 v1 → A·B·C → D·E·F·G, D를 골랐다 |
| `refs.png` | `ref/`의 참조 그림 16장 |
| `heroes.png` | 사람 캐릭터(용사) 36명 |
| `monsters_cute.png` | 귀여운 몬스터 16, 종의 보스 4, 화면을 채우는 보스 5 |
| `monsters_enemy_bosses.png` | 적다운 몬스터 12, 대형 보스 6 (원래 게임에는 아직 넣지 않았다) |
| `icons.png` | 아이콘 22 (속성, 역할, 별 문양, 무기, 단추, 상태) |
| `ui.png` | 카드 틀, 버튼, 화로 상태, 작은 아이콘, 필살기 불꽃 테 |
| `cards.png` | 카드 일러스트 35 (평면 단색 배경) |
| `items.png` | 아이템 아이콘 14 (광석, 골드, 선물, 가방, 망치 버튼) |
| `town.png` | 마을 지도 (바닥, 구름 띠, 건물, 탑, 소품) |
| `workshop.png` | 기준 드워프의 자세, 공방 배경, 소품, 완성 무기 |
| [`new-project-examples/`](samples/new-project-examples/README.md) | 이 게임 밖의 새 그림 넷을 키트만으로 뽑아 본 예 (빵집 용사, 쇠가시 고슴도치 두 판, 번개 아이콘)와 시험 한 장. 보낸 프롬프트 원문과 시트. 안내서 9.8 |

## 원래 게임에서 가져오지 않은 것

- 마을 지도 합성·굽기 (`tools/art/town/`): 바닥 위에 건물을 놓고 그림자·잉크 테를 다시 그리는 게임 전용 도구. 생각은 안내서 3.13에 있다.
- 공방 화면 전용 처리 `alignTo`(두 그림을 같은 자리에 맞추기)와 `measure`(그림 속 칸의 자리 재기).
- 동작 스프라이트 시트(시댄스 영상 → ffmpeg)와 효과음(ElevenLabs): 원래 게임에서도 아직 자리만 정했다.
