# FBX → GLB Conversion Pipeline

Converts Unity-exported FBX animal assets to web-ready GLB files.

## Prerequisites

Install one of the following (pick one):

### Option A: Blender CLI (recommended — best animation preservation)
```bash
brew install --cask blender
# Blender version 3.6+ required for reliable FBX → glTF
```

### Option B: FBX2glTF (Facebook, fast, no UI required)
```bash
brew install fbx2gltf
# or: npm install -g fbx2gltf
```

### Option C: gltf-pipeline (post-processing only — use after FBX2glTF)
```bash
npm install -g gltf-pipeline
```

---

## Conversion Script (Blender CLI)

Save as `scripts/convert-fbx.sh` and run from the project root:

```bash
#!/usr/bin/env bash
# Usage: ./scripts/convert-fbx.sh
# Converts all FBX files in .asset-imports/ into models/companions/

BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
SRC_BASE=".asset-imports/animals-free-animated-low-poly-3d-models/Assets/ithappy/Animals_FREE/Meshes"
DEST="models/companions"
mkdir -p "$DEST"

ANIMALS=(Dog_001 Horse_001 Kitty_001 Deer_001 Tiger_001 Chicken_002 Chicken_003 Pinguin_001)

for ANIMAL in "${ANIMALS[@]}"; do
  FBX="$SRC_BASE/${ANIMAL}.fbx"
  OUT="$DEST/${ANIMAL,,}.glb"

  if [ ! -f "$FBX" ]; then
    echo "⚠️  Not found: $FBX"
    continue
  fi

  echo "Converting $ANIMAL → $OUT"
  "$BLENDER" --background --python - <<PYEOF
import bpy, sys

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="$(pwd)/$FBX")

# Apply all transforms
for obj in bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(
    filepath="$(pwd)/$OUT",
    export_format='GLB',
    export_animations=True,
    export_skins=True,
    export_apply=False,
)
print("Done: $OUT")
PYEOF
done
echo "✅ Conversion complete. GLBs are in $DEST/"
```

Make it executable:
```bash
chmod +x scripts/convert-fbx.sh
./scripts/convert-fbx.sh
```

---

## Expected Output (animals-free pack)

| FBX Source | Output GLB | Size estimate | Animations |
|---|---|---|---|
| Dog_001.fbx | dog_001.glb | ~300KB | idle, walk, run |
| Horse_001.fbx | horse_001.glb | ~400KB | idle, walk, run |
| Kitty_001.fbx | kitty_001.glb | ~280KB | idle, walk, run |
| Deer_001.fbx | deer_001.glb | ~350KB | idle, walk |
| Tiger_001.fbx | tiger_001.glb | ~380KB | idle, walk, run |
| Chicken_002.fbx | chicken_002.glb | ~200KB | idle, walk |

---

## Integrating Converted GLBs

Once converted, register them in `src/core/Constants.js` and `src/scene/CompanionManager.js`:

```js
// In Constants.js COMPANIONS array, add/update:
{
  id: 'horse',
  name: 'Horse',
  emoji: '🐴',
  placementMode: 'capy_on_companion',  // capy rides on horse's back
  allowedBiomes: ['meadow'],
  preferTime: 'day',
  preferWeather: 'clear',
  modelPath: 'models/companions/horse_001.glb',
  animationIdle: 'idle',
  rideHeight: 1.4,                     // Y offset capy sits at
  specialCombo: { biome: 'meadow', time: 'day' },
},
```

Then in `CompanionManager._buildMesh()`:
```js
case 'horse': return this._loadGLB('models/companions/horse_001.glb');
```

Add a `_loadGLB(path)` async method that wraps GLTFLoader (similar to CapybaraActor.load).

---

## Known Issues / Limitations

- **Armature scaling**: Unity FBX files often export with a root armature scale of 0.01. Blender's FBX importer handles this automatically. If models appear tiny, apply scale (`Ctrl+A → Scale`) before export.
- **Texture embedding**: The FBX pack uses embedded textures. Blender's glTF exporter will embed them in the GLB by default.
- **Animation names**: Unity animation names (`Dog_001_idle`) will be preserved in the GLB clips array. Reference them by name in Three.js AnimationMixer.
- **Tiger / Kitty**: These are predators — perfect for the "capy chills on apex predator" meme. Use `capy_on_companion` placement mode.

---

## Missing Animals (still needed)

These are NOT in the Unity pack and need separate sourcing:

| Animal | Suggested source | Priority |
|---|---|---|
| Frog | Sketchfab free (search "low poly frog glb") | High |
| Rabbit | Sketchfab / Quaternius pack | High |
| Crocodile | Sketchfab free | Medium |
| Gorilla / Monkey | Quaternius "Ultimate Lowpoly Animal Pack" | Medium |
| Firefly | Procedural (current VFX is good) | Done |
| Bee | Procedural (current VFX is good) | Done |

### Quaternius Free Pack
High-quality low-poly animals, CC0 license, web-ready:
- https://quaternius.com/packs/ultimateanimatedanimalpack.html
- Downloads as GLB directly — no conversion needed.

### Sketchfab
Filter by: License = Free, Format = glTF/GLB, Animated = yes.
