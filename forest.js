const forest = document.querySelector('#forest');
const canvas = document.querySelector('#dust');
const ctx = canvas.getContext('2d');
const hint = document.querySelector('#hint');
const fullscreen = document.querySelector('#fullscreen');
const notice = document.querySelector('#notice');
const fairy = document.querySelector('#fairy');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width, height, particles = [], lastTime = performance.now(), hasMoved = false;
let targetX = innerWidth / 2, targetY = innerHeight * .55;
let lightX = targetX, lightY = targetY, power = 0, active = false;
let fairyX = targetX + 40, fairyY = targetY - 40, lastMotionTime = -Infinity;
let pressed = false, strokePower = 0, lastStrokeTime = -Infinity;
let previousPointer = null;
let fairyHalfWidth = 160, fairyHalfHeight = 200;

function resize() {
  width = innerWidth; height = innerHeight;
  fairyHalfWidth = fairy.offsetWidth / 2; fairyHalfHeight = fairy.offsetHeight / 2;
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  forest.style.setProperty('--radius', `${Math.max(210, Math.min(390, Math.min(width, height) * .42))}px`);
  targetX = Math.min(targetX, width); targetY = Math.min(targetY, height);
  previousPointer = null;
}
resize();
addEventListener('resize', resize);

function emit(x, y, now) {
  particles.push({
    x: x + (Math.random() - .5) * 16, y: y + (Math.random() - .5) * 16,
    vx: (Math.random() - .5) * 13, vy: -3 - Math.random() * 10,
    radius: .7 + Math.random() ** 2 * 1.7, phase: Math.random() * Math.PI * 2,
    born: now, life: 2400 + Math.random() * 2400,
    color: '#ffffff'
  });
}

function updatePointer(event) {
  targetX = event.clientX; targetY = event.clientY;
  if (!active) { lightX = targetX; lightY = targetY; fairyX = targetX + 40; fairyY = targetY - 40; }
  active = true;
  forest.style.setProperty('--pointer-x', `${targetX}px`);
  forest.style.setProperty('--pointer-y', `${targetY}px`);
}
function stopDrawing() {
  pressed = false; previousPointer = null; lastStrokeTime = -Infinity;
}
forest.addEventListener('pointerenter', event => {
  if (!event.target.closest('button')) updatePointer(event);
});
forest.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('button')) return;
  updatePointer(event);
  pressed = true;
  previousPointer = { x: targetX, y: targetY };
});
forest.addEventListener('pointermove', event => {
  if (event.target.closest('button')) { stopDrawing(); return; }
  const moved = Math.hypot(event.clientX - targetX, event.clientY - targetY) > 0;
  updatePointer(event);
  if (moved) {
    lastMotionTime = performance.now();
    if (!hasMoved) { hasMoved = true; setTimeout(() => hint.classList.add('hidden'), 3500); }
  }
  if (!pressed || !(event.buttons & 1)) { stopDrawing(); return; }
  const now = performance.now();
  if (previousPointer) {
    const dx = targetX - previousPointer.x, dy = targetY - previousPointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) lastStrokeTime = now;
    const count = distance > 0 ? Math.min(90, Math.max(1, Math.ceil(distance / (reducedMotion ? 12 : 2)))) : 0;
    for (let i = 1; i <= count; i++) emit(previousPointer.x + dx * i / count, previousPointer.y + dy * i / count, now);
  }
  previousPointer = { x: targetX, y: targetY };
  if (particles.length > 1000) particles.splice(0, particles.length - 1000);
});
forest.addEventListener('pointerleave', () => { active = false; stopDrawing(); });
addEventListener('pointerup', event => {
  if (!(event.buttons & 1)) stopDrawing();
  if (event.pointerType !== 'mouse') active = false;
});
addEventListener('pointercancel', () => { active = false; stopDrawing(); });
addEventListener('blur', () => { active = false; stopDrawing(); });

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  const follow = reducedMotion ? 1 : 1 - Math.exp(-22 * dt);
  lightX += (targetX - lightX) * follow; lightY += (targetY - lightY) * follow;
  const moving = active && now - lastMotionTime < 220;
  power += ((moving ? 1 : 0) - power) * (1 - Math.exp(-(moving ? 3.2 : .95) * dt));
  const fairyFollow = reducedMotion ? 1 : 1 - Math.exp(-6 * dt);
  fairyX += (Math.max(fairyHalfWidth, Math.min(width - fairyHalfWidth, targetX + 40)) - fairyX) * fairyFollow;
  fairyY += (Math.max(fairyHalfHeight + 3, Math.min(height - fairyHalfHeight - 3, targetY - 40)) - fairyY) * fairyFollow;
  const bob = reducedMotion ? 0 : Math.sin(now / 220) * 3;
  fairy.style.transform = `translate3d(${(fairyX - fairyHalfWidth).toFixed(1)}px, ${(fairyY - fairyHalfHeight + bob).toFixed(1)}px, 0)`;
  const drawing = pressed && now - lastStrokeTime < 140;
  strokePower += ((drawing ? 1 : 0) - strokePower) * (1 - Math.exp(-10 * dt));
  forest.style.setProperty('--x', `${lightX.toFixed(1)}px`);
  forest.style.setProperty('--y', `${lightY.toFixed(1)}px`);
  forest.style.setProperty('--power', power.toFixed(3));
  forest.style.setProperty('--stroke', strokePower.toFixed(3));
  ctx.clearRect(0, 0, width, height);
  particles = particles.filter(p => now - p.born < p.life);
  for (const p of particles) {
    const age = (now - p.born) / p.life;
    p.x += (p.vx + Math.sin(now / 1100 + p.phase) * 5) * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, age * 12) * (1 - age) ** 1.2 * .95;
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

fullscreen.addEventListener('click', async () => {
  notice.textContent = '';
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { notice.textContent = '전체 화면을 열 수 없어요. 키보드 F11을 눌러보세요.'; }
});
document.addEventListener('fullscreenchange', () => {
  const expanded = Boolean(document.fullscreenElement);
  fullscreen.querySelector('span').textContent = expanded ? '전체 화면 닫기' : '전체 화면';
  fullscreen.setAttribute('aria-label', expanded ? '전체 화면 닫기' : '전체 화면으로 보기');
});
