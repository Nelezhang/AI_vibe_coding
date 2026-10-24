import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.querySelector('#arena');
const titleScreen = document.querySelector('#titleScreen');
const gameHud = document.querySelector('#gameHud');
const playButton = document.querySelector('#playButton');
const characterSelect = document.querySelector('#characterSelect');
const weaponSelect = document.querySelector('#weaponSelect');
const mapSelect = document.querySelector('#mapSelect');
const healthBar = document.querySelector('#healthBar');
const healthText = document.querySelector('#healthText');
const killsText = document.querySelector('#kills');
const playerName = document.querySelector('#playerName');
const playerLevelText = document.querySelector('#playerLevel');
const levelProgressText = document.querySelector('#levelProgress');
const battleBanner = document.querySelector('#battleBanner');
const mapBadge = document.querySelector('#mapBadge');
const characterDesc = document.querySelector('#characterDesc');
const weaponDesc = document.querySelector('#weaponDesc');
const mapDesc = document.querySelector('#mapDesc');
const titleEyebrow = document.querySelector('.eyebrow');
const titleHeading = document.querySelector('.title-copy h1');
const titleParagraph = document.querySelector('.title-copy p');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#121a2d');
const camera = new THREE.OrthographicCamera(-12, 12, 6.75, -6.75, 0.1, 80);
camera.position.set(0, -3.2, 27);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#d6e4ff', '#46506e', 2.35));
const sun = new THREE.DirectionalLight('#fff2cb', 3.5);
sun.position.set(-7, 9, 16);
scene.add(sun);
const fillLight = new THREE.PointLight('#40decc', 80, 25);
fillLight.position.set(7, -3, 8);
scene.add(fillLight);

const arenaRoot = new THREE.Group();
scene.add(arenaRoot);
const decorRoot = new THREE.Group();
scene.add(decorRoot);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const pointerWorld = new THREE.Vector3();
const arenaBounds = { x: 14.25, y: 8.0 };
const MAP_SCALE = 1.35;

const characters = {
  nova: { name: 'NOVA', tag: 'ALL-ROUNDER', color: '#4de7d1', accent: '#d3fff2', speed: 5.3, health: 120, radius: 0.42, style: 'visor' },
  vega: { name: 'VEGA', tag: 'QUICK & LIGHT', color: '#ffb647', accent: '#fff1bd', speed: 6.5, health: 90, radius: 0.36, style: 'antenna' },
  titan: { name: 'TITAN', tag: 'HEAVY DEFENDER · BODY DAMAGE', color: '#b783ff', accent: '#eee0ff', speed: 4.3, health: 165, radius: 0.5, style: 'horns', bodyDamage: 16 },
  ember: { name: 'EMBER', tag: 'RAPID STRIKER', color: '#ff684f', accent: '#ffe0a1', speed: 5.8, health: 105, radius: 0.39, style: 'crest' },
  rook: { name: 'ROOK', tag: 'ARMORED BRUISER · BODY DAMAGE', color: '#74a7ff', accent: '#d7e5ff', speed: 4.6, health: 190, radius: 0.49, style: 'armor', bodyDamage: 20 },
  echo: { name: 'ECHO', tag: 'ELUSIVE SCOUT', color: '#e47dff', accent: '#f8d8ff', speed: 6.1, health: 100, radius: 0.37, style: 'fins' },
  ultra: { name: 'ULTRA', tag: 'ALL-DIRECTION BLASTER', color: '#ff4fdf', accent: '#fff1ff', speed: 6.2, health: 500, radius: 0.46, style: 'crown', radialShots: 12, radialSpread: 0.28, fireDelay: 0.1, damageMultiplier: 3 },
};
const weapons = {
  pulse: { name: 'PULSE BLASTER', tag: 'BALANCED', fireDelay: 0.28, damage: 22, speed: 12, pellets: 1, spread: 0.025, color: '#73f6e7', radius: 0.105 },
  scatter: { name: 'STAR SCATTER', tag: 'CLOSE-RANGE BURST', fireDelay: 0.72, damage: 13, speed: 10, pellets: 5, spread: 0.32, color: '#ffd45e', radius: 0.09 },
  rail: { name: 'RAIL LANCE', tag: 'PIERCING LONG-RANGE', fireDelay: 0.62, damage: 42, speed: 17, pellets: 1, spread: 0.008, color: '#ff83c7', radius: 0.14, pierce: true, projectile: 'rail' },
  prism: { name: 'PRISM BURST', tag: 'THREE-SHOT FAN', fireDelay: 0.43, damage: 15, speed: 13, pellets: 3, spread: 0.16, color: '#8ce2ff', radius: 0.09, projectile: 'diamond' },
  comet: { name: 'COMET LAUNCHER', tag: 'EXPLOSIVE SPLASH', fireDelay: 0.86, damage: 38, speed: 7.5, pellets: 1, spread: 0.018, color: '#ff9c5e', radius: 0.19, splash: 1.35, projectile: 'rocket' },
  twin: { name: 'TWIN COMETS', tag: 'FAST DUAL SHOT', fireDelay: 0.2, damage: 12, speed: 14, pellets: 2, spread: 0.11, color: '#c4a1ff', radius: 0.085, projectile: 'twin' },
  nova: { name: 'NOVA ORB', tag: 'HEAVY ENERGY BOLT', fireDelay: 0.55, damage: 32, speed: 9.5, pellets: 1, spread: 0.015, color: '#f3ed78', radius: 0.17, projectile: 'orb' },
  ion: { name: 'ION REPEATER', tag: 'RAPID FOUR-SHOT BURST', fireDelay: 0.38, damage: 9, speed: 16, pellets: 4, spread: 0.14, color: '#70a7ff', radius: 0.07, projectile: 'diamond' },
  frost: { name: 'FROST NEEDLE', tag: 'PIERCING PRECISION', fireDelay: 0.48, damage: 29, speed: 19, pellets: 1, spread: 0.006, color: '#a9f5ff', radius: 0.11, pierce: true, projectile: 'rail' },
  sunburst: { name: 'SUNBURST', tag: 'WIDE SEVEN-SHOT FAN', fireDelay: 0.76, damage: 10, speed: 11, pellets: 7, spread: 0.52, color: '#ffdb69', radius: 0.1, projectile: 'orb' },
  cluster: { name: 'CLUSTER ROCKET', tag: 'TRIPLE SPLASH VOLLEY', fireDelay: 1.05, damage: 24, speed: 8, pellets: 3, spread: 0.2, color: '#ff795b', radius: 0.16, splash: 1.05, projectile: 'rocket' },
  shard: { name: 'SHARD STORM', tag: 'FIVE-SHOT CRYSTAL FAN', fireDelay: 0.62, damage: 12, speed: 12, pellets: 5, spread: 0.34, color: '#f39cff', radius: 0.095, projectile: 'diamond' },
  omega: { name: 'OMEGA CANNON', tag: 'PLAYER ONLY · ALL-DIRECTION ARSENAL · 2× SPEED', fireDelay: 0.16, damage: 100000, speed: 22, pellets: 5, spread: 0.3, color: '#fff36b', radius: 0.2, splash: 3.2, pierce: true, projectile: 'orb', playerOnly: true, allWeapons: true, radialShots: 16, speedMultiplier: 2 },
  ghdjcncjhvbk: { name: 'GHDJCN CJHVBK', tag: 'PLAYER ONLY · SUMMON TANKS', fireDelay: 0.65, damage: 0, speed: 1, pellets: 1, spread: 0, color: '#6cff9a', radius: 0.1, playerOnly: true, summonTanks: true },
};
const maps = {
  docks: {
    name: 'NEON DOCKS', tag: 'OPEN LANES', floor: '#243b48', edge: '#55ead3', wall: '#32606a', trim: '#96fff0',
    obstacles: [[-4.9, 2.55, 1.8, 0.7], [4.8, 2.55, 1.8, 0.7], [-4.9, -2.55, 1.8, 0.7], [4.8, -2.55, 1.8, 0.7], [0, 3.35, 1.2, 0.65], [0, -3.35, 1.2, 0.65]],
  },
  ruins: {
    name: 'SUNSTONE RUINS', tag: 'TIGHT CORNERS', floor: '#5a4034', edge: '#ffc866', wall: '#895d3e', trim: '#ffe09a',
    obstacles: [[-5, 3.1, 1.7, 1.2], [-2.3, 3.1, 1.25, 1.25], [2.6, 3.1, 1.6, 1.05], [5.1, 2, 1.2, 1.8], [-5.2, -2.7, 1.4, 1.5], [-2.6, -3.1, 1.2, 1.1], [1, -3.2, 1.8, 1], [4.2, -2.6, 1.35, 1.4], [-0.15, 0.15, 1.35, 1.35]],
  },
  garden: {
    name: 'MOON GARDEN', tag: 'COVER & CROSSES', floor: '#30433a', edge: '#bcf477', wall: '#56764d', trim: '#dcff9c',
    obstacles: [[-5.1, 2.9, 1.2, 1.2], [-2.6, 2.3, 1.1, 1.1], [2.6, 2.6, 1.35, 1.35], [5.1, 3, 1.1, 1.1], [-4.3, -2.7, 1.5, 1.1], [-1.5, -3.2, 1.2, 1.4], [1.6, -2.6, 1.15, 1.15], [4.7, -2.7, 1.4, 1.1], [0, 0.1, 1.15, 1.15]],
  },
};

const controls = new Set();
const bullets = [];
const enemies = [];
const allies = [];
let obstacles = [];
let player = null;
let playerMesh = null;
let playerHealth = 0;
let playerMaxHealth = 0;
let playerLevel = 1;
let playerInvulnerability = 0;
let fireCooldown = 0;
let spawnTimer = 0;
let elapsed = 0;
let kills = 0;
let running = false;
let lastTime = 0;
let pointerDown = false;
let hitFlash = 0;
let muzzleTimer = 0;
let activeCharacter = characters.nova;
let activeWeapon = weapons.pulse;
let activeMap = maps.docks;
let messageTimer = 0;
const effects = [];

function fillSelect(select, entries, selected) {
  select.replaceChildren(...Object.entries(entries).map(([key, item]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${item.name} — ${item.tag}`;
    option.selected = key === selected;
    return option;
  }));
}

fillSelect(characterSelect, characters, 'nova');
fillSelect(weaponSelect, weapons, 'pulse');
fillSelect(mapSelect, maps, 'docks');

function updateLoadoutLabels() {
  activeCharacter = characters[characterSelect.value];
  activeWeapon = weapons[weaponSelect.value];
  activeMap = maps[mapSelect.value];
  characterDesc.textContent = `${activeCharacter.name} · ${activeCharacter.tag}`;
  weaponDesc.textContent = `${activeWeapon.name} · ${activeWeapon.tag}`;
  mapDesc.textContent = `${activeMap.name} · ${activeMap.tag}`;
  mapBadge.textContent = activeMap.name;
}

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  renderer.setSize(safeWidth, safeHeight, false);
  const worldHeight = safeWidth < 650 ? 20 : 17;
  const aspect = safeWidth / safeHeight;
  camera.left = -worldHeight * aspect / 2;
  camera.right = worldHeight * aspect / 2;
  camera.top = worldHeight / 2;
  camera.bottom = -worldHeight / 2;
  camera.updateProjectionMatrix();
  render();
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.06, ...options });
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clearGroup(group) {
  while (group.children.length) {
    const object = group.children[0];
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
      }
      if (child.material?.map) child.material.map.dispose();
    });
    group.remove(object);
  }
}

function addBox(group, width, height, depth, position, material, bevel = false) {
  const geometry = bevel
    ? new THREE.BoxGeometry(width, height, depth, 1, 1, 1)
    : new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function setupArena(map) {
  clearGroup(arenaRoot);
  clearGroup(decorRoot);
  obstacles = [];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(29.8, 16.8), makeMaterial(map.floor, { roughness: 0.95 }));
  floor.position.z = -0.08;
  arenaRoot.add(floor);

  const gridMaterial = new THREE.LineBasicMaterial({ color: map.trim, transparent: true, opacity: 0.095 });
  const gridPositions = [];
  for (let x = -14; x <= 14; x += 1) gridPositions.push(x, -7.8, -0.045, x, 7.8, -0.045);
  for (let y = -7; y <= 7; y += 1) gridPositions.push(-14.2, y, -0.045, 14.2, y, -0.045);
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
  arenaRoot.add(new THREE.LineSegments(gridGeometry, gridMaterial));

  const edgeMaterial = makeMaterial(map.edge, { emissive: map.edge, emissiveIntensity: 0.16, roughness: 0.5 });
  const wallMaterial = makeMaterial(map.wall, { roughness: 0.84 });
  const trimMaterial = makeMaterial(map.trim, { emissive: map.trim, emissiveIntensity: 0.12 });
  addBox(arenaRoot, 29.1, 0.3, 0.46, [0, 8.13, 0.12], edgeMaterial);
  addBox(arenaRoot, 29.1, 0.3, 0.46, [0, -8.13, 0.12], edgeMaterial);
  addBox(arenaRoot, 0.3, 16, 0.46, [-14.55, 0, 0.12], edgeMaterial);
  addBox(arenaRoot, 0.3, 16, 0.46, [14.55, 0, 0.12], edgeMaterial);

  for (const [mapX, mapY, mapWidth, mapHeight] of map.obstacles) {
    const x = mapX * MAP_SCALE;
    const y = mapY * MAP_SCALE;
    const width = mapWidth * MAP_SCALE;
    const height = mapHeight * MAP_SCALE;
    const obstacle = { x, y, width, height };
    obstacles.push(obstacle);
    const shape = mapSelect.value === 'garden' ? 'rock' : mapSelect.value === 'ruins' ? 'pillar' : 'crate';
    if (shape === 'rock') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(width, height) * 0.42, 0), wallMaterial);
      rock.scale.set(width / Math.max(width, height), height / Math.max(width, height), 0.66);
      rock.position.set(x, y, 0.27);
      rock.rotation.z = Math.random() * 0.5;
      rock.castShadow = true;
      arenaRoot.add(rock);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), trimMaterial);
      cap.position.set(x - width * 0.2, y + height * 0.18, 0.65);
      arenaRoot.add(cap);
    } else {
      const body = addBox(arenaRoot, width, height, 0.64, [x, y, 0.28], wallMaterial, true);
      body.rotation.z = mapSelect.value === 'ruins' ? 0.025 : 0;
      const top = addBox(arenaRoot, width * 0.83, height * 0.82, 0.12, [x, y, 0.66], trimMaterial);
      top.material = makeMaterial(map.wall, { emissive: map.edge, emissiveIntensity: 0.11 });
      addBox(arenaRoot, width * 0.72, 0.055, 0.035, [x, y, 0.74], trimMaterial);
    }
  }

  // Scatter low-lit floor markers to make each map feel distinct without blocking movement.
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() * 27.2) - 13.6;
    const y = (Math.random() * 14.4) - 7.2;
    if (obstacles.some((obstacle) => Math.abs(x - obstacle.x) < obstacle.width && Math.abs(y - obstacle.y) < obstacle.height)) continue;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.028 + Math.random() * 0.025, 8), new THREE.MeshBasicMaterial({ color: map.trim, transparent: true, opacity: 0.25 }));
    marker.position.set(x, y, -0.025);
    decorRoot.add(marker);
  }
}

function createFighter(color, accent, radius, isPlayer = false, style = 'visor') {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.3, 24), new THREE.MeshBasicMaterial({ color: '#07101b', transparent: true, opacity: 0.3 }));
  shadow.position.z = 0.012;
  group.add(shadow);

  const bodyMaterial = makeMaterial(color, { emissive: color, emissiveIntensity: 0.12, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.84, radius, 0.52, 8), bodyMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 10), makeMaterial(accent, { roughness: 0.37 }));
  head.position.set(radius * 0.2, 0, 0.67);
  head.scale.set(1, 0.84, 0.6);
  head.castShadow = true;
  group.add(head);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#152033' });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.09, 8, 6), eyeMaterial);
  eye.position.set(radius * 0.48, 0.025, 0.72);
  group.add(eye);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.02, 0.035, 5, 20), makeMaterial(accent, { emissive: accent, emissiveIntensity: 0.26 }));
  rim.position.z = 0.12;
  group.add(rim);

  const detailMaterial = makeMaterial(accent, { emissive: accent, emissiveIntensity: 0.2, metalness: 0.22 });
  if (style === 'antenna' || style === 'crest') {
    const antenna = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.13, radius * 0.65, 6), detailMaterial);
    antenna.position.set(-radius * 0.12, radius * 0.4, 0.75);
    group.add(antenna);
    if (style === 'antenna') {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.13, 8, 6), makeMaterial('#fff2a8', { emissive: '#ffd95c', emissiveIntensity: 0.7 }));
      beacon.position.set(-radius * 0.12, radius * 0.67, 0.75);
      group.add(beacon);
    }
  } else if (style === 'horns') {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.18, radius * 0.58, 6), detailMaterial);
      horn.position.set(-radius * 0.32, side * radius * 0.65, 0.58);
      horn.rotation.z = side * -0.62;
      group.add(horn);
    }
  } else if (style === 'armor') {
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.42, radius * 0.95, 0.18), detailMaterial);
      plate.position.set(-radius * 0.12, side * radius * 0.77, 0.36);
      plate.rotation.z = side * 0.16;
      group.add(plate);
    }
  } else if (style === 'fins') {
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.22, radius * 0.66, 5), detailMaterial);
      fin.position.set(-radius * 0.42, side * radius * 0.64, 0.38);
      fin.rotation.z = side * -Math.PI / 2;
      group.add(fin);
    }
  } else if (style === 'crown') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, 0.045, 6, 24), detailMaterial);
    halo.position.set(-radius * 0.08, 0, 0.88);
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.13, radius * 0.52, 6), detailMaterial);
      spike.position.set(-radius * 0.3 + i * radius * 0.36, 0, 0.91);
      group.add(spike);
    }
  } else {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.52, radius * 0.12, 0.07), detailMaterial);
    visor.position.set(radius * 0.42, 0, 0.78);
    group.add(visor);
  }

  if (isPlayer) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.47, 8), makeMaterial('#eaf5ff', { metalness: 0.35, roughness: 0.38 }));
    barrel.rotation.z = -Math.PI / 2;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(radius * 0.9, 0, 0.44);
    group.add(barrel);
  } else {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.18, radius * 0.4, 6), makeMaterial('#ffe3ca'));
    horn.position.set(0, radius * 0.43, 0.73);
    group.add(horn);
  }
  return group;
}

function circleHitsObstacle(x, y, radius, obstacle) {
  const nearX = Math.max(obstacle.x - obstacle.width / 2, Math.min(x, obstacle.x + obstacle.width / 2));
  const nearY = Math.max(obstacle.y - obstacle.height / 2, Math.min(y, obstacle.y + obstacle.height / 2));
  const dx = x - nearX;
  const dy = y - nearY;
  return dx * dx + dy * dy < radius * radius;
}

function isBlocked(x, y, radius) {
  if (Math.abs(x) > arenaBounds.x - radius || Math.abs(y) > arenaBounds.y - radius) return true;
  return obstacles.some((obstacle) => circleHitsObstacle(x, y, radius, obstacle));
}

function spawnPlayer() {
  player = {
    x: -7.1,
    y: 0,
    radius: activeCharacter.radius,
    speed: Math.min(3.4, activeCharacter.speed * 0.55 * (activeWeapon.speedMultiplier || 1)),
    mesh: createFighter(activeCharacter.color, activeCharacter.accent, activeCharacter.radius, true, activeCharacter.style),
    color: activeCharacter.color,
  };
  playerMesh = player.mesh;
  playerMesh.position.set(player.x, player.y, 0.05);
  scene.add(playerMesh);
  playerHealth = playerMaxHealth = activeCharacter.health;
  playerInvulnerability = 0;
  fireCooldown = 0;
  updateHealth();
}

function spawnEnemy() {
  const enemyRoster = Object.values(characters).filter((character) => character !== characters.ultra);
  const chosenCharacter = enemyRoster[Math.floor(Math.random() * enemyRoster.length)];
  const enemyWeaponEntries = Object.entries(weapons).filter(([, weapon]) => !weapon.playerOnly);
  const [weaponKey, chosenWeapon] = enemyWeaponEntries[Math.floor(Math.random() * enemyWeaponEntries.length)];
  const edge = Math.floor(Math.random() * 4);
  let x = edge < 2 ? (edge === 0 ? -12.8 : 12.8) : randomBetween(-12.8, 12.8);
  let y = edge >= 2 ? (edge === 2 ? -7.0 : 7.0) : randomBetween(-7.0, 7.0);
  for (let tries = 0; tries < 10 && (isBlocked(x, y, chosenCharacter.radius) || Math.hypot(x - player.x, y - player.y) < 4.3); tries++) {
    x = randomBetween(-12.8, 12.8);
    y = randomBetween(-7.0, 7.0);
  }
  const radius = chosenCharacter.radius;
  const startingLevel = 20;
  const levelScale = 1 + (startingLevel - 1) * 0.12;
  const startingHealth = Math.round(chosenCharacter.health * 0.55 * levelScale);
  const enemy = {
    x, y, radius, health: startingHealth, maxHealth: startingHealth, speed: Math.min(3.4, chosenCharacter.speed * 0.32),
    level: startingLevel, levelTimer: randomBetween(10, 15),
    damage: chosenWeapon.damage * (1 + (startingLevel - 1) * 0.15),
    bodyDamage: (chosenCharacter.bodyDamage || 7) * (1 + (startingLevel - 1) * 0.035),
    fireInterval: Math.max(0.16, chosenWeapon.fireDelay * 0.75),
    character: chosenCharacter, weapon: chosenWeapon, weaponKey,
    fireTimer: randomBetween(0.8, 1.8), hitFlash: 0,
    mesh: createFighter(chosenCharacter.color, chosenCharacter.accent, radius, false, chosenCharacter.style),
  };
  enemy.statusGroup = createEnemyStatus(enemy);
  enemy.mesh.position.set(x, y, 0.05);
  scene.add(enemy.mesh);
  scene.add(enemy.statusGroup);
  enemies.push(enemy);
}

function spawnSummonedTank() {
  if (!player || allies.length >= 5) return;
  const angle = Math.random() * Math.PI * 2;
  const radius = activeCharacter.radius * 2.2;
  const x = player.x + Math.cos(angle) * radius;
  const y = player.y + Math.sin(angle) * radius;
  if (isBlocked(x, y, 0.4)) return;

  const tank = {
    x, y, radius: 0.4, health: 260, maxHealth: 260, speed: 2.8,
    damage: 34 * (1 + (playerLevel - 1) * 0.1), bodyDamage: 28,
    level: playerLevel, character: { name: 'ALLY TANK', health: 260 },
    weapon: { name: 'SUMMONED' }, fireInterval: 0.8,
    mesh: createFighter('#6cff9a', '#e2ff9a', 0.4, false, 'armor'),
  };
  tank.statusGroup = createEnemyStatus(tank);
  tank.statusGroup.userData.healthFill.material.color.set('#70ffab');
  tank.statusGroup.userData.levelSprite.material.map.dispose();
  tank.statusGroup.userData.levelSprite.material.dispose();
  tank.statusGroup.remove(tank.statusGroup.userData.levelSprite);
  tank.statusGroup.userData.levelSprite = createEnemyLevelSprite(tank.level, 'ALLY TANK');
  tank.statusGroup.userData.levelSprite.material.color.set('#75ffad');
  tank.statusGroup.add(tank.statusGroup.userData.levelSprite);
  tank.mesh.position.set(x, y, 0.05);
  scene.add(tank.mesh, tank.statusGroup);
  allies.push(tank);
  showMessage(`ALLY TANK SUMMONED · ${allies.length}/5`, 1.0);
}

function removeAlly(tank) {
  const index = allies.indexOf(tank);
  if (index < 0) return;
  removeEnemyActors(tank);
  allies.splice(index, 1);
}

function createEnemyStatus(enemy) {
  const group = new THREE.Group();
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.13),
    new THREE.MeshBasicMaterial({ color: '#111426', depthTest: false, depthWrite: false }),
  );
  background.position.z = 0;
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.085),
    new THREE.MeshBasicMaterial({ color: '#ff6688', depthTest: false, depthWrite: false }),
  );
  fill.position.set(0, 0, 0.01);
  group.add(background, fill);
  group.userData.healthFill = fill;
  group.userData.levelSprite = createEnemyLevelSprite(enemy.level, enemy.weapon.name);
  group.add(group.userData.levelSprite);
  group.position.set(enemy.x, enemy.y + enemy.radius + 0.52, 1.25);
  return group;
}

function createEnemyLevelSprite(level, weaponName) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 76;
  const context = labelCanvas.getContext('2d');
  context.fillStyle = 'rgba(13, 17, 35, 0.92)';
  context.beginPath();
  context.roundRect(2, 2, 176, 72, 12);
  context.fill();
  context.strokeStyle = '#ff91aa';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = '#fff4f6';
  context.font = '900 27px Nunito, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`LV ${String(level).padStart(2, '0')}`, 90, 24);
  context.fillStyle = '#ffc6d3';
  context.font = '800 13px Nunito, sans-serif';
  context.fillText(weaponName, 90, 55);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.95, 0.4, 1);
  sprite.position.set(0, 0.28, 0.02);
  return sprite;
}

function updateEnemyStatus(enemy) {
  const ratio = Math.max(0, enemy.health / enemy.maxHealth);
  const fill = enemy.statusGroup.userData.healthFill;
  fill.scale.x = ratio;
  fill.position.x = -0.53 * (1 - ratio);
  fill.material.color.set(ratio < 0.3 ? '#ff526f' : '#ff9a70');
  enemy.statusGroup.position.set(enemy.x, enemy.y + enemy.radius + 0.62, 1.25);
}

function levelUpEnemy(enemy) {
  enemy.level++;
  const healthBonus = Math.round(enemy.character.health * 0.12);
  enemy.maxHealth += healthBonus;
  enemy.health = Math.min(enemy.maxHealth, enemy.health + healthBonus);
  enemy.speed = Math.min(3.4, enemy.speed * 1.015);
  enemy.damage *= 1.15;
  enemy.bodyDamage *= 1.12;
  enemy.fireInterval = Math.max(0.12, enemy.fireInterval * 0.985);

  const oldSprite = enemy.statusGroup.userData.levelSprite;
  enemy.statusGroup.remove(oldSprite);
  oldSprite.material.map.dispose();
  oldSprite.material.dispose();
  enemy.statusGroup.userData.levelSprite = createEnemyLevelSprite(enemy.level, enemy.weapon.name);
  enemy.statusGroup.add(enemy.statusGroup.userData.levelSprite);
  updateEnemyStatus(enemy);
}

function startBattle() {
  if (running) return;
  updateLoadoutLabels();
  setupArena(activeMap);
  if (playerMesh) {
    scene.remove(playerMesh);
    clearObject(playerMesh);
  }
  for (const enemy of enemies) removeEnemyActors(enemy);
  for (const ally of allies) removeEnemyActors(ally);
  for (const bullet of bullets) removeActor(bullet.mesh);
  for (const effect of effects) removeActor(effect.mesh);
  enemies.length = 0;
  allies.length = 0;
  bullets.length = 0;
  effects.length = 0;
  kills = 0;
  playerLevel = 1;
  elapsed = 0;
  spawnTimer = 1.2;
  hitFlash = 0;
  muzzleTimer = 0;
  spawnPlayer();
  for (let i = 0; i < 3; i++) spawnEnemy();
  titleScreen.hidden = true;
  gameHud.hidden = false;
  battleBanner.hidden = true;
  killsText.textContent = '00';
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function clearObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material.map) material.map.dispose();
        material.dispose();
      }
    }
  });
}

function removeActor(object) {
  scene.remove(object);
  clearObject(object);
}

function removeEnemyActors(enemy) {
  removeActor(enemy.mesh);
  removeActor(enemy.statusGroup);
}

function updateHealth() {
  playerName.textContent = activeCharacter.name;
  playerLevelText.textContent = `LEVEL ${String(playerLevel).padStart(2, '0')}`;
  levelProgressText.textContent = `${kills % 3} / 3 ELIMS TO LEVEL UP`;
  const percent = Math.max(0, playerHealth / playerMaxHealth * 100);
  healthBar.style.width = `${percent}%`;
  healthBar.style.background = percent < 30 ? 'linear-gradient(90deg,#ff587b,#ff9b72)' : 'linear-gradient(90deg,#54f0bd,#b6ff72)';
  healthText.textContent = `${Math.max(0, Math.ceil(playerHealth))} / ${playerMaxHealth}`;
}

function showMessage(text, duration = 1.1) {
  battleBanner.textContent = text;
  battleBanner.hidden = false;
  messageTimer = duration;
}

function aimAtPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  raycaster.ray.intersectPlane(groundPlane, pointerWorld);
}

function fireWeapon() {
  if (!running || fireCooldown > 0 || !player) return;
  if (activeWeapon.summonTanks) {
    spawnSummonedTank();
    fireCooldown = 0.65;
    muzzleTimer = 0.08;
    return;
  }
  const radialShots = activeCharacter.radialShots || 0;
  const baseFireDelay = activeCharacter.fireDelay || activeWeapon.fireDelay;
  fireCooldown = Math.max(0.06, baseFireDelay / (1 + (playerLevel - 1) * 0.07));
  const angle = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
  const weaponPatterns = activeWeapon.allWeapons
    ? Object.values(weapons).filter((weapon) => !weapon.playerOnly)
    : [activeWeapon];
  for (const weapon of weaponPatterns) {
    const omegaRadialShots = activeWeapon.allWeapons ? activeWeapon.radialShots : 0;
    const shotCount = omegaRadialShots || (radialShots ? radialShots : weapon.pellets);
    for (let i = 0; i < shotCount; i++) {
      const direction = omegaRadialShots
        ? angle + (Math.PI * 2 * i) / omegaRadialShots
        : radialShots
          ? (Math.PI * 2 * i) / radialShots + (Math.random() - 0.5) * (activeCharacter.radialSpread || 0)
        : angle + (weapon.pellets === 1
          ? (Math.random() - 0.5) * weapon.spread
          : (i - (weapon.pellets - 1) / 2) * weapon.spread + (Math.random() - 0.5) * 0.05);
      let geometry;
      if (weapon.projectile === 'diamond') geometry = new THREE.OctahedronGeometry(weapon.radius * 1.35, 0);
      else if (weapon.projectile === 'rocket') geometry = new THREE.ConeGeometry(weapon.radius * 0.8, weapon.radius * 2.5, 8);
      else if (weapon.projectile === 'rail') geometry = new THREE.CylinderGeometry(weapon.radius * 0.55, weapon.radius * 0.55, weapon.radius * 3.2, 8);
      else geometry = new THREE.SphereGeometry(weapon.radius, 10, 8);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: weapon.color }));
      const x = player.x + Math.cos(direction) * (player.radius + 0.18);
      const y = player.y + Math.sin(direction) * (player.radius + 0.18);
      mesh.position.set(x, y, 0.55);
      if (weapon.projectile === 'rocket' || weapon.projectile === 'rail') mesh.rotation.z = direction - Math.PI / 2;
      scene.add(mesh);
      bullets.push({
        x, y, vx: Math.cos(direction) * weapon.speed, vy: Math.sin(direction) * weapon.speed,
        damage: activeWeapon.allWeapons ? activeWeapon.damage : weapon.damage * (activeCharacter.damageMultiplier || 1) * (1 + (playerLevel - 1) * 0.1),
        radius: weapon.radius, splash: activeWeapon.allWeapons ? Math.max(weapon.splash || 0, activeWeapon.splash) : weapon.splash || 0,
        pierce: Boolean(weapon.pierce || activeWeapon.allWeapons), hitTargets: new Set(), life: 1.2, owner: 'player', mesh,
      });
    }
  }
  muzzleTimer = 0.08;
}

function enemyFire(enemy, target) {
  const weapon = enemy.weapon;
  const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  for (let i = 0; i < weapon.pellets; i++) {
    const spread = weapon.pellets === 1
      ? randomBetween(-weapon.spread * 0.5, weapon.spread * 0.5)
      : (i - (weapon.pellets - 1) / 2) * weapon.spread;
    const angle = baseAngle + spread;
    let geometry;
    if (weapon.projectile === 'diamond') geometry = new THREE.OctahedronGeometry(weapon.radius * 1.35, 0);
    else if (weapon.projectile === 'rocket') geometry = new THREE.ConeGeometry(weapon.radius * 0.8, weapon.radius * 2.5, 8);
    else if (weapon.projectile === 'rail') geometry = new THREE.CylinderGeometry(weapon.radius * 0.55, weapon.radius * 0.55, weapon.radius * 3.2, 8);
    else geometry = new THREE.SphereGeometry(weapon.radius, 10, 8);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: weapon.color }));
    const x = enemy.x + Math.cos(angle) * (enemy.radius + 0.18);
    const y = enemy.y + Math.sin(angle) * (enemy.radius + 0.18);
    mesh.position.set(x, y, 0.55);
    if (weapon.projectile === 'rocket' || weapon.projectile === 'rail') mesh.rotation.z = angle - Math.PI / 2;
    scene.add(mesh);
    bullets.push({
      x, y, vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
      damage: enemy.damage, radius: weapon.radius, splash: weapon.splash || 0,
      pierce: Boolean(weapon.pierce), hitTargets: new Set(), life: 2.8, owner: 'enemy', shooter: enemy, mesh,
    });
  }
}

function findEnemyTarget(enemy) {
  let target = player;
  let nearestDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  for (const candidate of enemies) {
    if (candidate === enemy) continue;
    const distance = Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y);
    if (distance < nearestDistance) {
      target = candidate;
      nearestDistance = distance;
    }
  }
  for (const ally of allies) {
    const distance = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
    if (distance < nearestDistance) {
      target = ally;
      nearestDistance = distance;
    }
  }
  return { target, distance: nearestDistance };
}

function makeBurst(x, y, color, count = 7) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(1.2, 3.7);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(randomBetween(0.035, 0.075), 0), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.set(x, y, 0.75);
    scene.add(mesh);
    effects.push({ mesh, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5, maxLife: 0.5 });
  }
}

function damagePlayer(amount) {
  if (playerInvulnerability > 0) return;
  playerHealth -= amount;
  playerInvulnerability = 0.58;
  hitFlash = 0.18;
  updateHealth();
  if (playerHealth <= 0) returnToTitle();
}

function returnToTitle() {
  running = false;
  pointerDown = false;
  controls.clear();
  for (const enemy of enemies) removeEnemyActors(enemy);
  for (const ally of allies) removeEnemyActors(ally);
  for (const bullet of bullets) removeActor(bullet.mesh);
  for (const effect of effects) removeActor(effect.mesh);
  enemies.length = 0;
  allies.length = 0;
  bullets.length = 0;
  effects.length = 0;
  if (playerMesh) {
    scene.remove(playerMesh);
    clearObject(playerMesh);
    playerMesh = null;
  }
  gameHud.hidden = true;
  titleScreen.hidden = false;
  battleBanner.hidden = true;
  titleEyebrow.innerHTML = '<i></i> BATTLE OVER · LOADOUT READY';
  titleHeading.innerHTML = 'BACK TO<br /><em>THE FIGHT.</em>';
  titleParagraph.textContent = `You took ${kills} ${kills === 1 ? 'opponent' : 'opponents'} down. Switch your brawler, weapon, or map and jump back in.`;
  playButton.querySelector('span').textContent = 'FIGHT AGAIN';
  render();
}

function tryMove(entity, dx, dy) {
  const nextX = entity.x + dx;
  if (!isBlocked(nextX, entity.y, entity.radius)) entity.x = nextX;
  const nextY = entity.y + dy;
  if (!isBlocked(entity.x, nextY, entity.radius)) entity.y = nextY;
}

function updatePlayer(dt) {
  if (!player) return;
  let dx = Number(controls.has('KeyD') || controls.has('ArrowRight')) - Number(controls.has('KeyA') || controls.has('ArrowLeft'));
  let dy = Number(controls.has('KeyW') || controls.has('ArrowUp')) - Number(controls.has('KeyS') || controls.has('ArrowDown'));
  const magnitude = Math.hypot(dx, dy) || 1;
  dx = dx / magnitude * player.speed * dt;
  dy = dy / magnitude * player.speed * dt;
  tryMove(player, dx, dy);
  player.mesh.position.set(player.x, player.y, 0.05);
  player.mesh.rotation.z = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
  playerInvulnerability = Math.max(0, playerInvulnerability - dt);
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (playerInvulnerability > 0) player.mesh.visible = Math.floor(playerInvulnerability * 19) % 2 === 0;
  else player.mesh.visible = true;
  if (pointerDown || controls.has('Space')) fireWeapon();
}

function updateEnemies(dt) {
  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    const { target, distance: targetDistance } = findEnemyTarget(enemy);
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = targetDistance || 0.001;
    const ux = dx / distance;
    const uy = dy / distance;
    if (distance > 3.3) tryMove(enemy, ux * enemy.speed * dt, uy * enemy.speed * dt);
    enemy.mesh.position.set(enemy.x, enemy.y, 0.05);
    enemy.mesh.rotation.z = Math.atan2(dy, dx);
    enemy.levelTimer -= dt;
    if (enemy.levelTimer <= 0 && enemy.level < 1000000) {
      levelUpEnemy(enemy);
      enemy.levelTimer = randomBetween(12, 18);
      showMessage(`${enemy.character.name} REACHED LEVEL ${enemy.level}!`, 1.2);
    }
    updateEnemyStatus(enemy);
    enemy.fireTimer -= dt;
    if (distance < 8.5 && enemy.fireTimer <= 0) {
      enemyFire(enemy, target);
      enemy.fireTimer = enemy.fireInterval;
    }
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.mesh.scale.setScalar(enemy.hitFlash > 0 ? 1.1 : 1);
    if (distance < player.radius + enemy.radius + 0.14) {
      if (activeCharacter.bodyDamage) {
        enemy.health -= activeCharacter.bodyDamage * (1 + (playerLevel - 1) * 0.12) * dt;
        updateEnemyStatus(enemy);
        if (enemy.health <= 0) removeEnemy(enemy);
      }
      damagePlayer(enemy.bodyDamage * dt);
      if (!running) return;
    }
    const nearbyAlly = allies.find((ally) => Math.hypot(ally.x - enemy.x, ally.y - enemy.y) < ally.radius + enemy.radius + 0.12);
    if (nearbyAlly) {
      nearbyAlly.health -= enemy.bodyDamage * dt;
      updateEnemyStatus(nearbyAlly);
      if (nearbyAlly.health <= 0) removeAlly(nearbyAlly);
    }
  }
}

function updateAllies(dt) {
  for (let index = allies.length - 1; index >= 0; index--) {
    const ally = allies[index];
    if (enemies.length === 0) continue;
    let target = enemies[0];
    let distance = Math.hypot(target.x - ally.x, target.y - ally.y);
    for (const enemy of enemies) {
      const candidateDistance = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
      if (candidateDistance < distance) {
        target = enemy;
        distance = candidateDistance;
      }
    }
    if (distance > ally.radius + target.radius + 0.08) {
      const dx = (target.x - ally.x) / distance * ally.speed * dt;
      const dy = (target.y - ally.y) / distance * ally.speed * dt;
      tryMove(ally, dx, dy);
    } else {
      target.health -= ally.damage * dt;
      target.hitFlash = 0.1;
      updateEnemyStatus(target);
      if (target.health <= 0) removeEnemy(target);
    }
    ally.mesh.position.set(ally.x, ally.y, 0.05);
    ally.mesh.rotation.z = Math.atan2(target.y - ally.y, target.x - ally.x);
    updateEnemyStatus(ally);
  }
}

function updateBullets(dt) {
  const intercepted = new Set();
  for (const bullet of bullets) {
    if (!bullet) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    bullet.mesh.position.set(bullet.x, bullet.y, 0.55);
  }

  for (let i = 0; i < bullets.length; i++) {
    const first = bullets[i];
    if (!first) continue;
    if (intercepted.has(first)) continue;
    for (let j = i + 1; j < bullets.length; j++) {
      const second = bullets[j];
      if (!second) continue;
      if (intercepted.has(second) || first.owner === second.owner) continue;
      if (Math.hypot(first.x - second.x, first.y - second.y) > first.radius + second.radius) continue;

      const burstColor = first.damage >= second.damage ? first.mesh.material.color : second.mesh.material.color;
      makeBurst((first.x + second.x) * 0.5, (first.y + second.y) * 0.5, burstColor, 4);
      if (first.damage > second.damage) intercepted.add(second);
      else if (second.damage > first.damage) intercepted.add(first);
      else {
        intercepted.add(first);
        intercepted.add(second);
      }
      if (intercepted.has(first)) break;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet) continue;
    let remove = intercepted.has(bullet) || bullet.life <= 0
      || Math.abs(bullet.x) > arenaBounds.x + 1
      || Math.abs(bullet.y) > arenaBounds.y + 1;
    if (!remove && obstacles.some((obstacle) => circleHitsObstacle(bullet.x, bullet.y, bullet.radius, obstacle))) remove = true;

    if (!remove && bullet.owner === 'player') {
      for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        const enemy = enemies[enemyIndex];
        if (!bullet.hitTargets.has(enemy) && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius) {
          enemy.health -= bullet.damage;
          updateEnemyStatus(enemy);
          bullet.hitTargets.add(enemy);
          enemy.hitFlash = 0.12;
          makeBurst(bullet.x, bullet.y, bullet.mesh.material.color, 3);
          if (enemy.health <= 0) removeEnemy(enemy);
          if (bullet.splash > 0) {
            for (let splashIndex = enemies.length - 1; splashIndex >= 0; splashIndex--) {
              const nearby = enemies[splashIndex];
              const splashDistance = Math.hypot(nearby.x - bullet.x, nearby.y - bullet.y);
              if (nearby !== enemy && splashDistance < bullet.splash) {
                nearby.health -= bullet.damage * (1 - splashDistance / bullet.splash) * 0.72;
                updateEnemyStatus(nearby);
                nearby.hitFlash = 0.12;
                if (nearby.health <= 0) removeEnemy(nearby);
              }
            }
          }
          remove = !bullet.pierce;
          if (remove) break;
        }
      }
    } else if (!remove && bullet.owner === 'enemy') {
      const targetEnemy = enemies.find((enemy) => enemy !== bullet.shooter
        && !bullet.hitTargets.has(enemy)
        && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius);
      if (targetEnemy) {
        targetEnemy.health -= bullet.damage;
        bullet.hitTargets.add(targetEnemy);
        targetEnemy.hitFlash = 0.12;
        updateEnemyStatus(targetEnemy);
        makeBurst(bullet.x, bullet.y, bullet.mesh.material.color, 4);
        if (targetEnemy.health <= 0) removeEnemy(targetEnemy, false);
        if (bullet.splash > 0) {
          for (const nearby of [...enemies]) {
            if (nearby === targetEnemy || nearby === bullet.shooter) continue;
            const splashDistance = Math.hypot(nearby.x - bullet.x, nearby.y - bullet.y);
            if (splashDistance >= bullet.splash) continue;
            nearby.health -= bullet.damage * (1 - splashDistance / bullet.splash) * 0.72;
            updateEnemyStatus(nearby);
            if (nearby.health <= 0) removeEnemy(nearby, false);
          }
          const playerDistance = Math.hypot(player.x - bullet.x, player.y - bullet.y);
          if (playerDistance < bullet.splash) {
            damagePlayer(bullet.damage * (1 - playerDistance / bullet.splash) * 0.72);
            if (!running) return;
          }
        }
        remove = !bullet.pierce;
      } else {
        const targetAlly = allies.find((ally) => !bullet.hitTargets.has(ally)
          && Math.hypot(ally.x - bullet.x, ally.y - bullet.y) < ally.radius + bullet.radius);
        if (targetAlly) {
          targetAlly.health -= bullet.damage;
          bullet.hitTargets.add(targetAlly);
          updateEnemyStatus(targetAlly);
          makeBurst(bullet.x, bullet.y, bullet.mesh.material.color, 4);
          if (targetAlly.health <= 0) removeAlly(targetAlly);
          remove = !bullet.pierce;
        } else if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < player.radius + bullet.radius) {
        damagePlayer(bullet.damage);
        makeBurst(bullet.x, bullet.y, bullet.mesh.material.color, 4);
        remove = !bullet.pierce;
        if (!running) return;
        }
      }
    }

    if (remove) {
      removeActor(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

function removeEnemy(enemy, creditedToPlayer = true) {
  const enemyIndex = enemies.indexOf(enemy);
  if (enemyIndex < 0) return;
  makeBurst(enemy.x, enemy.y, '#ff8eb2', 12);
  removeEnemyActors(enemy);
  enemies.splice(enemyIndex, 1);
  if (!creditedToPlayer) return;
  kills++;
  killsText.textContent = String(kills).padStart(2, '0');
  const levelGain = Math.max(1, Math.floor(enemy.level / 10));
  playerLevel += levelGain;
  player.speed = Math.min(3.4, player.speed * Math.pow(1.01, levelGain));
  playerMaxHealth += 25 * levelGain;
  playerHealth = Math.min(playerMaxHealth, playerHealth + 25 * levelGain);
  updateHealth();
  showMessage(`+${levelGain} LEVELS! SPEED, DAMAGE & HEALTH UP`, 1.7);
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.life -= dt;
    effect.mesh.position.x += effect.vx * dt;
    effect.mesh.position.y += effect.vy * dt;
    effect.mesh.scale.setScalar(Math.max(0.05, effect.life / effect.maxLife));
    effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife);
    if (effect.life <= 0) {
      removeActor(effect.mesh);
      effects.splice(i, 1);
    }
  }
}

function update(dt) {
  elapsed += dt;
  updatePlayer(dt);
  if (!running) return;
  updateEnemies(dt);
  if (!running) return;
  updateAllies(dt);
  if (!running) return;
  updateBullets(dt);
  if (!running) return;
  updateEffects(dt);
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < 7) {
    spawnEnemy();
    spawnTimer = Math.max(0.72, 2.15 - elapsed * 0.008);
  }
  hitFlash = Math.max(0, hitFlash - dt);
  muzzleTimer = Math.max(0, muzzleTimer - dt);
  messageTimer = Math.max(0, messageTimer - dt);
  if (messageTimer === 0) battleBanner.hidden = true;
}

function render() {
  if (muzzleTimer > 0 && playerMesh) fillLight.intensity = 95;
  else fillLight.intensity = 55;
  renderer.render(scene, camera);
}

function gameLoop(timestamp) {
  if (!running) return;
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.04);
  lastTime = timestamp;
  update(dt);
  render();
  if (running) requestAnimationFrame(gameLoop);
}

function onPointerMove(event) {
  aimAtPointer(event);
  if (playerMesh && running) playerMesh.rotation.z = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
}

playButton.addEventListener('click', startBattle);
for (const select of [characterSelect, weaponSelect, mapSelect]) select.addEventListener('change', updateLoadoutLabels);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerdown', (event) => {
  if (!running) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  pointerDown = true;
  aimAtPointer(event);
  fireWeapon();
});
window.addEventListener('pointerup', () => { pointerDown = false; });
window.addEventListener('pointercancel', () => { pointerDown = false; });
window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  controls.add(event.code);
});
window.addEventListener('keyup', (event) => controls.delete(event.code));
window.addEventListener('blur', () => { controls.clear(); pointerDown = false; });
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);
updateLoadoutLabels();
setupArena(activeMap);
resize();
