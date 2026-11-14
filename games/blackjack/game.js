import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML } from "../../js/ui.js";
import { cardFace, cardBack } from "../../js/cards.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

const RULES = `<ul>
  <li>모두가 컴퓨터 딜러와 대결해요. 칩 ${E.START_CHIPS}개로 시작해요.</li>
  <li>라운드마다 ${E.BETS.join(" / ")}칩 중에서 베팅해요.</li>
  <li>카드 합이 21에 가까울수록 좋아요. 21을 넘으면 버스트로 바로 져요.</li>
  <li>A는 1 또는 11, J·Q·K는 10이에요.</li>
  <li><b>히트</b>: 한 장 더, <b>스탠드</b>: 멈추기, <b>더블</b>: 첫 2장일 때 베팅을 2배로 하고 딱 한 장만 더 받기.</li>
  <li>처음 2장이 21이면 블랙잭! 베팅의 1.5배를 받아요.</li>
  <li>딜러는 17 이상이 될 때까지 카드를 받아요.</li>
  <li>${E.ROUNDS}라운드가 끝나면 칩이 가장 많은 사람이 우승이에요.</li>
</ul>`;

export function start(opts) {
  return runTurnGame({
    hidden: false,
    minPlayers: 1, maxPlayers: 4,
    localCounts: [1, 2, 3, 4], aiCounts: [0, 1, 2, 3],
    aiDelay: 900,
    rulesHTML: RULES,
    newGame: E.newGame, nextRound: E.nextRound, act: E.act,
    publicView: E.publicView, privateView: E.privateView,
    aiAction: decide,
    render,
  }, opts);
}

const mini = cards => (cards || []).map(c => cardFace(c, { cls: "small" })).join("");

function render(container, pub, mine, ui) {
  const players = pub.players || [];
  const turn = players.find(p => p.id === pub.turnId);
  const d = pub.dealer || {};
  const showMe = id => id === ui.meId && ui.mode === "online" ? " (나)" : "";

  const dealerCards = mini(d.cards) + Array.from({ length: d.hidden || 0 }, () => cardBack("small")).join("");
  const dealerHTML = `<div class="dealer">
    <strong>🎩 딜러</strong>
    <div class="mini">${dealerCards || '<span class="wait">베팅을 기다려요</span>'}</div>
    ${d.total != null ? `<small>합계 ${d.total}${d.total > 21 ? " 버스트" : ""}</small>` : ""}
  </div>`;

  let actions = "";
  if (pub.phase === "bet" || pub.phase === "play") {
    if (ui.canAct && turn) {
      if (pub.phase === "bet") {
        actions = `<p class="hint">${esc(turn.name)}, 몇 칩 걸까요? (가진 칩 ${turn.chips})</p>
          <div class="actions">${E.BETS.map(b =>
            `<button data-bet="${b}" ${b > turn.chips ? "disabled" : ""}>${b}칩</button>`).join("")}</div>`;
      } else {
        actions = `<p class="hint">${esc(turn.name)} 차례: 지금 합계 <b>${turn.total}</b></p>
          <div class="actions">
            <button id="hit">히트</button>
            <button id="stand" class="ghost">스탠드</button>
            ${turn.canDouble ? `<button id="double" class="dark">더블</button>` : ""}
          </div>`;
      }
    } else {
      actions = `<p class="wait">${esc(turn?.name ?? "")} 차례예요...</p>`;
    }
  }

  const rows = players.map(p => {
    const hand = p.hand || [];
    const info = [];
    if (p.status === "out") info.push("칩 부족으로 쉬어요");
    else {
      if (p.bet) info.push(`베팅 ${p.bet}`);
      if (hand.length) info.push(`합계 ${p.total}`);
      if (p.result) info.push(`${p.result} ${p.delta > 0 ? "+" + p.delta : p.delta < 0 ? p.delta : "±0"}`);
      else if (p.status === "blackjack") info.push("블랙잭!");
      else if (p.status === "bust") info.push("버스트");
      else if (p.status === "stand") info.push("스탠드");
    }
    const resultCls = p.delta > 0 ? "up" : p.delta < 0 ? "down" : "";
    return `<div class="bjrow ${p.id === pub.turnId ? "turn" : ""} ${p.status === "out" ? "out" : ""}">
      <div class="rhead"><strong>${esc(p.name)}${showMe(p.id)}</strong><span>💰 ${p.chips}</span></div>
      ${hand.length ? `<div class="mini">${mini(hand)}</div>` : ""}
      <small class="${resultCls}">${info.join(" / ")}</small>
    </div>`;
  }).join("");

  let ending = "";
  if (pub.phase === "gameOver") {
    const ranked = [...players].sort((a, b) => b.chips - a.chips);
    const winners = pub.winnerIds || [];
    ending = `<h2>${winners.length ? "🏆 " + esc(players.filter(p => winners.includes(p.id)).map(p => p.name).join(", ")) + " 우승!" : "딜러 승리!"}</h2>
      <div class="reveal"><h3>최종 칩</h3><ul>${ranked.map((p, i) =>
        `<li><div class="rhead"><strong>${i + 1}. ${esc(p.name)}</strong><span>💰 ${p.chips}</span></div></li>`).join("")}</ul></div>`;
  }

  container.innerHTML = `<div class="game">
    <div class="round">${pub.round} / ${pub.rounds}라운드 / 딜러는 17 이상에서 멈춰요</div>
    ${dealerHTML}
    ${actions}
    <div class="bjlist">${rows}</div>
    ${ending}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;

  container.querySelectorAll("[data-bet]").forEach(b =>
    b.addEventListener("click", () => ui.act({ type: "bet", amount: Number(b.dataset.bet) })));
  container.querySelector("#hit")?.addEventListener("click", () => ui.act({ type: "hit" }));
  container.querySelector("#stand")?.addEventListener("click", () => ui.act({ type: "stand" }));
  container.querySelector("#double")?.addEventListener("click", () => ui.act({ type: "double" }));
  bindFooter(container, ui);
}
