import fs from 'fs/promises';
import path from 'path';

const replacements = [
  { from: /JavaVersion\.VERSION_21/g, to: 'JavaVersion.VERSION_17' },
  { from: /sourceCompatibility\s+JavaVersion\.VERSION_21/g, to: 'sourceCompatibility JavaVersion.VERSION_17' },
  { from: /targetCompatibility\s+JavaVersion\.VERSION_21/g, to: 'targetCompatibility JavaVersion.VERSION_17' },
  { from: /VERSION_21/g, to: 'VERSION_17' },
];

const roots = ['android', 'node_modules/@capacitor'];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
    } else if (/\.gradle$|\.groovy$|build\.gradle$/.test(entry.name)) {
      await processFile(filePath);
    }
  }
}

async function processFile(file) {
  try {
    const content = await fs.readFile(file, 'utf8');
    let output = content;
    for (const replacement of replacements) {
      output = output.replace(replacement.from, replacement.to);
    }
    if (output !== content) {
      await fs.writeFile(file, output, 'utf8');
      console.log('patched', file);
    }
  } catch {
    // Ignore unreadable generated files.
  }
}

for (const rootDir of roots) {
  try {
    await walk(rootDir);
  } catch {
    // Ignore missing generated folders.
  }
}

console.log('fix-capacitor-java finished');
