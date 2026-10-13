// Gera os ícones da PWA que o manifest referencia (public/icons/).
// Sem eles o navegador registra o manifest e reclama do download (404 no console).
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="26" fill="#7C5CFC"/>
  <ellipse cx="60" cy="74" rx="34" ry="36" fill="#EDE8FE"/>
  <circle cx="46" cy="52" r="14" fill="#ffffff"/>
  <circle cx="74" cy="52" r="14" fill="#ffffff"/>
  <circle cx="46" cy="52" r="6" fill="#2D2A3E"/>
  <circle cx="74" cy="52" r="6" fill="#2D2A3E"/>
  <path d="M60 58 L53 65 L60 72 L67 65 Z" fill="#FF8A3D"/>
</svg>`;

(async () => {
  const dir = path.join(process.cwd(), 'public', 'icons');
  fs.mkdirSync(dir, { recursive: true });
  for (const size of [192, 512]) {
    const file = path.join(dir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svg), { density: 96 }).resize(size, size).png().toFile(file);
    console.log(file);
  }
})();
