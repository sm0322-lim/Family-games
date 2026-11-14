# 🎲 가족 게임

가족이 함께 하는 미니 게임 모음이에요. 휴대폰 브라우저에서 열고 **홈 화면에 추가**하면 앱처럼 쓸 수 있어요.

| 게임 | 상태 |
|---|---|
| 31 | ✅ 한 기기 / 컴퓨터 상대 / 온라인 |
| 블랙잭 | ✅ 한 기기 / 컴퓨터 상대 / 온라인 |
| 우노 | ✅ 한 기기 / 컴퓨터 상대 / 온라인 |
| 체스, 할리갈리 | 🛠️ 준비 중 |

온라인 대기실에서 방장이 **+ 컴퓨터** 버튼으로 컴퓨터를 넣을 수 있어요.
게임 중 연결이 끊긴 사람의 차례는 컴퓨터가 대신 해요.

## 1. GitHub에 올리기

1. GitHub에서 **New repository** → 이름 `family-games`, **Public**
2. 저장소 화면에서 **Add file → Upload files**
3. 압축을 푼 `family-games` 폴더를 **열고, 안에 있는 파일과 폴더를 전부 선택해서** 드래그
   - 폴더 자체를 끌어 놓으면 한 단계 안쪽에 들어가서 사이트가 열리지 않아요
4. **Commit changes**
5. **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `/ (root)` → Save
6. 1~3분 뒤 `https://내아이디.github.io/family-games/` 접속

한 기기, 컴퓨터 상대 모드는 여기까지만 해도 바로 동작해요.

## 2. 온라인 모드 (Firebase 설정)

1. https://console.firebase.google.com 에서 프로젝트 만들기
2. **빌드 → Realtime Database → 데이터베이스 만들기**
3. **Rules** 탭에 `firebase-rules.json` 내용을 붙여넣고 게시
4. **빌드 → Authentication → 로그인 방법 → 익명** 사용 설정
5. **Authentication → 설정 → 승인된 도메인**에 `내아이디.github.io` 추가
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가**에서 나온 값을 `js/firebase-config.js`에 붙여넣기
7. GitHub에서 `js/firebase-config.js` 파일을 열고 연필 아이콘으로 수정 후 커밋

## 3. 게임 규칙

각 게임의 인원 선택 화면과 온라인 대기실에서 **규칙 보기**를 누르면 볼 수 있어요.

## 폴더 구조

```
family-games/
├─ index.html
├─ manifest.json
├─ firebase-rules.json    ← Firebase Rules에 붙여넣을 내용
├─ css/style.css
├─ icons/                 ← 홈 화면 아이콘
├─ js/
│  ├─ app.js              ← 메뉴, 모드 선택
│  ├─ firebase-config.js  ← 내 Firebase 값으로 수정
│  ├─ net.js              ← 온라인 연결
│  ├─ turn-game.js        ← 차례 진행 게임 공통 (한 기기/컴퓨터/온라인)
│  ├─ cards.js            ← 트럼프 카드 공통
│  └─ ui.js               ← 화면 공통
└─ games/
   ├─ thirtyone/          ← 31 (engine.js 규칙, ai.js 컴퓨터, game.js 화면)
   ├─ blackjack/          ← 블랙잭
   ├─ uno/                ← 우노
   ├─ chess/  halli/      ← 준비 중
```

## 알아둘 점

- 온라인 게임 중에는 **방장 폰을 켜 두어야** 해요. 방장이 나가면 게임이 멈춰요.
- 연결이 끊긴 사람의 차례는 자동으로 스톱 처리돼요.
- 파일을 고친 뒤 폰에 바로 반영되지 않으면 브라우저에서 새로고침해 주세요.
