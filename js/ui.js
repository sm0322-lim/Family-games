// 여러 게임이 함께 쓰는 화면 도우미
import { t } from "./i18n.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function hearts(n, max) {
  const k = Math.max(0, n || 0);
  return "❤️".repeat(k) + "🖤".repeat(Math.max(0, max - k));
}

export const logText = e => (typeof e === "string" ? e : e && e.k ? t(e.k, e.v || {}) : "");

// 라운드 끝 / 게임 끝 버튼
export function footerHTML(pub, ui) {
  if (pub.phase === "roundEnd") {
    return ui.onNext
      ? `<div class="actions"><button id="next">${esc(t("footer.next"))}</button></div>`
      : `<p class="wait">${esc(t("footer.waitNext"))}</p>`;
  }
  if (pub.phase === "gameOver") {
    return ui.onRestart
      ? `<div class="actions"><button id="again">${esc(t("footer.again"))}</button></div>`
      : `<p class="wait">${esc(t("footer.waitAgain"))}</p>`;
  }
  return "";
}

export function bindFooter(container, ui) {
  container.querySelector("#next")?.addEventListener("click", () => ui.onNext && ui.onNext());
  container.querySelector("#again")?.addEventListener("click", () => ui.onRestart && ui.onRestart());
}

// 최근 진행 기록 (마지막 줄이 가장 최근)
export function logHTML(pub, count = 3) {
  const lines = (pub.log || []).slice(-count).map(logText).filter(Boolean);
  if (!lines.length) return "";
  return `<ul class="log">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

// 실수 방지: 두 번 눌러야 실행되는 버튼
export function bindConfirm(btn, onConfirm) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!btn.dataset.armed) {
      btn.dataset.armed = "1";
      btn.textContent = btn.dataset.confirm || t("confirm.again");
      return;
    }
    onConfirm();
  });
}
