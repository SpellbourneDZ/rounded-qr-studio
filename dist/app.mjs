import { EXAMPLE, parseLinks, createSvg, filename } from './qr.mjs';
const $ = id => document.getElementById(id);
let batch = false;
let entries = [];
let busy = false;
const drafts = { single: EXAMPLE, batch: '' };

function setMode(next) {
  drafts[batch ? 'batch' : 'single'] = $('links').value;
  batch = next;
  $('links').value = drafts[batch ? 'batch' : 'single'];
  $('links').rows = batch ? 6 : 3;
  $('links').placeholder = batch ? 'https://example.com\nhttps://example.com/catalog\nhttps://example.com/contacts' : 'https://example.com';
  $('input-label').textContent = batch ? 'Ссылки — по одной на строку' : 'Ссылка';
  $('input-hint').textContent = batch ? 'До 100 ссылок за раз. Пустые строки пропускаются.' : 'Полный адрес, начиная с https://';
  $('editor-title').textContent = batch ? 'Добавьте ссылки' : 'Добавьте ссылку';
  $('generate').firstChild.textContent = batch ? 'Создать QR-коды ' : 'Создать QR-код ';
  for (const [id, active] of [['single-tab', !batch], ['batch-tab', batch]]) {
    $(id).setAttribute('aria-selected', active);
    $(id).tabIndex = active ? 0 : -1;
  }
  $('input-panel').setAttribute('aria-labelledby', batch ? 'batch-tab' : 'single-tab');
  clearResults();
}

function clearResults() {
  entries = [];
  $('results').className = '';
  $('results').replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'Добавьте ссылки и создайте QR-коды';
  $('results').append(empty);
  $('download-all').hidden = true;
  $('result-count').textContent = '0 кодов';
  $('errors').textContent = '';
  $('status').textContent = '';
  $('links').removeAttribute('aria-invalid');
}

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function generate() {
  if (busy) return;
  let urls;
  try { urls = parseLinks($('links').value, batch); }
  catch (error) { clearResults(); $('errors').textContent = error.message; $('links').setAttribute('aria-invalid', 'true'); return; }
  clearResults();
  busy = true;
  for (const id of ['generate', 'links', 'single-tab', 'batch-tab', 'example']) $(id).disabled = true;
  $('results').replaceChildren();
  $('results').className = urls.length > 1 ? 'batch-results' : '';
  $('results').setAttribute('aria-busy', 'true');
  try {
    const next = [];
    for (let i = 0; i < urls.length; i++) {
      next.push({ url: urls[i], svg: createSvg(urls[i]), name: filename(urls[i], i) });
      if (i % 5 === 0) { $('status').textContent = `Создаём: ${i + 1} из ${urls.length}…`; await new Promise(resolve => setTimeout(resolve, 0)); }
    }
    entries = next;
    for (const entry of entries) {
      const card = document.createElement('article'); card.className = 'qr-card';
      const stage = document.createElement('div'); stage.className = 'qr-stage'; stage.innerHTML = entry.svg;
      stage.firstChild.setAttribute('role', 'img'); stage.firstChild.setAttribute('aria-label', `QR-код для ${entry.url}`);
      const caption = document.createElement('div'); caption.className = 'qr-caption';
      const url = document.createElement('span'); url.className = 'qr-link'; url.textContent = entry.url; url.title = entry.url;
      const badge = document.createElement('span'); badge.className = 'svg-badge'; badge.textContent = 'SVG';
      caption.append(url, badge);
      const download = document.createElement('button'); download.type = 'button'; download.className = 'download'; download.innerHTML = 'Скачать SVG <span aria-hidden="true">↓</span>'; download.setAttribute('aria-label', `Скачать SVG для ${entry.url}`);
      download.addEventListener('click', () => { save(new Blob([entry.svg], { type: 'image/svg+xml' }), entry.name); $('status').textContent = 'SVG подготовлен к скачиванию'; });
      card.append(stage, caption, download); $('results').append(card);
    }
    const count = entries.length;
    $('result-count').textContent = `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'код' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'кода' : 'кодов'}`;
    $('preview-title').textContent = count > 1 ? 'Ваши QR-коды' : 'Ваш QR-код';
    $('download-all').hidden = count < 2;
    $('status').textContent = '';
  } catch { clearResults(); $('errors').textContent = 'Не удалось создать QR-коды. Проверьте длину ссылок и повторите попытку.'; }
  finally {
    busy = false; $('results').removeAttribute('aria-busy');
    for (const id of ['generate', 'links', 'single-tab', 'batch-tab', 'example']) $(id).disabled = false;
  }
}

$('single-tab').addEventListener('click', () => { if (batch) setMode(false); });
$('batch-tab').addEventListener('click', () => { if (!batch) setMode(true); });
document.querySelector('.tabs').addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); setMode(event.key === 'Home' ? false : event.key === 'End' ? true : !batch);
    $(batch ? 'batch-tab' : 'single-tab').focus();
  }
});
$('generator').addEventListener('submit', event => { event.preventDefault(); generate(); });
$('links').addEventListener('input', clearResults);
$('example').addEventListener('click', () => { $('links').value = EXAMPLE; clearResults(); $('links').focus(); });
$('download-all').addEventListener('click', () => {
  try {
    const files = Object.fromEntries(entries.map(entry => [entry.name, fflate.strToU8(entry.svg)]));
    save(new Blob([fflate.zipSync(files)], { type: 'application/zip' }), 'qr-studio.zip');
    $('status').textContent = `Архив с ${entries.length} SVG подготовлен к скачиванию`;
  } catch { $('status').textContent = 'Не удалось создать архив. Попробуйте скачать SVG по отдельности.'; }
});

await generate();
if (document.modelContext?.registerTool) {
  try {
    await document.modelContext.registerTool({
      name: 'generate_qr_codes', description: 'Создать QR-коды из списка ссылок и показать SVG для скачивания. Не скачивает файлы автоматически.',
      inputSchema: { type: 'object', properties: { links: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 } }, required: ['links'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (busy) throw new Error('Генерация уже выполняется');
        if (!Array.isArray(input?.links) || input.links.some(link => typeof link !== 'string' || /[\r\n]/.test(link))) throw new Error('Ожидается список ссылок');
        parseLinks(input.links.join('\n'), true);
        setMode(input.links.length > 1); $('links').value = input.links.join('\n'); await generate();
        if (entries.length !== input.links.length) throw new Error('Не удалось создать все QR-коды');
        return { count: entries.length, files: entries.map(entry => entry.name) };
      }
    });
  } catch (error) { console.warn('WebMCP недоступен', error); }
}
