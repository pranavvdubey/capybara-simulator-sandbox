import * as THREE from 'three';

function createWaterNormalTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx =
        Math.sin((x / size) * Math.PI * 6.0) * 0.35 +
        Math.sin((y / size) * Math.PI * 11.0) * 0.2;
      const ny =
        Math.cos((x / size) * Math.PI * 7.0) * 0.25 +
        Math.sin((y / size) * Math.PI * 5.0) * 0.3;
      const nz = Math.sqrt(Math.max(0.0, 1.0 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
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
      normalSampler: { value: null },
      mirrorSampler: { value: null },
      alpha: { value: 1.0 },
      time: { value: 0.0 },
      distortionScale: { value: 20.0 },
      noiseScale: { value: 1.0 },
      textureMatrix: { value: new THREE.Matrix4() },
      sunColor: { value: new THREE.Color(0x7f7f7f) },
      sunDirection: { value: new THREE.Vector3(0.70707, 0.70707, 0.0) },
      eye: { value: new THREE.Vector3() },
      waterColor: { value: new THREE.Color(0x555555) },
    },
  ]),
  vertexShader: `
    uniform mat4 textureMatrix;

    varying vec4 vMirrorCoord;
    varying vec3 vWorldPosition;
    varying vec3 vModelPosition;
    varying vec3 vSurfaceX;
    varying vec3 vSurfaceY;
    varying vec3 vSurfaceZ;
    #include <fog_pars_vertex>

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vMirrorCoord = textureMatrix * worldPos;
      vWorldPosition = worldPos.xyz;
      vModelPosition = position;
      vSurfaceX = normalize(vec3(modelMatrix[0][0], modelMatrix[0][1], modelMatrix[0][2]));
      vSurfaceY = normalize(vec3(modelMatrix[2][0], modelMatrix[2][1], modelMatrix[2][2]));
      vSurfaceZ = normalize(normalMatrix * normal);

      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: `
    uniform sampler2D mirrorSampler;
    uniform sampler2D normalSampler;
    uniform float alpha;
    uniform float time;
    uniform float distortionScale;
    uniform float noiseScale;
    uniform vec3 sunColor;
    uniform vec3 sunDirection;
    uniform vec3 eye;
    uniform vec3 waterColor;

    varying vec4 vMirrorCoord;
    varying vec3 vWorldPosition;
    varying vec3 vModelPosition;
    varying vec3 vSurfaceX;
    varying vec3 vSurfaceY;
    varying vec3 vSurfaceZ;

    #include <common>
    #include <fog_pars_fragment>

    void sunLight(
      const vec3 surfaceNormal,
      const vec3 eyeDirection,
      in float shiny,
      in float spec,
      in float diffuse,
      inout vec3 diffuseColor,
      inout vec3 specularColor
    ) {
      vec3 reflection = normalize(reflect(-sunDirection, surfaceNormal));
      float direction = max(0.0, dot(eyeDirection, reflection));
      specularColor += pow(direction, shiny) * sunColor * spec;
      diffuseColor += max(dot(sunDirection, surfaceNormal), 0.0) * sunColor * diffuse;
    }

    vec3 getNoise(in vec2 uv) {
      vec2 uv0 = uv / (103.0 * noiseScale) + vec2(time / 17.0, time / 29.0);
      vec2 uv1 = uv / (107.0 * noiseScale) - vec2(time / -19.0, time / 31.0);
      vec2 uv2 = uv / (vec2(8907.0, 9803.0) * noiseScale) + vec2(time / 101.0, time / 97.0);
      vec2 uv3 = uv / (vec2(1091.0, 1027.0) * noiseScale) - vec2(time / 109.0, time / -113.0);

      vec4 noise =
        texture(normalSampler, uv0) +
        texture(normalSampler, uv1) +
        texture(normalSampler, uv2) +
        texture(normalSampler, uv3);

      return noise.xyz * 0.5 - 1.0;
    }

    void main() {
      vec3 worldToEye = eye - vWorldPosition;
      vec3 eyeDirection = normalize(worldToEye);

      vec3 noise = getNoise(vModelPosition.xz);
      vec3 distortCoord = noise.x * vSurfaceX + noise.y * vSurfaceY;
      vec3 distortNormal = normalize(distortCoord + vSurfaceZ);

      if (dot(eyeDirection, vSurfaceZ) < 0.0) {
        distortNormal *= -1.0;
      }

      vec3 diffuseLight = vec3(0.0);
      vec3 specularLight = vec3(0.0);
      sunLight(distortNormal, eyeDirection, 100.0, 1.8, 0.45, diffuseLight, specularLight);

      float distanceToEye = length(worldToEye);
      vec2 distortion = distortCoord.xz * distortionScale * sqrt(distanceToEye) * 0.07;
      vec4 mirrorCoord = vMirrorCoord;
      mirrorCoord.xy += distortion;
      vec3 reflectionSample = textureProj(mirrorSampler, mirrorCoord).rgb;

      float theta = max(dot(eyeDirection, distortNormal), 0.0);
      float reflectance = 0.3 + (1.0 - 0.3) * pow(1.0 - theta, 3.0);
      vec3 scatter = max(0.0, dot(distortNormal, eyeDirection)) * waterColor;
      vec3 albedo = mix(
        sunColor * diffuseLight * 0.3 + scatter,
        vec3(0.1) + reflectionSample * 0.9 + reflectionSample * specularLight,
        reflectance
      );

      gl_FragColor = vec4(albedo, alpha);
      #include <fog_fragment>
    }
  `,
};

export class OceanWater extends THREE.Mesh {
  constructor(renderer, scene, camera, geometry, options = {}) {
    const textureWidth = options.textureWidth ?? 512;
    const textureHeight = options.textureHeight ?? 512;
    const renderTarget = new THREE.WebGLRenderTarget(textureWidth, textureHeight, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    renderTarget.texture.generateMipmaps = false;

    const uniforms = THREE.UniformsUtils.clone(WATER_SHADER.uniforms);
    uniforms.normalSampler.value = options.waterNormals ?? createWaterNormalTexture();
    uniforms.mirrorSampler.value = renderTarget.texture;
    uniforms.alpha.value = options.alpha ?? 0.82;
    uniforms.distortionScale.value = options.distortionScale ?? 12.0;
    uniforms.noiseScale.value = options.noiseScale ?? 1.0;
    uniforms.sunColor.value = new THREE.Color(options.sunColor ?? 0xf8ecd4);
    uniforms.sunDirection.value.copy(options.sunDirection ?? new THREE.Vector3(0.3, 0.9, 0.1).normalize());
    uniforms.waterColor.value = new THREE.Color(options.waterColor ?? 0x4f92a0);

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WATER_SHADER.vertexShader,
      fragmentShader: WATER_SHADER.fragmentShader,
      transparent: true,
      fog: options.fog ?? true,
      side: options.side ?? THREE.DoubleSide,
    });

    super(geometry, material);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.clipBias = options.clipBias ?? 0.0;
    this.textureMatrix = uniforms.textureMatrix.value;
    this.mirrorCamera = camera.clone();
    this.renderTarget = renderTarget;
    this.mirrorPlane = new THREE.Plane();
    this.normal = new THREE.Vector3();
    this.mirrorWorldPosition = new THREE.Vector3();
    this.cameraWorldPosition = new THREE.Vector3();
    this.rotationMatrix = new THREE.Matrix4();
    this.lookAtPosition = new THREE.Vector3(0, 0, -1);
    this.clipPlane = new THREE.Vector4();
    this.view = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.q = new THREE.Vector4();
    this.upVector = new THREE.Vector3();
    this._lastTime = 0;
  }

  setSunFromLight(light) {
    if (!light) return;
    this.material.uniforms.sunColor.value.copy(light.color).multiplyScalar(Math.max(light.intensity, 0.15));
    const direction = light.position.clone().normalize();
    this.material.uniforms.sunDirection.value.copy(direction);
  }

  setWaterColor(color) {
    this.material.uniforms.waterColor.value.set(color);
  }

  update(elapsed, light) {
    this._lastTime = elapsed;
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

    this.view.reflect(this.normal).negate();
    this.view.add(this.mirrorWorldPosition);

    this.rotationMatrix.extractRotation(this.camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotationMatrix).add(this.cameraWorldPosition);

    this.target.subVectors(this.mirrorWorldPosition, this.lookAtPosition);
    this.target.reflect(this.normal).negate();
    this.target.add(this.mirrorWorldPosition);

    this.upVector.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal).negate();

    this.mirrorCamera.position.copy(this.view);
    this.mirrorCamera.up.copy(this.upVector);
    this.mirrorCamera.lookAt(this.target);
    this.mirrorCamera.near = this.camera.near;
    this.mirrorCamera.far = this.camera.far;
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

    const projectionMatrix = this.mirrorCamera.projectionMatrix;
    this.q.x = (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    this.q.y = (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    this.q.z = -1.0;
    this.q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q));
    projectionMatrix.elements[2] = this.clipPlane.x;
    projectionMatrix.elements[6] = this.clipPlane.y;
    projectionMatrix.elements[10] = this.clipPlane.z + 1.0 - this.clipBias;
    projectionMatrix.elements[14] = this.clipPlane.w;

    this.material.uniforms.eye.value.copy(this.cameraWorldPosition);

    const currentTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
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
