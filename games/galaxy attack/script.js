import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const overlayHint = document.getElementById('overlayHint');

const WIDTH = 960;
const HEIGHT = 600;
const PLAYER_X = 218;
const PLAYER_SIZE = 11;
const GATE_WIDTH = 43;
const BASE_SPEED = 310;
const WAVE_SPEED = 325;
const GATE_SPACING_MIN = 430;
const GATE_SPACING_MAX = 520;
const WORLD_SCALE = 60;
const stars = Array.from({ length: 180 }, () => ({
  x: Math.random() * 20 - 10,
  y: Math.random() * 12 - 6,
  size: Math.random() * 1.7 + 0.35,
  depth: Math.random() * 0.8 + 0.12,
  phase: Math.random() * Math.PI * 2,
}));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#090b22');
scene.fog = new THREE.FogExp2('#090b22', 0.012);

const camera = new THREE.PerspectiveCamera(23.5, WIDTH / HEIGHT, 0.1, 80);
camera.position.set(0, 0, 24);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#b8c8ff', '#17103d', 2.2));
const keyLight = new THREE.PointLight('#65eaff', 34, 34);
keyLight.position.set(-5, 7, 8);
scene.add(keyLight);
const violetLight = new THREE.PointLight('#8c4dff', 24, 30);
violetLight.position.set(7, -5, 5);
scene.add(violetLight);

const backgroundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 25),
  new THREE.MeshBasicMaterial({ color: '#0b1031' }),
);
backgroundPlane.position.z = -10;
scene.add(backgroundPlane);

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(stars.length * 3), 3));
const starPoints = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: '#c8e9ff', size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.9 }),
);
starPoints.position.z = -6;
scene.add(starPoints);

const grid = new THREE.GridHelper(28, 28, '#353c8b', '#252d70');
grid.rotation.x = Math.PI / 2;
grid.position.set(0, 0, -4.5);
grid.material.transparent = true;
grid.material.opacity = 0.17;
scene.add(grid);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const playerMaterial = new THREE.MeshStandardMaterial({
  color: '#a7ffff', emissive: '#21dff7', emissiveIntensity: 2.2,
  metalness: 0.35, roughness: 0.22,
});
const player = new THREE.Group();
const shipShape = new THREE.Shape();
shipShape.moveTo(0.25, 0);
shipShape.lineTo(-0.16, 0.14);
shipShape.lineTo(-0.08, 0);
shipShape.lineTo(-0.16, -0.14);
shipShape.closePath();
const shipGeometry = new THREE.ExtrudeGeometry(shipShape, {
  depth: 0.13, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.035, bevelThickness: 0.035,
});
const shipMesh = new THREE.Mesh(shipGeometry, playerMaterial);
shipMesh.position.z = 0.08;
player.add(shipMesh);
const engineGlow = new THREE.Mesh(
  new THREE.ConeGeometry(0.075, 0.2, 12),
  new THREE.MeshBasicMaterial({ color: '#56eaff', transparent: true, opacity: 0.8 }),
);
engineGlow.rotation.z = Math.PI / 2;
engineGlow.position.set(-0.19, 0, 0.04);
player.add(engineGlow);
player.position.z = 0.5;
scene.add(player);

const trailMaterial = new THREE.LineBasicMaterial({ color: '#67edff', transparent: true, opacity: 0.75 });
let trailLine = new THREE.Line(new THREE.BufferGeometry(), trailMaterial);
trailLine.position.z = 0.2;
scene.add(trailLine);

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(0), 3));
const particlePoints = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({ color: '#fff1b1', size: 0.09, transparent: true, opacity: 0.9, sizeAttenuation: true }),
);
particlePoints.position.z = 0.9;
scene.add(particlePoints);

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

function worldX(pixelX) {
  return (pixelX - WIDTH / 2) / WORLD_SCALE;
}

function worldY(pixelY) {
  return (HEIGHT / 2 - pixelY) / WORLD_SCALE;
}

function setOverlay() {
  overlay.hidden = running;
  if (running) return;
  overlayTitle.textContent = gameOver ? 'SIGNAL LOST' : 'READY, PILOT?';
  overlaySubtitle.textContent = gameOver
    ? `DISTANCE ${formatScore(score)}  ·  BEST ${formatScore(best)}`
    : 'Hold SPACE to rise · Release to fall';
  overlayHint.textContent = gameOver ? 'PRESS SPACE TO TRY AGAIN' : 'DODGE THE GATES  ·  COLLECT THE STARS';
}

function disposeGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
  worldGroup.remove(group);
}

function makeGate(x, center) {
  const gapHeight = randomBetween(194, 224);
  const gate = {
    x,
    gapTop: center - gapHeight * 0.5,
    gapBottom: center + gapHeight * 0.5,
    passed: false,
    group: new THREE.Group(),
  };
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#7045dc', emissive: '#5b28c8', emissiveIntensity: 1.3, metalness: 0.48, roughness: 0.27,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: '#e3c3ff', emissive: '#b778ff', emissiveIntensity: 2.3, metalness: 0.25, roughness: 0.2,
  });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: '#caa2ff', transparent: true, opacity: 0.56 });
  const gateWidth = GATE_WIDTH / WORLD_SCALE;

  function addSegment(top, bottom) {
    const height = Math.max(0, bottom - top);
    if (!height) return;
    const segment = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, height / WORLD_SCALE, 0.62), bodyMaterial);
    segment.position.set(0, worldY((top + bottom) * 0.5), 0);
    gate.group.add(segment);

    const inset = new THREE.Mesh(new THREE.BoxGeometry(gateWidth * 0.56, 0.025, 0.04), stripeMaterial);
    inset.position.set(0, worldY((top + bottom) * 0.5), 0.34);
    gate.group.add(inset);
  }

  addSegment(0, gate.gapTop);
  addSegment(gate.gapBottom, HEIGHT);
  for (const edgeY of [gate.gapTop, gate.gapBottom]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(gateWidth + 0.09, 0.075, 0.82), edgeMaterial);
    rail.position.set(0, worldY(edgeY), 0.08);
    gate.group.add(rail);
  }
  gate.group.position.set(worldX(x), 0, 0);
  worldGroup.add(gate.group);
  return gate;
}

function makeOrb(x, y) {
  const group = new THREE.Group();
  const jewelMaterial = new THREE.MeshStandardMaterial({
    color: '#fff0a0', emissive: '#ffc83d', emissiveIntensity: 2.7, metalness: 0.35, roughness: 0.18,
  });
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), jewelMaterial);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.018, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#fff0a0' }),
  );
  group.add(jewel, ring);
  group.position.set(worldX(x), worldY(y), 0.38);
  worldGroup.add(group);
  return { x, y, radius: 9, collected: false, phase: Math.random() * 6, group };
}

function clearWorld() {
  for (const gate of gates) disposeGroup(gate.group);
  for (const orb of orbs) disposeGroup(orb.group);
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
  clearWorld();
  gates = [];
  orbs = [];
  trailLine.geometry.dispose();
  trailLine.geometry = new THREE.BufferGeometry();

  let gateX = 650;
  let gapCenter = HEIGHT * 0.5;
  for (let i = 0; i < 7; i++) {
    gapCenter = nextGapCenter(gapCenter);
    gates.push(makeGate(gateX, gapCenter));
    if (i % 2 === 0) orbs.push(makeOrb(gateX - randomBetween(105, 145), gapCenter));
    gateX += randomBetween(GATE_SPACING_MIN, GATE_SPACING_MAX);
  }

  scoreEl.textContent = formatScore(score);
  startButton.innerHTML = '<span aria-hidden="true">▶</span> LAUNCH RUN';
  setOverlay();
  draw();
}

function nextGapCenter(previous) {
  return clamp(previous + randomBetween(-135, 135), 128, HEIGHT - 128);
}

function startGame() {
  if (running) return;
  if (gameOver) resetGame();
  running = true;
  gameOver = false;
  startButton.innerHTML = '<span aria-hidden="true">◆</span> RUN IN PROGRESS';
  setOverlay();
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
  setOverlay();
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
    if (Math.random() < 0.8) orbs.push(makeOrb(lastX - randomBetween(115, 175), center));
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
    gate.group.position.x = worldX(screenX);
  }

  for (const orb of orbs) {
    if (orb.collected) continue;
    const screenX = orb.x - distance + PLAYER_X;
    orb.phase += dt * 3;
    orb.group.position.x = worldX(screenX);
    orb.group.position.y = worldY(orb.y) + Math.sin(orb.phase) * 0.035;
    orb.group.rotation.y += dt * 1.3;
    orb.group.rotation.z += dt * 0.8;
    const pulse = 1 + Math.sin(orb.phase) * 0.12;
    orb.group.scale.setScalar(pulse);
    if (Math.hypot(screenX - PLAYER_X, orb.y - playerY) < orb.radius + PLAYER_SIZE + 3) {
      orb.collected = true;
      score += 50;
      scoreEl.textContent = formatScore(score);
      addParticles(PLAYER_X, playerY, '#ffe576', 15);
      disposeGroup(orb.group);
    }
  }

  gates = gates.filter((gate) => {
    if (gate.x - distance + PLAYER_X > -GATE_WIDTH - 10) return true;
    disposeGroup(gate.group);
    return false;
  });
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

function updateScene() {
  const starPositions = starGeometry.attributes.position.array;
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const x = ((star.x - distance * star.depth * 0.00075 + 10) % 20 + 20) % 20 - 10;
    const twinkle = 0.82 + Math.sin(elapsed * 1.7 + star.phase) * 0.18;
    starPositions[i * 3] = x * twinkle;
    starPositions[i * 3 + 1] = star.y;
    starPositions[i * 3 + 2] = (star.depth - 0.5) * 1.2;
  }
  starGeometry.attributes.position.needsUpdate = true;

  player.position.set(worldX(PLAYER_X), worldY(playerY), 0.5);
  player.rotation.z = direction * -0.16;
  engineGlow.scale.y = 0.78 + Math.sin(elapsed * 24) * 0.18;

  const points = [];
  for (let i = trail.length - 1; i >= 0; i--) {
    const point = trail[i];
    const x = PLAYER_X - point.age * (BASE_SPEED + Math.min(105, elapsed * 4.4));
    if (x >= -20) points.push(new THREE.Vector3(worldX(x), worldY(point.y), 0));
  }
  points.push(new THREE.Vector3(worldX(PLAYER_X), worldY(playerY), 0));
  trailLine.geometry.dispose();
  trailLine.geometry = new THREE.BufferGeometry().setFromPoints(points);

  const particlePositions = new Float32Array(particles.length * 3);
  for (let i = 0; i < particles.length; i++) {
    particlePositions[i * 3] = worldX(particles[i].x);
    particlePositions[i * 3 + 1] = worldY(particles[i].y);
    particlePositions[i * 3 + 2] = 0;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.attributes.position.needsUpdate = true;
  particlePoints.material.opacity = particles.length ? 0.9 : 0;

  if (shake > 0) {
    camera.position.x = randomBetween(-shake, shake) / WORLD_SCALE;
    camera.position.y = randomBetween(-shake, shake) / WORLD_SCALE;
  } else {
    camera.position.x = 0;
    camera.position.y = 0;
  }
  camera.lookAt(0, 0, 0);
  scene.background.set(flash > 0 ? '#260b2c' : '#090b22');
}

function draw() {
  updateScene();
  renderer.render(scene, camera);
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
  canvas.setPointerCapture(event.pointerId);
  holdSpace();
});
window.addEventListener('pointerup', releaseSpace);
window.addEventListener('pointercancel', releaseSpace);
startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetGame);

resetGame();