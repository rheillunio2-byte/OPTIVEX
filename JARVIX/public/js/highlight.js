/* JARVIX — tiny dependency-free syntax highlighter. Tokenises raw text, then escapes each token (XSS-safe). */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const kw = (s) => '\\b(?:' + s.trim().split(/\s+/).join('|') + ')\\b';
  const KW = {
    js: kw('async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield interface type enum implements public private protected readonly as namespace declare abstract'),
    lit: kw('true false null undefined NaN Infinity None True False nil self'),
    py: kw('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
    sh: kw('if then else elif fi for while do done case esac function in return export local echo cd ls cat grep sed awk sudo git npm node python pip curl chmod mkdir rm cp mv'),
    sql: kw('select from where insert into values update set delete create table drop alter add join left right inner outer on group by order having limit offset as and or not null is in like distinct union primary key foreign references index default'),
    c: kw('auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected namespace using new delete template typename virtual override final try catch throw bool fn let mut pub impl trait use mod match loop func package import go defer chan map range var type string interface select'),
  };

  const RULES = {
    js: [['com', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)'], ['str', '`(?:\\\\[\\s\\S]|[^`\\\\])*`?|"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?'], ['num', '\\b0x[\\da-fA-F]+\\b|\\b\\d[\\d_]*\\.?\\d*(?:e[+-]?\\d+)?\\b'], ['lit', KW.lit], ['kw', KW.js], ['fn', '[A-Za-z_$][\\w$]*(?=\\s*\\()'], ['cls', '\\b[A-Z][\\w$]*\\b'], ['op', '=>|[=!<>]=?=?|&&|\\|\\||\\?\\?|[+\\-*/%]=?|[?:]']],
    py: [['com', '#[^\\n]*'], ['str', '(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)|"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?)'], ['num', '\\b\\d[\\d_]*\\.?\\d*(?:e[+-]?\\d+)?\\b'], ['lit', KW.lit], ['kw', KW.py], ['fn', '[A-Za-z_][\\w]*(?=\\s*\\()'], ['cls', '\\b[A-Z][\\w]*\\b'], ['op', '[=!<>]=?|[+\\-*/%]=?|:=']],
    sh: [['com', '(?:^|\\s)#[^\\n]*'], ['str', '"(?:\\\\.|[^"\\\\])*"?|\'[^\']*\'?'], ['var', '\\$\\{?[\\w@#?*]+\\}?'], ['num', '\\b\\d+\\b'], ['kw', KW.sh], ['op', '--?[A-Za-z][\\w-]*|[|&;<>]+']],
    sql: [['com', '--[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)'], ['str', '\'(?:\'\'|[^\'])*\'?'], ['num', '\\b\\d+\\.?\\d*\\b'], ['kw', '(?i:' + KW.sql + ')'], ['fn', '[A-Za-z_]\\w*(?=\\s*\\()']],
    c: [['com', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)|#\\s*\\w+[^\\n]*'], ['str', '"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?|`[^`]*`?'], ['num', '\\b0x[\\da-fA-F]+\\b|\\b\\d[\\d_]*\\.?\\d*(?:[eE][+-]?\\d+)?[fFlLuU]*\\b'], ['lit', '\\b(?:true|false|null|nil|NULL|nullptr)\\b'], ['kw', KW.c], ['fn', '[A-Za-z_]\\w*(?=\\s*\\()'], ['cls', '\\b[A-Z][\\w]*\\b']],
    json: [['key', '"(?:\\\\.|[^"\\\\])*"(?=\\s*:)'], ['str', '"(?:\\\\.|[^"\\\\])*"?'], ['num', '-?\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b'], ['lit', '\\b(?:true|false|null)\\b']],
    css: [['com', '\\/\\*[\\s\\S]*?(?:\\*\\/|$)'], ['str', '"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?'], ['kw', '@[\\w-]+'], ['var', '--[\\w-]+'], ['key', '[a-zA-Z-]+(?=\\s*:(?!\\S*\\{))'], ['num', '#[\\da-fA-F]{3,8}\\b|-?\\d*\\.?\\d+(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|ex)?\\b'], ['cls', '[.#][A-Za-z_][\\w-]*'], ['fn', '[a-zA-Z-]+(?=\\()']],
    html: [['com', '<!--[\\s\\S]*?(?:-->|$)'], ['str', '"[^"]*"?|\'[^\']*\'?'], ['kw', '<\\/?[A-Za-z][\\w:-]*|\\/?>|<!DOCTYPE'], ['key', '[A-Za-z_:@][\\w:.-]*(?=\\s*=)'], ['op', '=']],
  };
  const ALIAS = {
    js: 'js', javascript: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'js', typescript: 'js', tsx: 'js', node: 'js',
    python: 'py', py: 'py', bash: 'sh', shell: 'sh', sh: 'sh', zsh: 'sh', console: 'sh', powershell: 'sh',
    sql: 'sql', json: 'json', jsonc: 'json', css: 'css', scss: 'css', less: 'css', html: 'html', xml: 'html', svg: 'html', vue: 'html',
    c: 'c', cpp: 'c', 'c++': 'c', h: 'c', cs: 'c', csharp: 'c', java: 'c', go: 'c', golang: 'c', rust: 'c', rs: 'c', php: 'c', kotlin: 'c', swift: 'c', dart: 'c',
  };
  const compiled = {};
  function compile(lang) {
    if (compiled[lang]) return compiled[lang];
    const rules = RULES[lang];
    const src = rules.map(([, re]) => '(' + re.replace(/\(\?i:/g, '(?:') + ')').join('|');
    const flags = lang === 'sql' ? 'gi' : 'gm';
    return (compiled[lang] = { re: new RegExp(src, flags), names: rules.map((r) => r[0]) });
  }

  /** Returns {html, lang}. Unknown languages are returned escaped, un-coloured. */
  function highlight(code, langHint) {
    const lang = ALIAS[String(langHint || '').toLowerCase()];
    if (!lang) return { html: esc(code), lang: null };
    const { re, names } = compile(lang);
    re.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > last) out += esc(code.slice(last, m.index));
      let cls = 'plain';
      for (let i = 0; i < names.length; i++) if (m[i + 1] !== undefined) { cls = names[i]; break; }
      out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return { html: out + esc(code.slice(last)), lang };
  }

  JX.highlight = highlight;
})();
