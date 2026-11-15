'use strict';
/**
 * Provider registry. To add a provider, create a module exporting
 *   { id, label, async *stream({cfg,key,messages,system,model,temperature,maxTokens,signal,timeoutMs}) }
 * (an async generator yielding text deltas), register it below, and add its
 * settings to server/config.js. The frontend never needs to change.
 */
const anthropic = require('./anthropic');
const { openai, compatible } = require('./openai');

const registry = { anthropic, openai, compatible };

module.exports = { registry };
