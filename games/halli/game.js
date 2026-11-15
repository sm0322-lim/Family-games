import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML, logText } from "../../js/ui.js";
import { t, addStrings } from "../../js/i18n.js";
import * as E from "./engine.js";
import { decide, reactions } from "./ai.js";

const FRUIT = { S: "🍓", B: "🍌", L: "🍋", G: "🍇" };

addStrings({
  ko: {
    "halli.deck": "🂠 {n}장",
    "halli.flip": "뒤집기",
    "halli.outTag": "탈락",
    "halli.myCards": "내 카드 {n}장",
    "halli.myTurn": "내 차례: 카드를 뒤집어요",
    "halli.watch": "한 과일이 정확히 5개면 🔔 종을 쳐요!",
    "halli.youOut": "카드를 모두 잃었어요. 구경해요",
    "halli.ringAria": "{name} 종 치기",
    // 진행 기록
    "halli.start": "게임 시작! {name}부터 뒤집어요",
    "halli.good": "🔔 {name} 정답! 카드 {n}장 획득",
    "halli.bad": "🔔 {name} 틀렸어요! {n}장을 나눠줘요",
    "halli.out": "{name} 탈락",
    "halli.win": "🏆 {name} 우승!",
    "halli.stuck": "뒤집을 카드가 없어요. 카드가 가장 많은 {name} 우승!",
  },
  en: {
    "halli.deck": "🂠 {n}",
    "halli.flip": "Flip",
    "halli.outTag": "Out",
    "halli.myCards": "My cards: {n}",
    "halli.myTurn": "Your turn: flip a card",
    "halli.watch": "Ring 🔔 when one fruit adds up to exactly 5!",
    "halli.youOut": "You're out of cards. Enjoy watching",
    "halli.ringAria": "Bell for {name}",
    "halli.start": "Game on! First to flip: {name}",
    "halli.good": "🔔 {name}: correct! +{n} cards",
    "halli.bad": "🔔 {name}: wrong bell! Gave away {n} cards",
    "halli.out": "Out: {name}",
    "halli.win": "🏆 Winner: {name}!",
    "halli.stuck": "No cards left to flip. Most cards wins: {name}!",
  },
});

const RULES = {
  ko: `<ul>
    <li>과일 카드(🍓 딸기, 🍌 바나나, 🍋 레몬, 🍇 포도)를 모두 똑같이 나눠 가져요.</li>
    <li>차례대로 <b>뒤집기</b>를 눌러 내 카드를 한 장씩 펼쳐요. 각자 맨 위 카드만 보여요.</li>
    <li>펼쳐진 카드 중 <b>한 과일이 정확히 5개</b>가 되면 가장 먼저 <b>🔔 종</b>을 친 사람이 펼쳐진 카드를 모두 가져가요.</li>
    <li>5개가 아닌데 종을 치면 다른 사람에게 1장씩 나눠줘요.</li>
    <li>카드를 모두 잃으면 탈락, 마지막까지 남은 사람이 우승이에요.</li>
    <li>한 기기 모드에서는 폰을 가운데 두고 각자 자기 앞의 종을 쳐요. 위쪽 자리는 화면이 뒤집혀 보여요.</li>
  </ul>`,
  en: `<ul>
    <li>All fruit cards (🍓 strawberry, 🍌 banana, 🍋 lemon, 🍇 grape) are dealt out evenly.</li>
    <li>Take turns tapping <b>Flip</b> to turn over your top card. Only each player's top card counts.</li>
    <li>When the face-up cards show <b>exactly 5 of one fruit</b>, the first to ring the <b>🔔 bell</b> wins all face-up cards.</li>
    <li>Ring when it isn't 5 and you give 1 card to each other player.</li>
    <li>Run out of cards and you're out. The last player left wins.</li>
    <li>In one-phone mode, put the phone in the middle; everyone rings their own bell. Seats at the top see the screen upside down.</li>
  </ul>`,
};

export function start(opts) {
  return runTurnGame({
    hidden: false,
    minPlayers: 2, maxPlayers: 4,
    localCounts: [2, 3, 4], aiCounts: [1, 2, 3],
    levels: ["easy", "normal", "hard"],
    aiDelay: 1400,
    turnSound: false,
    rules: RULES,
    newGame: E.newGame, nextRound: E.nextRound, act: E.act,
    publicView: E.publicView, privateView: E.privateView,
    aiAction: decide,
    aiReactions: reactions,
    render,
  }, opts);
}

function fruitCard(c, cls = "") {
  if (!c) return `<div class="hg-card empty ${cls}"></div>`;
  const f = FRUIT[c.f] || "❓";
  const n = Math.max(1, Math.min(5, Number(c.n) || 1));
  return `<div class="hg-card n${n} ${cls}">${Array.from({ length: n }, () => `<span>${f}</span>`).join("")}</div>`;
}

function render(container, pub, mine, ui) {
  if (ui.mode === "local") renderLocal(container, pub, ui);
  else renderTable(container, pub, ui);

  // 종은 손가락이 닿는 순간 반응하도록 pointerdown 사용
  container.querySelectorAll("[data-ring]").forEach(el => el.addEventListener("pointerdown", e => {
    e.preventDefault();
    el.classList.add("hit");
    ui.actAs(el.dataset.ring, { type: "ring", ver: pub.ver });
  }));
  container.querySelectorAll("[data-flip]").forEach(el => el.addEventListener("click", () =>
    ui.actAs(el.dataset.flip, { type: "flip" })));
  bindFooter(container, ui);
}

// 한 기기: 폰을 가운데 두고 각자 자기 자리의 종을 쳐요
function renderLocal(container, pub, ui) {
  const ps = pub.players || [];
  const topCount = Math.floor(ps.length / 2);
  const zone = p => {
    const turn = p.id === pub.turnId;
    return `<div class="hg-zone ${turn ? "turn" : ""} ${p.out ? "out" : ""}">
      <div class="hg-zinfo"><strong>${esc(p.name)}</strong> <span>${esc(t("halli.deck", { n: p.deck }))}</span></div>
      ${fruitCard(p.top)}
      <div class="hg-zbtns">
        ${p.out || pub.phase !== "playing" ? `<span class="wait">${p.out ? esc(t("halli.outTag")) : ""}</span>`
          : `<button class="bell" data-ring="${esc(p.id)}" aria-label="${esc(t("halli.ringAria", { name: p.name }))}">🔔</button>`}
        ${turn ? `<button class="flipbtn" data-flip="${esc(p.id)}">${esc(t("halli.flip"))}</button>` : ""}
      </div>
    </div>`;
  };
  const lastEntry = (pub.log || []).slice(-1)[0];
  const winner = ps.find(p => p.id === pub.winnerId);
  container.innerHTML = `<div class="hg-local">
    <div class="hg-row top">${ps.slice(0, topCount).map(zone).join("")}</div>
    <div class="hg-mid">
      ${pub.phase === "gameOver" ? `<h2>${esc(winner ? t("winner", { name: winner.name }) : t("draw"))}</h2>${footerHTML(pub, ui)}`
        : esc(lastEntry ? logText(lastEntry) : t("halli.watch"))}
    </div>
    <div class="hg-row">${ps.slice(topCount).map(zone).join("")}</div>
  </div>`;
}

// 컴퓨터 상대 / 온라인: 다른 사람은 위에 작게, 내 자리는 아래에 크게
function renderTable(container, pub, ui) {
  const ps = pub.players || [];
  const me = ps.find(p => p.id === ui.meId);
  const others = ps.filter(p => p !== me);

  const otherHTML = others.map(p => `
    <div class="hg-other ${p.id === pub.turnId ? "turn" : ""} ${p.out ? "out" : ""}">
      <strong>${esc(p.name)}</strong>
      ${fruitCard(p.top, "small")}
      <small>${esc(p.out ? t("halli.outTag") : t("halli.deck", { n: p.deck }))}</small>
    </div>`).join("");

  let meHTML = "";
  if (me) {
    const myTurn = me.id === pub.turnId && ui.canAct;
    meHTML = `<div class="hg-me ${me.id === pub.turnId ? "turn" : ""} ${me.out ? "out" : ""}">
      <div class="hg-zinfo"><strong>${esc(me.name)}${ui.mode === "online" ? esc(t("me.suffix")) : ""}</strong> <span>${esc(t("halli.myCards", { n: me.deck }))}</span></div>
      ${fruitCard(me.top, "big")}
      ${pub.phase === "playing" && !me.out ? `<div class="hg-mybtns">
        ${myTurn ? `<button class="flipbtn big" data-flip="${esc(me.id)}">${esc(t("halli.flip"))}</button>` : ""}
        <button class="bell big" data-ring="${esc(me.id)}" aria-label="${esc(t("halli.ringAria", { name: me.name }))}">🔔</button>
      </div>` : ""}
    </div>`;
  }

  let hint = "";
  if (pub.phase === "playing") {
    if (me && me.out) hint = t("halli.youOut");
    else if (me && me.id === pub.turnId) hint = t("halli.myTurn");
    else hint = t("halli.watch");
  }
  const winner = ps.find(p => p.id === pub.winnerId);

  container.innerHTML = `<div class="game">
    <div class="hg-others">${otherHTML}</div>
    ${meHTML}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    ${pub.phase === "gameOver" ? `<h2>${esc(winner ? t("winner", { name: winner.name }) : t("draw"))}</h2>` : ""}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;
}
