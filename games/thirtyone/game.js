import { runTurnGame } from "../../js/turn-game.js";
import { esc, hearts, footerHTML, bindFooter, logHTML } from "../../js/ui.js";
import { cardFace, cardBack, cardLabel } from "../../js/cards.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

const RULES = `<ul>
  <li>각자 카드 3장을 받고, 바닥에 1장을 펼쳐 놓고 시작해요.</li>
  <li>내 차례에는 <b>더미</b>(뒤집힌 카드)나 <b>바닥</b>(펼쳐진 카드)에서 1장을 가져오고, 1장을 바닥에 반납해요. 손에는 항상 3장!</li>
  <li>점수는 <b>같은 무늬 카드의 합</b>이에요. A는 11, J·Q·K는 10, 나머지는 숫자 그대로예요. 최고 점수는 31점.</li>
  <li>그만 받고 싶으면 가져오는 대신 <b>🔒 Lock</b>을 눌러요. 다른 사람은 마지막으로 한 번씩 교환할 수 있어요.</li>
  <li>그다음 모두 카드를 공개해요. 31에 가장 가까운 사람이 1등, <b>가장 낮은 사람은 목숨 -1</b>.</li>
  <li>목숨은 3개, 마지막까지 남은 사람이 우승이에요.</li>
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

function render(container, pub, mine, ui) {
  const players = pub.players || [];
  const nameOf = id => players.find(p => p.id === id)?.name ?? "";
  const turn = players.find(p => p.id === pub.turnId);
  const status = p => p.lives <= 0 ? "탈락" : p.id === pub.lockBy ? "🔒 Lock" : p.id === pub.turnId ? "차례" : "";
  const meLabel = ui.mode === "local" ? `${esc(nameOf(ui.meId))}의` : "내";

  const seats = players.map(p => `
    <div class="pcard ${p.id === pub.turnId ? "turn" : ""} ${p.lives <= 0 ? "out" : ""}">
      <strong>${esc(p.name)}${p.id === ui.meId && ui.mode === "online" ? " (나)" : ""}</strong>
      <span>${hearts(p.lives, E.START_LIVES)}</span>
      <small>${status(p)}</small>
    </div>`).join("");

  let body = "";

  if (pub.phase === "playing") {
    const drawStep = ui.canAct && pub.step === "draw";
    const discardStep = ui.canAct && pub.step === "discard";

    if (pub.lockBy) body += `<div class="banner">🔒 ${esc(nameOf(pub.lockBy))} Lock! 나머지는 마지막 교환 기회예요</div>`;

    body += `<div class="table31">
      <button class="pile" id="deck" ${drawStep ? "" : "disabled"}>${cardBack()}<small>더미 (${pub.deckCount ?? 0}장)</small></button>
      <button class="pile" id="top" ${drawStep && pub.discardTop ? "" : "disabled"}>${pub.discardTop ? cardFace(pub.discardTop) : cardBack("empty")}<small>바닥</small></button>
    </div>`;

    const hand = (mine && mine.hand) || [];
    if (hand.length === 4 && discardStep) {
      body += `<div class="hand">${hand.map((c, i) => `
        <div class="slot">
          ${cardFace(c, { tag: "button", cls: i === 3 ? "new" : "", attrs: `data-i="${i}" aria-label="${cardLabel(c)} 반납"` })}
          <small>남는 점수 ${E.score(hand.filter((_, j) => j !== i))}</small>
        </div>`).join("")}</div>
        <p class="hint">반납할 카드를 눌러 주세요</p>`;
    } else if (hand.length) {
      body += `<div class="hand">${hand.map(c => cardFace(c)).join("")}</div>
        <p class="sum">${meLabel} 점수 <b>${E.score(hand)}</b></p>`;
    }

    if (drawStep) {
      body += `<p class="hint">더미나 바닥에서 한 장 가져오세요</p>`;
      if (!pub.lockBy) body += `<div class="actions"><button id="lock" class="dark">🔒 Lock (그만 받기)</button></div>`;
    } else if (!ui.canAct) {
      body += `<p class="wait">${esc(turn?.name ?? "")} 차례예요...</p>`;
    }
  }

  if (pub.phase === "roundEnd" || pub.phase === "gameOver") body += revealHTML(pub);

  if (pub.phase === "gameOver") {
    const w = players.find(p => p.id === pub.winnerId);
    body += `<h2>🏆 ${w ? esc(w.name) + " 우승!" : "무승부"}</h2>`;
  }

  container.innerHTML = `<div class="game">
    <div class="round">${pub.round}라운드 / 목숨 ${E.START_LIVES}개 / 같은 무늬 합 31</div>
    <div class="players">${seats}</div>
    ${body}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;

  container.querySelector("#deck")?.addEventListener("click", () => ui.act({ type: "drawDeck" }));
  container.querySelector("#top")?.addEventListener("click", () => ui.act({ type: "drawDiscard" }));
  container.querySelectorAll(".hand button[data-i]").forEach(el =>
    el.addEventListener("click", () => ui.act({ type: "discard", index: Number(el.dataset.i) })));

  // Lock은 실수로 누르지 않게 두 번 눌러야 확정
  const lock = container.querySelector("#lock");
  lock?.addEventListener("click", () => {
    if (!lock.dataset.armed) {
      lock.dataset.armed = "1";
      lock.textContent = "한 번 더 누르면 Lock!";
      return;
    }
    ui.act({ type: "lock" });
  });

  bindFooter(container, ui);
}

function revealHTML(pub) {
  const r = pub.result;
  if (!r) return "";
  const lost = r.lostIds || [];
  const win = r.winnerIds || [];
  return `<div class="reveal"><h3>카드 공개</h3><ul>${(r.reveal || []).map(x => `
    <li class="${win.includes(x.id) ? "best" : ""}">
      <div class="rhead">
        <strong>${win.includes(x.id) ? "👑 " : ""}${esc(x.name)}${x.id === r.lockBy ? " 🔒" : ""}</strong>
        <span><b>${x.score}</b>점${lost.includes(x.id) ? " ❤️-1" : ""}</span>
      </div>
      <div class="mini">${(x.hand || []).map(c => cardFace(c, { cls: "small" })).join("")}</div>
    </li>`).join("")}</ul></div>`;
}
