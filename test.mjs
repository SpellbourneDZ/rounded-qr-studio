import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { EXAMPLE, parseLinks, createSvg, filename } from './dist/qr.mjs';
const require = createRequire(import.meta.url);
globalThis.qrcode = require('./dist/vendor/qrcode.js');
const { zipSync, unzipSync, strToU8, strFromU8 } = require('./dist/vendor/fflate.js');

assert.deepEqual(parseLinks(`\n${EXAMPLE}\r\n\nhttps://example.com/?a=1&b=2\n`, true), [EXAMPLE, 'https://example.com/?a=1&b=2']);
for (const value of ['', 'javascript:alert(1)', 'https://', 'https://example.com/a b', 'just text']) assert.throws(() => parseLinks(value, false));
assert.throws(() => parseLinks(`${EXAMPLE}\n${EXAMPLE}`, false));
assert.throws(() => parseLinks(Array(101).fill(EXAMPLE).join('\n'), true));
const urls = [EXAMPLE, 'https://example.com', 'https://example.com/?a=1&b=2#section', 'https://пример.рф/каталог?имя=Анна', 'https://example.com/' + 'a'.repeat(300)];
const files = {};
for (const [index, url] of urls.entries()) {
  const svg = createSvg(url);
  assert.match(svg, /fill="#111111"/);
  assert.doesNotMatch(svg, /<image|<script|#fff|background|stroke=/i);
  const transparent = await sharp(Buffer.from(svg)).resize(512, 512).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(transparent.data[3], 0, 'The corner is transparent');
  const { data, info } = await sharp(Buffer.from(svg)).resize(512, 512).flatten({ background: '#ffffff' }).extend({ top: 90, bottom: 90, left: 90, right: 90, background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, url, `Decode ${url}`);
  files[filename(url, index)] = strToU8(svg);
}
for (const style of ['rounded', 'classic', 'circular']) {
  const svg = createSvg(EXAMPLE, style, '#111111');
  const { data, info } = await sharp(Buffer.from(svg)).resize(512, 512).flatten({ background: '#ffffff' }).extend({ top: 90, bottom: 90, left: 90, right: 90, background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, EXAMPLE, `Decode ${style}`);
}
const white = createSvg(EXAMPLE, 'rounded', '#ffffff');
const whiteImage = await sharp(Buffer.from(white)).resize(512, 512).flatten({ background: '#111111' }).extend({ top: 90, bottom: 90, left: 90, right: 90, background: '#111111' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(jsQR(new Uint8ClampedArray(whiteImage.data), whiteImage.info.width, whiteImage.info.height, { inversionAttempts: 'attemptBoth' })?.data, EXAMPLE, 'Decode white QR on dark background');
assert.match(createSvg(EXAMPLE, 'classic', '#ff0088'), /fill="#ff0088"/);
assert.throws(() => createSvg(EXAMPLE, 'rounded', 'red'));
const unzipped = unzipSync(zipSync(files));
assert.deepEqual(Object.keys(unzipped), Object.keys(files));
for (const name in files) assert.equal(strFromU8(unzipped[name]), strFromU8(files[name]));
console.log('PASS: SVG decode, transparency, UTF-8, validation, ZIP round-trip, unique filenames.');
