export const EXAMPLE = 'https://chelyabinsk.mehotel.ru/merooms/';

export function parseLinks(text, batch) {
  const rows = text.split(/\r?\n/).map((value, index) => ({ value: value.trim(), line: index + 1 })).filter(row => row.value);
  if (!rows.length) throw new Error('Добавьте хотя бы одну ссылку.');
  if (!batch && rows.length > 1) throw new Error('Для нескольких ссылок выберите «Список ссылок».');
  if (rows.length > 100) throw new Error('За один раз можно создать до 100 QR-кодов.');
  const errors = [];
  for (const row of rows) {
    try {
      const url = new URL(row.value);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || /\s/.test(row.value)) throw new Error();
      if (new TextEncoder().encode(row.value).length > 2000) {
        errors.push(`Строка ${row.line}: ссылка слишком длинная (максимум 2000 байт).`);
      }
    } catch { errors.push(`Строка ${row.line}: укажите корректный адрес с https:// или http://.`); }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return rows.map(row => row.value);
}

// Round only exposed corners, retaining full connections between neighbouring modules.
export function createSvg(data) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, 'M');
  qr.addData(data, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
  const dark = (x, y) => x >= 0 && y >= 0 && x < n && y < n && qr.isDark(y, x);
  let paths = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!dark(x, y) || finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)) continue;
    const tl = !dark(x - 1, y) && !dark(x, y - 1) ? .32 : 0;
    const tr = !dark(x + 1, y) && !dark(x, y - 1) ? .32 : 0;
    const br = !dark(x + 1, y) && !dark(x, y + 1) ? .32 : 0;
    const bl = !dark(x - 1, y) && !dark(x, y + 1) ? .32 : 0;
    paths += `M${x + tl} ${y}H${x + 1 - tr}Q${x + 1} ${y} ${x + 1} ${y + tr}V${y + 1 - br}Q${x + 1} ${y + 1} ${x + 1 - br} ${y + 1}H${x + bl}Q${x} ${y + 1} ${x} ${y + 1 - bl}V${y + tl}Q${x} ${y} ${x + tl} ${y}Z`;
  }
  const roundRect = (x, y, s, r) => `M${x + r} ${y}H${x + s - r}A${r} ${r} 0 0 1 ${x + s} ${y + r}V${y + s - r}A${r} ${r} 0 0 1 ${x + s - r} ${y + s}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + s - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  const eyes = finders.map(([x, y]) => `<path fill-rule="evenodd" d="${roundRect(x, y, 7, 2.35)}${roundRect(x + 1, y + 1, 5, 1.35)}"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.8"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ${n} ${n}" fill="#000000"><path d="${paths}"/>${eyes}</svg>`;
}

export function filename(url, index) {
  return `${String(index + 1).padStart(2, '0')}-${new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}.svg`;
}
