// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Stage.init();
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  await Store.init();
  await Session.init();
  Ink.init();      // Session.doc이 있어야 한다
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels, InkGeom, InkModel, Store, Session, Tools, Ink };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
