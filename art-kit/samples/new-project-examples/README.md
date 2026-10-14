# new-project-examples — 키트만으로 뽑아 본 새 그림

2026-10-14, 키트 문서(`README.md`, `ART_STYLE_GUIDE.md`, `PROMPTS.md`, `ref/README.md`)만 보고 '용사의 대장간'에 없는 그림을 뽑아 본 결과다.
같은 컴퓨터·계정·모델(codex-cli 0.162.0, gpt-6.1-sol). 셋 모두 첫 판에 화풍이 맞았다.
프로젝트 파일에 적은 항목, 조립된 프롬프트의 짜임, 결과 수치, 작은 어긋남, 이 시험으로 키트가 바꾼 것은 [`ART_STYLE_GUIDE.md` 9.8](../../ART_STYLE_GUIDE.md#98-실제로-해-본-예-새-프로젝트의-첫-그림들-2026-10-14)에 있다.

| 파일 | 내용 |
|---|---|
| `compare.png` | 기준 그림(ref)과 새 그림의 원본을 나란히 (칸마다 맞춤) |
| `probe.png` | 시험 한 장: 예제 `hero_vail`을 같은 프롬프트로 다시 뽑은 것과 원래 그림 (`--canvas-scale`) |
| `processed.png` | `process.ts`로 다듬은 WebP 셋 (고슴도치는 둘째 판) |
| `webp/` | 다듬은 WebP 그 자체: `hero_baker.webp` 246×400, `foe_iron_hedgehog.webp` 400×309 (둘째 판), `element_lightning.webp` 78×96 |
| `prompts/` | Codex에 표준 입력으로 보낸 **원문 그대로** (Codex 기록에서 잘라 냈다. 지시문 + 그림 프롬프트) |

`prompts/`의 파일:

| 파일 | 그림 | 참조 (`-i` 순서) | 도움 함수 |
|---|---|---|---|
| `hero_vail.probe.txt` | 시험 한 장 (키트 예제 `characters/hero_vail`) | `d_dwarf_idle` | `leadCharacter` |
| `hero_baker.txt` | 빵집 용사 (일반) | `d_dwarf_idle`, `hero_vail` | `character(..., 'normal', ...)` |
| `foe_iron_hedgehog.v1.txt` | 쇠가시 고슴도치 첫 판 (FOE_SAME_BODY + '새 생물' 문장) | `d_dwarf_idle`, `mon_armored_earth` | `foe(...)` |
| `foe_iron_hedgehog.v2.txt` | 쇠가시 고슴도치 둘째 판 (FOE_STYLE_REF) | `d_dwarf_idle`, `mon_armored_earth` | `foe(..., { secondRef: 'style' })` |
| `element_lightning.txt` | 번개 속성 아이콘 | `d_dwarf_idle`, `element_water` | `icon(...)` |

같은 항목을 프로젝트 파일에 적고 `node tools/gen.ts <그룹/키> --dry`를 돌리면 이 파일들과 글자까지 같은 표준 입력이 찍힌다 (확인했다).
원본 PNG는 넣지 않았다 (한 장에 0.5~1MB). 다시 보려면 위 항목으로 다시 뽑는다. 같은 그림은 나오지 않지만 결은 같다.

![비교](compare.png)
