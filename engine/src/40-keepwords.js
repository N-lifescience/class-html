// 어절을 nowrap span으로 감싸고 인라인 요소 사이에 WORD JOINER(U+2060)를 넣는다.
// 원래 요소와 이벤트는 보존하며, .w 내부를 건너뛰어 다시 적용해도 중첩하지 않는다.
const KeepWords = {
  SKIP: 'svg, math, script, style, pre, code, textarea, select, button, canvas, .katex, .w, [data-no-keep], [contenteditable=""], [contenteditable="true"]',

  apply(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest(KeepWords.SKIP)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => this.wrap(node));
  },

  inline(el) {
    if (/^(BR|WBR)$/.test(el.tagName)) return false;
    const display = getComputedStyle(el).display;
    if (display) return /^(inline|inline-block|inline-flex|inline-grid|inline-table|contents|ruby.*)$/.test(display);
    // 분리된 요소도 보정할 수 있도록 브라우저 기본 인라인 태그를 사용한다.
    return /^(A|ABBR|B|BDI|BDO|CITE|CODE|DATA|DEL|DFN|EM|I|INS|KBD|LABEL|MARK|Q|RP|RT|RUBY|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|U|VAR)$/.test(el.tagName);
  },

  // 경계 쪽 첫 문자가 공백이면 끊고, 빈 요소·주석은 건너뛴다.
  edge(node, before) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue) return null;
      return before ? /\S$/.test(node.nodeValue) : /^\S/.test(node.nodeValue);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (!this.inline(node)) return false;
    let child = before ? node.lastChild : node.firstChild;
    while (child) {
      const result = this.edge(child, before);
      if (result !== null) return result;
      child = before ? child.previousSibling : child.nextSibling;
    }
    return null;
  },

  joined(node, before) {
    let current = node;
    while (current) {
      let sibling = before ? current.previousSibling : current.nextSibling;
      while (sibling) {
        const result = this.edge(sibling, before);
        if (result !== null) return result;
        sibling = before ? sibling.previousSibling : sibling.nextSibling;
      }
      const parent = current.parentElement;
      if (!parent || !this.inline(parent)) return false;
      current = parent;
    }
    return false;
  },

  wrap(node) {
    let text = node.nodeValue;
    if (/^\S/.test(text) && !text.startsWith('\u2060') && this.joined(node, true)) text = `\u2060${text}`;
    if (/\S$/.test(text) && !text.endsWith('\u2060') && this.joined(node, false)) text = `${text}\u2060`;
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(part);
      else frag.append(h('span', { class: 'w', text: part }));
    }
    // flex·grid 상자 안에서는 낱말 span 하나하나가 따로 놓여 사이 공백이 사라진다. 한 덩어리로 감싼다.
    const parent = node.parentElement;
    if (parent && /flex|grid/.test(getComputedStyle(parent).display) && frag.childNodes.length > 1) {
      node.replaceWith(h('span', { class: 'ch-wrun' }, frag));
    } else node.replaceWith(frag);
  },
};
