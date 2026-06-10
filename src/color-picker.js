// Minimal inline HSV color picker — no dependencies

const SV_W = 192;
const SV_H = 144;
const HUE_H = 14;

function hsvToRgb(h, s, v) {
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const cases = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
  const [r,g,b] = cases[i];
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max };
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1,3), 16),
    g: parseInt(hex.slice(3,5), 16),
    b: parseInt(hex.slice(5,7), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

export class ColorPicker {
  static #instance = null;

  static open(anchor, hex, onChange) {
    if (!ColorPicker.#instance) {
      ColorPicker.#instance = new ColorPicker();
    }
    ColorPicker.#instance.#openAt(anchor, hex, onChange);
  }

  static close() {
    ColorPicker.#instance?.#close();
  }

  #el;
  #svCanvas;
  #hueCanvas;
  #svCursor;
  #hueCursor;
  #hexInput;
  #preview;
  #h = 0; #s = 1; #v = 1;
  #onChange = null;
  #anchor = null;

  constructor() {
    this.#el = document.createElement('div');
    this.#el.className = 'cpicker';

    const titleBar = document.createElement('div');
    titleBar.className = 'cpicker-titlebar';
    titleBar.textContent = 'Color';
    this.#el.append(titleBar);

    const svWrap = document.createElement('div');
    svWrap.className = 'cpicker-sv-wrap';
    this.#svCanvas = document.createElement('canvas');
    this.#svCanvas.className = 'cpicker-sv';
    this.#svCanvas.width = SV_W;
    this.#svCanvas.height = SV_H;
    this.#svCursor = document.createElement('div');
    this.#svCursor.className = 'cpicker-sv-cursor';
    svWrap.append(this.#svCanvas, this.#svCursor);

    const hueWrap = document.createElement('div');
    hueWrap.className = 'cpicker-hue-wrap';
    this.#hueCanvas = document.createElement('canvas');
    this.#hueCanvas.className = 'cpicker-hue';
    this.#hueCanvas.width = SV_W;
    this.#hueCanvas.height = HUE_H;
    this.#hueCursor = document.createElement('div');
    this.#hueCursor.className = 'cpicker-hue-cursor';
    hueWrap.append(this.#hueCanvas, this.#hueCursor);

    const bottom = document.createElement('div');
    bottom.className = 'cpicker-bottom';
    this.#preview = document.createElement('div');
    this.#preview.className = 'cpicker-preview';
    this.#hexInput = document.createElement('input');
    this.#hexInput.className = 'cpicker-hex';
    this.#hexInput.type = 'text';
    this.#hexInput.maxLength = 7;
    this.#hexInput.spellcheck = false;
    bottom.append(this.#preview, this.#hexInput);

    this.#el.append(svWrap, hueWrap, bottom);

    this.#drawHue();
    this.#attachEvents();
    document.body.appendChild(this.#el);
  }

  #drawHue() {
    const ctx = this.#hueCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, SV_W, 0);
    for (let i = 0; i <= 12; i++) {
      grad.addColorStop(i / 12, `hsl(${i * 30}, 100%, 50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SV_W, HUE_H);
  }

  #drawSV() {
    const ctx = this.#svCanvas.getContext('2d');
    ctx.fillStyle = `hsl(${this.#h}, 100%, 50%)`;
    ctx.fillRect(0, 0, SV_W, SV_H);
    const white = ctx.createLinearGradient(0, 0, SV_W, 0);
    white.addColorStop(0, 'rgba(255,255,255,1)');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, SV_W, SV_H);
    const black = ctx.createLinearGradient(0, 0, 0, SV_H);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, SV_W, SV_H);
  }

  #syncUI() {
    const sx = clamp(Math.round(this.#s * SV_W), 0, SV_W);
    const sy = clamp(Math.round((1 - this.#v) * SV_H), 0, SV_H);
    this.#svCursor.style.transform = `translate(${sx}px, ${sy}px)`;
    const hx = clamp(Math.round((this.#h / 360) * SV_W), 0, SV_W);
    this.#hueCursor.style.transform = `translateX(${hx}px)`;
    const hex = this.#toHex();
    this.#hexInput.value = hex;
    this.#preview.style.background = hex;
  }

  #toHex() {
    const { r, g, b } = hsvToRgb(this.#h, this.#s, this.#v);
    return rgbToHex(r, g, b);
  }

  #emit() {
    this.#onChange?.(this.#toHex());
  }

  #openAt(anchor, hex, onChange) {
    this.#anchor = anchor;
    this.#onChange = onChange;
    const { r, g, b } = hexToRgb(hex);
    const { h, s, v } = rgbToHsv(r, g, b);
    this.#h = h; this.#s = s; this.#v = v;
    this.#drawSV();
    this.#syncUI();
    this.#el.style.display = 'block';
    this.#reposition();
  }

  #close() {
    this.#el.style.display = 'none';
    this.#anchor = null;
  }

  #reposition() {
    const el = this.#el;
    const rect = this.#anchor.getBoundingClientRect();
    const pw = el.offsetWidth || 220;
    const ph = el.offsetHeight || 230;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = rect.top - ph - 6;
    if (top < 8) top = 8;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }

  #attachEvents() {
    let dragging = null;

    const onSvDown = (e) => {
      e.preventDefault();
      dragging = 'sv';
      this.#updateSV(e);
    };
    const onHueDown = (e) => {
      e.preventDefault();
      dragging = 'hue';
      this.#updateHue(e);
    };

    this.#svCanvas.addEventListener('mousedown', onSvDown);
    this.#hueCanvas.addEventListener('mousedown', onHueDown);

    document.addEventListener('mousemove', (e) => {
      if (dragging === 'sv') this.#updateSV(e);
      else if (dragging === 'hue') this.#updateHue(e);
    });
    document.addEventListener('mouseup', () => { dragging = null; });

    this.#hexInput.addEventListener('change', () => {
      const v = this.#hexInput.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        const { r, g, b } = hexToRgb(v);
        const hsv = rgbToHsv(r, g, b);
        this.#h = hsv.h; this.#s = hsv.s; this.#v = hsv.v;
        this.#drawSV();
        this.#syncUI();
        this.#emit();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.#el.style.display !== 'none'
          && !this.#el.contains(e.target)
          && e.target !== this.#anchor
          && !e.target.closest?.('.color-swatch')) {
        this.#close();
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#el.style.display !== 'none') {
        this.#close();
      }
    });
  }

  #updateSV(e) {
    const rect = this.#svCanvas.getBoundingClientRect();
    this.#s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    this.#v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    this.#syncUI();
    this.#emit();
  }

  #updateHue(e) {
    const rect = this.#hueCanvas.getBoundingClientRect();
    this.#h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
    this.#drawSV();
    this.#syncUI();
    this.#emit();
  }
}
