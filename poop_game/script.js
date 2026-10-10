const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const timeEl = document.getElementById('time');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');

const keys = {};
const world = { width: canvas.width, height: canvas.height };
const pointer = { x: canvas.width / 2, y: canvas.height / 2, active: false };
let score = 0;
let health = 5;
let gameRunning = false;
let lastTime = 0;
let shake = 0;
let dashScoreDrain = 0;

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 20,
  speed: 220,
  angle: 0,
  bodyLength: 7,
  path: [],
  segments: [],
  facingX: 1,
  facingY: 0,
  trail: [],
  invuln: 0,
};

const poopDrops = [];
const bots = [];
const particles = [];
const eatRatio = 1.12;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getCameraZoom() {
  return 1 / (1 + Math.max(0, player.radius - 20) / 320);
}

function createFoodNear(x, y) {
  const viewRadius = Math.max(world.width, world.height) * 0.7 / getCameraZoom();
  const distance = randomBetween(100, Math.max(180, viewRadius));
  const angle = randomBetween(0, Math.PI * 2);
  return {
    x: x + Math.cos(angle) * distance,
    y: y + Math.sin(angle) * distance,
    radius: 11,
    glow: Math.random() * Math.PI * 2,
  };
}

function addParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: randomBetween(-80, 80),
      vy: randomBetween(-80, 80),
      life: randomBetween(0.3, 0.8),
      color,
      radius: randomBetween(2, 5),
    });
  }
}

function seedSnakePath(snake) {
  const length = Math.ceil(snake.bodyLength * 12) + 20;
  snake.path = [];
  for (let i = length; i >= 0; i--) {
    snake.path.push({
      x: snake.x - Math.cos(snake.angle) * i,
      y: snake.y - Math.sin(snake.angle) * i,
    });
  }
  updateSnakeSegments(snake);
}

function updateSnakeSegments(snake) {
  const spacing = 12;
  const maxDistance = snake.bodyLength * spacing;
  const path = snake.path;
  const segments = [];
  let walked = 0;
  let targetDistance = spacing;

  for (let i = path.length - 1; i > 0 && targetDistance <= maxDistance; i--) {
    const newer = path[i];
    const older = path[i - 1];
    const dx = older.x - newer.x;
    const dy = older.y - newer.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    while (targetDistance <= walked + length && targetDistance <= maxDistance) {
      const t = (targetDistance - walked) / length;
      segments.push({ x: newer.x + dx * t, y: newer.y + dy * t });
      targetDistance += spacing;
    }
    walked += length;
    if (walked > maxDistance + 160) {
      path.splice(0, i - 1);
      break;
    }
  }

  snake.segments = segments;
}

function resetGame() {
  score = 0;
  health = 5;
  player.radius = 20;
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.facingX = 1;
  player.facingY = 0;
  player.invuln = 0;
  player.trail = [];
  player.angle = 0;
  player.bodyLength = 7;
  pointer.active = false;
  seedSnakePath(player);
  dashScoreDrain = 0;

  poopDrops.length = 0;
  bots.length = 0;
  particles.length = 0;

  for (let i = 0; i < 9; i++) poopDrops.push(createFoodNear(player.x, player.y));

  for (let i = 0; i < 5; i++) bots.push(createBot(i));

  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score);
  healthEl.textContent = String(health);
  timeEl.textContent = '∞';
}

function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  resetGame();
  requestAnimationFrame(gameLoop);
}

function stopGame() {
  gameRunning = false;
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  const inputLength = Math.hypot(dx, dy);
  if (inputLength > 0) {
    player.angle = Math.atan2(dy, dx);
  } else if (pointer.active) {
    const screenDx = pointer.x - world.width / 2;
    const screenDy = pointer.y - world.height / 2;
    if (Math.hypot(screenDx, screenDy) > 12) {
      const desiredAngle = Math.atan2(screenDy, screenDx);
      const difference = Math.atan2(Math.sin(desiredAngle - player.angle), Math.cos(desiredAngle - player.angle));
      player.angle += Math.max(-4 * dt, Math.min(4 * dt, difference));
    }
  }
  player.facingX = Math.cos(player.angle);
  player.facingY = Math.sin(player.angle);

  if (keys[' '] && score > 0) {
    dashScoreDrain += dt * 18;
    const scoreSpent = Math.min(score, Math.floor(dashScoreDrain));
    if (scoreSpent > 0) {
      score -= scoreSpent;
      dashScoreDrain -= scoreSpent;
      updateHud();
    }
    if (score <= 0) {
      dashScoreDrain = 0;
    }

    player.bodyLength = Math.max(3, player.bodyLength - dt * 0.55);
    updateSnakeSegments(player);
  }

  const dashActive = keys[' '] && score > 0;
  const sizeSpeedFactor = Math.max(0.12, 1 / (1 + Math.max(0, player.radius - 20) / 100));
  const sprint = (keys['shift'] ? 1.4 : 1) * (dashActive ? 2.5 : 1);
  const moveX = player.facingX * player.speed * sizeSpeedFactor * sprint * dt;
  const moveY = player.facingY * player.speed * sizeSpeedFactor * sprint * dt;

  player.x += moveX;
  player.y += moveY;

  const distanceMoved = Math.hypot(moveX, moveY);
  if (distanceMoved > 0) {
    player.path.push({ x: player.x, y: player.y });
    updateSnakeSegments(player);
  }

  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 10) player.trail.shift();

  if (player.invuln > 0) {
    player.invuln -= dt;
  }
}

function createBot(index, excludedBot = null) {
  let x = player.x;
  let y = player.y;
  let radius = randomBetween(16, 27);

  for (let attempt = 0; attempt < 40; attempt++) {
    x = player.x + randomBetween(-world.width * 0.7, world.width * 0.7);
    y = player.y + randomBetween(-world.height * 0.7, world.height * 0.7);
    radius = randomBetween(16, 27);
    const playerClear = Math.hypot(x - player.x, y - player.y) > Math.max(130, (radius + player.radius) * 1.5);
    const botsClear = bots.every((other) =>
      other === excludedBot || Math.hypot(x - other.x, y - other.y) > (radius + other.radius) * 1.3,
    );
    if (playerClear && botsClear) break;
  }

  const angle = randomBetween(0, Math.PI * 2);
  const speed = randomBetween(72, 105);
  const bot = {
    x,
    y,
    radius,
    speed,
    angle,
    bodyLength: 5,
    path: [],
    segments: [],
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color: ['#d9485f', '#9b2c2c', '#a34fc2', '#3979bd', '#e78336'][index % 5],
  };
  seedSnakePath(bot);
  return bot;
}

function replaceFood(index, x = player.x, y = player.y) {
  poopDrops.splice(index, 1);
  poopDrops.push(createFoodNear(x, y));
}

function replaceBot(bot) {
  Object.assign(bot, createBot(Math.floor(Math.random() * 5), bot));
}

function snakesCollide(first, second) {
  const headDistance = Math.hypot(first.x - second.x, first.y - second.y);
  if (headDistance < (first.radius + second.radius) * 0.72) return true;

  const bodyThreshold = (first.radius + second.radius) * 0.48;
  for (let i = 2; i < second.segments.length; i++) {
    const segment = second.segments[i];
    if (Math.hypot(first.x - segment.x, first.y - segment.y) < bodyThreshold) return true;
  }
  for (let i = 2; i < first.segments.length; i++) {
    const segment = first.segments[i];
    if (Math.hypot(second.x - segment.x, second.y - segment.y) < bodyThreshold) return true;
  }
  return false;
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateBots(dt) {
  for (const bot of bots) {
    let targetX = poopDrops[0]?.x ?? player.x;
    let targetY = poopDrops[0]?.y ?? player.y;
    let targetDistance = Infinity;

    for (const drop of poopDrops) {
      const distance = Math.hypot(drop.x - bot.x, drop.y - bot.y);
      if (distance < targetDistance) {
        targetDistance = distance;
        targetX = drop.x;
        targetY = drop.y;
      }
    }

    let prey = null;
    let preyDistance = 220;
    const possiblePrey = [player, ...bots];
    for (const other of possiblePrey) {
      if (other === bot || bot.radius < other.radius * eatRatio) continue;
      const distance = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (distance < preyDistance) {
        prey = other;
        preyDistance = distance;
      }
    }
    if (prey) {
      targetX = prey.x;
      targetY = prey.y;
    }

    let steerX = targetX - bot.x;
    let steerY = targetY - bot.y;
    for (const other of [player, ...bots]) {
      if (other === bot || other.radius <= bot.radius * eatRatio) continue;
      const awayX = bot.x - other.x;
      const awayY = bot.y - other.y;
      const distance = Math.hypot(awayX, awayY);
      if (distance < 120 && distance > 0) {
        const urgency = (120 - distance) / 120;
        steerX += (awayX / distance) * urgency * 180;
        steerY += (awayY / distance) * urgency * 180;
      }
    }

    const directionLength = Math.hypot(steerX, steerY) || 1;
    const speedFactor = Math.max(0.12, 1 / (1 + Math.max(0, bot.radius - 16) / 100));
    const desiredAngle = Math.atan2(steerY, steerX);
    const angleDifference = Math.atan2(Math.sin(desiredAngle - bot.angle), Math.cos(desiredAngle - bot.angle));
    bot.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, angleDifference));
    bot.vx = Math.cos(bot.angle) * bot.speed * speedFactor;
    bot.vy = Math.sin(bot.angle) * bot.speed * speedFactor;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    if (Math.hypot(bot.vx * dt, bot.vy * dt) > 0) {
      bot.path.push({ x: bot.x, y: bot.y });
      updateSnakeSegments(bot);
    }
  }
}

function updateDrops() {
  for (let i = poopDrops.length - 1; i >= 0; i--) {
    const drop = poopDrops[i];
    if (Math.hypot(drop.x - player.x, drop.y - player.y) < drop.radius + player.radius * 0.75) {
      score += 10;
      player.radius += 3.2;
      player.bodyLength += 1;
      updateSnakeSegments(player);
      addParticles(drop.x, drop.y, '#a8682a', 16);
      replaceFood(i, player.x, player.y);
      updateHud();
      continue;
    }

    const bot = bots.find((candidate) =>
      Math.hypot(drop.x - candidate.x, drop.y - candidate.y) < drop.radius + candidate.radius * 0.75,
    );
    if (bot) {
      bot.radius += 2.4;
      bot.bodyLength += 1;
      updateSnakeSegments(bot);
      addParticles(drop.x, drop.y, bot.color, 10);
      replaceFood(i, bot.x, bot.y);
    }
  }
}

function updateEating() {
  for (const bot of bots) {
    if (!snakesCollide(player, bot)) continue;

    if (player.radius >= bot.radius * eatRatio) {
      player.radius += bot.radius * 0.22;
      player.bodyLength += Math.max(2, bot.bodyLength * 0.3);
      updateSnakeSegments(player);
      score += 50;
      addParticles(bot.x, bot.y, bot.color, 20);
      replaceBot(bot);
      updateHud();
    } else if (bot.radius >= player.radius * eatRatio && player.invuln <= 0) {
      health -= 1;
      player.radius = Math.max(20, player.radius - 5);
      player.bodyLength = Math.max(3, player.bodyLength - 3);
      updateSnakeSegments(player);
      player.invuln = 1.2;
      const knockbackDistance = player.radius + bot.radius + 20;
      const escapeAngle = distance > 0 ? Math.atan2(player.y - bot.y, player.x - bot.x) : randomBetween(0, Math.PI * 2);
      player.x += Math.cos(escapeAngle) * knockbackDistance;
      player.y += Math.sin(escapeAngle) * knockbackDistance;
      bot.radius += 8;
      shake = 10;
      addParticles(player.x, player.y, '#f6d365', 18);
      updateHud();
      if (health <= 0) stopGame();
    } else if (player.invuln <= 0) {
      health -= 1;
      player.invuln = 1.2;
      player.bodyLength = Math.max(3, player.bodyLength - 3);
      updateSnakeSegments(player);
      bot.radius += 8;
      bot.bodyLength += 3;
      updateSnakeSegments(bot);
      shake = 10;
      updateHud();
      if (health <= 0) stopGame();
    }
  }

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const first = bots[i];
      const second = bots[j];
      if (!snakesCollide(first, second)) continue;

      if (first.radius >= second.radius * eatRatio) {
        first.radius += second.radius * 0.22;
        first.bodyLength += Math.max(2, second.bodyLength * 0.3);
        updateSnakeSegments(first);
        addParticles(second.x, second.y, second.color, 16);
        replaceBot(second);
      } else if (second.radius >= first.radius * eatRatio) {
        second.radius += first.radius * 0.22;
        second.bodyLength += Math.max(2, first.bodyLength * 0.3);
        updateSnakeSegments(second);
        addParticles(first.x, first.y, first.color, 16);
        replaceBot(first);
      }
    }
  }
}

function update(dt) {
  if (!gameRunning) return;

  updatePlayer(dt);
  updateBots(dt);
  updateDrops();
  updateEating();
  updateParticles(dt);

  shake = Math.max(0, shake - dt * 25);
}

function drawBackground(zoom) {
  const grass = ctx.createLinearGradient(0, 0, 0, world.height);
  grass.addColorStop(0, '#b9e681');
  grass.addColorStop(1, '#92cc5a');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, world.width, world.height);

  const tileSize = Math.max(12, 112 * zoom);
  const cameraX = world.width / 2 - player.x * zoom;
  const cameraY = world.height / 2 - player.y * zoom;
  const startX = ((cameraX % tileSize) + tileSize) % tileSize - tileSize;
  const startY = ((cameraY % tileSize) + tileSize) % tileSize - tileSize;
  let row = 0;

  for (let y = startY; y < world.height + tileSize; y += tileSize, row++) {
    let column = 0;
    for (let x = startX; x < world.width + tileSize; x += tileSize, column++) {
      if ((row + column) % 2 === 0) {
        ctx.fillStyle = 'rgba(228, 255, 179, 0.12)';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}

function drawSnakeBody(snake, color, isPlayer = false) {
  const segmentRadius = Math.max(5, snake.radius * 0.48);
  for (let i = snake.segments.length - 1; i >= 0; i--) {
    const segment = snake.segments[i];
    const taper = 0.76 + 0.24 * (1 - i / Math.max(1, snake.segments.length));
    ctx.fillStyle = isPlayer ? `hsl(210 28% ${Math.round(17 + taper * 9)}%)` : color;
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, segmentRadius * taper, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isPlayer ? '#66717f' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, segmentRadius * 0.12);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  const bodyW = player.radius;
  const bodyH = player.radius * 0.82;

  ctx.strokeStyle = '#242a34';
  ctx.lineWidth = Math.max(2, bodyW * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -bodyH * 0.72);
  ctx.lineTo(0, -bodyH - bodyW * 0.22);
  ctx.stroke();
  ctx.fillStyle = '#19d9ff';
  ctx.shadowColor = '#19d9ff';
  ctx.shadowBlur = bodyW * 0.35;
  ctx.beginPath();
  ctx.arc(0, -bodyH - bodyW * 0.25, Math.max(2, bodyW * 0.11), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#11151c';
  ctx.strokeStyle = '#66717f';
  ctx.lineWidth = Math.max(1.5, bodyW * 0.07);
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#05070a';
  ctx.strokeStyle = '#3b4654';
  ctx.lineWidth = Math.max(1, bodyW * 0.045);
  ctx.beginPath();
  ctx.ellipse(0, -bodyH * 0.12, bodyW * 0.68, bodyH * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#42e8ff';
  ctx.shadowColor = '#19d9ff';
  ctx.shadowBlur = bodyW * 0.28;
  ctx.beginPath();
  ctx.ellipse(-bodyW * 0.29, -bodyH * 0.15, Math.max(2, bodyW * 0.13), Math.max(2, bodyH * 0.11), 0, 0, Math.PI * 2);
  ctx.ellipse(bodyW * 0.29, -bodyH * 0.15, Math.max(2, bodyW * 0.13), Math.max(2, bodyH * 0.11), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#788493';
  ctx.fillRect(-bodyW * 0.23, bodyH * 0.2, bodyW * 0.46, Math.max(2, bodyH * 0.07));
  ctx.fillRect(-bodyW * 0.16, bodyH * 0.33, bodyW * 0.32, Math.max(2, bodyH * 0.06));

  if (keys[' '] && score > 0) {
    ctx.strokeStyle = 'rgba(25, 217, 255, 0.9)';
    ctx.lineWidth = Math.max(2, bodyW * 0.08);
    ctx.shadowColor = '#19d9ff';
    ctx.shadowBlur = bodyW * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (player.invuln > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDrop(drop) {
  ctx.save();
  ctx.translate(drop.x, drop.y);
  ctx.rotate(drop.glow);

  ctx.fillStyle = '#6c3d1a';
  ctx.beginPath();
  ctx.ellipse(0, 0, drop.radius, drop.radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d6a25a';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function drawBot(bot) {
  drawSnakeBody(bot, bot.color);
  ctx.save();
  ctx.translate(bot.x, bot.y);
  ctx.rotate(bot.angle);

  ctx.fillStyle = bot.color;
  ctx.beginPath();
  ctx.arc(0, 0, bot.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bot.radius * 0.25, -bot.radius * 0.28, Math.max(2, bot.radius * 0.13), 0, Math.PI * 2);
  ctx.arc(bot.radius * 0.25, bot.radius * 0.28, Math.max(2, bot.radius * 0.13), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#321';
  ctx.beginPath();
  ctx.arc(bot.radius * 0.28, -bot.radius * 0.28, Math.max(1, bot.radius * 0.06), 0, Math.PI * 2);
  ctx.arc(bot.radius * 0.28, bot.radius * 0.28, Math.max(1, bot.radius * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGameOver() {
  if (gameRunning) return;

  ctx.fillStyle = 'rgba(19, 14, 10, 0.52)';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = '#fff7df';
  ctx.textAlign = 'center';
  ctx.font = '700 42px Arial';
  ctx.fillText('Run Over', world.width / 2, world.height / 2 - 14);
  ctx.font = '700 20px Arial';
  ctx.fillText(`Score: ${score}`, world.width / 2, world.height / 2 + 24);
}

function draw() {
  ctx.save();
  if (shake > 0) {
    ctx.translate(randomBetween(-shake, shake), randomBetween(-shake, shake));
  }

  const zoom = getCameraZoom();
  drawBackground(zoom);
  ctx.save();
  ctx.translate(world.width / 2 - player.x * zoom, world.height / 2 - player.y * zoom);
  ctx.scale(zoom, zoom);
  drawSnakeBody(player, '#11151c', true);
  for (const drop of poopDrops) drawDrop(drop);
  for (const bot of bots) drawBot(bot);
  drawParticles();
  drawPlayer();
  ctx.restore();
  drawGameOver();
  ctx.restore();
}

function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000 || 0.016, 0.033);
  lastTime = ts;

  update(dt);
  draw();

  if (gameRunning) {
    requestAnimationFrame(gameLoop);
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (event.key === 'Shift') keys['shift'] = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
  if (event.key === 'Shift') keys['shift'] = false;
});

canvas.addEventListener('pointermove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * world.width;
  pointer.y = ((event.clientY - bounds.top) / bounds.height) * world.height;
  pointer.active = true;
});

canvas.addEventListener('pointerleave', () => {
  pointer.active = false;
});

startButton.addEventListener('click', () => {
  if (!gameRunning) {
    startGame();
  }
});

resetButton.addEventListener('click', () => {
  resetGame();
  gameRunning = false;
  draw();
});

resetGame();
draw();
