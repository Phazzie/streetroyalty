/**
 * A small WebGL slide stage: two photos, one noisy sweep between them.
 * No library. It reports `ok = false` when WebGL is missing so the caller can
 * keep the plain images that sit underneath.
 */

export type SlideSource = {
  src: string;
  /** Where the subject sits in the photo, 0..1 from the top left. Kept in frame when the photo is cropped. */
  focus: [number, number];
};

type Loaded = { texture: WebGLTexture; width: number; height: number; focus: [number, number] };

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uRes;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform vec2 uFromFocus;
uniform vec2 uToFocus;
uniform vec2 uPointer;
uniform float uProgress;
uniform float uTime;
uniform float uDrift;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// object-fit: cover, with the crop pulled toward the subject.
vec2 coverUv(vec2 uv, vec2 tex, vec2 focus, float zoom) {
  float rs = uRes.x / uRes.y;
  float rt = tex.x / tex.y;
  vec2 scale = rs > rt ? vec2(1.0, rt / rs) : vec2(rs / rt, 1.0);
  vec2 slack = 1.0 - scale;
  scale /= zoom;
  return (uv - 0.5) * scale + 0.5 + (focus - 0.5) * slack;
}

vec3 split(sampler2D tex, vec2 uv, float amount) {
  return vec3(texture2D(tex, uv + vec2(amount, 0.0)).r, texture2D(tex, uv).g, texture2D(tex, uv - vec2(amount, 0.0)).b);
}

void main() {
  vec2 uv = vUv;
  float ease = uProgress * uProgress * (3.0 - 2.0 * uProgress);
  float n = fbm(uv * vec2(2.5, 4.0) + vec2(0.0, uTime * 0.05));
  float sweep = uv.x * 0.82 + (1.0 - uv.y) * 0.18 + (n - 0.5) * 0.35;
  float edge = mix(-0.3, 1.3, ease);
  float keep = smoothstep(edge - 0.06, edge + 0.06, sweep);
  vec2 parallax = uPointer * 0.012;
  float zoomFrom = 1.02 + 0.015 * (1.0 - cos(uDrift * 0.12));
  float zoomTo = 1.08 - 0.06 * ease;
  vec2 push = vec2(0.10, 0.0);
  vec2 uvFrom = coverUv(uv + push * ease * (0.4 + n) + parallax, uFromSize, uFromFocus, zoomFrom);
  vec2 uvTo = coverUv(uv - push * (1.0 - ease) * (0.4 + n) + parallax, uToSize, uToFocus, zoomTo);
  float band = (1.0 - smoothstep(0.0, 0.16, abs(sweep - edge))) * sin(uProgress * 3.14159);
  vec3 from = split(uFrom, uvFrom, band * 0.012);
  vec3 to = split(uTo, uvTo, band * 0.012);
  vec3 color = mix(to, from, keep);
  vec3 lime = vec3(0.84, 1.0, 0.24);
  float dots = smoothstep(0.34, 0.2, length(fract(gl_FragCoord.xy / 7.0) - 0.5));
  color += lime * band * (0.2 + dots * 0.28);
  color += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.03;
  gl_FragColor = vec4(color, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("slide shader", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`slide image failed: ${src}`));
    image.src = src;
  });
}

const DURATION_MS = 1500;

export class SlideStage {
  ok = false;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private slides: (Loaded | null)[] = [];
  private from = 0;
  private to = 0;
  private startedAt = 0;
  private settledAt = 0;
  private moving = false;
  private frame = 0;
  private running = false;
  private pointer: [number, number] = [0, 0];
  private aim: [number, number] = [0, 0];
  private readonly canvas: HTMLCanvasElement;
  private readonly onLost = (event: Event) => {
    event.preventDefault();
    this.ok = false;
    this.stop();
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("slide program", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of [
      "uFrom",
      "uTo",
      "uRes",
      "uFromSize",
      "uToSize",
      "uFromFocus",
      "uToFocus",
      "uPointer",
      "uProgress",
      "uTime",
      "uDrift",
    ]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    canvas.addEventListener("webglcontextlost", this.onLost);
    this.gl = gl;
    this.program = program;
    this.ok = true;
  }

  /** Loads one slide. The rest can follow in the background. */
  async load(index: number, source: SlideSource): Promise<boolean> {
    const gl = this.gl;
    if (!gl || !this.ok) return false;
    try {
      const image = await loadImage(source.src);
      if (!this.ok) return false;
      const texture = gl.createTexture();
      if (!texture) return false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.slides[index] = {
        texture,
        width: image.naturalWidth,
        height: image.naturalHeight,
        // The texture is flipped on upload, so the vertical focus flips with it.
        focus: [source.focus[0], 1 - source.focus[1]],
      };
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  has(index: number): boolean {
    return Boolean(this.slides[index]);
  }

  /** Cut straight to a slide with no sweep. */
  cut(index: number) {
    if (!this.slides[index]) return;
    this.from = index;
    this.to = index;
    this.moving = false;
    this.settledAt = performance.now();
  }

  /** Sweep to a slide. Returns false when the slide is not loaded yet. */
  show(index: number): boolean {
    if (!this.slides[index]) return false;
    if (index === this.to && !this.moving) return true;
    if (this.moving) this.from = this.to;
    this.to = index;
    this.startedAt = performance.now();
    this.moving = true;
    return true;
  }

  setPointer(x: number, y: number) {
    this.aim = [x, y];
  }

  resize() {
    const gl = this.gl;
    if (!gl) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    const gl = this.gl;
    if (gl) {
      for (const slide of this.slides) if (slide) gl.deleteTexture(slide.texture);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.slides = [];
    this.gl = null;
    this.ok = false;
  }

  private draw() {
    const gl = this.gl;
    const from = this.slides[this.from];
    const to = this.slides[this.to];
    if (!gl || !from || !to) return;
    const now = performance.now();
    let progress = 0;
    if (this.moving) {
      progress = Math.min(1, (now - this.startedAt) / DURATION_MS);
      if (progress >= 1) {
        this.from = this.to;
        this.moving = false;
        this.settledAt = now;
        progress = 0;
      }
    }
    const shown = this.slides[this.from] ?? from;
    this.pointer[0] += (this.aim[0] - this.pointer[0]) * 0.06;
    this.pointer[1] += (this.aim[1] - this.pointer[1]) * 0.06;
    const u = this.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shown.texture);
    gl.uniform1i(u.uFrom, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, to.texture);
    gl.uniform1i(u.uTo, 1);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uFromSize, shown.width, shown.height);
    gl.uniform2f(u.uToSize, to.width, to.height);
    gl.uniform2f(u.uFromFocus, shown.focus[0], shown.focus[1]);
    gl.uniform2f(u.uToFocus, to.focus[0], to.focus[1]);
    gl.uniform2f(u.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(u.uProgress, progress);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uDrift, (now - this.settledAt) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
