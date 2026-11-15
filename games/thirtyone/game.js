import { runTurnGame } from "../../js/turn-game.js";
import { esc, hearts, footerHTML, bindFooter, logHTML, bindConfirm } from "../../js/ui.js";
import { cardFace, cardBack, cardLabel } from "../../js/cards.js";
import { t, addStrings } from "../../js/i18n.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

addStrings({
  ko: {
    "31.header": "{round}라운드 / 목숨 {lives}개 / 같은 무늬 합 31",
    "31.out": "탈락", "31.turn": "차례",
    "31.banner": "🔒 {name} Lock! 나머지는 마지막 교환 기회예요",
    "31.deck": "더미 ({n}장)", "31.discardPile": "바닥",
    "31.keep": "남는 점수 {n}", "31.keepTriple": "트리플! 즉시 승리",
    "31.pick": "반납할 카드를 눌러 주세요",
    "31.myScore": "내 점수", "31.theirScore": "{name}의 점수",
    "31.drawHint": "더미나 바닥에서 한 장 가져오세요",
    "31.lockBtn": "🔒 Lock (그만 받기)", "31.lockConfirm": "한 번 더 누르면 Lock!",
    "31.reveal": "카드 공개", "31.revealTriple": "🎉 트리플! 즉시 승리",
    "31.pts": "{n}점", "31.tripleTag": "트리플!", "31.giveBack": "{card} 반납",
    // 진행 기록
    "31.start": "{round}라운드 시작! {name}부터 해요",
    "31.drawDeck": "{name}: 더미에서 한 장 가져왔어요",
    "31.drawDiscard": "{name}: 바닥의 {card} 가져왔어요",
    "31.lock": "🔒 {name} Lock! 나머지는 마지막으로 한 번씩 교환해요",
    "31.discard": "{name}: {card} 반납했어요",
    "31.triple": "🎉 {names} 트리플({r}·{r}·{r})! 즉시 1등",
    "31.lost": "목숨 -1: {names}",
    "31.noLoss": "목숨 손실 없음",
    "31.tie": "모두 동점! 목숨 손실 없음",
    "31.round": "👑 {names} {top}점! 목숨 -1: {lost} ({low}점)",
    "31.champ": "🏆 {name} 최종 우승!",
    "31.allOut": "모두 탈락! 무승부예요",
  },
  en: {
    "31.header": "Round {round} / {lives} lives / 31 in one suit",
    "31.out": "Out", "31.turn": "Turn",
    "31.banner": "🔒 Lock by {name}! Everyone else gets one last swap",
    "31.deck": "Deck ({n})", "31.discardPile": "Discard",
    "31.keep": "Keeps {n}", "31.keepTriple": "Triple! Instant win",
    "31.pick": "Tap a card to give back",
    "31.myScore": "My score", "31.theirScore": "{name}'s score",
    "31.drawHint": "Take a card from the deck or the discard pile",
    "31.lockBtn": "🔒 Lock (stop drawing)", "31.lockConfirm": "Tap again to lock!",
    "31.reveal": "Cards revealed", "31.revealTriple": "🎉 Triple! Instant win",
    "31.pts": "{n} pts", "31.tripleTag": "Triple!", "31.giveBack": "Give back {card}",
    "31.start": "Round {round}! First up: {name}",
    "31.drawDeck": "{name}: drew from the deck",
    "31.drawDiscard": "{name}: took {card} from the discard pile",
    "31.lock": "🔒 Lock by {name}! Everyone else gets one last turn",
    "31.discard": "{name}: gave back {card}",
    "31.triple": "🎉 Triple {r}-{r}-{r} for {names}! Instant win",
    "31.lost": "−1 life: {names}",
    "31.noLoss": "No lives lost",
    "31.tie": "All tied! No lives lost",
    "31.round": "👑 Top: {names} ({top} pts). −1 life: {lost} ({low} pts)",
    "31.champ": "🏆 Champion: {name}!",
    "31.allOut": "Everyone is out! It's a draw",
  },
});

const RULES = {
  ko: `<ul>
    <li>각자 카드 3장을 받고, 바닥에 1장을 펼쳐 놓고 시작해요.</li>
    <li>내 차례에는 <b>더미</b>(뒤집힌 카드)나 <b>바닥</b>(펼쳐진 카드)에서 1장을 가져오고, 1장을 바닥에 반납해요. 손에는 항상 3장!</li>
    <li>점수는 <b>같은 무늬 카드의 합</b>이에요. A는 11, J·Q·K는 10, 나머지는 숫자 그대로예요. 최고 점수는 31점.</li>
    <li><b>같은 숫자 3장(트리플, 예: 7·7·7)</b>을 만들면 그 순간 <b>즉시 1등</b>! 나머지는 모두 목숨 -1. 처음 받은 3장이 트리플이어도 바로 이겨요.</li>
    <li>그만 받고 싶으면 가져오는 대신 <b>🔒 Lock</b>을 눌러요. 다른 사람은 마지막으로 한 번씩 교환할 수 있어요.</li>
    <li>그다음 모두 카드를 공개해요. 31에 가장 가까운 사람이 1등, <b>가장 낮은 사람은 목숨 -1</b>.</li>
    <li>목숨은 3개, 마지막까지 남은 사람이 우승이에요.</li>
  </ul>`,
  en: `<ul>
    <li>Everyone gets 3 cards, and one card is turned face up on the discard pile.</li>
    <li>On your turn, take 1 card from the <b>deck</b> (face down) or the <b>discard pile</b> (face up), then give 1 card back. You always hold 3 cards.</li>
    <li>Your score is the <b>total of cards in one suit</b>. A = 11, J/Q/K = 10, others are their number. The best score is 31.</li>
    <li>Make <b>three of the same rank (a triple, e.g. 7-7-7)</b> and you <b>win the round instantly</b>! Everyone else loses a life. A triple in your first 3 cards wins right away too.</li>
    <li>Happy with your hand? Instead of drawing, tap <b>🔒 Lock</b>. Everyone else gets one last turn to swap.</li>
    <li>Then all cards are revealed. Closest to 31 is first; <b>the lowest score loses a life</b>.</li>
    <li>You have 3 lives. The last player standing wins.</li>
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

const keepText = rest => (E.isTriple(rest) ? `<b>${esc(t("31.keepTriple"))}</b>` : esc(t("31.keep", { n: E.score(rest) })));

function render(container, pub, mine, ui) {
  const players = pub.players || [];
  const nameOf = id => players.find(p => p.id === id)?.name ?? "";
  const turn = players.find(p => p.id === pub.turnId);
  const status = p => p.lives <= 0 ? t("31.out") : p.id === pub.lockBy ? "🔒 Lock" : p.id === pub.turnId ? t("31.turn") : "";
  const scoreLabel = ui.mode === "local" ? t("31.theirScore", { name: nameOf(ui.meId) }) : t("31.myScore");

  const seats = players.map(p => `
    <div class="pcard ${p.id === pub.turnId ? "turn" : ""} ${p.lives <= 0 ? "out" : ""}">
      <strong>${esc(p.name)}${p.id === ui.meId && ui.mode === "online" ? esc(t("me.suffix")) : ""}</strong>
      <span>${hearts(p.lives, E.START_LIVES)}</span>
      <small>${esc(status(p))}</small>
    </div>`).join("");

  let body = "";

  if (pub.phase === "playing") {
    const drawStep = ui.canAct && pub.step === "draw";
    const discardStep = ui.canAct && pub.step === "discard";

    if (pub.lockBy) body += `<div class="banner">${esc(t("31.banner", { name: nameOf(pub.lockBy) }))}</div>`;

    body += `<div class="table31">
      <button class="pile" id="deck" ${drawStep ? "" : "disabled"}>${cardBack()}<small>${esc(t("31.deck", { n: pub.deckCount ?? 0 }))}</small></button>
      <button class="pile" id="top" ${drawStep && pub.discardTop ? "" : "disabled"}>${pub.discardTop ? cardFace(pub.discardTop) : cardBack("empty")}<small>${esc(t("31.discardPile"))}</small></button>
    </div>`;

    const hand = (mine && mine.hand) || [];
    if (hand.length === 4 && discardStep) {
      body += `<div class="hand">${hand.map((c, i) => `
        <div class="slot">
          ${cardFace(c, { tag: "button", cls: i === 3 ? "new" : "", attrs: `data-i="${i}" aria-label="${esc(t("31.giveBack", { card: cardLabel(c) }))}"` })}
          <small>${keepText(hand.filter((_, j) => j !== i))}</small>
        </div>`).join("")}</div>
        <p class="hint">${esc(t("31.pick"))}</p>`;
    } else if (hand.length) {
      body += `<div class="hand">${hand.map(c => cardFace(c)).join("")}</div>
        <p class="sum">${esc(scoreLabel)} <b>${E.score(hand)}</b></p>`;
    }

    if (drawStep) {
      body += `<p class="hint">${esc(t("31.drawHint"))}</p>`;
      if (!pub.lockBy) body += `<div class="actions"><button id="lock" class="dark" data-confirm="${esc(t("31.lockConfirm"))}">${esc(t("31.lockBtn"))}</button></div>`;
    } else if (!ui.canAct) {
      body += `<p class="wait">${esc(t("turnOf", { name: turn?.name ?? "" }))}</p>`;
    }
  }

  if (pub.phase === "roundEnd" || pub.phase === "gameOver") body += revealHTML(pub);

  if (pub.phase === "gameOver") {
    const w = players.find(p => p.id === pub.winnerId);
    body += `<h2>${esc(w ? t("winner", { name: w.name }) : t("draw"))}</h2>`;
  }

  container.innerHTML = `<div class="game">
    <div class="round">${esc(t("31.header", { round: pub.round, lives: E.START_LIVES }))}</div>
    <div class="players">${seats}</div>
    ${body}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;

  container.querySelector("#deck")?.addEventListener("click", () => ui.act({ type: "drawDeck" }));
  container.querySelector("#top")?.addEventListener("click", () => ui.act({ type: "drawDiscard" }));
  container.querySelectorAll(".hand button[data-i]").forEach(el =>
    el.addEventListener("click", () => ui.act({ type: "discard", index: Number(el.dataset.i) })));
  bindConfirm(container.querySelector("#lock"), () => ui.act({ type: "lock" }));
  bindFooter(container, ui);
}

function revealHTML(pub) {
  const r = pub.result;
  if (!r) return "";
  const lost = r.lostIds || [];
  const win = r.winnerIds || [];
  return `<div class="reveal"><h3>${esc(t(r.instant ? "31.revealTriple" : "31.reveal"))}</h3><ul>${(r.reveal || []).map(x => `
    <li class="${win.includes(x.id) ? "best" : ""}">
      <div class="rhead">
        <strong>${win.includes(x.id) ? "👑 " : ""}${esc(x.name)}${x.id === r.lockBy ? " 🔒" : ""}</strong>
        <span>${x.triple ? `<b>${esc(t("31.tripleTag"))}</b>` : `<b>${esc(t("31.pts", { n: x.score }))}</b>`}${lost.includes(x.id) ? " ❤️-1" : ""}</span>
      </div>
      <div class="mini">${(x.hand || []).map(c => cardFace(c, { cls: "small" })).join("")}</div>
    </li>`).join("")}</ul></div>`;
}
