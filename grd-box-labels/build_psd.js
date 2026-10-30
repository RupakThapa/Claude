// Builds output/GRD Box Labels.psd: one 1700x1080 artboard per product, laid out
// like the GardenTerra box label. Product art is an embedded smart object and
// every piece of wording is a live text layer.
//
// Usage: python3 prep_assets.py && node build_psd.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage, registerFont } = require('canvas');
require('ag-psd/initialize-canvas');
const { writePsdBuffer } = require('ag-psd');

const ROOT = __dirname;
const BUILD = path.join(ROOT, 'build');
const OUT = path.join(ROOT, 'output');

const LABEL_W = 1700;
const LABEL_H = 1080;
const COLS = 4;
const GAP = 160;

const GREEN = { r: 5, g: 72, b: 38 };       // size line, 100%, distributor
const BADGE_GREEN = { r: 3, g: 74, b: 43 };
const BROWN = { r: 42, g: 34, b: 30 };      // product name
const WHITE = { r: 255, g: 255, b: 255 };

// Photoshop needs the PostScript name; node-canvas renders the preview pixels.
const FONTS = {
  Bold: { ps: 'Montserrat-Bold', file: 'Montserrat_700Bold.ttf' },
  SemiBold: { ps: 'Montserrat-SemiBold', file: 'Montserrat_600SemiBold.ttf' },
  Medium: { ps: 'Montserrat-Medium', file: 'Montserrat_500Medium.ttf' },
};
for (const [weight, f] of Object.entries(FONTS)) {
  registerFont(require.resolve(`@expo-google-fonts/montserrat/${f.file}`), { family: `Montserrat ${weight}` });
}

const PRODUCTS = [
  { name: '10" Round Plate', file: '10in Round Plate.png', size: '10”', title: ['Round Plate'], qty: 500 },
  { name: '9" Round Plate', file: '9in Round Plate.png', size: '9”', title: ['Round Plate'], qty: 500 },
  { name: '12oz Bowl', file: '12oz Bowl.png', size: '12 oz', title: ['Bowl'], qty: 1000 },
  { name: '6 CP Meal Tray', file: '6 CP Meal Tray.png', size: '6 CP', title: ['Compartment', 'Meal Tray'], qty: 400 },
  { name: '5 CP Meal Tray', file: '5 CP Meal Tray.png', size: '5 CP', title: ['Compartment', 'Meal Tray'], qty: 500 },
  { name: '8x8 3CP Clamshell', file: '8x8 3CP Clamshell.png', size: '8” x 8”', title: ['3-Compartment', 'Hinged Clamshell'], qty: 200 },
  { name: '9x9 Clamshell', file: '9x9 Clamshell.png', size: '9” x 9”', title: ['Hinged Clamshell', 'Container'], qty: 200 },
  { name: '9x9 3CP Clamshell', file: '9x9 3CP Clamshell.png', size: '9” x 9”', title: ['3-Compartment', 'Hinged Clamshell'], qty: 200 },
];

// Label geometry, measured from the reference label (1700x1080).
const LAYOUT = {
  badge: { left: 56, top: 433, right: 701, bottom: 529, radius: 18, maxFontSize: 58, maxWidth: 585, baseline: 502 },
  size: { x: 74, baseline: 666, maxFontSize: 138, maxWidth: 440 },
  title: { x: 76, baseline: 748, maxFontSize: 75, maxWidth: 615, leading: 72 },
  hundred: { x: 255, baseline: 941, fontSize: 94 },
  compostable: { x: 258, baseline: 962, fontSize: 21, leading: 21 },
  distributor: { right: 1658, baseline: 1046, maxFontSize: 61, maxWidth: 640 },
  qty: { right: 1664, top: 63, height: 82, padX: 22, stroke: 3, radius: 14, fontSize: 50 },
  art: { centerX: 1240, maxW: 780, maxH: 640, minTop: 170, waveGap: 30 },
};

const css = c => `rgb(${c.r},${c.g},${c.b})`;

// Draws onto a label-sized canvas, then trims it to the painted pixels and
// offsets it to document coordinates.
function rasterLayer(name, origin, draw) {
  const canvas = createCanvas(LABEL_W, LABEL_H);
  draw(canvas.getContext('2d'));
  const box = paintedBounds(canvas);
  if (!box) throw new Error(`layer "${name}" is empty`);
  const trimmed = createCanvas(box.w, box.h);
  trimmed.getContext('2d').drawImage(canvas, -box.x, -box.y);
  return { name, left: origin.x + box.x, top: origin.y + box.y, canvas: trimmed, preview: { canvas, origin } };
}

function paintedBounds(canvas) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Point text: (x, baseline) is the anchor, as Photoshop's text tool sets it.
function textLayer(name, origin, { text, weight, fontSize, color, x, baseline, align = 'left', leading }) {
  const lines = text.split('\n');
  const lineGap = leading ?? Math.round(fontSize * 1.2);
  const layer = rasterLayer(name, origin, ctx => {
    ctx.font = `${fontSize}px "Montserrat ${weight}"`;
    ctx.fillStyle = css(color);
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => ctx.fillText(line, x, baseline + i * lineGap));
  });
  layer.text = {
    text,
    transform: [1, 0, 0, 1, origin.x + x, origin.y + baseline],
    antiAlias: 'smooth',
    style: {
      font: { name: FONTS[weight].ps },
      fontSize,
      fillColor: color,
      autoLeading: false,
      leading: lineGap,
    },
    paragraphStyle: { justification: align },
  };
  return layer;
}

function measure(text, weight, fontSize) {
  const ctx = createCanvas(10, 10).getContext('2d');
  ctx.font = `${fontSize}px "Montserrat ${weight}"`;
  return ctx.measureText(text);
}

// Largest size (whole px) at which every string fits maxWidth, so a line style
// stays the same size on every label.
function fitFontSize(texts, weight, { maxFontSize, maxWidth }) {
  let size = maxFontSize;
  while (size > 8 && texts.some(t => measure(t, weight, size).width > maxWidth)) size--;
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Scales the art into the space right of the copy and stands it just above the wave.
function artPlacement(img, waveTop) {
  const a = LAYOUT.art;
  let scale = Math.min(a.maxW / img.width, a.maxH / img.height);
  for (;;) {
    const w = img.width * scale;
    const h = img.height * scale;
    const left = a.centerX - w / 2;
    const xs = waveTop.slice(Math.floor(left), Math.ceil(left + w));
    const bottom = Math.min(...xs) - a.waveGap;
    if (bottom - h >= a.minTop) return { left, top: bottom - h, w, h };
    scale *= 0.98;
  }
}

async function buildLabel(product, index, shared) {
  const { sizes } = shared;
  const origin = { x: (index % COLS) * (LABEL_W + GAP), y: Math.floor(index / COLS) * (LABEL_H + GAP) };
  const L = LAYOUT;
  const layers = [];

  layers.push(rasterLayer('Background', origin, ctx => ctx.drawImage(shared.background, 0, 0)));
  layers.push(rasterLayer('Logo', origin, ctx => ctx.drawImage(shared.logo, shared.logoPos.left, shared.logoPos.top)));

  const b = L.badge;
  const badge = [
    rasterLayer('Badge Shape', origin, ctx => {
      ctx.fillStyle = css(BADGE_GREEN);
      roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, b.radius);
      ctx.fill();
    }),
    textLayer('Badge Text', origin, {
      text: 'BAGASSE TABLEWARE', weight: 'SemiBold', fontSize: sizes.badge, color: WHITE,
      x: (b.left + b.right) / 2, baseline: b.baseline, align: 'center',
    }),
  ];
  layers.push({ name: 'Badge', opened: true, children: badge });

  layers.push(textLayer('Size', origin, {
    text: product.size, weight: 'Bold', fontSize: sizes.size, color: GREEN, x: L.size.x, baseline: L.size.baseline,
  }));
  layers.push(textLayer('Product Name', origin, {
    text: product.title.join('\n'), weight: 'Bold', fontSize: sizes.title, color: BROWN,
    x: L.title.x, baseline: L.title.baseline, leading: L.title.leading,
  }));

  // Icons are placed by hand later in the space left of "100%".
  layers.push({
    name: 'Compostable', opened: true, children: [
      textLayer('100%', origin, {
        text: '100%', weight: 'SemiBold', fontSize: L.hundred.fontSize, color: GREEN, x: L.hundred.x, baseline: L.hundred.baseline,
      }),
      textLayer('Compostable Text', origin, {
        text: 'Compostable\ndisposable\ntableware products', weight: 'Medium', fontSize: L.compostable.fontSize, color: GREEN,
        x: L.compostable.x, baseline: L.compostable.baseline, leading: L.compostable.leading,
      }),
    ],
  });

  layers.push(textLayer('Distributor', origin, {
    text: 'Garden Road Distributors', weight: 'Bold', fontSize: sizes.distributor, color: GREEN,
    x: L.distributor.right, baseline: L.distributor.baseline, align: 'right',
  }));

  // QTY box grows to the left so longer counts (1000) still fit.
  const q = L.qty;
  const qtyText = `QTY: ${product.qty} PCS`;
  const qm = measure(qtyText, 'Bold', q.fontSize);
  const boxW = Math.ceil(qm.width) + 2 * q.padX;
  const boxLeft = q.right - boxW;
  const capH = qm.actualBoundingBoxAscent;
  layers.push({
    name: 'Quantity', opened: true, children: [
      rasterLayer('QTY Box', origin, ctx => {
        ctx.strokeStyle = css(GREEN);
        ctx.lineWidth = q.stroke;
        roundRect(ctx, boxLeft + q.stroke / 2, q.top + q.stroke / 2, boxW - q.stroke, q.height - q.stroke, q.radius);
        ctx.stroke();
      }),
      textLayer('QTY Text', origin, {
        text: qtyText, weight: 'Bold', fontSize: q.fontSize, color: GREEN,
        x: boxLeft + boxW / 2, baseline: Math.round(q.top + q.height / 2 + capH / 2), align: 'center',
      }),
    ],
  });

  // Product art as an embedded smart object.
  const art = shared.art[product.file];
  const place = artPlacement(art.img, shared.waveTop);
  const artLayer = rasterLayer('Art', origin, ctx => ctx.drawImage(art.img, place.left, place.top, place.w, place.h));
  const x0 = origin.x + place.left, y0 = origin.y + place.top;
  const x1 = x0 + place.w, y1 = y0 + place.h;
  artLayer.placedLayer = {
    id: art.fileId,
    placed: crypto.randomUUID(),
    type: 'raster',
    transform: [x0, y0, x1, y0, x1, y1, x0, y1],
    width: art.img.width,
    height: art.img.height,
  };
  layers.push({ name: 'Product', opened: true, children: [artLayer] });

  return {
    name: product.name,
    opened: true,
    artboard: {
      rect: { left: origin.x, top: origin.y, right: origin.x + LABEL_W, bottom: origin.y + LABEL_H },
      guideIndices: [],
      presetName: '',
      color: WHITE,
      backgroundType: 1,
    },
    children: layers,
  };
}

// Flattens layer previews in stacking order (children are bottom-first).
function paint(ctx, layers) {
  for (const layer of layers) {
    if (layer.children) paint(ctx, layer.children);
    else ctx.drawImage(layer.canvas, layer.left, layer.top);
  }
}

function stripPreviews(layers) {
  for (const layer of layers) {
    delete layer.preview;
    if (layer.children) stripPreviews(layer.children);
  }
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'previews'), { recursive: true });
  const shared = {
    background: await loadImage(path.join(ROOT, 'source/template/label-background.png')),
    logo: await loadImage(path.join(BUILD, 'logo.png')),
    logoPos: JSON.parse(fs.readFileSync(path.join(BUILD, 'logo.json'), 'utf8')),
    waveTop: JSON.parse(fs.readFileSync(path.join(BUILD, 'wave_top.json'), 'utf8')),
    art: {},
    sizes: {
      badge: fitFontSize(['BAGASSE TABLEWARE'], 'SemiBold', LAYOUT.badge),
      size: fitFontSize(PRODUCTS.map(p => p.size), 'Bold', LAYOUT.size),
      title: fitFontSize(PRODUCTS.flatMap(p => p.title), 'Bold', LAYOUT.title),
      distributor: fitFontSize(['Garden Road Distributors'], 'Bold', LAYOUT.distributor),
    },
  };
  console.log('font sizes', shared.sizes);
  const linkedFiles = [];
  for (const p of PRODUCTS) {
    const file = path.join(BUILD, 'art', p.file);
    const data = fs.readFileSync(file);
    const fileId = crypto.randomUUID();
    shared.art[p.file] = { img: await loadImage(data), fileId };
    linkedFiles.push({ id: fileId, name: p.file, type: 'png ', creator: '8BIM', data: new Uint8Array(data) });
  }

  const artboards = [];
  for (const [i, p] of PRODUCTS.entries()) artboards.push(await buildLabel(p, i, shared));

  const rows = Math.ceil(PRODUCTS.length / COLS);
  const width = COLS * LABEL_W + (COLS - 1) * GAP;
  const height = rows * LABEL_H + (rows - 1) * GAP;
  const composite = createCanvas(width, height);
  paint(composite.getContext('2d'), artboards);

  for (const [i, ab] of artboards.entries()) {
    const r = ab.artboard.rect;
    const preview = createCanvas(LABEL_W, LABEL_H);
    preview.getContext('2d').drawImage(composite, -r.left, -r.top);
    const fileName = `${String(i + 1).padStart(2, '0')} ${PRODUCTS[i].file.replace('.png', '')}.png`;
    fs.writeFileSync(path.join(OUT, 'previews', fileName), preview.toBuffer('image/png'));
  }

  stripPreviews(artboards);
  const psd = { width, height, canvas: composite, children: artboards, linkedFiles };
  const buffer = writePsdBuffer(psd, { invalidateTextLayers: true, noBackground: true });
  fs.writeFileSync(path.join(OUT, 'GRD Box Labels.psd'), buffer);
  console.log(`wrote ${(buffer.length / 1e6).toFixed(1)} MB, ${artboards.length} artboards`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
