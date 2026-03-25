const fs = require('fs');
const path = require('path');
const convert = require('@cocos/fbx2gltf');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(
  projectRoot,
  '.asset-imports',
  'animals-free-animated-low-poly-3d-models',
  'Assets',
  'ithappy',
  'Animals_FREE',
  'Meshes'
);
const outputRoot = path.join(projectRoot, 'models', 'imported', 'ithappy-animals');
const manifestPath = path.join(outputRoot, 'manifest.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(name) {
  return name
    .replace(/\.fbx$/i, '')
    .replace(/_+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeWeirdExtractedNames(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const cleaned = entry.replace(/\s*00$/g, '').trimEnd();
    if (cleaned !== entry) {
      fs.renameSync(path.join(dir, entry), path.join(dir, cleaned));
    }
  }
}

async function main() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source directory not found: ${sourceRoot}`);
  }

  ensureDir(outputRoot);
  normalizeWeirdExtractedNames(sourceRoot);

  const files = fs
    .readdirSync(sourceRoot)
    .filter((entry) => entry.toLowerCase().includes('.fbx'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No FBX files found in ${sourceRoot}`);
  }

  const manifest = {
    source: sourceRoot,
    generatedAt: new Date().toISOString(),
    count: files.length,
    animals: [],
  };

  for (const file of files) {
    const sourceFile = path.join(sourceRoot, file);
    const slug = slugify(file);
    const targetFile = path.join(outputRoot, `${slug}.glb`);

    console.log(`Converting ${file} -> ${path.relative(projectRoot, targetFile)}`);
    await convert(sourceFile, targetFile, ['--binary']);

    manifest.animals.push({
      name: file.replace(/\.fbx$/i, ''),
      sourceFile: path.relative(projectRoot, sourceFile),
      outputFile: path.relative(projectRoot, targetFile),
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote manifest: ${path.relative(projectRoot, manifestPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
