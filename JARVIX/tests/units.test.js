'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const cv = (s) => JX.units.convert(s);
const near = (a, b, e = 1e-4) => assert.ok(Math.abs(a - b) <= e * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('length / mass / volume', () => { near(cv('5 km to mi').result, 3.10686); near(cv('1 lb to kg').result, 0.45359); near(cv('1 gal to l').result, 3.78541); near(cv('12 in to cm').result, 30.48); });
test('temperature is affine', () => { near(cv('72 f to c').result, 22.2222); near(cv('0 c to f').result, 32); near(cv('0 c to k').result, 273.15); near(cv('-40 f to c').result, -40); });
test('data & time & speed', () => { near(cv('1 gb to mb').result, 1000, 0.03); near(cv('2 h to min').result, 120); near(cv('100 kph to mph').result, 62.1371); });
test('word forms and spacing', () => { near(cv('10 miles to kilometers').result, 16.0934); near(cv('3.5 kg in lb').result, 7.71617); });
test('rejects nonsense and cross-category', () => { for (const b of ['5 kg to apples', '5 kg to km', 'hello', '5 to c']) assert.throws(() => cv(b), Error, b); });
test('categories are listed', () => { assert.ok(JX.units.categories().length >= 6); });
