#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('score-popup.js', `file://${__dirname}/`), 'utf8');

function makeContext() {
  const elements = new Map();
  const storage = new Map();

  function makeElement(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      id: '',
      textContent: '',
      innerHTML: '',
      style: {},
      parentNode: null,
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild(child) { child.parentNode = this; return child; },
      remove() { if (this.parentNode?.removeChild) this.parentNode.removeChild(this); },
      getContext() {
        return {
          clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
          fillStyle: '', globalAlpha: 1
        };
      }
    };
  }

  const body = {
    lastOverlay: null,
    appendChild(node) {
      node.parentNode = body;
      if (node.id === 'sp-overlay') {
        body.lastOverlay = node;
        const ids = [...node.innerHTML.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
        ids.forEach((id) => {
          const child = makeElement('div');
          child.id = id;
          child.parentNode = node;
          elements.set(id, child);
        });
      }
      if (node.id) elements.set(node.id, node);
      return node;
    },
    removeChild(node) {
      if (node.id === 'sp-overlay') body.lastOverlay = null;
      if (node.id) elements.delete(node.id);
      node.parentNode = null;
    }
  };

  const document = {
    head: { appendChild(node) { node.parentNode = this; return node; } },
    body,
    addEventListener() {},
    createElement: makeElement,
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  const context = {
    document,
    location: { pathname: '/score-popup-test' },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    requestAnimationFrame() {},
    console
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'score-popup.js' });
  return { context, body, storage };
}

function renderedHtml(correct, total) {
  const { context, body, storage } = makeContext();
  context.showScorePopup(correct, total);
  assert(body.lastOverlay, 'score popup overlay should render');
  const html = body.lastOverlay.innerHTML;
  assert.doesNotMatch(html, /NaN/);
  assert.equal(JSON.parse(storage.get('mg_score_/score-popup-test')).sc, total > 0 ? Math.round(correct / total * 100) : 0);
  return html;
}

const cases = [
  { correct: 0, total: 0, score: 0 },
  { correct: 0, total: 10, score: 0 },
  { correct: 5, total: 10, score: 50 },
  { correct: 10, total: 10, score: 100 }
];

for (const { correct, total, score } of cases) {
  const html = renderedHtml(correct, total);
  assert.match(html, new RegExp(`id="sp-score">${score}점<`), `${correct}/${total} should render ${score}점`);
  assert.match(html, new RegExp(`${correct} / ${total} 문제 정답`), `${correct}/${total} result should retain its answer count`);
}

console.log('Score popup boundary regression checks passed.');
