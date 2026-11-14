// 여러 게임이 함께 쓰는 화면 도우미
export const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function hearts(n, max) {
  const k = Math.max(0, n || 0);
  return "❤️".repeat(k) + "🖤".repeat(Math.max(0, max - k));
}

// 라운드 끝 / 게임 끝 버튼
export function footerHTML(pub, ui) {
  if (pub.phase === "roundEnd") {
    return ui.onNext
      ? `<div class="actions"><button id="next">다음 라운드</button></div>`
      : `<p class="wait">방장이 다음 라운드를 시작할 때까지 기다려요</p>`;
  }
  if (pub.phase === "gameOver") {
    return ui.onRestart
      ? `<div class="actions"><button id="again">다시 하기</button></div>`
      : `<p class="wait">방장이 새 게임을 시작할 때까지 기다려요</p>`;
  }
  return "";
}

export function bindFooter(container, ui) {
  container.querySelector("#next")?.addEventListener("click", () => ui.onNext && ui.onNext());
  container.querySelector("#again")?.addEventListener("click", () => ui.onRestart && ui.onRestart());
}

// 최근 진행 기록 (마지막 줄이 가장 최근)
export function logHTML(pub, count = 3) {
  const lines = (pub.log || []).slice(-count);
  if (!lines.length) return "";
  return `<ul class="log">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
}
