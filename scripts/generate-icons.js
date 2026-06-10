import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, 'work', 'icon-source.png');

const webIcons = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const androidSizes = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const iosIcons = [
  { size: 20, scale: 1, idiom: 'iphone' },
  { size: 20, scale: 2, idiom: 'iphone' },
  { size: 20, scale: 3, idiom: 'iphone' },
  { size: 29, scale: 1, idiom: 'iphone' },
  { size: 29, scale: 2, idiom: 'iphone' },
  { size: 29, scale: 3, idiom: 'iphone' },
  { size: 40, scale: 1, idiom: 'iphone' },
  { size: 40, scale: 2, idiom: 'iphone' },
  { size: 40, scale: 3, idiom: 'iphone' },
  { size: 60, scale: 2, idiom: 'iphone' },
  { size: 60, scale: 3, idiom: 'iphone' },
  { size: 20, scale: 1, idiom: 'ipad' },
  { size: 20, scale: 2, idiom: 'ipad' },
  { size: 29, scale: 1, idiom: 'ipad' },
  { size: 29, scale: 2, idiom: 'ipad' },
  { size: 40, scale: 1, idiom: 'ipad' },
  { size: 40, scale: 2, idiom: 'ipad' },
  { size: 76, scale: 1, idiom: 'ipad' },
  { size: 76, scale: 2, idiom: 'ipad' },
  { size: 83.5, scale: 2, idiom: 'ipad' },
  { size: 1024, scale: 1, idiom: 'ios-marketing' },
];

function pngName(icon) {
  const sizeLabel = String(icon.size).replace('.', '_');
  return `AppIcon-${sizeLabel}@${icon.scale}x.png`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIcon(input, output, size) {
  await sharp(input)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(output);
}

async function main() {
  await fs.access(source);

  const publicDir = path.join(repoRoot, 'public');
  for (const icon of webIcons) {
    await writeIcon(source, path.join(publicDir, icon.file), icon.size);
  }

  const androidRes = path.join(repoRoot, 'android', 'app', 'src', 'main', 'res');
  for (const [density, size] of androidSizes) {
    const dir = path.join(androidRes, `mipmap-${density}`);
    await ensureDir(dir);
    await writeIcon(source, path.join(dir, 'ic_launcher.png'), size);
    await writeIcon(source, path.join(dir, 'ic_launcher_round.png'), size);
    await writeIcon(source, path.join(dir, 'ic_launcher_foreground.png'), size);
  }

  const iosDir = path.join(repoRoot, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  await ensureDir(iosDir);

  const images = [];
  for (const icon of iosIcons) {
    const pixelSize = Math.round(icon.size * icon.scale);
    const filename = pngName(icon);
    await writeIcon(source, path.join(iosDir, filename), pixelSize);
    images.push({
      idiom: icon.idiom,
      filename,
      platform: icon.idiom === 'ios-marketing' ? 'ios' : undefined,
      size: `${icon.size}x${icon.size}`,
      scale: `${icon.scale}x`,
    });
  }

  const contents = {
    images,
    info: { author: 'xcode', version: 1 },
  };

  await fs.writeFile(path.join(iosDir, 'Contents.json'), JSON.stringify(contents, null, 2) + '\n');

  console.log('Icon assets generated.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
