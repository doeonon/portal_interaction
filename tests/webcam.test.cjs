const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function setup(getUserMedia) {
  const handlers = {}, events = {}, classes = new Set(), draws = [];
  const label = {}, status = {}, stopped = [];
  let now = 1000, frame, timer, detections = [];
  const track = { stop: () => stopped.push(true), addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const button = { querySelector: () => label, setAttribute(name, value) { this[name] = value; }, addEventListener(name, fn) { handlers[name] = fn; } };
  const video = { readyState: 2, currentTime: 1, videoWidth: 640, videoHeight: 480, play: async () => {} };
  const context = { clearRect() {}, save() {}, restore() {}, translate() {}, scale(x) { draws.push({ mirrored: x === -1 }); }, drawImage(...args) { draws.push({ args }); } };
  const portrait = { width: 240, height: 252, getContext: () => context };
  const elements = { '#camera-button': button, '#camera-status': status, '#camera-video': video, '#face-portrait': portrait };
  const sandbox = vm.createContext({
    document: { querySelector: selector => elements[selector] },
    navigator: { mediaDevices: { getUserMedia: constraints => getUserMedia ? getUserMedia(constraints, stream) : Promise.resolve(stream) } },
    fairy: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    faceapi: {
      tf: { ready: async () => {}, io: { decodeWeights: () => ({}) } },
      nets: { tinyFaceDetector: { loadFromWeightMap() {} } },
      TinyFaceDetectorOptions: class {},
      detectSingleFace: async () => detections.shift()
    },
    FAIRY_FACE_MODEL: { specs: [], weights: '' }, atob: value => value,
    performance: { now: () => now },
    requestAnimationFrame: fn => { frame = fn; },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = null; },
    addEventListener: (name, fn) => { events[name] = fn; }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'webcam.js'), 'utf8'), sandbox);
  return { button, video, status, stopped, classes, draws, events, sandbox,
    click: () => handlers.click(),
    setDetections: results => { detections = results; },
    draw: () => frame(),
    advance: ms => { now += ms; video.currentTime += ms / 1000; },
    detect: async () => { const current = timer; timer = null; if (current) await current(); }
  };
}

(async () => {
  const app = setup((constraints, stream) => {
    assert.equal(constraints.audio, false, 'Microphone must stay off');
    return Promise.resolve(stream);
  });
  app.setDetections([{ box: { x: 580, y: 410, width: 120, height: 140 } }]);
  await app.click(); await Promise.resolve(); app.draw();
  assert.equal(app.button['aria-pressed'], 'true');
  assert(app.classes.has('has-face'), 'Detected face should replace the default face');
  assert(app.draws.some(draw => draw.mirrored), 'Portrait should behave like a mirror');
  const crop = app.draws.find(draw => draw.args).args;
  assert(crop[1] >= 0 && crop[2] >= 0 && crop[1] + crop[3] <= 640 && crop[2] + crop[4] <= 480,
    'Face at the video edge must crop inside the frame');
  assert(crop[3] < 640 && crop[4] < 480, 'Portrait must zoom into the face');
  app.advance(1100); app.setDetections([null]); await app.detect(); app.draw();
  assert(!app.classes.has('has-face'), 'Lost face should reveal default face');
  await app.click();
  assert.equal(app.stopped.length, 1, 'Camera off must release the webcam');
  assert.equal(app.video.srcObject, null);
  assert.equal(app.button['aria-pressed'], 'false');

  const denied = setup(async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; });
  await denied.click();
  assert.equal(denied.button.disabled, false);
  assert(denied.status.textContent.includes('허용되지'));

  let grant;
  const leaving = setup((constraints, stream) => new Promise(resolve => { grant = () => resolve(stream); }));
  const starting = leaving.click(); leaving.events.pagehide(); grant(); await starting;
  assert.equal(leaving.stopped.length, 1, 'A late permission grant after leaving must stop its tracks');

  const pending = setup(); await pending.click(); await Promise.resolve();
  vm.runInContext('faceapi.detectSingleFace = () => new Promise(resolve => { globalThis.completeDetection = resolve; })', pending.sandbox);
  pending.advance(200); const detection = pending.detect();
  await pending.click();
  vm.runInContext('completeDetection({ box: { x: 100, y: 100, width: 100, height: 120 } })', pending.sandbox);
  await detection; pending.draw();
  assert(!pending.classes.has('has-face'), 'A late detection after camera off must not restore the face');

  const html = fs.readFileSync(path.join(root, '보라빛_비밀의_숲.html'), 'utf8');
  assert(!/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i.test(html), 'Standalone HTML must embed dependencies');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 5);
  scripts.forEach(script => new vm.Script(script[1]));
  assert.equal(scripts[3][1].trim(), fs.readFileSync(path.join(root, 'webcam.js'), 'utf8').trim());
  const image = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert(Buffer.from(image[1], 'base64').equals(fs.readFileSync(path.join(root, 'forest2.png'))));
  console.log('PASS: zoomed face crop, mirroring, face loss, camera off, permission denial, late grant, late detection, standalone HTML');
})().catch(error => { console.error(error); process.exitCode = 1; });
