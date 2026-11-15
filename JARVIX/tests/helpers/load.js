'use strict';
// Loads the browser-side "JX" modules into Node (they are plain IIFEs that attach to globalThis.JX)
// so the pure-logic parts can be unit tested without a browser.
const path = require('path');
const ORDER = ['util', 'calc', 'units', 'highlight', 'markdown', 'tools', 'state', 'intent'];
function loadJX(extra = []) {
  globalThis.window = globalThis.window || globalThis;
  globalThis.JX = {};
  for (const f of [...ORDER, ...extra]) {
    const p = path.resolve(__dirname, '../../public/js', f + '.js');
    delete require.cache[p]; require(p);
  }
  return globalThis.JX;
}
module.exports = { loadJX };
