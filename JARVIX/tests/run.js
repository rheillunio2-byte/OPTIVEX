'use strict';
// Cross-platform / cross-Node-version unit test runner: node tests/run.js
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).map((f) => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
