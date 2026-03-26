import * as THREE from 'three';

// Multi-octave procedural normal map — diagonal waves give more organic look than pure sin/cos rows
function createWaterNormalTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 4 octaves at different frequencies and diagonal orientations
      const nx =
        Math.sin(u * Math.PI *  4.0 + v * Math.PI *  3.1) * 0.28 +
        Math.sin(u * Math.PI *  9.5 - v * Math.PI *  2.3) * 0.17 +
        Math.sin((u + v) * Math.PI * 13.7) * 0.10 +
        Math.sin((u - v) * Math.PI *  6.8 + 1.2) * 0.08;
      const ny =
        Math.cos(u * Math.PI *  5.2 + v * Math.PI *  2.8) * 0.26 +
        Math.cos(u * Math.PI *  3.1 - v * Math.PI *  8.4) * 0.19 +
        Math.sin((u + v) * Math.PI * 11.3 + 0.7) * 0.09 +
        Math.cos((u - v) * Math.PI * 15.1) * 0.06;
      const nz = Math.sqrt(Math.max(0.001, 1.0 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      data[i]     = Math.floor((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

const WATER_SHADER = {
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      normalSampler:   { value: null },
      mirrorSampler:   { value: null },
      alpha:           { value: 1.0 },
      time:            { value: 0.0 },
      distortionScale: { value: 20.0 },
      noiseScale:      { value: 1.0 },
      textureMatrix:   { value: new THREE.Matrix4() },
      sunColor:        { value: new THREE.Color(0x7f7f7f) },
      sunDirection:    { value: new THREE.Vector3(0.70707, 0.70707, 0.0) },
      eye:             { value: new THREE.Vector3() },
      waterColor:      { value: new THREE.Color(0x555555) },
      waterRadius:     { value: 8.0 },
    },
  ]),

  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    uniform float time;

    varying vec4 vMirrorCoord;
    varying vec3 vWorldPosition;
    varying vec3 vModelPosition;
    varying vec3 vSurfaceX;
    varying vec3 vSurfaceY;
    varying vec3 vSurfaceZ;
    #include <fog_pars_vertex>

    void main() {
      // Gentle multi-frequency wave displacement
      float waveY =
        sin(position.x * 0.78 + time * 1.05) * 0.042 +
        sin(position.z * 0.93 + time * 0.72) * 0.031 +
        sin((position.x + position.z) * 0.57 + time * 0.88) * 0.022 +
        sin((position.x - position.z) * 0.44 + time * 1.34) * 0.014;

      vec3 displaced = vec3(position.x, position.y + waveY, position.z);

      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vec4 viewPos  = modelViewMatrix * vec4(displaced, 1.0);

      vMirrorCoord = textureMatrix * worldPos;
      vWorldPosition = worldPos.xyz;
      vModelPosition = position; // undisplaced — used for UV/noise lookups

      vSurfaceX = normalize(vec3(modelMatrix[0][0], modelMatrix[0][1], modelMatrix[0][2]));
      vSurfaceY = normalize(vec3(modelMatrix[2][0], modelMatrix[2][1], modelMatrix[2][2]));
      vSurfaceZ = normalize(normalMatrix * normal);

      gl_Position = projectionMatrix * viewPos;
      // Inline fog depth (avoids Three.js mvPosition naming convention conflicts)
      #ifdef USE_FOG
        vFogDepth = -viewPos.z;
      #endif
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D mirrorSampler;
    uniform sampler2D normalSampler;
    uniform float alpha;
    uniform float time;
    uniform float distortionScale;
    uniform float noiseScale;
    uniform vec3  sunColor;
    uniform vec3  sunDirection;
    uniform vec3  eye;
    uniform vec3  waterColor;
    uniform float waterRadius;

    varying vec4 vMirrorCoord;
    varying vec3 vWorldPosition;
    varying vec3 vModelPosition;
    varying vec3 vSurfaceX;
    varying vec3 vSurfaceY;
    varying vec3 vSurfaceZ;

    #include <common>
    #include <fog_pars_fragment>

    void sunLight(
      const vec3 surfaceNormal, const vec3 eyeDirection,
      in float shiny, in float spec, in float diffuse,
      inout vec3 diffuseColor, inout vec3 specularColor
    ) {
      vec3 reflection  = normalize(reflect(-sunDirection, surfaceNormal));
      float direction  = max(0.0, dot(eyeDirection, reflection));
      specularColor   += pow(direction, shiny) * sunColor * spec;
      diffuseColor    += max(dot(sunDirection, surfaceNormal), 0.0) * sunColor * diffuse;
    }

    // 4-directional animated normal sampling (jbouny/ocean technique)
    vec3 getNoise(in vec2 uv) {
      float s = noiseScale;
      vec2 uv0 = uv / (108.0 * s) + vec2( time * 0.014,  time * 0.010);
      vec2 uv1 = uv / ( 97.0 * s) + vec2(-time * 0.012,  time * 0.009);
      vec2 uv2 = uv / vec2(8800.0 * s, 9600.0 * s) + vec2(time / 95.0,  time / 87.0);
      vec2 uv3 = uv / vec2(1100.0 * s,  950.0 * s) + vec2(-time / 103.0, time / 119.0);
      vec4 n = texture(normalSampler, uv0)
             + texture(normalSampler, uv1)
             + texture(normalSampler, uv2)
             + texture(normalSampler, uv3);
      return n.xyz * 0.5 - 1.0;
    }

    // High-frequency sparkle samples — tight caustic-like glints
    vec3 getSparkle(in vec2 uv) {
      float s = noiseScale;
      vec2 su0 = uv / (28.0 * s) + vec2( time * 0.031,  time * 0.027);
      vec2 su1 = uv / (23.0 * s) + vec2(-time * 0.022,  time * 0.038);
      vec4 n = texture(normalSampler, su0) + texture(normalSampler, su1);
      return n.xyz * 0.5 - 1.0;
    }

    void main() {
      // --- Circular pond mask (smooth fade at edge) ---
      float pondDist = length(vModelPosition.xz);
      float edgeMask = 1.0 - smoothstep(waterRadius - 0.35, waterRadius + 0.05, pondDist);
      if (edgeMask < 0.001) discard;

      vec3 worldToEye   = eye - vWorldPosition;
      vec3 eyeDirection = normalize(worldToEye);
      float distToEye   = length(worldToEye);

      // --- Primary wave normal ---
      vec3 noise       = getNoise(vModelPosition.xz);
      vec3 distortCoord = noise.x * vSurfaceX + noise.y * vSurfaceY;
      vec3 distortNormal = normalize(distortCoord * 0.55 + vSurfaceZ);
      if (dot(eyeDirection, vSurfaceZ) < 0.0) distortNormal *= -1.0;

      // --- Primary lighting ---
      vec3 diffuseLight  = vec3(0.0);
      vec3 specularLight = vec3(0.0);
      sunLight(distortNormal, eyeDirection, 80.0, 2.0, 0.40, diffuseLight, specularLight);

      // --- Caustic-like sparkle specular (tight high-freq lobe) ---
      vec3 sparkleNoise = getSparkle(vModelPosition.xz);
      vec3 sparkleNorm  = normalize(sparkleNoise.x * vSurfaceX + sparkleNoise.y * vSurfaceY + vSurfaceZ * 1.8);
      vec3 sparkleDiff = vec3(0.0), sparkleSpec = vec3(0.0);
      sunLight(sparkleNorm, eyeDirection, 650.0, 1.5, 0.0, sparkleDiff, sparkleSpec);
      specularLight += sparkleSpec * 0.45;

      // --- Reflection with distortion ---
      vec2 distortion = distortCoord.xz * distortionScale * sqrt(distToEye) * 0.065;
      vec4 mirrorCoord = vMirrorCoord;
      mirrorCoord.xy  += distortion;
      vec3 reflectionSample = textureProj(mirrorSampler, mirrorCoord).rgb;

      // --- Schlick Fresnel (water IOR ≈ 1.333, F0 ≈ 0.020) ---
      float cosTheta = max(dot(eyeDirection, distortNormal), 0.0);
      float fresnel  = 0.020 + 0.980 * pow(1.0 - cosTheta, 5.0);
      fresnel = clamp(fresnel * 1.75 + 0.04, 0.05, 0.96);

      // --- Depth-based water color (deeper at center, shallower at edge) ---
      float normalizedDepth = 1.0 - smoothstep(0.5, waterRadius * 0.85, pondDist);
      vec3 shallowColor = waterColor * vec3(1.18, 1.12, 1.04); // warmer / brighter
      vec3 deepColor    = waterColor * vec3(0.82, 0.90, 1.10); // cooler / deeper blue
      vec3 waterBody    = mix(shallowColor, deepColor, normalizedDepth);

      // Subsurface scatter: warm-up when eye is near-flat to surface
      float sss = max(0.0, dot(distortNormal, eyeDirection));
      waterBody *= (0.55 + sss * 0.75);

      // --- Combine base + reflection via Fresnel ---
      vec3 albedo = mix(
        waterBody + sunColor * diffuseLight * 0.20,
        reflectionSample * 0.92 + reflectionSample * specularLight * 0.30,
        fresnel
      );
      albedo += specularLight * sunColor * 0.28;

      // --- Animated edge foam ring ---
      float foamEdge  = smoothstep(waterRadius - 0.9, waterRadius - 0.15, pondDist);
      float foamBreak = 0.5 + 0.5 * sin(time * 1.4 + pondDist * 4.0 + noise.x * 2.0);
      albedo = mix(albedo, vec3(0.90, 0.95, 1.0), foamEdge * foamBreak * 0.55);

      gl_FragColor = vec4(albedo, alpha * edgeMask);
      #include <fog_fragment>
    }
  `,
};

export class OceanWater extends THREE.Mesh {
  constructor(renderer, scene, camera, geometry, options = {}) {
    const textureWidth  = options.textureWidth  ?? 512;
    const textureHeight = options.textureHeight ?? 512;
    const renderTarget  = new THREE.WebGLRenderTarget(textureWidth, textureHeight, {
      depthBuffer:   true,
      stencilBuffer: false,
    });
    renderTarget.texture.generateMipmaps = false;

    const uniforms = THREE.UniformsUtils.clone(WATER_SHADER.uniforms);
    uniforms.normalSampler.value   = options.waterNormals ?? createWaterNormalTexture();
    uniforms.mirrorSampler.value   = renderTarget.texture;
    uniforms.alpha.value           = options.alpha           ?? 0.82;
    uniforms.distortionScale.value = options.distortionScale ?? 12.0;
    uniforms.noiseScale.value      = options.noiseScale      ?? 1.0;
    uniforms.sunColor.value        = new THREE.Color(options.sunColor    ?? 0xf8ecd4);
    uniforms.sunDirection.value.copy(options.sunDirection ?? new THREE.Vector3(0.3, 0.9, 0.1).normalize());
    uniforms.waterColor.value      = new THREE.Color(options.waterColor  ?? 0x4f92a0);
    uniforms.waterRadius.value     = options.waterRadius ?? 8.0;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:   WATER_SHADER.vertexShader,
      fragmentShader: WATER_SHADER.fragmentShader,
      transparent: true,
      fog:  options.fog  ?? true,
      side: options.side ?? THREE.FrontSide,
    });

    super(geometry, material);

    this.renderer             = renderer;
    this.scene                = scene;
    this.camera               = camera;
    this.clipBias             = options.clipBias ?? 0.0;
    this.textureMatrix        = uniforms.textureMatrix.value;
    this.mirrorCamera         = camera.clone();
    this.renderTarget         = renderTarget;
    this.mirrorPlane          = new THREE.Plane();
    this.normal               = new THREE.Vector3();
    this.mirrorWorldPosition  = new THREE.Vector3();
    this.cameraWorldPosition  = new THREE.Vector3();
    this.rotationMatrix       = new THREE.Matrix4();
    this.lookAtPosition       = new THREE.Vector3(0, 0, -1);
    this.clipPlane            = new THREE.Vector4();
    this.view                 = new THREE.Vector3();
    this.target               = new THREE.Vector3();
    this.q                    = new THREE.Vector4();
    this.upVector             = new THREE.Vector3();
  }

  setSunFromLight(light) {
    if (!light) return;
    this.material.uniforms.sunColor.value.copy(light.color).multiplyScalar(Math.max(light.intensity, 0.15));
    this.material.uniforms.sunDirection.value.copy(light.position.clone().normalize());
  }

  setWaterColor(color) {
    this.material.uniforms.waterColor.value.set(color);
  }

  update(elapsed, light) {
    this.material.uniforms.time.value = elapsed;
    this.material.uniforms.eye.value.copy(this.camera.position);
    this.setSunFromLight(light);
  }

  onBeforeRender(renderer, scene, camera) {
    if (camera !== this.camera) return;

    this.updateMatrixWorld();
    this.camera.updateMatrixWorld();

    this.mirrorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);

    this.rotationMatrix.extractRotation(this.matrixWorld);
    this.normal.set(0, 1, 0).applyMatrix4(this.rotationMatrix).normalize();

    this.view.subVectors(this.mirrorWorldPosition, this.cameraWorldPosition);
    if (this.view.dot(this.normal) > 0) return;

    this.view.reflect(this.normal).negate().add(this.mirrorWorldPosition);

    this.rotationMatrix.extractRotation(this.camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotationMatrix).add(this.cameraWorldPosition);
    this.target.subVectors(this.mirrorWorldPosition, this.lookAtPosition)
               .reflect(this.normal).negate().add(this.mirrorWorldPosition);

    this.upVector.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal).negate();

    this.mirrorCamera.position.copy(this.view);
    this.mirrorCamera.up.copy(this.upVector);
    this.mirrorCamera.lookAt(this.target);
    this.mirrorCamera.near   = this.camera.near;
    this.mirrorCamera.far    = this.camera.far;
    this.mirrorCamera.aspect = this.camera.aspect;
    this.mirrorCamera.updateMatrixWorld();
    this.mirrorCamera.projectionMatrix.copy(this.camera.projectionMatrix);
    this.mirrorCamera.matrixWorldInverse.copy(this.mirrorCamera.matrixWorld).invert();

    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    this.textureMatrix.multiply(this.mirrorCamera.projectionMatrix);
    this.textureMatrix.multiply(this.mirrorCamera.matrixWorldInverse);
    this.textureMatrix.multiply(this.matrixWorld);

    this.mirrorPlane.setFromNormalAndCoplanarPoint(this.normal, this.mirrorWorldPosition);
    this.mirrorPlane.applyMatrix4(this.mirrorCamera.matrixWorldInverse);
    this.clipPlane.set(
      this.mirrorPlane.normal.x,
      this.mirrorPlane.normal.y,
      this.mirrorPlane.normal.z,
      this.mirrorPlane.constant,
    );

    const pm = this.mirrorCamera.projectionMatrix;
    this.q.x = (Math.sign(this.clipPlane.x) + pm.elements[8])  / pm.elements[0];
    this.q.y = (Math.sign(this.clipPlane.y) + pm.elements[9])  / pm.elements[5];
    this.q.z = -1.0;
    this.q.w = (1.0 + pm.elements[10]) / pm.elements[14];

    this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q));
    pm.elements[2]  = this.clipPlane.x;
    pm.elements[6]  = this.clipPlane.y;
    pm.elements[10] = this.clipPlane.z + 1.0 - this.clipBias;
    pm.elements[14] = this.clipPlane.w;

    this.material.uniforms.eye.value.copy(this.cameraWorldPosition);

    const currentTarget         = renderer.getRenderTarget();
    const currentXrEnabled      = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

    this.visible = false;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.renderTarget);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, this.mirrorCamera);
    renderer.setRenderTarget(currentTarget);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    this.visible = true;
  }

  dispose() {
    this.renderTarget.dispose();
    this.material.uniforms.normalSampler.value?.dispose?.();
    this.material.dispose();
    this.geometry.dispose();
  }
}
