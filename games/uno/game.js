import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML } from "../../js/ui.js";
import { t, addStrings } from "../../js/i18n.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

// 카드 이름: 언어별로 만들어요
const cardName = (lang, v) => {
  const C = lang === "ko" ? { R: "빨강", Y: "노랑", G: "초록", B: "파랑" } : { R: "Red", Y: "Yellow", G: "Green", B: "Blue" };
  const A = lang === "ko"
    ? { skip: "건너뛰기", rev: "방향 바꾸기", "+2": "+2", wild: "와일드", "+4": "와일드 +4" }
    : { skip: "Skip", rev: "Reverse", "+2": "+2", wild: "Wild", "+4": "Wild +4" };
  if (v.c === "W") return `${A[v.val] || ""} → ${C[v.color] || ""}`;
  return `${C[v.c] || ""} ${A[v.val] || v.val}`;
};

addStrings({
  ko: {
    "uno.color.R": "빨강", "uno.color.Y": "노랑", "uno.color.G": "초록", "uno.color.B": "파랑",
    "uno.count": "🃏 {n}장", "uno.deck": "뽑기 ({n}장)", "uno.now": "지금 색: {c}",
    "uno.dir": "진행 방향 {a}",
    "uno.hint": "낼 카드를 누르거나, 내지 않고 한 장 먹을 수도 있어요",
    "uno.drawBtn": "🃏 한 장 먹기",
    "uno.pendingHint": "뽑은 카드를 바로 낼 수 있어요",
    "uno.passBtn": "내지 않고 넘기기",
    "uno.pick": "다음 색을 골라 주세요", "uno.cancel": "취소",
    "uno.left": "남은 카드", "uno.cards": "{n}장", "uno.over": "게임 끝",
    "uno.start": "게임 시작! {name}부터 해요",
    "uno.play": v => `${v.name}: ${cardName("ko", v)}` +
      (v.uno ? " 🔔 우노!" : "") +
      (v.eff === "skip" ? ` (${v.target} 건너뜀)` : v.eff === "rev" ? " (방향 바뀜)" : v.eff === "draw" ? ` (${v.target} ${v.k}장 받고 건너뜀)` : ""),
    "uno.win": "🏆 {name} 우승!",
    "uno.drew": "{name}: 한 장 먹었어요",
    "uno.drewPass": "{name}: 한 장 먹고 넘겼어요",
    "uno.empty": "{name}: 먹을 카드가 없어 넘겼어요",
    "uno.pass": "{name}: 넘겼어요",
  },
  en: {
    "uno.color.R": "Red", "uno.color.Y": "Yellow", "uno.color.G": "Green", "uno.color.B": "Blue",
    "uno.count": "🃏 {n}", "uno.deck": "Draw ({n})", "uno.now": "Color: {c}",
    "uno.dir": "Direction {a}",
    "uno.hint": "Tap a card to play it, or draw a card instead",
    "uno.drawBtn": "🃏 Draw a card",
    "uno.pendingHint": "You can play the card you just drew",
    "uno.passBtn": "Keep it and pass",
    "uno.pick": "Pick the next color", "uno.cancel": "Cancel",
    "uno.left": "Cards left", "uno.cards": "{n} cards", "uno.over": "Game over",
    "uno.start": "Game on! First up: {name}",
    "uno.play": v => `${v.name}: ${cardName("en", v)}` +
      (v.uno ? " 🔔 UNO!" : "") +
      (v.eff === "skip" ? ` (${v.target} skipped)` : v.eff === "rev" ? " (reversed)" : v.eff === "draw" ? ` (${v.target} draws ${v.k}, skipped)` : ""),
    "uno.win": "🏆 Winner: {name}!",
    "uno.drew": "{name}: drew a card",
    "uno.drewPass": "{name}: drew a card and passed",
    "uno.empty": "{name}: no cards left to draw, passed",
    "uno.pass": "{name}: passed",
  },
});

const RULES = {
  ko: `<ul>
    <li>각자 7장으로 시작해요. 바닥 카드와 <b>같은 색</b>이나 <b>같은 숫자·기호</b>를 낼 수 있어요.</li>
    <li>낼 카드가 있어도 <b>내지 않고 한 장 먹을 수</b> 있어요. 먹은 카드를 낼 수 있으면 바로 내거나 넘길 수 있어요.</li>
    <li><b>와일드</b>는 언제든 낼 수 있고 다음 색을 정해요. <b>+4</b>는 다음 사람이 4장 받고 건너뛰어요.</li>
    <li><b>⊘ 건너뛰기</b>: 다음 사람 건너뜀, <b>⇄ 방향 바꾸기</b>: 순서 반대로 (2명이면 건너뛰기), <b>+2</b>: 다음 사람 2장 받고 건너뜀.</li>
    <li>가장 먼저 카드를 다 털면 우승!</li>
  </ul>`,
  en: `<ul>
    <li>Everyone starts with 7 cards. Play a card that matches the top card's <b>color</b> or <b>number/symbol</b>.</li>
    <li>Even if you can play, you may <b>draw a card instead</b>. If the drawn card can be played, play it or keep it and pass.</li>
    <li><b>Wild</b> can always be played and picks the next color. <b>+4</b> makes the next player draw 4 and miss their turn.</li>
    <li><b>⊘ Skip</b>: the next player misses a turn. <b>⇄ Reverse</b>: changes direction (acts as Skip with 2 players). <b>+2</b>: the next player draws 2 and misses a turn.</li>
    <li>First to empty their hand wins!</li>
  </ul>`,
};

export function start(opts) {
  return runTurnGame({
    hidden: true,
    minPlayers: 2, maxPlayers: 4,
    localCounts: [2, 3, 4], aiCounts: [1, 2, 3],
    aiDelay: 1000,
    rules: RULES,
    newGame: E.newGame, nextRound: E.nextRound, act: E.act,
    publicView: E.publicView, privateView: E.privateView,
    aiAction: decide,
    render,
  }, opts);
}

const SYM = { skip: "⊘", rev: "⇄", wild: "W", "+4": "+4", "+2": "+2" };

function unoCard(c, { tag = "span", cls = "", attrs = "" } = {}) {
  const col = ["R", "Y", "G", "B", "W"].includes(c?.c) ? c.c : "W";
  const label = SYM[c?.v] || (/^\d$/.test(c?.v) ? c.v : "?");
  const type = tag === "button" ? ' type="button"' : "";
  return `<${tag}${type} class="uno ${col} ${cls}" ${attrs}><b>${label}</b></${tag}>`;
}

function render(container, pub, mine, ui) {
  const players = pub.players || [];
  const turn = players.find(p => p.id === pub.turnId);
  const color = E.COLORS.includes(pub.color) ? pub.color : "R";

  const seats = players.map(p => `
    <div class="pcard ${p.id === pub.turnId ? "turn" : ""}">
      <strong>${esc(p.name)}${p.id === ui.meId && ui.mode === "online" ? esc(t("me.suffix")) : ""}</strong>
      <span>${esc(t("uno.count", { n: p.count ?? 0 }))}${p.count === 1 ? " 🔔" : ""}</span>
    </div>`).join("");

  let body = "";
  if (pub.phase === "playing") {
    const canDraw = ui.canAct && !pub.pendingDraw;
    body += `<div class="unotable">
      <button class="pile" id="draw" ${canDraw ? "" : "disabled"}>
        <span class="uno back"><b>UNO</b></span><small>${esc(t("uno.deck", { n: pub.deckCount ?? 0 }))}</small>
      </button>
      <div class="pile">${pub.top ? unoCard(pub.top, { cls: "big" }) : ""}
        <small><span class="dot ${color}"></span>${esc(t("uno.now", { c: t("uno.color." + color) }))}</small></div>
    </div>
    <p class="round">${esc(t("uno.dir", { a: pub.dir === 1 ? "→" : "←" }))}</p>`;

    const hand = (mine && mine.hand) || [];
    if (hand.length) {
      body += `<div class="hand uno-hand">${hand.map((c, i) => {
        const ok = ui.canAct && E.canPlay(c, pub.top, color) && (!pub.pendingDraw || i === hand.length - 1);
        const cls = ok ? "play" : ui.canAct ? "dim" : "";
        return ok
          ? unoCard(c, { tag: "button", cls, attrs: `data-i="${i}" data-w="${c.c === "W" ? 1 : 0}"` })
          : unoCard(c, { cls });
      }).join("")}</div>`;
    }

    if (ui.canAct) {
      if (pub.pendingDraw) {
        body += `<p class="hint">${esc(t("uno.pendingHint"))}</p>
          <div class="actions"><button id="pass" class="ghost">${esc(t("uno.passBtn"))}</button></div>`;
      } else {
        body += `<p class="hint">${esc(t("uno.hint"))}</p>
          <div class="actions"><button id="drawBtn" class="dark">${esc(t("uno.drawBtn"))}</button></div>`;
      }
      body += `<div class="picker" id="picker" hidden>
        <p>${esc(t("uno.pick"))}</p>
        <div class="actions">${E.COLORS.map(c => `<button class="uno ${c}" data-color="${c}"><b>${esc(t("uno.color." + c))}</b></button>`).join("")}</div>
        <div class="actions"><button id="cancelPick" class="ghost">${esc(t("uno.cancel"))}</button></div>
      </div>`;
    } else {
      body += `<p class="wait">${esc(t("turnOf", { name: turn?.name ?? "" }))}</p>`;
    }
  }

  if (pub.phase === "gameOver") {
    const w = players.find(p => p.id === pub.winnerId);
    body += `<h2>${esc(w ? t("winner", { name: w.name }) : t("uno.over"))}</h2>
      <div class="reveal"><h3>${esc(t("uno.left"))}</h3><ul>${[...players].sort((a, b) => (a.count || 0) - (b.count || 0)).map(p =>
        `<li><div class="rhead"><strong>${esc(p.name)}</strong><span>${esc(t("uno.cards", { n: p.count || 0 }))}</span></div></li>`).join("")}</ul></div>`;
  }

  container.innerHTML = `<div class="game">
    <div class="players">${seats}</div>
    ${body}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;

  const picker = container.querySelector("#picker");
  let pickIndex = null;

  container.querySelectorAll(".hand button[data-i]").forEach(el => {
    el.addEventListener("click", () => {
      const index = Number(el.dataset.i);
      if (el.dataset.w === "1") {
        pickIndex = index;
        picker.hidden = false;
        picker.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        ui.act({ type: "play", index });
      }
    });
  });
  container.querySelectorAll("#picker [data-color]").forEach(el =>
    el.addEventListener("click", () => {
      if (pickIndex != null) ui.act({ type: "play", index: pickIndex, color: el.dataset.color });
    }));
  container.querySelector("#cancelPick")?.addEventListener("click", () => { picker.hidden = true; pickIndex = null; });
  container.querySelector("#draw")?.addEventListener("click", () => ui.act({ type: "draw" }));
  container.querySelector("#drawBtn")?.addEventListener("click", () => ui.act({ type: "draw" }));
  container.querySelector("#pass")?.addEventListener("click", () => ui.act({ type: "pass" }));
  bindFooter(container, ui);
}
