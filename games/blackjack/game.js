import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML } from "../../js/ui.js";
import { cardFace, cardBack } from "../../js/cards.js";
import { t, addStrings } from "../../js/i18n.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

addStrings({
  ko: {
    "bj.header": "{round} / {rounds}라운드 / 딜러는 17 이상에서 멈춰요",
    "bj.dealerName": "🎩 딜러", "bj.waitBets": "베팅을 기다려요",
    "bj.total": "합계 {n}", "bj.totalBust": "합계 {n} 버스트",
    "bj.askBet": "{name}, 몇 칩 걸까요? (가진 칩 {chips})", "bj.chips": "{n}칩",
    "bj.yourTurn": "{name} 차례: 지금 합계 {n}",
    "bj.hitBtn": "히트", "bj.standBtn": "스탠드", "bj.doubleBtn": "더블",
    "bj.noChips": "칩 부족으로 쉬어요", "bj.betInfo": "베팅 {n}",
    "bj.blackjack": "블랙잭!", "bj.bust": "버스트", "bj.standing": "스탠드",
    "bj.res.win": "승", "bj.res.lose": "패", "bj.res.push": "무승부", "bj.res.bj": "블랙잭 승",
    "bj.finalTitle": "최종 칩", "bj.winners": "🏆 {names} 우승!", "bj.dealerWon": "딜러 승리!",
    // 진행 기록
    "bj.round": "{round}라운드: 베팅할 칩을 골라요",
    "bj.bet": "{name}: {n}칩 베팅",
    "bj.hit": "{name}: 히트 → {n}", "bj.hitBust": "{name}: 히트 → {n} 버스트!", "bj.hit21": "{name}: 히트 → 21!",
    "bj.stand": "{name}: 스탠드 ({n})",
    "bj.double": "{name}: 더블 ({bet}칩) → {n}", "bj.doubleBust": "{name}: 더블 ({bet}칩) → {n} 버스트!",
    "bj.dealt": "카드를 2장씩 나눠 줬어요", "bj.dealerBJ": "딜러 블랙잭!",
    "bj.dealer": "딜러: {n}", "bj.dealerBust": "딜러: {n} 버스트!",
    "bj.win": "🏆 {names} 우승! ({n}칩)", "bj.dealerWins": "모두 칩을 잃었어요. 딜러 승리!",
  },
  en: {
    "bj.header": "Round {round} of {rounds} / Dealer stands on 17",
    "bj.dealerName": "🎩 Dealer", "bj.waitBets": "Waiting for bets",
    "bj.total": "Total {n}", "bj.totalBust": "Total {n}, bust",
    "bj.askBet": "Bet for {name} ({chips} chips left)", "bj.chips": "{n} chips",
    "bj.yourTurn": "Turn: {name}, total {n}",
    "bj.hitBtn": "Hit", "bj.standBtn": "Stand", "bj.doubleBtn": "Double",
    "bj.noChips": "Out of chips", "bj.betInfo": "Bet {n}",
    "bj.blackjack": "Blackjack!", "bj.bust": "Bust", "bj.standing": "Stand",
    "bj.res.win": "Win", "bj.res.lose": "Lose", "bj.res.push": "Push", "bj.res.bj": "Blackjack win",
    "bj.finalTitle": "Final chips", "bj.winners": "🏆 Winner: {names}!", "bj.dealerWon": "The dealer wins!",
    "bj.round": "Round {round}: place your bets",
    "bj.bet": "{name}: bet {n} chips",
    "bj.hit": "{name}: hit → {n}", "bj.hitBust": "{name}: hit → {n}, bust!", "bj.hit21": "{name}: hit → 21!",
    "bj.stand": "{name}: stand ({n})",
    "bj.double": "{name}: double ({bet} chips) → {n}", "bj.doubleBust": "{name}: double ({bet} chips) → {n}, bust!",
    "bj.dealt": "Two cards each are dealt", "bj.dealerBJ": "Dealer blackjack!",
    "bj.dealer": "Dealer: {n}", "bj.dealerBust": "Dealer: {n}, bust!",
    "bj.win": "🏆 Winner: {names} ({n} chips)", "bj.dealerWins": "Everyone is out of chips. The dealer wins!",
  },
});

const RULES = {
  ko: `<ul>
    <li>모두가 컴퓨터 딜러와 대결해요. 칩 ${E.START_CHIPS}개로 시작해요.</li>
    <li>라운드마다 ${E.BETS.join(" / ")}칩 중에서 베팅해요.</li>
    <li>카드 합이 21에 가까울수록 좋아요. 21을 넘으면 버스트로 바로 져요.</li>
    <li>A는 1 또는 11, J·Q·K는 10이에요.</li>
    <li><b>히트</b>: 한 장 더, <b>스탠드</b>: 멈추기, <b>더블</b>: 첫 2장일 때 베팅을 2배로 하고 딱 한 장만 더 받기.</li>
    <li>처음 2장이 21이면 블랙잭! 베팅의 1.5배를 받아요.</li>
    <li>딜러는 17 이상이 될 때까지 카드를 받아요.</li>
    <li>${E.ROUNDS}라운드가 끝나면 칩이 가장 많은 사람이 우승이에요.</li>
  </ul>`,
  en: `<ul>
    <li>Everyone plays against the computer dealer. You start with ${E.START_CHIPS} chips.</li>
    <li>Each round, bet ${E.BETS.join(" / ")} chips.</li>
    <li>Get as close to 21 as you can. Go over 21 and you bust and lose right away.</li>
    <li>A counts as 1 or 11; J, Q and K count as 10.</li>
    <li><b>Hit</b>: take a card. <b>Stand</b>: stop. <b>Double</b>: on your first 2 cards, double your bet and take exactly one more card.</li>
    <li>21 with your first 2 cards is blackjack and pays 1.5 times your bet.</li>
    <li>The dealer draws until reaching 17 or more.</li>
    <li>After ${E.ROUNDS} rounds, the player with the most chips wins.</li>
  </ul>`,
};

export function start(opts) {
  return runTurnGame({
    hidden: false,
    minPlayers: 1, maxPlayers: 4,
    localCounts: [1, 2, 3, 4], aiCounts: [0, 1, 2, 3],
    aiDelay: 900,
    rules: RULES,
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
  const meTag = id => (id === ui.meId && ui.mode === "online" ? esc(t("me.suffix")) : "");

  const dealerCards = mini(d.cards) + Array.from({ length: d.hidden || 0 }, () => cardBack("small")).join("");
  const dealerHTML = `<div class="dealer">
    <strong>${esc(t("bj.dealerName"))}</strong>
    <div class="mini">${dealerCards || `<span class="wait">${esc(t("bj.waitBets"))}</span>`}</div>
    ${d.total != null ? `<small>${esc(t(d.total > 21 ? "bj.totalBust" : "bj.total", { n: d.total }))}</small>` : ""}
  </div>`;

  let actions = "";
  if (pub.phase === "bet" || pub.phase === "play") {
    if (ui.canAct && turn) {
      if (pub.phase === "bet") {
        actions = `<p class="hint">${esc(t("bj.askBet", { name: turn.name, chips: turn.chips }))}</p>
          <div class="actions">${E.BETS.map(b =>
            `<button data-bet="${b}" ${b > turn.chips ? "disabled" : ""}>${esc(t("bj.chips", { n: b }))}</button>`).join("")}</div>`;
      } else {
        actions = `<p class="hint">${esc(t("bj.yourTurn", { name: turn.name, n: turn.total }))}</p>
          <div class="actions">
            <button id="hit">${esc(t("bj.hitBtn"))}</button>
            <button id="stand" class="ghost">${esc(t("bj.standBtn"))}</button>
            ${turn.canDouble ? `<button id="double" class="dark">${esc(t("bj.doubleBtn"))}</button>` : ""}
          </div>`;
      }
    } else {
      actions = `<p class="wait">${esc(t("turnOf", { name: turn?.name ?? "" }))}</p>`;
    }
  }

  const rows = players.map(p => {
    const hand = p.hand || [];
    const info = [];
    if (p.status === "out") info.push(t("bj.noChips"));
    else {
      if (p.bet) info.push(t("bj.betInfo", { n: p.bet }));
      if (hand.length) info.push(t("bj.total", { n: p.total }));
      if (p.result) info.push(`${t("bj.res." + p.result)} ${p.delta > 0 ? "+" + p.delta : p.delta < 0 ? p.delta : "±0"}`);
      else if (p.status === "blackjack") info.push(t("bj.blackjack"));
      else if (p.status === "bust") info.push(t("bj.bust"));
      else if (p.status === "stand") info.push(t("bj.standing"));
    }
    const resultCls = p.delta > 0 ? "up" : p.delta < 0 ? "down" : "";
    return `<div class="bjrow ${p.id === pub.turnId ? "turn" : ""} ${p.status === "out" ? "out" : ""}">
      <div class="rhead"><strong>${esc(p.name)}${meTag(p.id)}</strong><span>💰 ${p.chips}</span></div>
      ${hand.length ? `<div class="mini">${mini(hand)}</div>` : ""}
      <small class="${resultCls}">${esc(info.join(" / "))}</small>
    </div>`;
  }).join("");

  let ending = "";
  if (pub.phase === "gameOver") {
    const ranked = [...players].sort((a, b) => b.chips - a.chips);
    const winners = pub.winnerIds || [];
    const names = players.filter(p => winners.includes(p.id)).map(p => p.name).join(", ");
    ending = `<h2>${esc(winners.length ? t("bj.winners", { names }) : t("bj.dealerWon"))}</h2>
      <div class="reveal"><h3>${esc(t("bj.finalTitle"))}</h3><ul>${ranked.map((p, i) =>
        `<li><div class="rhead"><strong>${i + 1}. ${esc(p.name)}</strong><span>💰 ${p.chips}</span></div></li>`).join("")}</ul></div>`;
  }

  container.innerHTML = `<div class="game">
    <div class="round">${esc(t("bj.header", { round: pub.round, rounds: pub.rounds }))}</div>
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
