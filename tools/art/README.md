# tools/art — 그림·동작·소리를 게임에 넣는 자리

그림의 원본은 `assets.ts`(매니페스트)다. 뽑기는 `gen.ts`, 다듬기는 `process.ts`. 이 문서는 그 뒤에 올 두 가지,
**전투 동작 스프라이트 시트**(시댄스 2.5 영상 → ffmpeg → 시트)와 **효과음·목소리**(ElevenLabs)를 끼울 자리와
이름 규칙을 적는다 (사용자 결정 13). 지금은 둘 다 없다: 전투는 정지 그림을 좌표로 움직이고(`src/render/battle/motion.ts`),
소리는 `src/platform/audio.ts`가 합성한다. 아래 규칙대로 파일을 놓으면 코드를 고치지 않아도 그쪽이 쓰인다.

## 1. 전투 동작 시트

### 동작 여섯 개 (규격: `src/render/battle/motion.ts`의 `ANIM_SPEC`)

| 동작 | 키 | 칸 수 | fps | 반복 | 길이 | 언제 |
|---|---|---|---|---|---|---|
| 대기 | `idle` | 8 | 8 | 반복 | 1.0초 | 아무것도 안 할 때 |
| 공격 | `attack` | 6 | 15 | 한 번 | 0.4초 | 일반 공격. 0.45 지점(3번째 칸 끝쯤)에 맞는다 (`ATTACK_IMPACT_AT`) |
| 스킬 | `skill` | 8 | 14 | 한 번 | 0.57초 | 액티브 스킬. 가운데쯤 맞는다 |
| 피격 | `hit` | 4 | 12 | 한 번 | 0.33초 | 맞았을 때 (다른 동작 위에 겹쳐 보인다) |
| 승리 | `victory` | 8 | 10 | 반복 | 0.8초 | 층을 넘었을 때 |
| 필살기 | `ultimate` | 12 | 12 | 한 번 | 1.0초 | 필살기. 가운데쯤 맞는다 |

쓰러짐(`down`)은 시트가 없다. 늘 좌표 움직임(기울며 흐려진다)이다.
칸 수나 fps를 바꾸려면 `ANIM_SPEC`만 고친다. 전투의 시간표(`timeline.ts`)가 그 길이를 읽어 맞는 순간을 맞춘다.

### 파일 이름과 모양

```
src/assets/art/anim/<그림 키>@<동작>.webp
예: src/assets/art/anim/hero_vail@attack.webp
    src/assets/art/anim/mon_flying_fire@idle.webp
    src/assets/art/anim/daily_turtle@hit.webp
```

- `<그림 키>`는 정지 그림과 같다 (`hero_*`, `mon_*`, `boss_*`, `daily_*`).
- **가로 한 줄 띠**, 칸은 모두 같은 크기. 띠의 너비 ÷ `ANIM_SPEC`의 칸 수 = 한 칸의 너비. 나누어떨어지지 않으면
  그 시트는 버리고 좌표 움직임을 쓴다.
- 칸마다 **발끝 가운데**가 칸의 (가로 0.5, 세로 0.97) 자리에 온다 (`ANIM_ANCHOR`). 정지 그림처럼 발끝을 아래 선에 맞춘다.
- **왼쪽을 보게** 그린다 (정지 그림과 같다). 용사는 화면 왼쪽에서 오른쪽을 보므로 게임이 좌우를 뒤집는다.
- 배경은 투명. 칸 높이는 정지 그림과 비슷하게(용사 400px 안팎). 화면에서는 키 높이에 맞춰 줄인다.
- 시트가 있는 동작만 시트로 나오고, 없는 동작은 좌표 움직임이 대신한다. 한 용사에 시트가 하나만 있어도 된다.
- 시트가 있어도 공격의 '앞으로 툭 나갔다 오기'(자리 이동)는 그대로 한다. 늘이고 누르기(찌그러짐)만 빠진다.

### 만드는 순서 (시댄스 → ffmpeg → 시트)

1. 시댄스 2.5로 동작 하나를 짧은 영상으로 뽑는다. 정지 그림(`src/assets/art/heroes/<키>.webp`)을 첫 장면으로,
   단색 배경(초록 등)에 제자리 동작. 중계 Worker는 `tools/proxy/worker.js`의 `/ark/` 경로 (`.env`의 `PROXY_URL`, `PROXY_TOKEN`).
2. ffmpeg로 칸을 뽑고 배경을 빼고 띠로 붙인다. 예 (공격 6칸, 영상 0.4초 구간):

   ```
   ffmpeg -ss 0.2 -t 0.4 -i attack.mp4 -vf "fps=15,chromakey=0x00ff00:0.15:0.05,scale=-1:400,tile=6x1" -frames:v 1 hero_vail@attack.png
   ```

   칸 수는 `fps × 길이`가 `ANIM_SPEC`의 칸 수와 같게 고른다. 발끝이 칸마다 같은 자리에 오도록 자르기(`crop`)를 맞춘다.
3. `.webp`로 바꿔 `src/assets/art/anim/`에 넣는다 (예: `ffmpeg -i hero_vail@attack.png -c:v libwebp -lossless 0 -q:v 85 hero_vail@attack.webp`).
   게임은 `import.meta.glob('/src/assets/art/anim/*.webp')`로 찾으므로 등록할 곳이 따로 없다.
4. 몬스터도 같다 (사용자 결정 13: 나중에 시댄스).

이펙트(충격 별, 속도선, 회복 반짝임, 구름, 필살기 햇살)는 `src/render/forge/procedural.ts`의 평면 낙서풍 도형이다.
큰 스킬·필살기용으로 Codex가 몇 장(3~6칸)을 그리면 같은 가로 띠 규칙으로 `src/assets/art/fx/<이름>.webp`에 둔다 (자리만 정함, 아직 읽는 코드 없음).

## 2. 효과음과 목소리 (ElevenLabs)

지금 전투의 소리는 `src/platform/audio.ts`의 합성음 셋이다: `strike`(타격), `crit`(치명타), `heal`(회복).
ElevenLabs로 만들 때 (사용자 결정 13: 말 없는 짧은 소리 + 효과음):

```
src/assets/sound/sfx/<이름>.mp3     효과음 (sound-generation)
src/assets/sound/voice/<그림 키>_<때>.mp3   용사의 말 없는 짧은 소리 (text-to-speech, 숨소리·기합·웃음)
```

- 효과음 이름은 `platform/audio.ts`의 `SoundIntent`와 같게 한다: `strike`, `crit`, `heal`, `hit`(망치), `hitBright`,
  `rare`, `veryRare`. 새 소리는 이름을 `SoundIntent`에 더한다. 파일을 트는 길은 아직 없다: 파일이 생기면 `audio.ts`
  하나에 '그 이름의 파일이 있으면 틀고, 없으면 지금의 합성음'을 더한다 (화면은 이름만 부른다, CLAUDE.md 규칙 4).
- 목소리의 `<때>`: `attack`, `skill`, `hit`, `victory`, `ultimate`, `down` (동작 시트의 동작 + 쓰러짐). 한 때에 여럿이면 `_2`, `_3`.
- 길이는 짧게 (효과음 0.2~0.6초, 목소리 1초 안). 소리 크기는 -16 LUFS 안팎으로 맞춘다.
- 중계: `tools/proxy/worker.js`의 `/eleven/v1/sound-generation`, `/eleven/v1/text-to-speech/<voice_id>`.
- 배경 음악은 [미정].
