// 아직 만들지 않은 게임의 자리. 게임을 완성하면 이 파일을 교체하고
// js/app.js의 GAMES 목록에서 ready: true 로 바꿔 주세요.
export function start({ container }) {
  container.innerHTML = `<div class="game">
    <p class="icon-big">🛠️</p>
    <h2>준비 중이에요</h2>
    <p class="wait">31 만들기를 먼저 즐겨 주세요</p>
  </div>`;
}
