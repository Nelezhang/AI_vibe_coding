const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const blockCountEl = document.getElementById('blockCount');
const healthValueEl = document.getElementById('healthValue');
const mineButton = document.getElementById('mineButton');
const placeButton = document.getElementById('placeButton');
const resetButton = document.getElementById('resetButton');

const WORLD_SIZE = 20;
const WORLD_HEIGHT = 8;
const FOV = Math.PI / 3;
const MAX_DEPTH = 20;
const STEP = 0.05;
const keys = {};

const player = {
  x: 9.5,
  y: 3.2,
  z: 9.5,
  yaw: 0.75,
  pitch: 0.0,
  health: 5,
  speed: 0.12,
  vy: 0,
  onGround: true,
};

const blocks = {};
const monsters = [
  { x: 6.5, y: 1.5, z: 12.5, health: 2 },
  { x: 12.8, y: 1.5, z: 7.5, health: 2 },
  { x: 9.3, y: 1.5, z: 15.2, health: 2 },
];

function keyName(x, y, z) {
  return `${x},${y},${z}`;
}

function inBounds(x, y, z) {
  return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE && y >= 0 && y < WORLD_HEIGHT;
}

function setBlock(x, y, z, type) {
  if (!inBounds(x, y, z)) return;
  blocks[keyName(x, y, z)] = type;
}

function getBlock(x, y, z) {
  if (!inBounds(x, y, z)) return 'solid';
  return blocks[keyName(x, y, z)] || null;
}

function removeBlock(x, y, z) {
  if (!inBounds(x, y, z)) return;
  delete blocks[keyName(x, y, z)];
}

function noise(x, z) {
  return Math.floor((Math.sin((x + 2.5) * 0.9) + Math.cos((z + 1.3) * 0.8) + Math.sin((x * z) * 0.18)) * 1.5 + 2.5);
}

function generateWorld() {
  Object.keys(blocks).forEach((key) => delete blocks[key]);

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const height = Math.max(1, noise(x, z));
      for (let y = 0; y <= height; y++) {
        if (y === height) {
          setBlock(x, y, z, 'grass');
        } else if (y >= height - 2) {
          setBlock(x, y, z, 'dirt');
        } else {
          setBlock(x, y, z, 'stone');
        }
      }
    }
  }

  for (let t = 0; t < 20; t++) {
    const x = 2 + Math.floor(Math.random() * (WORLD_SIZE - 4));
    const z = 2 + Math.floor(Math.random() * (WORLD_SIZE - 4));
    const baseY = Math.max(1, noise(x, z));
    const trunk = 2 + Math.floor(Math.random() * 2);
    for (let y = baseY + 1; y <= baseY + trunk; y++) {
      setBlock(x, y, z, 'wood');
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const dist = Math.abs(dx) + Math.abs(dz);
        if (dist <= 3) {
          setBlock(x + dx, baseY + trunk + 1, z + dz, 'leaf');
        }
      }
    }
  }

  monsters.length = 0;
  monsters.push(
    { x: 6.5, y: 1.5, z: 12.5, health: 2 },
    { x: 12.8, y: 1.5, z: 7.5, health: 2 },
    { x: 9.3, y: 1.5, z: 15.2, health: 2 }
  );

  setBlockCount();
}

function setBlockCount() {
  const count = Object.keys(blocks).length;
  blockCountEl.textContent = String(count);
  healthValueEl.textContent = String(player.health);
}

function shadeColor(base, intensity) {
  const r = Math.min(255, Math.round(base.r * intensity));
  const g = Math.min(255, Math.round(base.g * intensity));
  const b = Math.min(255, Math.round(base.b * intensity));
  return `rgb(${r}, ${g}, ${b})`;
}

function blockColor(type) {
  switch (type) {
    case 'grass': return { r: 103, g: 171, b: 74 };
    case 'dirt': return { r: 128, g: 92, b: 58 };
    case 'stone': return { r: 150, g: 158, b: 160 };
    case 'wood': return { r: 168, g: 117, b: 62 };
    case 'leaf': return { r: 68, g: 169, b: 93 };
    default: return { r: 255, g: 255, b: 255 };
  }
}

function castRay(rayYaw, rayPitch) {
  const originX = player.x;
  const originY = player.y;
  const originZ = player.z;

  for (let dist = 0; dist <= MAX_DEPTH; dist += STEP) {
    const x = originX + Math.cos(rayYaw) * Math.cos(rayPitch) * dist;
    const y = originY + Math.sin(rayPitch) * dist;
    const z = originZ + Math.sin(rayYaw) * Math.cos(rayPitch) * dist;

    const blockX = Math.floor(x);
    const blockY = Math.floor(y);
    const blockZ = Math.floor(z);

    if (getBlock(blockX, blockY, blockZ)) {
      return {
        dist,
        x: blockX,
        y: blockY,
        z: blockZ,
      };
    }
  }

  return null;
}

function getForwardVector() {
  return {
    x: Math.cos(player.yaw) * Math.cos(player.pitch),
    y: Math.sin(player.pitch),
    z: Math.sin(player.yaw) * Math.cos(player.pitch),
  };
}

function movePlayer() {
  let moveX = 0;
  let moveZ = 0;

  const forward = getForwardVector();
  const strafeX = Math.cos(player.yaw + Math.PI / 2);
  const strafeZ = Math.sin(player.yaw + Math.PI / 2);

  if (keys['w'] || keys['arrowup']) {
    moveX += forward.x;
    moveZ += forward.z;
  }
  if (keys['s'] || keys['arrowdown']) {
    moveX -= forward.x;
    moveZ -= forward.z;
  }
  if (keys['a']) {
    moveX += strafeX;
    moveZ += strafeZ;
  }
  if (keys['d']) {
    moveX -= strafeX;
    moveZ -= strafeZ;
  }

  const length = Math.hypot(moveX, moveZ) || 1;
  const stepX = (moveX / length) * player.speed;
  const stepZ = (moveZ / length) * player.speed;

  const nextX = player.x + stepX;
  const nextZ = player.z + stepZ;

  const xFloor = Math.floor(nextX);
  const zFloor = Math.floor(nextZ);
  const footY = Math.floor(player.y);

  if (!getBlock(xFloor, footY, zFloor)) {
    player.x = nextX;
    player.z = nextZ;
  }

  if (keys['arrowleft']) player.yaw -= 0.05;
  if (keys['arrowright']) player.yaw += 0.05;

  player.vy -= 0.02;
  player.y += player.vy;

  const groundY = Math.floor(player.y);
  const bodyY = Math.floor(player.y - 0.2);
  if (getBlock(Math.floor(player.x), groundY, Math.floor(player.z)) || getBlock(Math.floor(player.x), bodyY, Math.floor(player.z))) {
    player.y = Math.floor(player.y) + 1.7;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
}

function jump() {
  if (player.onGround) {
    player.vy = 0.24;
    player.onGround = false;
  }
}

function mineBlock() {
  const hit = castRay(player.yaw, player.pitch);
  if (hit && hit.dist <= 4) {
    const blockAbove = getBlock(hit.x, hit.y, hit.z);
    if (blockAbove) {
      removeBlock(hit.x, hit.y, hit.z);
      setBlockCount();
      return;
    }
  }

  for (const monster of monsters) {
    const dx = monster.x - player.x;
    const dz = monster.z - player.z;
    const dist = Math.hypot(dx, dz);
    const angleToMonster = Math.atan2(dz, dx) - player.yaw;

    if (dist < 1.5 && Math.abs(angleToMonster) < 0.45) {
      monster.health -= 1;
      if (monster.health <= 0) {
        monster.x = -100;
        monster.z = -100;
      }
      return;
    }
  }
}

function placeBlock() {
  const hit = castRay(player.yaw, player.pitch);
  if (!hit || hit.dist > 4) return;

  const forward = getForwardVector();
  const placeX = Math.floor(player.x + forward.x * 1.8);
  const placeY = Math.floor(player.y + forward.y * 1.8 + 0.7);
  const placeZ = Math.floor(player.z + forward.z * 1.8);

  if (!getBlock(placeX, placeY, placeZ) && !((placeX === Math.floor(player.x)) && (placeY === Math.floor(player.y)) && (placeZ === Math.floor(player.z)))) {
    setBlock(placeX, placeY, placeZ, 'grass');
    setBlockCount();
  }
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#8fd3ff');
  gradient.addColorStop(0.55, '#edf9ff');
  gradient.addColorStop(1, '#b7d77f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 30; i++) {
    const x = ((i * 157) % canvas.width) + 12;
    const y = ((i * 89) % (canvas.height * 0.4)) + 18;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawGround() {
  const groundY = canvas.height * 0.52;
  const floorGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  floorGradient.addColorStop(0, '#86c762');
  floorGradient.addColorStop(1, '#4b7b2c');
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = groundY; y < canvas.height; y += 16) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function drawScene() {
  for (let column = 0; column < canvas.width; column += 2) {
    const rayYaw = player.yaw - FOV / 2 + (column / canvas.width) * FOV;
    const rayPitch = player.pitch;
    const hit = castRay(rayYaw, rayPitch);

    if (!hit) {
      ctx.fillStyle = '#8ec7ff';
      ctx.fillRect(column, 0, 2, canvas.height);
      continue;
    }

    const correctedDist = hit.dist * Math.cos(rayYaw - player.yaw);
    const wallHeight = Math.min(canvas.height * 0.9, (canvas.height * 0.85) / Math.max(0.14, correctedDist));
    const top = canvas.height / 2 - wallHeight / 2 + (Math.sin(player.pitch) * 26);

    const base = blockColor(getBlock(hit.x, hit.y, hit.z));
    const shadow = Math.max(0.45, 1.15 - correctedDist / MAX_DEPTH);
    ctx.fillStyle = shadeColor(base, shadow);
    ctx.fillRect(column, top, 2, wallHeight);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(column, top, 2, wallHeight);
  }
}

function drawCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();
}

function drawMonsters() {
  for (const monster of monsters) {
    if (monster.health <= 0) continue;

    const dx = monster.x - player.x;
    const dz = monster.z - player.z;
    const dist = Math.hypot(dx, dz);
    const angleToMonster = Math.atan2(dz, dx) - player.yaw;

    if (Math.abs(angleToMonster) > FOV / 2 + 0.2 || dist > MAX_DEPTH) continue;

    const screenX = canvas.width / 2 + Math.tan(angleToMonster) * (canvas.width * 0.52);
    const size = Math.max(16, (canvas.height * 0.28) / Math.max(0.2, dist));
    const screenY = canvas.height / 2 + 6;

    ctx.fillStyle = '#d52d2d';
    ctx.fillRect(screenX - size * 0.28, screenY - size * 0.5, size * 0.56, size * 0.7);
    ctx.fillStyle = '#111827';
    ctx.fillRect(screenX - size * 0.12, screenY - size * 0.18, 4, 4);
    ctx.fillRect(screenX + size * 0.08, screenY - size * 0.18, 4, 4);
  }
}

function updateMonsters() {
  for (const monster of monsters) {
    if (monster.health <= 0) continue;

    const dx = player.x - monster.x;
    const dz = player.z - monster.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.8) {
      player.health = Math.max(0, player.health - 0.08);
      setBlockCount();
    } else if (dist < 7) {
      const step = 0.012;
      monster.x += (dx / dist) * step;
      monster.z += (dz / dist) * step;
    }
  }
}

function draw() {
  drawSky();
  drawGround();
  drawScene();
  drawMonsters();
  drawCrosshair();
}

function gameLoop() {
  movePlayer();
  updateMonsters();
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    event.preventDefault();
  }
  keys[key] = true;

  if (event.code === 'Space') {
    jump();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.003;
  player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - event.movementY * 0.002));
});

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
  mineBlock();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  placeBlock();
});

mineButton.addEventListener('click', mineBlock);
placeButton.addEventListener('click', placeBlock);
resetButton.addEventListener('click', () => {
  player.x = 9.5;
  player.y = 3.2;
  player.z = 9.5;
  player.yaw = 0.75;
  player.pitch = 0;
  player.vy = 0;
  player.onGround = true;
  generateWorld();
});

generateWorld();
requestAnimationFrame(gameLoop);
