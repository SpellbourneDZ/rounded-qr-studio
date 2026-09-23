import { parseLinks, createSvg, filename } from './qr.mjs';
import { mountKiboColorPicker } from './kibo-color-picker.mjs';

const $ = id => document.getElementById(id);
const modes = { single: { text: '', entries: [] }, batch: { text: '', entries: [] } };
let mode = 'single';
let busy = false;
let settings = { style: 'rounded', color: '#111111' };
let draftSettings = { ...settings };
let settingsOpen = false;
const floatingDownload = document.createElement('div');
floatingDownload.className = 'floating-download';
floatingDownload.setAttribute('aria-hidden', 'true');
floatingDownload.innerHTML = '<span class="download-label">Скачать <img src="assets/download.svg" width="18" height="18" alt=""></span><img class="download-check" src="assets/check.svg" width="20" height="20" alt="">';
document.body.append(floatingDownload);
let downloadDoneTimer;
function placeDownload(event) {
  floatingDownload.style.setProperty('--cursor-x', `${event.clientX}px`);
  floatingDownload.style.setProperty('--cursor-y', `${event.clientY}px`);
}
function hideDownload() {
  clearTimeout(downloadDoneTimer);
  floatingDownload.classList.remove('visible', 'done');
}
function showDownloadDone() {
  clearTimeout(downloadDoneTimer);
  floatingDownload.classList.add('done');
  downloadDoneTimer = setTimeout(() => floatingDownload.classList.remove('done'), 1300);
}

function current() { return modes[mode]; }
const isCustomColor = color => !['#111111', '#ffffff'].includes(color.toLowerCase());
const badgeLabel = color => color.toLowerCase() === '#ffffff' ? 'Белый' : 'Свой цвет';
function updateSettingsPreview() {
  for (const option of document.querySelectorAll('.style-option')) {
    const input = option.querySelector('input');
    input.checked = input.value === draftSettings.style;
    const preview = option.querySelector('.style-preview');
    if (!preview.firstElementChild) preview.innerHTML = createSvg('https://example.com', input.value);
    const badge = option.querySelector('.color-badge');
    badge.hidden = draftSettings.color.toLowerCase() === '#111111' || !input.checked;
    badge.querySelector('.badge-swatch').style.backgroundColor = draftSettings.color;
    badge.querySelector('.badge-label').textContent = badgeLabel(draftSettings.color);
  }
  for (const choice of document.querySelectorAll('.color-choice')) {
    choice.setAttribute('aria-pressed', choice.dataset.color === draftSettings.color);
  }
  const custom = isCustomColor(draftSettings.color);
  $('custom-color-toggle').classList.toggle('selected', custom);
  $('custom-color-toggle').style.backgroundColor = custom ? draftSettings.color : '';
}
function hideColorPicker() {
  $('color-picker').hidden = true;
  $('custom-color-toggle').setAttribute('aria-expanded', 'false');
}
function closeSettings(apply) {
  if (apply) {
    settings = { ...draftSettings };
    for (const state of Object.values(modes)) {
      state.entries = state.entries.map(entry => ({ ...entry, svg: createSvg(entry.url, settings.style, settings.color) }));
    }
  }
  settingsOpen = false;
  hideColorPicker();
  $('settings-panel').hidden = true;
  $('input-panel').hidden = false;
  $('output').hidden = false;
  $('input-group').classList.remove('settings-open');
  document.querySelector('.mode-row').classList.remove('settings-active');
  $('settings-toggle').setAttribute('aria-expanded', 'false');
  $('settings-toggle').firstElementChild.src = 'assets/settings.svg';
  $('single-tab').disabled = $('batch-tab').disabled = $('generate').disabled = false;
  renderResults();
  $('settings-toggle').focus();
}
function openSettings() {
  if (busy) return;
  settingsOpen = true;
  draftSettings = { ...settings };
  colorPicker.setColor(draftSettings.color);
  updateSettingsPreview();
  $('settings-panel').hidden = false;
  $('input-panel').hidden = true;
  $('output').hidden = true;
  $('input-group').classList.add('settings-open');
  document.querySelector('.mode-row').classList.add('settings-active');
  $('settings-toggle').setAttribute('aria-expanded', 'true');
  $('settings-toggle').firstElementChild.src = 'assets/settings-active.svg';
  $('single-tab').disabled = $('batch-tab').disabled = $('generate').disabled = true;
}
function countLabel(count) {
  return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'QR-код' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'QR-кода' : 'QR-кодов'}`;
}
function clearMessage() {
  $('errors').textContent = '';
  $('status').textContent = '';
  $('input-panel').classList.remove('invalid');
  $('links').removeAttribute('aria-invalid');
}
function syncInput() {
  current().text = $('links').value;
  $('clear').hidden = !current().text;
  clearMessage();
}
function setMode(next) {
  if (busy || settingsOpen || mode === next) return;
  hideDownload();
  current().text = $('links').value;
  mode = next;
  const batch = mode === 'batch';
  $('links').value = current().text;
  $('links').rows = batch ? 6 : 1;
  $('links').placeholder = batch
    ? 'Ссылки, по одной на строку, например:\nhttps://example.com\nhttps://example.com/catalog\nhttps://example.com/contacts'
    : 'Вставьте ссылку';
  $('input-label').textContent = batch ? 'Ссылки, по одной на строку' : 'Ссылка';
  $('input-panel').classList.toggle('batch', batch);
  $('input-panel').setAttribute('aria-labelledby', batch ? 'batch-tab' : 'single-tab');
  $('generate').textContent = batch ? 'Создать QR-коды' : 'Создать QR-код';
  for (const [id, active] of [['single-tab', !batch], ['batch-tab', batch]]) {
    $(id).setAttribute('aria-selected', active);
    $(id).tabIndex = active ? 0 : -1;
  }
  $('clear').hidden = !current().text;
  clearMessage();
  renderResults();
}
function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function svgBlob(svg) { return new Blob([svg], { type: 'image/svg+xml' }); }
function pngName(entry) { return entry.name.replace(/\.svg$/, '.png'); }
async function pngBlob(svg) {
  const objectUrl = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    canvas.getContext('2d').drawImage(image, 0, 0, 1024, 1024);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG')), 'image/png'));
  } finally { URL.revokeObjectURL(objectUrl); }
}
function makeTile(entry, index, batch) {
  const tile = document.createElement(batch ? 'button' : 'div');
  tile.className = 'qr-tile';
  tile.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
  tile.innerHTML = settings.color.toLowerCase() === '#111111' ? entry.svg : entry.svg.replace(/fill="#[0-9a-fA-F]{6}"(?: fill-opacity="[^"]+")?/, 'fill="#111111"');
  if (batch) {
    tile.type = 'button';
    tile.setAttribute('aria-label', `Скачать SVG для ${entry.url}`);
    tile.addEventListener('click', () => {
      save(svgBlob(entry.svg), entry.name);
      if (floatingDownload.classList.contains('visible')) showDownloadDone();
      $('status').textContent = '';
    });
    tile.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      placeDownload(event);
      floatingDownload.getBoundingClientRect();
      floatingDownload.classList.add('visible');
    });
    tile.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') placeDownload(event);
    });
    tile.addEventListener('pointerleave', hideDownload);
    tile.addEventListener('pointercancel', hideDownload);
    tile.addEventListener('blur', () => {
      if (!document.querySelector('.batch-result .qr-tile:hover')) hideDownload();
    });
    tile.addEventListener('focus', () => {
      if (!tile.matches(':focus-visible')) return;
      const rect = tile.getBoundingClientRect();
      placeDownload({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
      floatingDownload.getBoundingClientRect();
      floatingDownload.classList.add('visible');
    });
    const item = document.createElement('div');
    item.className = 'qr-item';
    const link = document.createElement('p');
    link.className = 'qr-link';
    link.textContent = entry.url;
    link.title = entry.url;
    item.append(tile, link);
    return item;
  } else {
    tile.firstElementChild.setAttribute('role', 'img');
    tile.firstElementChild.setAttribute('aria-label', `QR-код для ${entry.url}`);
  }
  return tile;
}
function renderResults() {
  hideDownload();
  const { entries } = current();
  const results = $('results');
  results.replaceChildren();
  results.className = 'results';
  $('output-actions').hidden = entries.length === 0;
  const badge = $('result-color-badge');
  badge.hidden = !entries.length || settings.color.toLowerCase() === '#111111';
  if (!badge.hidden) {
    badge.querySelector('.badge-swatch').style.backgroundColor = settings.color;
    badge.querySelector('.badge-label').textContent = badgeLabel(settings.color);
  }
  if (!entries.length) {
    results.classList.add('empty-state');
    const empty = document.createElement('p');
    empty.textContent = mode === 'batch' ? 'Тут появятся QR-коды' : 'Тут появится QR-код';
    results.append(empty);
    return;
  }
  if (mode === 'single') {
    results.classList.add('single-result');
    results.append(makeTile(entries[0], 0, false));
  } else {
    results.classList.add('batch-result');
    const grid = document.createElement('div');
    grid.className = 'qr-grid';
    for (const [index, entry] of entries.entries()) grid.append(makeTile(entry, index, true));
    results.append(grid);
  }
  $('result-count').textContent = countLabel(entries.length);
  $('download-png').textContent = mode === 'batch' ? 'Скачать все PNG' : 'Скачать PNG';
  $('download-svg').textContent = mode === 'batch' ? 'Скачать все SVG' : 'Скачать SVG';
}
async function generate() {
  if (busy || settingsOpen) return;
  let urls;
  try { urls = parseLinks($('links').value, mode === 'batch'); }
  catch (error) {
    $('errors').textContent = error.message;
    $('input-panel').classList.add('invalid');
    $('links').setAttribute('aria-invalid', 'true');
    return;
  }
  clearMessage();
  busy = true;
  $('generate').disabled = true;
  $('status').textContent = 'Создаём QR-коды…';
  try {
    const entries = [];
    for (let i = 0; i < urls.length; i++) {
      entries.push({ url: urls[i], svg: createSvg(urls[i], settings.style, settings.color), name: filename(urls[i], i) });
      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    current().entries = entries;
    renderResults();
    $('status').textContent = '';
  } catch {
    $('errors').textContent = 'Не удалось создать QR-коды. Проверьте ссылки и повторите попытку.';
    $('status').textContent = '';
  } finally {
    busy = false;
    $('generate').disabled = false;
  }
}
async function download(format) {
  const entries = current().entries;
  if (!entries.length) return;
  $('status').textContent = '';
  try {
    if (entries.length === 1) {
      const entry = entries[0];
      save(format === 'svg' ? svgBlob(entry.svg) : await pngBlob(entry.svg), format === 'svg' ? entry.name : pngName(entry));
    } else {
      const files = {};
      for (const [index, entry] of entries.entries()) {
        files[format === 'svg' ? entry.name : pngName(entry)] = format === 'svg'
          ? fflate.strToU8(entry.svg)
          : new Uint8Array(await (await pngBlob(entry.svg)).arrayBuffer());
        if (index % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      save(new Blob([fflate.zipSync(files)], { type: 'application/zip' }), `qr-studio-${format}.zip`);
    }
  } catch {
    $('status').textContent = 'Не удалось подготовить файл. Попробуйте ещё раз.';
  }
}

$('single-tab').addEventListener('click', () => setMode('single'));
$('batch-tab').addEventListener('click', () => setMode('batch'));
$('settings-toggle').addEventListener('click', () => settingsOpen ? closeSettings(false) : openSettings());
$('settings-cancel').addEventListener('click', () => closeSettings(false));
$('settings-save').addEventListener('click', () => closeSettings(true));
document.querySelectorAll('input[name="qr-style"]').forEach(input => input.addEventListener('change', () => {
  draftSettings.style = input.value;
  updateSettingsPreview();
}));
document.querySelectorAll('.color-choice').forEach(choice => choice.addEventListener('click', () => {
  draftSettings.color = choice.dataset.color;
  hideColorPicker();
  updateSettingsPreview();
}));
$('custom-color-toggle').addEventListener('click', () => {
  const picker = $('color-picker');
  colorPicker.setColor(draftSettings.color);
  picker.hidden = !picker.hidden;
  $('custom-color-toggle').setAttribute('aria-expanded', String(!picker.hidden));
});
const colorPicker = mountKiboColorPicker($('color-picker'), color => {
  draftSettings.color = color;
  updateSettingsPreview();
});
document.addEventListener('keydown', event => {
  if (settingsOpen && event.key === 'Escape') {
    if (!$('color-picker').hidden) hideColorPicker();
    else closeSettings(false);
  }
});
document.addEventListener('click', event => {
  if (!$('color-picker').hidden && !$('color-picker').contains(event.target) && !$('custom-color-toggle').contains(event.target)) hideColorPicker();
});
document.querySelector('.tabs').addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    setMode(event.key === 'Home' ? 'single' : event.key === 'End' ? 'batch' : mode === 'single' ? 'batch' : 'single');
    $(mode === 'single' ? 'single-tab' : 'batch-tab').focus();
  }
});
$('links').addEventListener('input', syncInput);
$('links').addEventListener('keydown', event => {
  if (mode === 'single' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    generate();
  }
});
$('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error('empty');
    $('links').value = text;
    syncInput();
    $('links').focus();
  } catch {
    $('errors').textContent = 'Не удалось прочитать буфер обмена. Вставьте ссылку вручную.';
  }
});
$('clear').addEventListener('click', () => {
  $('links').value = '';
  syncInput();
  $('links').focus();
});
$('generator').addEventListener('submit', event => { event.preventDefault(); generate(); });
$('download-png').addEventListener('click', () => download('png'));
$('download-svg').addEventListener('click', () => download('svg'));
$('results').addEventListener('scroll', hideDownload);
window.addEventListener('blur', hideDownload);
renderResults();

if (document.modelContext?.registerTool) {
  try {
    await document.modelContext.registerTool({
      name: 'generate_qr_codes',
      description: 'Создать QR-коды из списка ссылок и показать PNG/SVG для скачивания. Не скачивает файлы автоматически.',
      inputSchema: { type: 'object', properties: { links: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 } }, required: ['links'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (busy || settingsOpen) throw new Error('Завершите настройку QR-кода');
        if (!Array.isArray(input?.links) || input.links.some(link => typeof link !== 'string' || /[\r\n]/.test(link))) throw new Error('Ожидается список ссылок');
        parseLinks(input.links.join('\n'), true);
        setMode(input.links.length > 1 ? 'batch' : 'single');
        $('links').value = input.links.join('\n');
        syncInput();
        await generate();
        if (current().entries.length !== input.links.length) throw new Error('Не удалось создать все QR-коды');
        return { count: current().entries.length, files: current().entries.map(entry => entry.name) };
      }
    });
  } catch (error) { console.warn('WebMCP недоступен', error); }
}
