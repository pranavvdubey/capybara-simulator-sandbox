import * as THREE from 'three';

const FULLSCREEN_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function createTarget(width, height) {
  return new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

export class WagnerComposer {
  constructor(renderer) {
    this.renderer = renderer;
    this.time = 0;
    this.size = new THREE.Vector2(1, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
    this.scene.add(this.quad);

    this.front = createTarget(1, 1);
    this.back = createTarget(1, 1);
    this.read = this.front;
    this.write = this.back;
  }

  static createShaderMaterial(fragmentShader, uniforms = {}) {
    return new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tInput: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 },
        ...uniforms,
      },
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader,
    });
  }

  setSize(width, height) {
    this.size.set(width, height);
    this.front.setSize(width, height);
    this.back.setSize(width, height);
  }

  reset() {
    this.read = this.front;
    this.write = this.back;
  }

  swap() {
    const next = this.read;
    this.read = this.write;
    this.write = next;
  }

  renderScene(scene, camera) {
    this.reset();
    this.renderer.setRenderTarget(this.write);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.swap();
    return this.read.texture;
  }

  renderPass(material, {
    input = this.read.texture,
    output = this.write,
    resolution = this.size,
    clear = true,
  } = {}) {
    if (material.uniforms.tInput) material.uniforms.tInput.value = input;
    if (material.uniforms.resolution) material.uniforms.resolution.value.copy(resolution);
    if (material.uniforms.time) material.uniforms.time.value = this.time;

    this.quad.material = material;
    this.renderer.setRenderTarget(output);
    if (clear) this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    if (output === this.write) this.swap();
    return output.texture;
  }

  toScreen(material, {
    input = this.read.texture,
    resolution = this.size,
  } = {}) {
    if (material.uniforms.tInput) material.uniforms.tInput.value = input;
    if (material.uniforms.resolution) material.uniforms.resolution.value.copy(resolution);
    if (material.uniforms.time) material.uniforms.time.value = this.time;

    this.quad.material = material;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}

// Adapted from spite/Wagner: https://github.com/spite/Wagner
export class WagnerBrightPass {
  constructor() {
    this.material = WagnerComposer.createShaderMaterial(`
      varying vec2 vUv;
      uniform sampler2D tInput;
      uniform float threshold;
      uniform float knee;

      void main() {
        vec4 color = texture2D(tInput, vUv);
        float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        float soft = smoothstep(threshold - knee, threshold + knee, luminance);
        gl_FragColor = vec4(color.rgb * soft, color.a);
      }
    `, {
      threshold: { value: 0.72 },
      knee: { value: 0.18 },
    });
  }
}

// Adapted from Wagner's box-blur2-fs.glsl
export class WagnerBoxBlurPass {
  constructor(direction = new THREE.Vector2(1, 0)) {
    this.material = WagnerComposer.createShaderMaterial(`
      varying vec2 vUv;
      uniform sampler2D tInput;
      uniform vec2 delta;
      uniform vec2 resolution;

      void main() {
        vec4 sum = vec4(0.0);
        vec2 inc = delta / resolution;

        sum += texture2D(tInput, (vUv - inc * 4.0)) * 0.051;
        sum += texture2D(tInput, (vUv - inc * 3.0)) * 0.0918;
        sum += texture2D(tInput, (vUv - inc * 2.0)) * 0.12245;
        sum += texture2D(tInput, (vUv - inc * 1.0)) * 0.1531;
        sum += texture2D(tInput, (vUv + inc * 0.0)) * 0.1633;
        sum += texture2D(tInput, (vUv + inc * 1.0)) * 0.1531;
        sum += texture2D(tInput, (vUv + inc * 2.0)) * 0.12245;
        sum += texture2D(tInput, (vUv + inc * 3.0)) * 0.0918;
        sum += texture2D(tInput, (vUv + inc * 4.0)) * 0.051;

        gl_FragColor = sum;
      }
    `, {
      delta: { value: direction.clone() },
    });
  }
}

// Composite pass uses Wagner-inspired screen blend, vignette and noise.
export class WagnerCompositePass {
  constructor() {
    this.material = WagnerComposer.createShaderMaterial(`
      varying vec2 vUv;
      uniform sampler2D tInput;
      uniform sampler2D tBloom;
      uniform vec2 resolution;
      uniform float time;
      uniform float bloomStrength;
      uniform float chromaticAberration;
      uniform float vignetteBoost;
      uniform float vignetteReduction;
      uniform float noiseAmount;
      uniform float rainDesaturation;
      uniform float tintMix;
      uniform vec3 tintColor;

      float random(vec2 n, float offset) {
        return 0.5 - fract(sin(dot(n.xy + vec2(offset, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 center = vUv - 0.5;
        float dist = dot(center, center);
        vec2 offset = center * chromaticAberration * (0.45 + dist * 1.8);

        vec3 base;
        base.r = texture2D(tInput, clamp(vUv + offset, 0.001, 0.999)).r;
        base.g = texture2D(tInput, vUv).g;
        base.b = texture2D(tInput, clamp(vUv - offset, 0.001, 0.999)).b;

        vec3 bloom = texture2D(tBloom, vUv).rgb * bloomStrength;
        vec3 color = base + bloom * 0.65;

        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, 1.0 - rainDesaturation);
        color = mix(color, color * tintColor, tintMix);

        vec2 screenCenter = resolution * 0.5;
        float vignette = distance(screenCenter, gl_FragCoord.xy) / resolution.x;
        vignette = vignetteBoost - vignette * vignetteReduction;
        color *= vignette;

        float grain = random(vUv, 0.00001 * 35.0 * time);
        color += noiseAmount * grain;

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `, {
      tBloom: { value: null },
      bloomStrength: { value: 0.18 },
      chromaticAberration: { value: 0.0005 },
      vignetteBoost: { value: 1.18 },
      vignetteReduction: { value: 0.9 },
      noiseAmount: { value: 0.01 },
      rainDesaturation: { value: 0.0 },
      tintMix: { value: 0.045 },
      tintColor: { value: new THREE.Color(0xfff4e0) },
    });
  }
}
