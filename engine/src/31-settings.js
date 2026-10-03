// ⚙ 설정: 이 PC의 저장소에 저장하고 수업 화면에 즉시 적용한다.
const Settings = {
  values: { motionOff: false, printInk: false, palmErase: false },
  button: null,
  extras: [],   // 다른 모듈이 설정 창 아래에 붙이는 묶음(그림 채우기·저장 등)
  ITEMS: [
    ['motionOff', '움직임 끄기', '슬라이드 전환과 단계 효과를 끕니다'],
    ['printInk', '인쇄에 판서 포함', '지금 반의 판서와 칠판을 함께 인쇄합니다'],
    ['palmErase', '손바닥으로 지우기 (실험)', '넓게 닿는 터치를 지우개로 씁니다'],
  ],

  async init() {
    const saved = await Store.get('settings');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(this.values)) {
        if (typeof saved[key] === 'boolean') this.values[key] = saved[key];
      }
    }
    this.apply();
    if (!this.button || !this.button.isConnected) {
      this.button = Toolbar.btn('gear', '설정', (e) => Toolbar.togglePop(e.currentTarget, () => this.panel()));
      Toolbar.slots.misc.append(this.button);
    }
  },

  panel() {
    return h('div', { class: 'ch-pop-settings' }, h('h3', { text: '설정' }),
      ...this.ITEMS.map(([key, label, desc]) => h('label', { class: 'ch-switch' },
        h('input', {
          type: 'checkbox', 'data-key': key, checked: this.values[key],
          onchange: (e) => this.set(key, e.target.checked),
        }),
        h('span', null, h('b', { text: label }), h('small', { text: desc })))),
      ...this.extras.map((fn) => fn()));
  },

  set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.values, key)) return;
    this.values[key] = !!value;
    this.apply();
    return Store.set('settings', { ...this.values });
  },

  apply() {
    document.documentElement.classList.toggle('ch-motion-off', this.values.motionOff);
    Ink.palmErase = this.values.palmErase;
    for (const input of qsa('.ch-pop-settings input[data-key]')) input.checked = this.values[input.dataset.key];
  },
};
