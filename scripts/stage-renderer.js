/* Decorative stage only: live iframe contents remain browser-rendered DOM. */
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  if (!stage) return;
  let canvas, device, context, pipeline, uniform, group, raf = 0, disposed = false;
  let backend = 'css', pulse = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const values = new Float32Array(12);
  const shader = `
    struct Params { size: vec4f, base: vec4f, dot: vec4f }
    @group(0) @binding(0) var<uniform> p: Params;
    @vertex fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
      var points = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
      return vec4f(points[i], 0, 1);
    }
    @fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
      let xy = pos.xy / p.size.z;
      let cell = fract(xy / 20.0) * 20.0 - vec2f(10.0);
      let dots = 1.0 - smoothstep(0.8, 1.4, length(cell));
      let glow = max(0.0, 1.0 - distance(xy, p.size.xy * 0.5) / max(p.size.x, p.size.y));
      let color = mix(p.base.rgb, p.dot.rgb, dots * p.dot.a);
      return vec4f(color + vec3f(0.025, 0.016, 0.04) * glow * p.size.w, 1.0);
    }`;

  function surface() {
    canvas?.remove(); // a WebGPU canvas cannot subsequently acquire a 2D context
    canvas = document.createElement('canvas');
    canvas.className = 'stage-renderer';
    canvas.setAttribute('aria-hidden', 'true');
    stage.prepend(canvas);
  }
  function color(value) {
    // Resolve CSS color syntax, including color-mix, through the browser.
    const probe = document.createElement('span');
    probe.style.color = value; stage.append(probe);
    const rgb = getComputedStyle(probe).color; probe.remove();
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return [0, 0, 0, 1];
    c.fillStyle = rgb; c.fillRect(0, 0, 1, 1);
    return [...c.getImageData(0, 0, 1, 1).data].map(v => v / 255);
  }
  function palette() {
    const css = getComputedStyle(stage);
    values.set(color(css.getPropertyValue('--stage')), 4);
    values.set(color(css.getPropertyValue('--stage-dot')), 8);
  }
  function status(name) {
    backend = name; stage.dataset.renderer = name;
    const label = document.getElementById('rendererLabel');
    if (label) {
      label.textContent = name === 'webgpu' ? 'WebGPU' : name === 'canvas2d' ? 'Canvas2D' : 'CSS';
      label.title = 'Bühnenhintergrund · ' + label.textContent;
    }
  }
  function fallback() {
    if (disposed) return;
    cancelAnimationFrame(raf); raf = 0;
    const old = device; device = null;
    context?.unconfigure?.(); old?.destroy();
    surface(); context = canvas.getContext('2d');
    status(context ? 'canvas2d' : 'css');
    palette(); schedule();
  }
  function draw(now) {
    raf = 0;
    if (disposed || document.hidden || !stage.clientWidth || !stage.clientHeight) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const limit = device?.limits.maxTextureDimension2D || 4096;
    const dpr = Math.min(ratio, limit / stage.clientWidth, limit / stage.clientHeight);
    const w = Math.max(1, Math.round(stage.clientWidth * dpr));
    const h = Math.max(1, Math.round(stage.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const amount = motion.matches ? 0 : Math.max(0, 1 - (now - pulse) / 450);
    values.set([stage.clientWidth, stage.clientHeight, dpr, amount]);
    try {
      if (backend === 'webgpu') {
        device.queue.writeBuffer(uniform, 0, values);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: {r:0,g:0,b:0,a:1} }] });
        pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.draw(3); pass.end();
        device.queue.submit([encoder.finish()]);
      } else if (backend === 'canvas2d') {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const css = getComputedStyle(stage);
        context.fillStyle = css.getPropertyValue('--stage');
        context.fillRect(0, 0, stage.clientWidth, stage.clientHeight);
        context.fillStyle = css.getPropertyValue('--stage-dot');
        for (let y = 10; y < stage.clientHeight; y += 20) for (let x = 10; x < stage.clientWidth; x += 20) {
          context.beginPath(); context.arc(x, y, 1, 0, Math.PI * 2); context.fill();
        }
      }
    } catch { fallback(); return; }
    if (amount > 0 && backend === 'webgpu') schedule();
  }
  function schedule() { if (!disposed && !raf) raf = requestAnimationFrame(draw); }
  async function init() {
    surface();
    try {
      if (new URLSearchParams(location.search).get('renderer') === 'canvas2d' || !isSecureContext || !navigator.gpu) return fallback();
      const adapter = await navigator.gpu.requestAdapter({powerPreference: 'low-power'});
      if (!adapter || disposed) return fallback();
      const acquired = await adapter.requestDevice();
      if (disposed) { acquired.destroy(); return; }
      device = acquired;
      device.lost.then(() => { if (device === acquired) fallback(); });
      device.addEventListener('uncapturederror', () => { if (device === acquired) fallback(); });
      context = canvas.getContext('webgpu');
      if (!context) return fallback();
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({device, format, alphaMode: 'opaque'});
      const module = device.createShaderModule({code: shader});
      pipeline = await device.createRenderPipelineAsync({layout: 'auto', vertex: {module, entryPoint: 'vertex'}, fragment: {module, entryPoint: 'fragment', targets: [{format}]}, primitive: {topology: 'triangle-list'}});
      if (device !== acquired || disposed) return;
      uniform = device.createBuffer({size: values.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
      group = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [{binding: 0, resource: {buffer: uniform}}]});
      status('webgpu'); palette(); schedule();
    } catch { fallback(); }
  }
  new ResizeObserver(schedule).observe(stage);
  new MutationObserver(() => { palette(); schedule(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); schedule(); });
  motion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else schedule(); });
  document.getElementById('frame')?.addEventListener('load', () => { pulse = performance.now(); schedule(); });
  window.addEventListener('pagehide', event => { if (!event.persisted) { disposed = true; cancelAnimationFrame(raf); device?.destroy(); } });
  init();
})();
