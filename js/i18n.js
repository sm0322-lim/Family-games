// 한국어 / English 전환
// t("키", { 값 }) 으로 현재 언어의 문장을 가져와요. 각 게임은 addStrings()로 자기 문장을 추가해요.
const DICT = { ko: {}, en: {} };

let lang = "ko";
try {
  const saved = localStorage.getItem("fg-lang");
  lang = saved === "en" || saved === "ko" ? saved
    : String(navigator.language || "ko").toLowerCase().startsWith("ko") ? "ko" : "en";
} catch (e) { /* 저장 불가 시 기본 한국어 */ }

export const getLang = () => lang;

export function setLang(next) {
  lang = next === "en" ? "en" : "ko";
  try { localStorage.setItem("fg-lang", lang); } catch (e) { /* 무시 */ }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("fg-lang"));
}

export function addStrings(obj) {
  for (const l of ["ko", "en"]) Object.assign(DICT[l], obj[l] || {});
}

export function t(key, v = {}) {
  const s = DICT[lang][key] ?? DICT.ko[key] ?? key;
  if (typeof s === "function") return s(v || {});
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : ""));
}

addStrings({
  ko: {
    "app.title": "🎲 가족 게임",
    "app.soon": "준비 중",
    "lang.switch": "EN",
    "lang.aria": "Switch to English",
    "sound.aria": "효과음 켜기/끄기",
    "back.aria": "뒤로 가기",
    "loading": "불러오는 중...",

    "game.chess": "체스", "game.chess.d": "2인 대결",
    "game.halli": "할리갈리", "game.halli.d": "같은 과일 5개면 종을 쳐라",
    "game.uno": "우노", "game.uno.d": "카드를 가장 먼저 털어라",
    "game.blackjack": "블랙잭", "game.blackjack.d": "딜러와 21 대결",
    "game.thirtyone": "31", "game.thirtyone.d": "같은 무늬 합 31을 만들어라",

    "mode.local": "👨‍👩‍👧 한 기기", "mode.local.d": "같은 폰으로 함께",
    "mode.ai": "🤖 컴퓨터 상대", "mode.ai.d": "컴퓨터와 대결",
    "mode.online": "📱 온라인", "mode.online.d": "각자 폰에서 방 코드로",

    "online.namePh": "내 이름 (예: 아빠)",
    "online.create": "방 만들기",
    "online.codePh": "방 코드 4자리",
    "online.join": "방 입장",
    "online.creating": "방을 만드는 중...",
    "online.joining": "입장하는 중...",
    "online.badCode": "방 코드는 숫자 4자리예요",
    "online.defaultName": "가족",

    "err.connect": "연결하지 못했어요. js/firebase-config.js 설정과 인터넷 연결을 확인해 주세요",
    "err.noRoom": "방을 찾을 수 없어요. 코드를 다시 확인해 주세요",
    "err.otherGame": "다른 게임의 방 코드예요",
    "err.load": "게임을 불러오지 못했어요",
    "err.loadHint": "{path} 파일이 올라가 있는지 확인해 주세요",

    "setup.howManyAI": "컴퓨터 몇 명과 할까요?",
    "setup.howMany": "몇 명이 함께 할까요?",
    "setup.solo": "나 혼자",
    "setup.meAI": "나 + 컴퓨터 {n}명",
    "setup.n": "{n}명",
    "setup.level": "컴퓨터 실력",
    "level.easy": "쉬움", "level.normal": "보통", "level.hard": "어려움",
    "rules": "규칙 보기",

    "name.me": "나",
    "name.ai": "컴퓨터 {x}",
    "name.p": "{n}번 플레이어",
    "me.suffix": " (나)",

    "pass.turn": "{name} 차례예요",
    "pass.hide": "다른 사람이 보지 않게 폰을 넘겨주세요",
    "pass.last": "방금: {text}",
    "pass.show": "내 카드 보기",

    "conn.connecting": "연결 중...",
    "conn.lost": "연결이 끊겼어요. 뒤로 가서 다시 들어와 주세요",
    "room.gone": "방이 사라졌어요. 뒤로 가서 새로 만들어 주세요",

    "lobby.title": "대기실",
    "lobby.code": "방 코드",
    "lobby.share": "가족에게 이 코드를 알려 주세요 ({range})",
    "lobby.range": "{a}~{b}명",
    "lobby.exact": "{a}명",
    "lobby.addBot": "+ 컴퓨터",
    "lobby.delBot": "- 컴퓨터",
    "lobby.start": "게임 시작 ({n}명)",
    "lobby.wait": "방장이 시작하기를 기다리는 중...",

    "footer.next": "다음 라운드",
    "footer.waitNext": "방장이 다음 라운드를 시작할 때까지 기다려요",
    "footer.again": "다시 하기",
    "footer.waitAgain": "방장이 새 게임을 시작할 때까지 기다려요",
    "turnOf": "{name} 차례예요...",
    "winner": "🏆 {name} 우승!",
    "draw": "무승부",
    "confirm.again": "한 번 더 누르면 확정",
  },
  en: {
    "app.title": "🎲 Family Games",
    "app.soon": "Coming soon",
    "lang.switch": "한",
    "lang.aria": "한국어로 바꾸기",
    "sound.aria": "Sound on/off",
    "back.aria": "Back",
    "loading": "Loading...",

    "game.chess": "Chess", "game.chess.d": "Two-player battle",
    "game.halli": "Halli Galli", "game.halli.d": "Ring the bell at five of a fruit",
    "game.uno": "UNO", "game.uno.d": "Be the first to empty your hand",
    "game.blackjack": "Blackjack", "game.blackjack.d": "Beat the dealer to 21",
    "game.thirtyone": "31", "game.thirtyone.d": "Make 31 in one suit",

    "mode.local": "👨‍👩‍👧 One phone", "mode.local.d": "Play together on one phone",
    "mode.ai": "🤖 vs Computer", "mode.ai.d": "Play against the computer",
    "mode.online": "📱 Online", "mode.online.d": "Each on your own phone, with a room code",

    "online.namePh": "Your name (e.g. Dad)",
    "online.create": "Create room",
    "online.codePh": "4-digit room code",
    "online.join": "Join room",
    "online.creating": "Creating room...",
    "online.joining": "Joining...",
    "online.badCode": "The room code is 4 digits",
    "online.defaultName": "Player",

    "err.connect": "Couldn't connect. Check js/firebase-config.js and your internet connection",
    "err.noRoom": "Room not found. Check the code and try again",
    "err.otherGame": "That code is for a different game",
    "err.load": "Couldn't load the game",
    "err.loadHint": "Check that {path} is uploaded",

    "setup.howManyAI": "How many computer players?",
    "setup.howMany": "How many players?",
    "setup.solo": "Just me",
    "setup.meAI": v => `Me + ${v.n} computer${v.n > 1 ? "s" : ""}`,
    "setup.n": "{n} players",
    "setup.level": "Computer skill",
    "level.easy": "Easy", "level.normal": "Normal", "level.hard": "Hard",
    "rules": "How to play",

    "name.me": "Me",
    "name.ai": "Computer {x}",
    "name.p": "Player {n}",
    "me.suffix": " (me)",

    "pass.turn": "Turn: {name}",
    "pass.hide": "Pass the phone so no one else can see",
    "pass.last": "Just now: {text}",
    "pass.show": "Show my cards",

    "conn.connecting": "Connecting...",
    "conn.lost": "Disconnected. Go back and join again",
    "room.gone": "This room is gone. Go back and create a new one",

    "lobby.title": "Lobby",
    "lobby.code": "Room code",
    "lobby.share": "Share this code with your family ({range})",
    "lobby.range": "{a}–{b} players",
    "lobby.exact": "{a} players",
    "lobby.addBot": "+ Computer",
    "lobby.delBot": "- Computer",
    "lobby.start": "Start game ({n})",
    "lobby.wait": "Waiting for the host to start...",

    "footer.next": "Next round",
    "footer.waitNext": "Waiting for the host to start the next round",
    "footer.again": "Play again",
    "footer.waitAgain": "Waiting for the host to start a new game",
    "turnOf": "Waiting for {name}...",
    "winner": "🏆 Winner: {name}!",
    "draw": "Draw",
    "confirm.again": "Tap again to confirm",
  },
});
