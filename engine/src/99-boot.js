// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Stage.init();
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  KeepWords.apply(Stage.deck);   // 목차 제목을 뽑은 뒤 어절을 감싼다
  await Store.init();
  await Session.init();
  Ink.init();      // Session.doc이 있어야 한다
  await Toolbar.init();
  Board.init();    // 툴바 자리(slots.board)에 버튼을 넣는다
  await Settings.init();
  Print.init();
  Audit.init();    // ?audit도 모든 준비가 끝난 다음 실행한다
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML.audit = () => Audit.run();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels, InkGeom, InkModel, Store, Session, Tools, Ink, Toolbar, icon, Board, Settings, KeepWords, Print, Audit };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
