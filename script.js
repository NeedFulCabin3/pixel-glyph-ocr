const fileInput = document.getElementById('fileInput');
const runBtn = document.getElementById('runBtn');
const downloadBtn = document.getElementById('downloadBtn');
const srcCanvas = document.getElementById('srcCanvas');
const procCanvas = document.getElementById('procCanvas');
const output = document.getElementById('output');
const threshSlider = document.getElementById('threshSlider');
const threshVal = document.getElementById('threshVal');
const invertCheck = document.getElementById('invertCheck');
const boxesCheck = document.getElementById('boxesCheck');

const srcCtx = srcCanvas.getContext('2d');
const procCtx = procCanvas.getContext('2d');

let loadedImg = null;

// 5x7 dot matrix style glyphs. rows top to bottom, 1 = ink pixel
const FONT = {
  'A': ["01110","10001","10001","11111","10001","10001","10001"],
  'B': ["11110","10001","10001","11110","10001","10001","11110"],
  'C': ["01111","10000","10000","10000","10000","10000","01111"],
  'D': ["11110","10001","10001","10001","10001","10001","11110"],
  'E': ["11111","10000","10000","11110","10000","10000","11111"],
  'F': ["11111","10000","10000","11110","10000","10000","10000"],
  'G': ["01111","10000","10000","10111","10001","10001","01111"],
  'H': ["10001","10001","10001","11111","10001","10001","10001"],
  'I': ["11111","00100","00100","00100","00100","00100","11111"],
  'J': ["00001","00001","00001","00001","10001","10001","01110"],
  'K': ["10001","10010","10100","11000","10100","10010","10001"],
  'L': ["10000","10000","10000","10000","10000","10000","11111"],
  'M': ["10001","11011","10101","10101","10001","10001","10001"],
  'N': ["10001","11001","10101","10101","10011","10001","10001"],
  'O': ["01110","10001","10001","10001","10001","10001","01110"],
  'P': ["11110","10001","10001","11110","10000","10000","10000"],
  'Q': ["01110","10001","10001","10001","10101","10010","01101"],
  'R': ["11110","10001","10001","11110","10100","10010","10001"],
  'S': ["01111","10000","10000","01110","00001","00001","11110"],
  'T': ["11111","00100","00100","00100","00100","00100","00100"],
  'U': ["10001","10001","10001","10001","10001","10001","01110"],
  'V': ["10001","10001","10001","10001","10001","01010","00100"],
  'W': ["10001","10001","10001","10101","10101","11011","10001"],
  'X': ["10001","10001","01010","00100","01010","10001","10001"],
  'Y': ["10001","10001","01010","00100","00100","00100","00100"],
  'Z': ["11111","00001","00010","00100","01000","10000","11111"],
  '0': ["01110","10001","10011","10101","11001","10001","01110"],
  '1': ["00100","01100","00100","00100","00100","00100","01110"],
  '2': ["01110","10001","00001","00010","00100","01000","11111"],
  '3': ["11111","00010","00100","00010","00001","10001","01110"],
  '4': ["00010","00110","01010","10010","11111","00010","00010"],
  '5': ["11111","10000","11110","00001","00001","10001","01110"],
  '6': ["00110","01000","10000","11110","10001","10001","01110"],
  '7': ["11111","00001","00010","00100","01000","01000","01000"],
  '8': ["01110","10001","10001","01110","10001","10001","01110"],
  '9': ["01110","10001","10001","01111","00001","00010","01100"]
};

// flatten templates into plain arrays of 0/1 numbers once
const templates = {};
for (const ch in FONT) {
  const rows = FONT[ch];
  const bits = [];
  for (const row of rows) {
    for (const c of row) bits.push(c === '1' ? 1 : 0);
  }
  templates[ch] = bits;
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      loadedImg = img;
      drawSource(img);
      runBtn.disabled = false;
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

threshSlider.addEventListener('input', () => {
  threshVal.textContent = threshSlider.value;
});

runBtn.addEventListener('click', () => {
  if (!loadedImg) return;
  const text = runOCR();
  output.value = text;
  downloadBtn.disabled = text.length === 0;
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([output.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ocr_result.txt';
  a.click();
});

function drawSource(img) {
  // cap size so huge photos don't wreck perf
  const maxW = 1400;
  let w = img.width, h = img.height;
  if (w > maxW) {
    h = Math.round(h * (maxW / w));
    w = maxW;
  }
  srcCanvas.width = w;
  srcCanvas.height = h;
  procCanvas.width = w;
  procCanvas.height = h;
  srcCtx.drawImage(img, 0, 0, w, h);
}

function runOCR() {
  const w = srcCanvas.width, h = srcCanvas.height;
  const imgData = srcCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const gray = new Uint8ClampedArray(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = g;
    hist[g]++;
  }

  let threshold = otsuThreshold(hist, w * h);
  threshold += parseInt(threshSlider.value, 10);

  const invert = invertCheck.checked;
  const ink = new Uint8Array(w * h); // 1 = text pixel
  for (let p = 0; p < gray.length; p++) {
    const isDark = gray[p] < threshold;
    ink[p] = invert ? (isDark ? 0 : 1) : (isDark ? 1 : 0);
  }

  // paint binarized preview
  const out = procCtx.createImageData(w, h);
  for (let p = 0; p < ink.length; p++) {
    const v = ink[p] ? 0 : 255;
    out.data[p * 4] = v;
    out.data[p * 4 + 1] = v;
    out.data[p * 4 + 2] = v;
    out.data[p * 4 + 3] = 255;
  }
  procCtx.putImageData(out, 0, 0);

  const components = findComponents(ink, w, h);

  if (boxesCheck.checked) {
    procCtx.strokeStyle = 'red';
    procCtx.lineWidth = 1;
    for (const c of components) {
      procCtx.strokeRect(c.minX, c.minY, c.maxX - c.minX + 1, c.maxY - c.minY + 1);
    }
  }

  const lines = groupIntoLines(components);
  return buildText(lines, ink, w);
}

function otsuThreshold(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, varMax = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

function findComponents(ink, w, h) {
  const labels = new Int32Array(w * h).fill(-1);
  const components = [];
  const stack = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (ink[idx] !== 1 || labels[idx] !== -1) continue;

      let minX = x, maxX = x, minY = y, maxY = y, count = 0;
      stack.push(idx);
      labels[idx] = 1;

      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w;
        const cy = (cur - cx) / w;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nidx = ny * w + nx;
            if (ink[nidx] === 1 && labels[nidx] === -1) {
              labels[nidx] = 1;
              stack.push(nidx);
            }
          }
        }
      }

      // toss out tiny noise blobs
      if (count >= 4 && (maxX - minX) < w * 0.9) {
        components.push({ minX, maxX, minY, maxY, count });
      }
    }
  }
  return components;
}

function groupIntoLines(components) {
  if (components.length === 0) return [];

  const sorted = [...components].sort((a, b) => a.minY - b.minY);
  const avgHeight = sorted.reduce((s, c) => s + (c.maxY - c.minY), 0) / sorted.length;

  const lines = [];
  let current = [sorted[0]];
  let currentCenter = (sorted[0].minY + sorted[0].maxY) / 2;

  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    const center = (c.minY + c.maxY) / 2;
    if (Math.abs(center - currentCenter) <= avgHeight * 0.6) {
      current.push(c);
    } else {
      lines.push(current);
      current = [c];
    }
    currentCenter = current.reduce((s, cc) => s + (cc.minY + cc.maxY) / 2, 0) / current.length;
  }
  lines.push(current);

  for (const line of lines) {
    line.sort((a, b) => a.minX - b.minX);
  }
  return lines;
}

function buildText(lines, ink, w) {
  let result = '';

  for (const line of lines) {
    if (line.length === 0) continue;
    const avgWidth = line.reduce((s, c) => s + (c.maxX - c.minX), 0) / line.length;

    let lineStr = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      lineStr += matchGlyph(c, ink, w);

      if (i < line.length - 1) {
        const gap = line[i + 1].minX - c.maxX;
        if (gap > avgWidth * 1.4) lineStr += ' ';
      }
    }
    result += lineStr + '\n';
  }

  return result.trim();
}

// crops the component down to a fixed 5x7 grid and compares against templates
function matchGlyph(box, ink, w) {
  const bw = box.maxX - box.minX + 1;
  const bh = box.maxY - box.minY + 1;
  const cols = 5, rows = 7;
  const grid = new Array(cols * rows).fill(0);
  const hits = new Array(cols * rows).fill(0);

  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      if (ink[y * w + x] !== 1) continue;
      const gx = Math.min(cols - 1, Math.floor(((x - box.minX) / bw) * cols));
      const gy = Math.min(rows - 1, Math.floor(((y - box.minY) / bh) * rows));
      grid[gy * cols + gx]++;
      hits[gy * cols + gx] = 1;
    }
  }

  // a cell counts as "on" if it's got any decent chunk of ink in it
  const bits = grid.map(v => (v > 0 ? 1 : 0));

  let bestChar = '?';
  let bestScore = Infinity;
  for (const ch in templates) {
    const t = templates[ch];
    let dist = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== bits[i]) dist++;
    }
    if (dist < bestScore) {
      bestScore = dist;
      bestChar = ch;
    }
  }

  // a really skinny tall blob with almost no width is very likely an "I" or "l" or "1"
  if (bw < bh * 0.35 && bestScore > 8) {
    bestChar = 'I';
  }

  return bestChar;
}