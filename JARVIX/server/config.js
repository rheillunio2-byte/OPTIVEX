'use strict';
/**
 * Server configuration. Reads a local `.env` file (never committed) plus the
 * process environment. API keys exist ONLY on the server and are never sent
 * to the browser.
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function load(root) {
  loadEnvFile(path.join(root, '.env'));
  const e = process.env;
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);
  return {
    root,
    host: e.HOST || '127.0.0.1',
    port: num(e.PORT, 3000),
    defaultProvider: (e.JARVIX_PROVIDER || '').toLowerCase(),
    timeoutMs: num(e.JARVIX_TIMEOUT_MS, 60000),
    allowedOrigins: (e.JARVIX_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    rateLimitPerMinute: num(e.JARVIX_RATE_LIMIT, 60),
    providers: {
      anthropic: {
        apiKey: e.ANTHROPIC_API_KEY || '',
        baseUrl: e.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        model: e.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      },
      openai: {
        apiKey: e.OPENAI_API_KEY || '',
        baseUrl: e.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: e.OPENAI_MODEL || 'gpt-4o-mini',
      },
      // Any OpenAI-compatible server: Ollama, LM Studio, OpenRouter, vLLM, Groq...
      compatible: {
        apiKey: e.JARVIX_API_KEY || '',
        baseUrl: e.JARVIX_BASE_URL || '',
        model: e.JARVIX_MODEL || '',
        keyOptional: true,
      },
    },
  };
}

module.exports = { load };
