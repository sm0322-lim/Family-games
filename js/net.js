import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, push, remove,
  onValue, onChildAdded, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 익명 로그인 (가입 불필요). 설정이 틀리면 실패 메시지가 화면에 표시돼요.
const ready = new Promise((resolve, reject) => {
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); resolve(user.uid); }
  });
  signInAnonymously(auth).catch(reject);
});

export const myId = () => ready;

const userError = text => Object.assign(new Error(text), { userMessage: text });

function makeCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createRoom(gameId, name) {
  const uid = await ready;
  let code, exists = true;
  while (exists) {
    code = makeCode();
    exists = (await get(ref(db, `rooms/${code}`))).exists();
  }
  await set(ref(db, `rooms/${code}`), {
    game: gameId,
    host: uid,
    status: "waiting",
    players: { [uid]: { name, joinedAt: Date.now() } },
    state: null,
  });
  onDisconnect(ref(db, `rooms/${code}/players/${uid}`)).remove();
  return code;
}

export async function joinRoom(code, name, gameId) {
  const uid = await ready;
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) throw userError("방을 찾을 수 없어요. 코드를 다시 확인해 주세요");
  const room = snap.val();
  if (gameId && room.game !== gameId) throw userError("다른 게임의 방 코드예요");
  await update(ref(db, `rooms/${code}/players/${uid}`), { name, joinedAt: Date.now() });
  onDisconnect(ref(db, `rooms/${code}/players/${uid}`)).remove();
  return room;
}

export async function leaveRoom(code) {
  const uid = await ready;
  return remove(ref(db, `rooms/${code}/players/${uid}`));
}

// 아래 watch 함수들은 구독을 끊는 함수를 돌려줘요
export function watchRoom(code, callback) {
  return onValue(ref(db, `rooms/${code}`), snap => callback(snap.val()));
}

// 방 정보의 한 항목 쓰기 (예: 방장이 추가한 컴퓨터 목록)
export function writeRoomField(code, key, value) {
  return set(ref(db, `rooms/${code}/${key}`), value);
}

// 공개 상태 (방장만 기록)
export function writeState(code, state) {
  return set(ref(db, `rooms/${code}/state`), state);
}

// 개인 패 (본인만 읽기 가능)
export function writePrivate(code, uid, data) {
  return set(ref(db, `hands/${code}/${uid}`), data);
}

export function watchPrivate(code, uid, callback) {
  return onValue(ref(db, `hands/${code}/${uid}`), snap => callback(snap.val()));
}

// 참가자 행동 전달 (방장이 읽어서 처리)
export function pushAction(code, action) {
  return push(ref(db, `rooms/${code}/actions`), action);
}

export function watchActions(code, callback) {
  return onChildAdded(ref(db, `rooms/${code}/actions`),
    snap => callback({ key: snap.key, value: snap.val() }));
}

export function removeAction(code, key) {
  return remove(ref(db, `rooms/${code}/actions/${key}`));
}
