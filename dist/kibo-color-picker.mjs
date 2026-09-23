// Kibo UI Color Picker adapted for this site's framework-free UI.
// https://www.kibo-ui.com/components/color-picker (MIT)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hexByte = value => Math.round(value).toString(16).padStart(2, '0');

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(channel => Math.round((channel + m) * 255));
}
function rgbToHsv(r, g, b) {
  [r, g, b] = [r, g, b].map(value => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, max === 0 ? 0 : d / max, max];
}
function rgbToHsl(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);
  const l = v * (1 - s / 2);
  return [Math.round(h), Math.round(l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l) * 100), Math.round(l * 100)];
}

export function mountKiboColorPicker(host, onChange) {
  host.innerHTML = `<div class="kibo-selection" role="slider" tabindex="0" aria-label="Насыщенность и яркость" aria-valuemin="0" aria-valuemax="100"><span class="kibo-selection-thumb"></span></div>
    <div class="kibo-slider-row"><button class="kibo-eyedropper" type="button" aria-label="Выбрать цвет с экрана" title="Выбрать цвет с экрана"><img src="assets/pipette.svg" width="16" height="16" alt=""></button><div class="kibo-sliders"><input class="kibo-hue" type="range" min="0" max="360" aria-label="Оттенок"><input class="kibo-alpha" type="range" min="0" max="100" aria-label="Прозрачность"></div></div>
    <div class="kibo-format-row"><span class="kibo-color-sample" aria-hidden="true"></span><select class="kibo-format" aria-label="Формат цвета"><option value="hex">HEX</option><option value="rgb">RGB</option><option value="css">CSS</option><option value="hsl">HSL</option></select><input class="kibo-value" aria-label="Значение цвета" readonly><input class="kibo-opacity" aria-label="Непрозрачность в процентах" readonly></div>`;
  const selection = host.querySelector('.kibo-selection');
  const thumb = host.querySelector('.kibo-selection-thumb');
  const hueInput = host.querySelector('.kibo-hue');
  const alphaInput = host.querySelector('.kibo-alpha');
  const format = host.querySelector('.kibo-format');
  const value = host.querySelector('.kibo-value');
  const opacity = host.querySelector('.kibo-opacity');
  const sample = host.querySelector('.kibo-color-sample');
  const eyedropper = host.querySelector('.kibo-eyedropper');
  let hue = 0, saturation = 0, brightness = 0, alpha = 100;

  function color() {
    const [r, g, b] = hsvToRgb(hue, saturation, brightness);
    return { rgb: [r, g, b], hex: `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`, alphaHex: alpha === 100 ? '' : hexByte(alpha * 2.55) };
  }
  function update(emit = false) {
    const { rgb, hex, alphaHex } = color();
    const selected = hex + alphaHex;
    selection.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${hue} 100% 50%)`;
    thumb.style.left = `${saturation * 100}%`;
    thumb.style.top = `${(1 - brightness) * 100}%`;
    selection.setAttribute('aria-valuenow', String(Math.round(brightness * 100)));
    hueInput.value = String(Math.round(hue));
    alphaInput.value = String(alpha);
    alphaInput.style.background = `linear-gradient(to right,transparent,${hex}),repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 50%/12px 12px`;
    sample.style.backgroundColor = selected;
    const mode = format.value;
    const [r, g, b] = rgb;
    value.value = mode === 'hex' ? hex.toUpperCase() : mode === 'rgb' ? `${r}, ${g}, ${b}` : mode === 'css' ? `rgba(${r}, ${g}, ${b}, ${alpha / 100})` : rgbToHsl(r, g, b).join(', ');
    opacity.value = `${alpha}%`;
    if (emit) onChange(selected);
  }
  function setColor(hex) {
    const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
    if (!match) return;
    const rgb = [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16));
    [hue, saturation, brightness] = rgbToHsv(...rgb);
    alpha = match[2] ? Math.round(parseInt(match[2], 16) / 255 * 100) : 100;
    update();
  }
  function setSelection(event) {
    const rect = selection.getBoundingClientRect();
    saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    brightness = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    update(true);
  }
  selection.addEventListener('pointerdown', event => {
    selection.setPointerCapture(event.pointerId);
    setSelection(event);
  });
  selection.addEventListener('pointermove', event => {
    if (selection.hasPointerCapture(event.pointerId)) setSelection(event);
  });
  selection.addEventListener('keydown', event => {
    const step = event.shiftKey ? .1 : .01;
    if (event.key === 'ArrowLeft') saturation = clamp(saturation - step, 0, 1);
    else if (event.key === 'ArrowRight') saturation = clamp(saturation + step, 0, 1);
    else if (event.key === 'ArrowUp') brightness = clamp(brightness + step, 0, 1);
    else if (event.key === 'ArrowDown') brightness = clamp(brightness - step, 0, 1);
    else return;
    event.preventDefault();
    update(true);
  });
  hueInput.addEventListener('input', () => { hue = Number(hueInput.value) % 360; update(true); });
  alphaInput.addEventListener('input', () => { alpha = Number(alphaInput.value); update(true); });
  format.addEventListener('change', () => update());
  eyedropper.hidden = !('EyeDropper' in window);
  eyedropper.addEventListener('click', async () => {
    try {
      const result = await new EyeDropper().open();
      setColor(result.sRGBHex);
      onChange(color().hex);
    } catch { /* Picker dismissed. */ }
  });
  setColor('#111111');
  return { setColor };
}
