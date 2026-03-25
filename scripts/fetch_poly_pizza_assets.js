const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'models', 'imported', 'poly-pizza');
const manifestPath = path.join(outputRoot, 'manifest.json');

const assets = [
  {
    key: 'rabbit',
    name: 'Rabbit',
    sourcePage: 'https://poly.pizza/m/lEJ3d1gMLC',
    creator: 'madtrollstudio',
    license: 'CC-BY 3.0',
    tags: ['small', 'sit_on_capy', 'meadow'],
    url: 'https://static.poly.pizza/ee445a10-2e3d-45c6-84c0-e7d2348f50c9.glb',
  },
  {
    key: 'frog',
    name: 'Frog',
    sourcePage: 'https://poly.pizza/m/R8nvw5DskS',
    creator: 'madtrollstudio',
    license: 'CC-BY 3.0',
    tags: ['small', 'sit_on_capy', 'swamp', 'rain'],
    url: 'https://static.poly.pizza/b3408a34-d2c5-4041-b49d-6c4a2f6a1fba.glb',
  },
  {
    key: 'gorilla',
    name: 'Gorilla',
    sourcePage: 'https://poly.pizza/m/1aReOCuu0TY',
    creator: 'jeremy',
    license: 'CC-BY 3.0',
    tags: ['large', 'capy_on_companion', 'jungle'],
    url: 'https://static.poly.pizza/09507d72-9b74-4f80-911d-26577724339f.glb',
  },
  {
    key: 'elephant',
    name: 'Elephant',
    sourcePage: 'https://poly.pizza/m/cx0-TiCjDOx',
    creator: 'Poly by Google',
    license: 'CC-BY 3.0',
    tags: ['large', 'capy_on_companion', 'savanna'],
    url: 'https://static.poly.pizza/2bc73032-37c9-4276-a620-437df45db428.glb',
  },
  {
    key: 'hippo',
    name: 'Hippopotamus',
    sourcePage: 'https://poly.pizza/m/4HNi8dZMdZa',
    creator: 'Poly by Google',
    license: 'CC-BY 3.0',
    tags: ['large', 'capy_on_companion', 'river', 'swamp'],
    url: 'https://static.poly.pizza/cdfb284b-720e-4b1f-88f5-82bce3a2286c.glb',
  },
  {
    key: 'crocodile',
    name: 'Crocodile',
    sourcePage: 'https://poly.pizza/m/2an6E2WjW3z',
    creator: 'Poly by Google',
    license: 'CC-BY 3.0',
    tags: ['large', 'capy_on_companion', 'river', 'swamp'],
    url: 'https://static.poly.pizza/4b11bdab-4e99-42a6-9919-3a27e1f3b44a.glb',
  },
  {
    key: 'bee',
    name: 'Bee',
    sourcePage: 'https://poly.pizza/m/6ktZgxSVVn1',
    creator: 'jeremy',
    license: 'CC-BY 3.0',
    tags: ['hover_around', 'meadow', 'day'],
    url: 'https://static.poly.pizza/6586f5d6-ca05-4838-950c-7d008a610ab0.glb',
  },
  {
    key: 'dragonfly',
    name: 'Dragonfly',
    sourcePage: 'https://poly.pizza/m/0myA_BOcZrD',
    creator: 'Poly by Google',
    license: 'CC-BY 3.0',
    tags: ['hover_around', 'swamp', 'night_fx_proxy'],
    url: 'https://static.poly.pizza/a657ff87-2200-4062-bd01-740ce06f524d.glb',
  },
];

async function fetchFile(url, outputFile) {
  childProcess.execFileSync('curl', ['-L', '-A', 'Mozilla/5.0', '--fail', '--silent', '--show-error', '-o', outputFile, url], {
    stdio: 'inherit',
  });
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Poly Pizza',
    notes: [
      'These assets are direct web-ready GLB downloads.',
      'Most are CC-BY 3.0 and require attribution.',
      'Fireflies should remain a particle/VFX system; dragonfly is included as a hover-actor fallback.',
    ],
    assets: [],
  };

  for (const asset of assets) {
    const outputFile = path.join(outputRoot, `${asset.key}.glb`);
    console.log(`Downloading ${asset.name} -> ${path.relative(projectRoot, outputFile)}`);
    await fetchFile(asset.url, outputFile);
    manifest.assets.push({
      ...asset,
      outputFile: path.relative(projectRoot, outputFile),
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote manifest: ${path.relative(projectRoot, manifestPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
