// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  readyResolve(ClassHTML);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
