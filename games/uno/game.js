import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML } from "../../js/ui.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

const RULES = `<ul>
  <li>각자 7장으로 시작해요. 바닥 카드와 <b>같은 색</b>이나 <b>같은 숫자·기호</b>를 낼 수 있어요.</li>
  <li><b>와일드</b>는 언제든 낼 수 있고 다음 색을 정해요. <b>+4</b>는 다음 사람이 4장 받고 건너뛰어요.</li>
  <li><b>⊘ 건너뛰기</b>: 다음 사람 건너뜀, <b>⇄ 방향 바꾸기</b>: 순서 반대로 (2명이면 건너뛰기), <b>+2</b>: 다음 사람 2장 받고 건너뜀.</li>
  <li>낼 카드가 없으면 1장 뽑아요. 뽑은 카드를 낼 수 있으면 바로 내거나 넘길 수 있어요.</li>
  <li>가장 먼저 카드를 다 털면 우승!</li>
</ul>`;

export function start(opts) {
  return runTurnGame({
    hidden: true,
    minPlayers: 2, maxPlayers: 4,
    localCounts: [2, 3, 4], aiCounts: [1, 2, 3],
    aiDelay: 1000,
    rulesHTML: RULES,
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
      <strong>${esc(p.name)}${p.id === ui.meId && ui.mode === "online" ? " (나)" : ""}</strong>
      <span>🃏 ${p.count ?? 0}장${p.count === 1 ? " 🔔" : ""}</span>
    </div>`).join("");

  let body = "";
  if (pub.phase === "playing") {
    const canDraw = ui.canAct && !pub.pendingDraw;
    body += `<div class="unotable">
      <button class="pile" id="draw" ${canDraw ? "" : "disabled"}>
        <span class="uno back"><b>UNO</b></span><small>뽑기 (${pub.deckCount ?? 0}장)</small>
      </button>
      <div class="pile">${pub.top ? unoCard(pub.top, { cls: "big" }) : ""}
        <small><span class="dot ${color}"></span>지금 색: ${E.COLOR_KO[color]}</small></div>
    </div>
    <p class="round">진행 방향 ${pub.dir === 1 ? "→" : "←"}</p>`;

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
        body += `<p class="hint">뽑은 카드를 낼 수 있어요</p>
          <div class="actions"><button id="pass" class="ghost">내지 않고 넘기기</button></div>`;
      } else {
        body += `<p class="hint">낼 카드를 누르거나, 없으면 더미에서 뽑으세요</p>`;
      }
      body += `<div class="picker" id="picker" hidden>
        <p>다음 색을 골라 주세요</p>
        <div class="actions">${E.COLORS.map(c => `<button class="uno ${c}" data-color="${c}"><b>${E.COLOR_KO[c]}</b></button>`).join("")}</div>
        <div class="actions"><button id="cancelPick" class="ghost">취소</button></div>
      </div>`;
    } else {
      body += `<p class="wait">${esc(turn?.name ?? "")} 차례예요...</p>`;
    }
  }

  if (pub.phase === "gameOver") {
    const w = players.find(p => p.id === pub.winnerId);
    body += `<h2>🏆 ${w ? esc(w.name) + " 우승!" : "게임 끝"}</h2>
      <div class="reveal"><h3>남은 카드</h3><ul>${[...players].sort((a, b) => (a.count || 0) - (b.count || 0)).map(p =>
        `<li><div class="rhead"><strong>${esc(p.name)}</strong><span>${p.count || 0}장</span></div></li>`).join("")}</ul></div>`;
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
  container.querySelector("#pass")?.addEventListener("click", () => ui.act({ type: "pass" }));
  bindFooter(container, ui);
}
