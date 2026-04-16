const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

async function main() {
  const projectRoot = path.join(__dirname, '..');
  const svgPath = path.join(projectRoot, 'public', 'icon.svg');
  const outPngPath = path.join(projectRoot, 'public', 'icon.png');

  if (!fs.existsSync(svgPath)) {
    console.error(`[gen-icon] Missing SVG: ${svgPath}`);
    process.exitCode = 1;
    return;
  }

  const svg = fs.readFileSync(svgPath, 'utf8');
  // Use createFromBuffer for maximum compatibility on Windows.
  const img = nativeImage.createFromBuffer(Buffer.from(svg), 'image/svg+xml');
  if (img.isEmpty()) {
    console.error('[gen-icon] Failed to rasterize SVG (nativeImage empty).');
    process.exitCode = 1;
    return;
  }

  // Generate a crisp tray/window icon. 256 is a good compromise.
  const png = img.resize({ width: 256, height: 256 }).toPNG();
  fs.writeFileSync(outPngPath, png);
  console.log(`[gen-icon] Wrote PNG: ${outPngPath}`);
}

app.whenReady().then(async () => {
  try {
    await main();
  } finally {
    app.quit();
  }
});

