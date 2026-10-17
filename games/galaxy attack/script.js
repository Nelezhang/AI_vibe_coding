const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_X = 218;
const PLAYER_SIZE = 11;
const GATE_WIDTH = 43;
const BASE_SPEED = 310;
const WAVE_SPEED = 325;
const GATE_SPACING_MIN = 430;
const GATE_SPACING_MAX = 520;
const stars = Array.from({ length: 115 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  size: Math.random() * 1.7 + 0.35,
  depth: Math.random() * 0.8 + 0.12,
  phase: Math.random() * Math.PI * 2,
}));

let best = loadBest();
let running = false;
let gameOver = false;
let lastFrame = 0;
let elapsed = 0;
let distance = 0;
let score = 0;
let direction = 1;
let spaceHeld = false;
let playerY = HEIGHT * 0.5;
let gates = [];
let orbs = [];
let trail = [];
let particles = [];
let shake = 0;
let flash = 0;

bestEl.textContent = formatScore(best);

function loadBest() {
  try {
    return Number(localStorage.getItem('galaxyAttackWaveBest')) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem('galaxyAttackWaveBest', String(best));
  } catch {
    // The game remains playable if storage is unavailable.
  }
}

function formatScore(value) {
  return String(value).padStart(5, '0');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function resetGame() {
  running = false;
  gameOver = false;
  elapsed = 0;
  distance = 0;
  score = 0;
  direction = 1;
  spaceHeld = false;
  playerY = HEIGHT * 0.5;
  shake = 0;
  flash = 0;
  trail = [];
  particles = [];
  gates = [];
  orbs = [];

  let gateX = 650;
  let gapCenter = HEIGHT * 0.5;
  for (let i = 0; i < 7; i++) {
    gapCenter = nextGapCenter(gapCenter);
    gates.push(makeGate(gateX, gapCenter));
    if (i % 2 === 0) {
      orbs.push({ x: gateX - randomBetween(105, 145), y: gapCenter, radius: 9, collected: false, phase: Math.random() * 6 });
    }
    gateX += randomBetween(GATE_SPACING_MIN, GATE_SPACING_MAX);
  }

  scoreEl.textContent = formatScore(score);
  startButton.innerHTML = '<span aria-hidden="true">▶</span> LAUNCH RUN';
  draw();
}

function nextGapCenter(previous) {
  return clamp(previous + randomBetween(-135, 135), 128, HEIGHT - 128);
}

function makeGate(x, center) {
  const gapHeight = randomBetween(194, 224);
  return {
    x,
    gapTop: center - gapHeight * 0.5,
    gapBottom: center + gapHeight * 0.5,
    passed: false,
  };
}

function startGame() {
  if (running) return;
  if (gameOver) resetGame();
  running = true;
  gameOver = false;
  startButton.innerHTML = '<span aria-hidden="true">◆</span> RUN IN PROGRESS';
  lastFrame = performance.now();
  requestAnimationFrame(gameLoop);
}

function holdSpace() {
  if (spaceHeld) return;
  if (!running) {
    if (gameOver) resetGame();
    startGame();
  }
  spaceHeld = true;
  direction = -1;
  addParticles(PLAYER_X, playerY, '#66f7ff', 6);
}

function releaseSpace() {
  if (!spaceHeld) return;
  spaceHeld = false;
  direction = 1;
  if (running) addParticles(PLAYER_X, playerY, '#a77bff', 4);
}

function endGame() {
  if (!running) return;
  running = false;
  gameOver = true;
  shake = 12;
  flash = 0.42;
  addParticles(PLAYER_X, playerY, '#ff559d', 28);
  if (score > best) {
    best = score;
    bestEl.textContent = formatScore(best);
    saveBest();
  }
  startButton.innerHTML = '<span aria-hidden="true">↻</span> TRY AGAIN';
}

function spawnAhead() {
  let lastX = gates.length ? gates[gates.length - 1].x : distance + WIDTH;
  let center = gates.length
    ? (gates[gates.length - 1].gapTop + gates[gates.length - 1].gapBottom) * 0.5
    : HEIGHT * 0.5;

  while (lastX < distance + WIDTH * 2.2) {
    lastX += randomBetween(GATE_SPACING_MIN, GATE_SPACING_MAX);
    center = nextGapCenter(center);
    gates.push(makeGate(lastX, center));
    if (Math.random() < 0.8) {
      orbs.push({ x: lastX - randomBetween(115, 175), y: center, radius: 9, collected: false, phase: Math.random() * 6 });
    }
  }
}

function update(dt) {
  elapsed += dt;
  const speed = BASE_SPEED + Math.min(105, elapsed * 4.4);
  distance += speed * dt;
  playerY += direction * WAVE_SPEED * dt;
  playerY = clamp(playerY, PLAYER_SIZE + 2, HEIGHT - PLAYER_SIZE - 2);
  if (playerY <= PLAYER_SIZE + 3 || playerY >= HEIGHT - PLAYER_SIZE - 3) {
    endGame();
    return;
  }

  const scoreNow = Math.floor(distance / 10);
  if (scoreNow > score) {
    score = scoreNow;
    scoreEl.textContent = formatScore(score);
  }

  for (const point of trail) point.age += dt;
  trail.push({ y: playerY, age: 0 });
  while (trail.length && trail[0].age * speed > WIDTH + 40) trail.shift();

  spawnAhead();
  const playerWorldX = distance + PLAYER_X;
  for (const gate of gates) {
    const screenX = gate.x - distance + PLAYER_X;
    if (PLAYER_X + PLAYER_SIZE * 0.75 > screenX && PLAYER_X - PLAYER_SIZE * 0.75 < screenX + GATE_WIDTH) {
      if (playerY - PLAYER_SIZE * 0.72 < gate.gapTop || playerY + PLAYER_SIZE * 0.72 > gate.gapBottom) {
        endGame();
        return;
      }
    }
    if (!gate.passed && gate.x + GATE_WIDTH < playerWorldX) {
      gate.passed = true;
      addParticles(PLAYER_X, playerY, '#8c77ff', 4);
    }
  }

  for (const orb of orbs) {
    if (orb.collected) continue;
    const screenX = orb.x - distance + PLAYER_X;
    orb.phase += dt * 3;
    if (Math.hypot(screenX - PLAYER_X, orb.y - playerY) < orb.radius + PLAYER_SIZE + 3) {
      orb.collected = true;
      score += 50;
      scoreEl.textContent = formatScore(score);
      addParticles(PLAYER_X, playerY, '#ffe576', 15);
    }
  }

  gates = gates.filter((gate) => gate.x - distance + PLAYER_X > -GATE_WIDTH - 10);
  orbs = orbs.filter((orb) => !orb.collected && orb.x - distance + PLAYER_X > -30);
  updateParticles(dt);
  shake = Math.max(0, shake - dt * 35);
  flash = Math.max(0, flash - dt);
}

function addParticles(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(45, 210);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.28, 0.72),
      maxLife: 0.72,
      size: randomBetween(1.5, 4),
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#0c1030');
  gradient.addColorStop(0.55, '#11123b');
  gradient.addColorStop(1, '#090b24');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const nebula = ctx.createRadialGradient(WIDTH * 0.72, HEIGHT * 0.48, 10, WIDTH * 0.72, HEIGHT * 0.48, 420);
  nebula.addColorStop(0, 'rgba(87, 65, 199, 0.18)');
  nebula.addColorStop(1, 'rgba(87, 65, 199, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const star of stars) {
    const x = ((star.x - distance * star.depth * 0.23) % WIDTH + WIDTH) % WIDTH;
    const twinkle = 0.48 + Math.sin(elapsed * 1.7 + star.phase) * 0.3;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = star.depth > 0.65 ? '#9ceeff' : '#e1e5ff';
    ctx.fillRect(x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(106, 133, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(WIDTH, 34);
  ctx.moveTo(0, HEIGHT - 34);
  ctx.lineTo(WIDTH, HEIGHT - 34);
  ctx.stroke();
}

function drawGate(gate) {
  const x = gate.x - distance + PLAYER_X;
  if (x < -GATE_WIDTH - 10 || x > WIDTH + 10) return;

  ctx.save();
  ctx.shadowColor = '#7f5aff';
  ctx.shadowBlur = 19;
  const topGradient = ctx.createLinearGradient(x, 0, x + GATE_WIDTH, 0);
  topGradient.addColorStop(0, '#5c38c9');
  topGradient.addColorStop(0.5, '#b17aff');
  topGradient.addColorStop(1, '#4e3de0');
  ctx.fillStyle = topGradient;
  ctx.fillRect(x, 0, GATE_WIDTH, gate.gapTop);
  ctx.fillRect(x, gate.gapBottom, GATE_WIDTH, HEIGHT - gate.gapBottom);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d9aaff';
  ctx.fillRect(x, gate.gapTop - 3, GATE_WIDTH, 4);
  ctx.fillRect(x, gate.gapBottom, GATE_WIDTH, 4);
  ctx.fillStyle = 'rgba(255,255,255,.19)';
  for (let y = 18; y < gate.gapTop - 14; y += 25) ctx.fillRect(x + 8, y, GATE_WIDTH - 16, 2);
  for (let y = gate.gapBottom + 18; y < HEIGHT - 14; y += 25) ctx.fillRect(x + 8, y, GATE_WIDTH - 16, 2);
  ctx.restore();
}

function drawOrb(orb) {
  if (orb.collected) return;
  const x = orb.x - distance + PLAYER_X;
  if (x < -30 || x > WIDTH + 30) return;
  const pulse = 1 + Math.sin(orb.phase) * 0.12;
  ctx.save();
  ctx.translate(x, orb.y);
  ctx.rotate(orb.phase * 0.3);
  ctx.shadowColor = '#ffe576';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#fff0a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -orb.radius * pulse);
  ctx.lineTo(orb.radius * pulse, 0);
  ctx.lineTo(0, orb.radius * pulse);
  ctx.lineTo(-orb.radius * pulse, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#fff5be';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}

function drawTrail() {
  if (!trail.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = trail.length - 1; i >= 0; i--) {
    const point = trail[i];
    const x = PLAYER_X - point.age * (BASE_SPEED + Math.min(105, elapsed * 4.4));
    if (x < -20) continue;
    if (!started) {
      ctx.moveTo(x, point.y);
      started = true;
    } else {
      ctx.lineTo(x, point.y);
    }
  }
  ctx.lineTo(PLAYER_X, playerY);
  ctx.strokeStyle = 'rgba(65, 230, 255, .28)';
  ctx.lineWidth = 15;
  ctx.shadowColor = '#24ddff';
  ctx.shadowBlur = 25;
  ctx.stroke();
  ctx.strokeStyle = '#72f8ff';
  ctx.lineWidth = 4;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(PLAYER_X, playerY);
  ctx.rotate(direction * -0.42);
  ctx.shadowColor = '#54f3ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#8fffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 9;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawOverlay() {
  if (running) return;
  ctx.fillStyle = 'rgba(5, 7, 24, .42)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#60f3ff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f4fbff';
  ctx.font = '800 42px Orbitron, Arial, sans-serif';
  ctx.fillText(gameOver ? 'SIGNAL LOST' : 'READY, PILOT?', WIDTH / 2, HEIGHT / 2 - 28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aab6e9';
  ctx.font = '600 17px Rajdhani, Arial, sans-serif';
  ctx.fillText(gameOver ? `DISTANCE ${formatScore(score)}  ·  BEST ${formatScore(best)}` : 'Hold SPACE to rise · Release to fall', WIDTH / 2, HEIGHT / 2 + 9);
  ctx.fillStyle = '#67edff';
  ctx.font = '700 12px Orbitron, Arial, sans-serif';
  ctx.fillText(gameOver ? 'PRESS SPACE TO TRY AGAIN' : 'DODGE THE GATES  ·  COLLECT THE STARS', WIDTH / 2, HEIGHT / 2 + 42);
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(randomBetween(-shake, shake), randomBetween(-shake, shake));
  drawBackground();
  for (const gate of gates) drawGate(gate);
  for (const orb of orbs) drawOrb(orb);
  drawTrail();
  drawParticles();
  drawPlayer();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 75, 143, ${flash * 0.28})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  drawOverlay();
  ctx.restore();
}

function gameLoop(timestamp) {
  if (!running) return;
  const dt = Math.min((timestamp - lastFrame) / 1000 || 0.016, 0.035);
  lastFrame = timestamp;
  update(dt);
  draw();
  if (running) requestAnimationFrame(gameLoop);
}

function flipFromInput(event) {
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    if (!event.repeat) holdSpace();
  }
}

window.addEventListener('keydown', flipFromInput);
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    releaseSpace();
  }
});
window.addEventListener('blur', releaseSpace);
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  holdSpace();
});
window.addEventListener('pointerup', releaseSpace);
window.addEventListener('pointercancel', releaseSpace);
startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetGame);

resetGame();
