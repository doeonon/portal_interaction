const forest = document.querySelector('#forest');
const canvas = document.querySelector('#flowers');
const ctx = canvas.getContext('2d');
const trailCanvas = document.querySelector('#flower-trail');
const trailContext = trailCanvas.getContext('2d');
const flowerMission = document.querySelector('#flower-mission');
const lightProgress = document.querySelector('#light-progress');
const lightCount = document.querySelector('#light-count');
const hint = document.querySelector('#hint');
const fullscreen = document.querySelector('#fullscreen');
const notice = document.querySelector('#notice');
const fairy = document.querySelector('#fairy');
const fairyArt = document.querySelector('#fairy-art');
const fairyCount = document.querySelector('#fairy-count');
const fairyProgress = document.querySelector('#fairy-progress');
const fairyMessage = document.querySelector('#fairy-message');
const hiddenFairies = Array.from({ length: 10 }, (_, index) => {
  const node = index === 0 ? fairy : document.createElement('div');
  if (index > 0) {
    const sprite = fairyArt.cloneNode();
    sprite.removeAttribute('id');
    node.className = 'hidden-fairy';
    node.append(sprite);
    fairy.parentElement.append(node);
  }
  return { node, found: false, x: .25 + Math.random() * .5, y: .25 + Math.random() * .5 };
});
const chimeButton = document.querySelector('#chime-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let flowers = [], clickStart = null;
let foundCount = 0, messageTimer;
let flowerStage = false, forestBright = false, lightCharge = 0;
let trailPoint = null, swingSample = null, previousSwing = null, lastShake = -Infinity;
let flowerSparks = [];
let chimeAudio, chimeVolume, chimeEnabled = false, lastChime = -Infinity, chimeStep = 0, chimeGain = 0;
let width, height, lastTime = performance.now(), hasMoved = false;
let targetX = innerWidth / 2, targetY = innerHeight * .55;
let lensOpacity = 0, active = false;

function resize() {
  let previousTrail;
  if (flowerStage && !forestBright) {
    previousTrail = document.createElement('canvas');
    previousTrail.width = trailCanvas.width;
    previousTrail.height = trailCanvas.height;
    previousTrail.getContext('2d').drawImage(trailCanvas, 0, 0);
  }
  width = innerWidth; height = innerHeight;
  const columns = width >= height ? 5 : 2;
  const rows = hiddenFairies.length / columns;
  hiddenFairies.forEach((fairy, index) => {
    const left = 6 + 88 * (index % columns + fairy.x) / columns;
    const top = 20 + 59 * (Math.floor(index / columns) + fairy.y) / rows;
    fairy.node.style.left = `${left}%`;
    fairy.node.style.top = `${top}%`;
    fairy.worldX = width * left / 100;
    fairy.worldY = height * top / 100;
  });
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  trailCanvas.width = canvas.width; trailCanvas.height = canvas.height;
  trailContext.setTransform(scale, 0, 0, scale, 0, 0);
  if (previousTrail) trailContext.drawImage(previousTrail, 0, 0, width, height);
  resetFlowerMotion();
  targetX = Math.min(targetX, width); targetY = Math.min(targetY, height);
}
resize();
addEventListener('resize', resize);

chimeButton.addEventListener('click', async () => {
  chimeButton.disabled = true;
  try {
    if (!chimeEnabled) {
      if (!chimeAudio) {
        chimeAudio = new AudioContext();
        chimeVolume = chimeAudio.createGain();
        chimeVolume.gain.value = 0;
        chimeVolume.connect(chimeAudio.destination);
      }
      await chimeAudio.resume();
    }
    chimeEnabled = !chimeEnabled;
    lastChime = -Infinity;
    chimeGain = 0;
    chimeVolume.gain.setTargetAtTime(0, chimeAudio.currentTime, .045);
    chimeButton.setAttribute('aria-pressed', String(chimeEnabled));
    chimeButton.textContent = chimeEnabled ? '효과음 끄기' : '효과음 켜기';
  } catch {
    notice.textContent = '효과음을 시작하지 못했어요. Chrome에서 다시 켜주세요.';
  } finally { chimeButton.disabled = false; }
});

function playChime(now) {
  lastChime = now;
  const notes = [783.99, 987.77, 1174.66, 1318.51, 1567.98, 1975.53];
  const start = chimeStep++ % 4;
  for (let i = 0; i < 3; i++) {
    const at = chimeAudio.currentTime + i * .095;
    for (const [ratio, volume, decay] of [[1, .062, 1.55], [2.76, .012, .74], [5.08, .003, .28]]) {
      const tone = chimeAudio.createOscillator(), envelope = chimeAudio.createGain();
      tone.frequency.value = notes[start + i] * ratio;
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(volume * (1 - i * .16), at + .018);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + decay);
      tone.connect(envelope); envelope.connect(chimeVolume);
      tone.start(at); tone.stop(at + decay + .02);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
    }
  }
}

function updateChime(now) {
  if (!chimeEnabled || chimeAudio.state !== 'running') return;
  const range = Math.max(125, Math.min(230, Math.min(width, height) * .27));
  let distance = range;
  if (active) {
    for (const fairy of hiddenFairies) {
      if (fairy.found) continue;
      distance = Math.min(distance, Math.hypot(targetX - fairy.worldX, targetY - fairy.worldY));
    }
  }
  const closeness = 1 - distance / range;
  const gain = Math.round(.6 * closeness ** 1.45 * 1000) / 1000;
  if (gain !== chimeGain) {
    chimeGain = gain;
    chimeVolume.gain.setTargetAtTime(gain, chimeAudio.currentTime, .09);
  }
  if (closeness > .04 && now - lastChime >= 1650 - 650 * closeness) playChime(now);
}

function plantFlower(x, y, now) {
  flowers.push({ x, y, born: now, size: .8 + Math.random() * .55, tilt: (Math.random() - .5) * .55 });
  if (flowers.length > 100) flowers.splice(0, flowers.length - 100);
}

function showFlowerStage() {
  flowerStage = true;
  endPointer();
  forest.classList.add('flower-stage');
  forest.setAttribute('aria-label', '마우스를 움직이면 방울꽃이 따라오는 숲');
  document.querySelector('#fairy-intro').hidden = true;
  document.querySelector('#flower-intro').hidden = false;
  stopCamera();
  flowerMission.showModal();
}

function resetFlowerMotion() {
  trailPoint = null;
  swingSample = null;
  previousSwing = null;
}

function leaveLight(x, y) {
  const radius = Math.max(68, Math.min(116, Math.min(width, height) * .14));
  const glow = trailContext.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, 'rgba(255, 219, 161, .18)');
  glow.addColorStop(.45, 'rgba(231, 176, 255, .10)');
  glow.addColorStop(1, 'rgba(231, 176, 255, 0)');
  trailContext.fillStyle = glow;
  trailContext.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
}

function shakeFlower(x, y, now, distance) {
  lastShake = now;
  for (let i = 0; i < (reducedMotion ? 8 : 24); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 42 + Math.random() * 150;
    flowerSparks.push({ x, y, born: now, life: 550 + Math.random() * 670,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 2.5, color: ['#fff6d8', '#e8bcff', '#ffcde2'][i % 3] });
  }
  if (flowerSparks.length > 180) flowerSparks.splice(0, flowerSparks.length - 180);
  lightCharge = Math.min(100, lightCharge + Math.max(5, Math.min(12, Math.round(distance * .22))));
  lightProgress.value = lightCharge;
  lightCount.textContent = `${lightCharge}%`;
  if (lightCharge === 100) {
    forestBright = true;
    forest.classList.add('forest-bright');
    forest.setAttribute('aria-label', '방울꽃으로 환하게 밝힌 숲');
    document.querySelector('#flower-instructions').textContent = '방울꽃의 빛으로 숲을 환하게 밝혔어요!';
    setTimeout(() => {
      endPointer();
      flowerMission.querySelector('#flower-mission-title').textContent = '고마워! 숲을 밝혀줬어!';
      flowerMission.querySelector('p').textContent = '방울꽃의 빛으로 어두웠던 숲이 환해졌어요.';
      flowerMission.querySelector('button').textContent = '숲 둘러보기';
      flowerMission.showModal();
    }, reducedMotion ? 0 : 1250);
  }
}

function moveFlower(x, y, now) {
  if (!trailPoint) { leaveLight(x, y); trailPoint = { x, y }; }
  const dx = x - trailPoint.x, dy = y - trailPoint.y;
  const length = Math.hypot(dx, dy);
  const steps = Math.floor(length / 24);
  if (steps > 0) {
    const start = trailPoint;
    for (let i = 1; i <= steps; i++) {
      const fraction = i * 24 / length;
      trailPoint = { x: start.x + dx * fraction, y: start.y + dy * fraction };
      leaveLight(trailPoint.x, trailPoint.y);
    }
  }

  if (!swingSample || now - swingSample.time > 320) {
    swingSample = { x, y, time: now };
    previousSwing = null;
    return;
  }
  const swingX = x - swingSample.x, swingY = y - swingSample.y;
  const distance = Math.hypot(swingX, swingY);
  if (distance < 22) return;
  const speed = distance / Math.max(1, now - swingSample.time);
  const swing = { x: swingX / distance, y: swingY / distance };
  swingSample = { x, y, time: now };
  if (speed < .23) { previousSwing = null; return; }
  if (previousSwing && swing.x * previousSwing.x + swing.y * previousSwing.y < -.48 && now - lastShake >= 70) {
    shakeFlower(x, y, now, distance);
  }
  previousSwing = swing;
}

function drawFlowerSparks(now) {
  flowerSparks = flowerSparks.filter(spark => now - spark.born < spark.life);
  for (const spark of flowerSparks) {
    const seconds = (now - spark.born) / 1000;
    ctx.globalAlpha = (1 - (now - spark.born) / spark.life) ** 1.5;
    ctx.fillStyle = spark.color;
    ctx.shadowColor = spark.color; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(spark.x + spark.vx * seconds, spark.y + spark.vy * seconds + 27 * seconds ** 2, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function selectFairy(x, y) {
  if (lensOpacity < .05) return false;
  const selected = hiddenFairies.find(({ node }) => {
    const { left, top, width, height } = node.getBoundingClientRect();
    return x >= left + width * .13 && x <= left + width * .84 &&
      y >= top + height * .01 && y <= top + height * .91;
  });
  if (!selected) return false;
  if (selected.found) return true;

  selected.found = true;
  selected.node.classList.add('is-found');
  foundCount++;
  fairyCount.textContent = `${foundCount}/${hiddenFairies.length}`;
  fairyProgress.value = foundCount;
  fairyMessage.textContent = '고마워! 요정을 찾았어!';
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { fairyMessage.textContent = ''; }, 2600);
  if (foundCount === hiddenFairies.length) setTimeout(showFlowerStage, 1000);
  return true;
}

function drawFlowers(now) {
  flowers = flowers.filter(flower => now - flower.born < 6200);
  for (const flower of flowers) {
    const age = now - flower.born;
    const growth = reducedMotion ? 1 : .2 + .8 * (1 - (1 - Math.min(1, age / 720)) ** 3);
    ctx.save();
    ctx.translate(flower.x, flower.y);
    ctx.rotate(flower.tilt);
    ctx.scale(flower.size * growth, flower.size * growth);
    ctx.globalAlpha = Math.min(1, age / 160) * Math.min(1, (6200 - age) / 2200);
    ctx.strokeStyle = '#abdbb5'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-3, 11); ctx.quadraticCurveTo(-3, 0, 0, -13); ctx.stroke();
    ctx.fillStyle = '#91c3a5';
    ctx.beginPath(); ctx.moveTo(-3, 7); ctx.quadraticCurveTo(-13, 5, -12, -2); ctx.quadraticCurveTo(-4, 0, -3, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.quadraticCurveTo(0, 1, 7, 1); ctx.quadraticCurveTo(5, 7, -3, 8); ctx.fill();
    ctx.translate(0, -13);
    const petal = ctx.createLinearGradient(0, -10, 0, 10);
    petal.addColorStop(0, '#e5c8ff'); petal.addColorStop(.6, '#a473ed'); petal.addColorStop(1, '#f1d8ff');
    ctx.fillStyle = petal; ctx.strokeStyle = '#f4dfff'; ctx.lineWidth = .7;
    ctx.shadowColor = '#b985ff'; ctx.shadowBlur = 11;
    ctx.beginPath(); ctx.moveTo(0, -10);
    ctx.bezierCurveTo(-7, -10, -7, -1, -10, 5);
    ctx.quadraticCurveTo(-8, 9, -4, 7); ctx.quadraticCurveTo(0, 11, 4, 7); ctx.quadraticCurveTo(8, 9, 10, 5);
    ctx.bezierCurveTo(7, -1, 7, -10, 0, -10); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#f5e7ffb0';
    ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-5, -2, -5, 4); ctx.stroke();
    ctx.fillStyle = '#fff0d7'; ctx.beginPath(); ctx.arc(0, 9, 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function updatePointer(event) {
  targetX = event.clientX; targetY = event.clientY;
  active = true;
  forest.style.setProperty('--pointer-x', `${targetX}px`);
  forest.style.setProperty('--pointer-y', `${targetY}px`);
}
function endPointer() {
  active = false;
  clickStart = null;
  resetFlowerMotion();
}
forest.addEventListener('pointerenter', event => {
  if (!flowerMission.open && !event.target.closest('button')) updatePointer(event);
});
forest.addEventListener('pointerdown', event => {
  if (flowerStage || event.button !== 0 || event.target.closest('button')) return;
  updatePointer(event);
  clickStart = { x: targetX, y: targetY, id: event.pointerId };
});
forest.addEventListener('pointerup', event => {
  if (!clickStart || clickStart.id !== event.pointerId) return;
  const start = clickStart; clickStart = null;
  if (event.button === 0 && !event.target.closest('button') &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 7) {
    updatePointer(event);
    if (!selectFairy(event.clientX, event.clientY)) {
      plantFlower(event.clientX, event.clientY, performance.now());
    }
  }
});
forest.addEventListener('pointermove', event => {
  if (flowerMission.open || event.target.closest('button')) { endPointer(); return; }
  const moved = event.clientX !== targetX || event.clientY !== targetY;
  updatePointer(event);
  if (flowerStage) {
    if (!forestBright && moved) moveFlower(targetX, targetY, performance.now());
    return;
  }
  if (clickStart && Math.hypot(targetX - clickStart.x, targetY - clickStart.y) > 7) clickStart = null;
  if (moved && !hasMoved) { hasMoved = true; setTimeout(() => hint.classList.add('hidden'), 3500); }
});
forest.addEventListener('pointerleave', endPointer);
addEventListener('pointerup', event => {
  clickStart = null;
  if (event.pointerType !== 'mouse') endPointer();
});
addEventListener('pointercancel', endPointer);
addEventListener('blur', endPointer);

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  lensOpacity += ((active ? 1 : 0) - lensOpacity) * (1 - Math.exp(-12 * dt));
  forest.style.setProperty('--lens-opacity', lensOpacity.toFixed(3));
  ctx.clearRect(0, 0, width, height);
  if (flowerStage) {
    drawFlowerSparks(now);
  } else {
    updateChime(now);
    drawFlowers(now);
  }
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
