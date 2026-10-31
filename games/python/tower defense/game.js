import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.querySelector('#gameCanvas');
const towerList = document.querySelector('#towerList');
const waveButton = document.querySelector('#waveButton');
const waveButtonSub = document.querySelector('#waveButtonSub');
const beginButton = document.querySelector('#beginButton');
const overlay = document.querySelector('#overlay');
const toast = document.querySelector('#toast');
const towerCount = document.querySelector('#towerCount');
const moneyValue = document.querySelector('#moneyValue');
const livesValue = document.querySelector('#livesValue');
const integrityBar = document.querySelector('#integrityBar');
const waveValue = document.querySelector('#waveValue');
const killsValue = document.querySelector('#killsValue');
const statusLabel = document.querySelector('#statusLabel');
const selectedName = document.querySelector('#selectedName');
const selectedStats = document.querySelector('#selectedStats');
const upgradeButton = document.querySelector('#upgradeButton');
const sellButton = document.querySelector('#sellButton');

const BASE_LIVES = 20;
const FIELD = { halfX: 9.7, halfZ: 6.7, roadWidth: 1.08 };
const COLORS = {
  mint: 0x81f2be, gold: 0xffcf77, blue: 0x67b1ff, purple: 0xc18bff,
  red: 0xff697d, white: 0xeff8f5, cyan: 0x68edf4, orange: 0xff9e5c,
};
const TOWERS = {
  dart: { name: 'Dart Tower', key: '1', cost: 75, range: 3.4, rate: 0.52, damage: 24, color: 0x67b1ff, icon: '➤', desc: 'Quick, reliable shots', shotSpeed: 12 },
  cannon: { name: 'Cannon Tower', key: '2', cost: 125, range: 3.05, rate: 1.15, damage: 68, color: 0xffcf77, icon: '◉', desc: 'Heavy impact splash', splash: 1.05, shotSpeed: 8 },
  frost: { name: 'Frost Tower', key: '3', cost: 105, range: 3.25, rate: 0.9, damage: 22, color: 0xc18bff, icon: '❄', desc: 'Slows enemy movement', slow: 2.4, shotSpeed: 9 },
  sniper: { name: 'Sniper Tower', key: '4', cost: 145, range: 5.15, rate: 1.55, damage: 126, color: 0xff8e6f, icon: '⌖', desc: 'Long-range heavy shot', shotSpeed: 18 },
  arc: { name: 'Arc Tower', key: '5', cost: 160, range: 3.25, rate: 1.0, damage: 38, color: 0x68edf4, icon: 'ϟ', desc: 'Chains to nearby targets', chains: 3, chainRadius: 1.65, shotSpeed: 12 },
  mortar: { name: 'Mortar Tower', key: '6', cost: 185, range: 4.45, rate: 1.8, damage: 95, color: 0xff9e5c, icon: '◍', desc: 'Long-range area blast', splash: 1.45, shotSpeed: 6 },
  ultra: { name: 'Ultra Tower', key: '7', cost: 700, range: 5.0, rate: 1.35, damage: 210, color: 0xff5be2, icon: '✹', desc: 'Omnidirectional combo blast', splash: 2.1, chains: 5, chainRadius: 1.8, slow: 2.2, radial: true },
};

// 3D ground coordinates are (x, z); enemies follow the route in order.
const PATH = [
  new THREE.Vector3(-10.2, 0, -4.25),
  new THREE.Vector3(-5.4, 0, -4.25),
  new THREE.Vector3(-5.4, 0, 0.7),
  new THREE.Vector3(-1.3, 0, 0.7),
  new THREE.Vector3(-1.3, 0, -3.2),
  new THREE.Vector3(3.0, 0, -3.2),
  new THREE.Vector3(3.0, 0, 4.5),
  new THREE.Vector3(10.2, 0, 4.5),
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1c21');
scene.fog = new THREE.Fog('#0b1c21', 27, 47);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 19.5, 20.5);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#d5fff1', '#233641', 2.15));
const sunlight = new THREE.DirectionalLight('#fff0cb', 3.2);
sunlight.position.set(-7, 15, 8);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -16;
sunlight.shadow.camera.right = 16;
sunlight.shadow.camera.top = 15;
sunlight.shadow.camera.bottom = -15;
scene.add(sunlight);
const mintLight = new THREE.PointLight('#78f5bd', 34, 20);
mintLight.position.set(-8, 5, -5);
scene.add(mintLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 16),
  new THREE.MeshStandardMaterial({ color: '#14302b', roughness: 0.92, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = -0.07;
scene.add(ground);

const grid = new THREE.GridHelper(22, 22, '#28554b', '#1d403a');
grid.position.y = -0.045;
grid.material.transparent = true;
grid.material.opacity = 0.32;
scene.add(grid);

const world = new THREE.Group();
const towerLayer = new THREE.Group();
const enemyLayer = new THREE.Group();
const projectileLayer = new THREE.Group();
const effectLayer = new THREE.Group();
scene.add(world, towerLayer, enemyLayer, projectileLayer, effectLayer);

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
const tempColor = new THREE.Color();

function standard(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.54, metalness: 0.28, ...extras });
}
function addMesh(parent, geometry, material, position, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function roundedBox(width, height, depth, color, position, parent, radius = 0.1) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = addMesh(parent, geometry, standard(color, { roughness: 0.65 }), position);
  mesh.userData.cornerRadius = radius;
  return mesh;
}

function buildMap() {
  const roadMat = standard('#506f5d', { roughness: 0.95 });
  const roadEdgeMat = standard('#29483c', { roughness: 1 });
  for (let index = 0; index < PATH.length - 1; index++) {
    const from = PATH[index];
    const to = PATH[index + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const angle = -Math.atan2(dz, dx);
    for (const [width, material, y] of [[1.34, roadEdgeMat, 0.0], [1.08, roadMat, 0.015]]) {
      const segment = new THREE.Mesh(new THREE.BoxGeometry(length + width * 0.38, 0.09, width), material);
      segment.position.set((from.x + to.x) / 2, y, (from.z + to.z) / 2);
      segment.rotation.y = angle;
      segment.receiveShadow = true;
      world.add(segment);
    }
    for (const corner of [from, to]) {
      const cornerMat = materialClone(roadMat);
      addMesh(world, new THREE.CylinderGeometry(0.54, 0.54, 0.09, 24), cornerMat, [corner.x, 0.015, corner.z], false);
    }
  }
  // Repeated terrain details add depth without interfering with placements.
  const rocksMat = standard('#274640', { roughness: 0.95 });
  for (let i = 0; i < 36; i++) {
    const x = (Math.random() - 0.5) * 20.5;
    const z = (Math.random() - 0.5) * 14.8;
    if (distanceToPath(x, z) < 1.25) continue;
    const size = 0.07 + Math.random() * 0.13;
    const pebble = addMesh(world, new THREE.DodecahedronGeometry(size, 0), rocksMat, [x, 0.015, z], false);
    pebble.rotation.set(Math.random(), Math.random(), Math.random());
  }
  // Entry pylon and protected command core.
  const entry = addMesh(world, new THREE.CylinderGeometry(0.22, 0.28, 0.34, 8), standard('#82f2bf', { emissive: '#245b46' }), [PATH[0].x + 0.3, 0.24, PATH[0].z], false);
  entry.rotation.z = Math.PI / 2;
  const base = new THREE.Group();
  base.position.set(PATH.at(-1).x - 0.35, 0, PATH.at(-1).z);
  world.add(base);
  addMesh(base, new THREE.CylinderGeometry(0.62, 0.8, 0.3, 8), standard('#52283b'), [0, 0.16, 0]);
  const core = addMesh(base, new THREE.OctahedronGeometry(0.42, 0), standard('#ff627f', { emissive: '#8f1e42', emissiveIntensity: 1.2 }), [0, 0.72, 0]);
  core.userData.isCore = true;
  world.userData.core = core;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.045, 8, 40), new THREE.MeshBasicMaterial({ color: '#ff748a' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.025;
  base.add(ring);
  for (const [x, z] of [[-9.6, -6.2], [-8.7, 5.8], [0.2, 6.2], [8.8, -6.1]]) {
    const pillar = new THREE.Group();
    pillar.position.set(x, 0, z);
    world.add(pillar);
    addMesh(pillar, new THREE.CylinderGeometry(0.14, 0.23, 0.72, 6), standard('#263b3d'), [0, 0.36, 0]);
    const glow = addMesh(pillar, new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: '#61cda1' }), [0, 0.79, 0], false);
    glow.userData.pulse = Math.random() * Math.PI * 2;
  }
}
function materialClone(mat) { return mat.clone(); }

const state = {
  towers: [], enemies: [], projectiles: [], effects: [],
  money: 1000, lives: BASE_LIVES, wave: 0, kills: 0,
  running: false, gameOver: false, waveActive: false, spawnQueue: 0, spawnTimer: 0,
  selectedKind: 'dart', selectedTower: null, previewTower: null,
  toastTimer: 0, lastTime: 0, elapsed: 0,
};

function distanceToPath(x, z) {
  let nearest = Infinity;
  for (let index = 0; index < PATH.length - 1; index++) {
    const a = PATH[index];
    const b = PATH[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / lengthSq, 0, 1);
    nearest = Math.min(nearest, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
  }
  return nearest;
}

function createTowerModel(kind, ghost = false) {
  const spec = TOWERS[kind];
  const root = new THREE.Group();
  const tint = tempColor.set(spec.color).getHex();
  const shell = standard(tint, { metalness: 0.54, roughness: 0.32, emissive: tint, emissiveIntensity: ghost ? 0.13 : 0.08, transparent: ghost, opacity: ghost ? 0.52 : 1 });
  const dark = standard('#263a45', { metalness: 0.68, roughness: 0.38, transparent: ghost, opacity: ghost ? 0.52 : 1 });
  addMesh(root, new THREE.CylinderGeometry(0.42, 0.52, 0.22, 10), dark, [0, 0.12, 0]);
  addMesh(root, new THREE.CylinderGeometry(0.33, 0.4, 0.14, 10), shell, [0, 0.29, 0]);
  const core = addMesh(root, new THREE.CylinderGeometry(0.2, 0.28, 0.36, kind === 'frost' ? 8 : 10), shell, [0, 0.53, 0]);
  const barrel = addMesh(root, new THREE.CylinderGeometry(0.1, 0.13, kind === 'sniper' ? 0.83 : 0.56, 8), dark, [0.1, 0.66, -0.18]);
  barrel.rotation.x = Math.PI / 2;
  barrel.rotation.z = -0.36;
  if (kind === 'cannon' || kind === 'mortar') {
    addMesh(root, new THREE.SphereGeometry(0.26, 12, 10), shell, [0, 0.68, 0]);
  } else if (kind === 'frost') {
    const crystal = addMesh(root, new THREE.OctahedronGeometry(0.29, 0), shell, [0, 0.86, 0]);
    crystal.userData.rotating = true;
  } else if (kind === 'arc') {
    for (let i = 0; i < 3; i++) {
      const pylon = addMesh(root, new THREE.ConeGeometry(0.1, 0.32, 6), shell, [Math.cos(i * 2.094) * 0.25, 0.84, Math.sin(i * 2.094) * 0.25]);
      pylon.userData.rotating = true;
    }
  } else if (kind === 'ultra') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 8, 32), shell);
    ring.position.y = 0.8;
    root.add(ring);
    ring.userData.rotating = true;
    for (let i = 0; i < 8; i++) {
      const spike = addMesh(root, new THREE.ConeGeometry(0.09, 0.28, 5), shell, [Math.sin(i * Math.PI / 4) * 0.42, 0.81, Math.cos(i * Math.PI / 4) * 0.42]);
      spike.userData.rotating = true;
    }
  }
  root.traverse((node) => { if (node.isMesh) node.castShadow = true; });
  root.userData.core = core;
  return root;
}

function createRangeRing(tower) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(tower.stats.range, 0.018, 6, 96),
    new THREE.MeshBasicMaterial({ color: TOWERS[tower.kind].color, transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(tower.x, 0.045, tower.z);
  scene.add(ring);
  return ring;
}

function clearRangeRing() {
  if (!state.rangeRing) return;
  scene.remove(state.rangeRing);
  state.rangeRing.geometry.dispose();
  state.rangeRing.material.dispose();
  state.rangeRing = null;
}

function addTower(kind, x, z) {
  const spec = TOWERS[kind];
  if (distanceToPath(x, z) < FIELD.roadWidth / 2 + 0.45) return notify('Cannot build on the route.');
  if (state.towers.some((tower) => Math.hypot(tower.x - x, tower.z - z) < 1.05)) return notify('Leave more space between towers.');
  if (state.money < spec.cost) return notify('Not enough supply credits.');
  const tower = { kind, x, z, level: 1, cooldown: 0, target: null, mesh: createTowerModel(kind) };
  Object.defineProperty(tower, 'stats', {
    get() {
      return {
        range: spec.range + (this.level - 1) * 0.32,
        rate: Math.max(0.18, spec.rate * (0.9 ** (this.level - 1))),
        damage: spec.damage * (1 + (this.level - 1) * 0.52),
      };
    },
  });
  tower.mesh.position.set(x, 0, z);
  towerLayer.add(tower.mesh);
  state.towers.push(tower);
  state.money -= spec.cost;
  selectTower(tower);
  updateHud();
  notify(`${spec.name} deployed.`);
}

function selectTower(tower) {
  state.selectedTower = tower;
  clearRangeRing();
  if (tower) state.rangeRing = createRangeRing(tower);
  updateSelectionPanel();
}

function towerUpgradeCost(tower) { return 85 + tower.level * 65; }
function upgradeTower() {
  const tower = state.selectedTower;
  if (!tower) return;
  const cost = towerUpgradeCost(tower);
  if (tower.level >= 5) return notify('This tower is at maximum level.');
  if (state.money < cost) return notify('Not enough credits to upgrade.');
  state.money -= cost;
  tower.level++;
  tower.mesh.scale.setScalar(1 + (tower.level - 1) * 0.055);
  selectTower(tower);
  updateHud();
  notify(`${TOWERS[tower.kind].name} upgraded to level ${tower.level}.`);
}
function sellTower() {
  const tower = state.selectedTower;
  if (!tower) return;
  state.money += Math.floor(TOWERS[tower.kind].cost * 0.62 + (tower.level - 1) * 50);
  towerLayer.remove(tower.mesh);
  disposeObject(tower.mesh);
  state.towers.splice(state.towers.indexOf(tower), 1);
  selectTower(null);
  updateHud();
  notify('Tower sold. Credits refunded.');
}

function spawnEnemy() {
  const scale = 1.26 ** (state.wave - 1);
  const roll = Math.random();
  let type = 'grunt';
  if (state.wave % 5 === 0 && state.spawnQueue === 1) type = 'boss';
  else if (state.wave >= 6 && roll < 0.18) type = 'shielded';
  else if (state.wave >= 5 && roll < 0.38) type = 'regenerator';
  else if (state.wave >= 4 && roll < 0.58) type = 'armored';
  else if (state.wave >= 3 && roll < 0.78) type = 'runner';
  const specs = {
    grunt: { hp: 170, speed: 2.4, reward: 18 + state.wave, color: '#ff697d', trait: 'GRUNT' },
    runner: { hp: 96, speed: 4.1 + state.wave * 0.025, reward: 16, color: '#d271ff', trait: 'RUNNER' },
    armored: { hp: 260, speed: 1.85, reward: 36 + state.wave, color: '#91b5cd', armor: 0.48, trait: 'ARMORED' },
    regenerator: { hp: 210, speed: 2.0, reward: 34 + state.wave, color: '#76f6b0', regen: 9 * scale, trait: 'REGEN' },
    shielded: { hp: 300, speed: 2.2, reward: 42 + state.wave, color: '#ffd36e', armor: 0.58, trait: 'SHIELDED' },
    boss: { hp: 1250, speed: 1.75, reward: 100 + state.wave * 2, color: '#ff824e', armor: 0.18, trait: 'BOSS' },
  }[type];
  const enemy = {
    type, trait: specs.trait, x: PATH[0].x, z: PATH[0].z, segment: 0, progress: 0,
    hp: specs.hp * scale, maxHp: specs.hp * scale, speed: specs.speed + state.wave * (type === 'runner' ? 0.09 : 0.035),
    reward: specs.reward, armor: specs.armor || 0, regen: specs.regen || 0, slow: 0,
    mesh: createEnemyModel(type, specs.color), healthSprite: createHealthSprite(),
  };
  enemy.mesh.position.set(enemy.x, 0, enemy.z);
  enemy.healthSprite.position.set(enemy.x, 1.05, enemy.z);
  enemy.healthSprite.scale.set(type === 'boss' ? 1.35 : 0.9, 0.19, 1);
  enemyLayer.add(enemy.mesh, enemy.healthSprite);
  state.enemies.push(enemy);
  state.spawnQueue--;
}

function createEnemyModel(type, color) {
  const root = new THREE.Group();
  const material = standard(color, { metalness: 0.22, roughness: 0.38, emissive: color, emissiveIntensity: type === 'boss' ? 0.3 : 0.08 });
  const radius = type === 'boss' ? 0.57 : type === 'armored' || type === 'shielded' ? 0.42 : 0.34;
  const body = addMesh(root, new THREE.SphereGeometry(radius, 16, 12), material, [0, radius + 0.12, 0]);
  body.scale.y = type === 'boss' ? 1.35 : 1;
  if (type === 'boss') {
    addMesh(root, new THREE.ConeGeometry(0.2, 0.42, 6), standard('#ffe1a0'), [-0.25, 0.95, 0]);
    addMesh(root, new THREE.ConeGeometry(0.2, 0.42, 6), standard('#ffe1a0'), [0.25, 0.95, 0]);
  }
  if (type === 'armored' || type === 'shielded') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.12, 0.045, 6, 24), standard(type === 'shielded' ? '#fff0a5' : '#c7e8ff', { emissive: color, emissiveIntensity: 0.25 }));
    ring.position.y = radius + 0.2;
    root.add(ring);
  }
  if (type === 'regenerator') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.13, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: '#8affbc' }));
    ring.position.y = 0.18;
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
  }
  if (type === 'runner') {
    const fin = addMesh(root, new THREE.ConeGeometry(0.16, 0.4, 5), material, [0, radius + 0.5, 0]);
    fin.rotation.x = Math.PI;
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.2, 18), new THREE.MeshBasicMaterial({ color: '#071414', transparent: true, opacity: 0.38 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);
  return root;
}

function createHealthSprite() {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshBasicMaterial({ color: '#12201f', depthTest: false, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.075), new THREE.MeshBasicMaterial({ color: '#83f0bd', depthTest: false, depthWrite: false }));
  fill.position.z = 0.01;
  group.add(bg, fill);
  group.userData.fill = fill;
  group.quaternion.copy(camera.quaternion);
  return group;
}

function updateEnemyHealth(enemy) {
  const ratio = THREE.MathUtils.clamp(enemy.hp / enemy.maxHp, 0, 1);
  const fill = enemy.healthSprite.userData.fill;
  fill.scale.x = ratio;
  fill.position.x = -0.43 * (1 - ratio);
  fill.material.color.set(ratio < 0.3 ? '#ff6578' : enemy.trait === 'REGEN' ? '#83f0bd' : '#ffbd73');
}

function updateEnemyPath(enemy, dt) {
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt);
  enemy.slow = Math.max(0, enemy.slow - dt);
  let travel = enemy.speed * (enemy.slow > 0 ? 0.48 : 1) * dt;
  while (travel > 0 && enemy.segment < PATH.length - 1) {
    const a = PATH[enemy.segment];
    const b = PATH[enemy.segment + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const remaining = length - enemy.progress;
    const step = Math.min(travel, remaining);
    enemy.progress += step;
    travel -= step;
    const t = enemy.progress / length;
    enemy.x = THREE.MathUtils.lerp(a.x, b.x, t);
    enemy.z = THREE.MathUtils.lerp(a.z, b.z, t);
    if (enemy.progress >= length - 0.0001) {
      enemy.segment++;
      enemy.progress = 0;
    }
  }
  enemy.mesh.position.set(enemy.x, 0, enemy.z);
  enemy.healthSprite.position.set(enemy.x, enemy.trait === 'BOSS' ? 1.55 : 1.08, enemy.z);
  enemy.healthSprite.quaternion.copy(camera.quaternion);
  if (enemy.mesh.children[0]) enemy.mesh.children[0].rotation.y += dt * (enemy.trait === 'RUNNER' ? 4 : 1.3);
  updateEnemyHealth(enemy);
  return enemy.segment >= PATH.length - 1;
}

function updateWaves(dt) {
  if (!state.waveActive) return;
  state.spawnTimer -= dt;
  if (state.spawnQueue > 0 && state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.2, 0.56 - state.wave * 0.022);
  }
  if (state.spawnQueue === 0 && state.enemies.length === 0) {
    state.waveActive = false;
    state.money += 28 + state.wave * 5;
    updateHud();
    notify(`WAVE ${state.wave} CLEARED · BONUS CREDITS AWARDED`);
  }
}

function launchWave() {
  if (!state.running || state.gameOver || state.waveActive) return;
  state.wave++;
  state.waveActive = true;
  state.spawnQueue = 9 + state.wave * 3;
  state.spawnTimer = 0.2;
  statusLabel.textContent = `WAVE ${String(state.wave).padStart(2, '0')} IN PROGRESS`;
  waveButtonSub.textContent = 'ENEMIES APPROACHING';
  waveButton.disabled = true;
  updateHud();
  notify(`WAVE ${state.wave} INCOMING`);
}

function handleEnemyDefeat(enemy) {
  if (!state.enemies.includes(enemy)) return;
  state.money += enemy.reward;
  state.kills++;
  removeEnemy(enemy);
  updateHud();
}
function removeEnemy(enemy) {
  const index = state.enemies.indexOf(enemy);
  if (index < 0) return;
  state.enemies.splice(index, 1);
  enemyLayer.remove(enemy.mesh, enemy.healthSprite);
  disposeObject(enemy.mesh);
  disposeObject(enemy.healthSprite);
}
function damageEnemy(enemy, damage) {
  enemy.hp -= damage * (1 - enemy.armor);
  if (enemy.hp <= 0) handleEnemyDefeat(enemy);
  else updateEnemyHealth(enemy);
}
function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        material.map?.dispose();
        material.dispose();
      }
    }
  });
}

function makeArc(points, color, lifetime = 0.22) {
  if (points.length < 2) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, 0.38, point.z)));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geometry, material);
  effectLayer.add(line);
  state.effects.push({ object: line, life: lifetime, maxLife: lifetime });
}

function createProjectile(tower, target, spec, damageMultiplier = 1, chainCount = spec.chains || 0) {
  const material = standard(spec.color, { emissive: spec.color, emissiveIntensity: 1.5, roughness: 0.25 });
  const shape = spec.kind === 'sniper' ? new THREE.OctahedronGeometry(0.13, 0) : new THREE.SphereGeometry(spec.kind === 'cannon' || spec.kind === 'mortar' ? 0.17 : 0.1, 10, 8);
  const mesh = new THREE.Mesh(shape, material);
  mesh.position.set(tower.x, 0.72, tower.z);
  projectileLayer.add(mesh);
  state.projectiles.push({
    mesh, tower, target, speed: spec.shotSpeed || 10,
    damage: tower.stats.damage * damageMultiplier,
    splash: spec.splash || 0, slow: spec.slow || 0,
    chains: chainCount, chainRadius: spec.chainRadius || 0,
    kind: spec.kind,
  });
}

function fireTower(tower) {
  const spec = TOWERS[tower.kind];
  const range = tower.stats.range;
  const targets = state.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - tower.x, enemy.z - tower.z) <= range);
  if (!targets.length) return;
  targets.sort((a, b) => b.segment - a.segment || b.progress - a.progress);
  const target = targets[0];
  tower.target = target;
  if (spec.radial) {
    fireUltra(tower, targets, spec);
    return;
  }
  createProjectile(tower, target, { ...spec, kind: tower.kind });
}

function fireUltra(tower, targets, spec) {
  const inBlast = targets.filter((enemy) => Math.hypot(enemy.x - tower.x, enemy.z - tower.z) <= tower.stats.range);
  for (const enemy of inBlast) {
    damageEnemy(enemy, tower.stats.damage);
    if (enemy.hp > 0) enemy.slow = Math.max(enemy.slow, spec.slow);
  }
  // The initial shockwave is radial. Each hit can chain to several nearby enemies.
  const visited = new Set(inBlast);
  let frontier = [...inBlast];
  const arcs = [];
  for (let hop = 0; hop < (spec.chains || 0); hop++) {
    const next = [];
    for (const source of frontier) {
      const candidates = state.enemies
        .filter((enemy) => enemy.hp > 0 && !visited.has(enemy) && Math.hypot(enemy.x - source.x, enemy.z - source.z) <= spec.chainRadius)
        .sort((a, b) => Math.hypot(a.x - source.x, a.z - source.z) - Math.hypot(b.x - source.x, b.z - source.z))
        .slice(0, 2);
      for (const target of candidates) {
        visited.add(target);
        next.push(target);
        arcs.push({ x: source.x, z: source.z }, { x: target.x, z: target.z });
        damageEnemy(target, tower.stats.damage * 0.65);
        if (target.hp > 0) target.slow = Math.max(target.slow, spec.slow);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(tower.stats.range, 0.055, 8, 64), new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(tower.x, 0.18, tower.z);
  effectLayer.add(ring);
  state.effects.push({ object: ring, life: 0.48, maxLife: 0.48 });
  if (arcs.length) {
    for (let index = 0; index < arcs.length; index += 2) makeArc([arcs[index], arcs[index + 1]], spec.color, 0.28);
  }
}

function tick(dt) {
  if (!state.running || state.gameOver) return;
  state.elapsed += dt;
  for (const enemy of [...state.enemies]) {
    const escaped = updateEnemyPath(enemy, dt);
    if (escaped) {
      state.lives--;
      removeEnemy(enemy);
      notify('ENEMY REACHED THE CORE · BASE DAMAGED');
      updateHud();
    }
  }
  for (const tower of state.towers) {
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown <= 0) {
      fireTower(tower);
      tower.cooldown = tower.stats.rate;
    }
    animateTower(tower, dt);
  }
  updateProjectiles(dt);
  for (const effect of [...state.effects]) {
    effect.life -= dt;
    effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
    if (effect.life <= 0) {
      effectLayer.remove(effect.object);
      effect.object.geometry.dispose();
      effect.object.material.dispose();
      state.effects.splice(state.effects.indexOf(effect), 1);
    }
  }
  updateWaves(dt);
  animateWorld(dt);
  if (state.lives <= 0) endGame();
  if (state.toastTimer > 0) state.toastTimer -= dt;
}

function updateProjectiles(dt) {
  for (const projectile of [...state.projectiles]) {
    if (!state.enemies.includes(projectile.target) || projectile.target.hp <= 0) {
      removeProjectile(projectile);
      continue;
    }
    const destination = new THREE.Vector3(projectile.target.x, 0.68, projectile.target.z);
    const direction = destination.clone().sub(projectile.mesh.position);
    const distance = direction.length();
    const step = projectile.speed * dt;
    if (distance <= step + 0.14) {
      projectile.mesh.position.copy(destination);
      resolveProjectile(projectile);
      removeProjectile(projectile);
    } else {
      projectile.mesh.position.add(direction.normalize().multiplyScalar(step));
    }
  }
}
function resolveProjectile(projectile) {
  const target = projectile.target;
  if (projectile.splash > 0) {
    for (const enemy of [...state.enemies]) {
      if (Math.hypot(enemy.x - target.x, enemy.z - target.z) <= projectile.splash) {
        damageEnemy(enemy, projectile.damage);
        if (enemy.hp > 0 && projectile.slow) enemy.slow = Math.max(enemy.slow, projectile.slow);
      }
    }
  } else {
    damageEnemy(target, projectile.damage);
    if (target.hp > 0 && projectile.slow) target.slow = Math.max(target.slow, projectile.slow);
  }
  if (projectile.chains > 0 && state.enemies.includes(target)) {
    let source = target;
    const visited = new Set([target]);
    for (let i = 0; i < projectile.chains; i++) {
      const next = state.enemies.filter((enemy) => !visited.has(enemy) && Math.hypot(enemy.x - source.x, enemy.z - source.z) <= projectile.chainRadius)
        .sort((a, b) => Math.hypot(a.x - source.x, a.z - source.z) - Math.hypot(b.x - source.x, b.z - source.z))[0];
      if (!next) break;
      visited.add(next);
      makeArc([{ x: source.x, z: source.z }, { x: next.x, z: next.z }], projectile.mesh.material.color, 0.22);
      damageEnemy(next, projectile.damage * 0.72);
      source = next;
    }
  }
}
function removeProjectile(projectile) {
  projectileLayer.remove(projectile.mesh);
  disposeObject(projectile.mesh);
  const index = state.projectiles.indexOf(projectile);
  if (index >= 0) state.projectiles.splice(index, 1);
}

function animateTower(tower, dt) {
  for (const child of tower.mesh.children) {
    if (child.userData.rotating) child.rotation.y += dt * (tower.kind === 'ultra' ? 1.7 : 0.9);
  }
  if (tower.target && state.enemies.includes(tower.target)) {
    const dx = tower.target.x - tower.x;
    const dz = tower.target.z - tower.z;
    const turret = tower.mesh.userData.core;
    if (turret) turret.rotation.y = Math.atan2(dx, dz);
  }
}
function animateWorld(dt) {
  const core = world.userData.core;
  if (core) {
    core.rotation.y += dt * 0.65;
    core.rotation.x += dt * 0.34;
    core.material.emissiveIntensity = state.lives <= 5 ? 2 : 1.2 + Math.sin(state.elapsed * 2.2) * 0.35;
  }
  world.traverse((object) => {
    if (object.userData.pulse) object.scale.setScalar(0.9 + (Math.sin(state.elapsed * 2 + object.userData.pulse) + 1) * 0.12);
  });
}

function beginGame() {
  if (state.running) return;
  state.running = true;
  overlay.hidden = true;
  statusLabel.textContent = 'PLACE YOUR DEFENSES';
  notify('DEFENSE GRID ONLINE · PLACE TOWERS');
}
function startWave() {
  if (!state.running || state.gameOver || state.waveActive) return;
  state.wave++;
  state.waveActive = true;
  state.spawnQueue = 9 + state.wave * 3;
  state.spawnTimer = 0.2;
  statusLabel.textContent = `WAVE ${String(state.wave).padStart(2, '0')} IN PROGRESS`;
  waveButtonSub.textContent = 'ENEMIES APPROACHING';
  waveButton.disabled = true;
  updateHud();
  notify(`WAVE ${state.wave} INCOMING`);
}
function endGame() {
  state.gameOver = true;
  state.waveActive = false;
  statusLabel.textContent = 'CORE BREACHED';
  waveButton.disabled = true;
  waveButtonSub.textContent = `FINAL WAVE ${state.wave} · ${state.kills} ELIMINATIONS`;
  overlay.hidden = false;
  overlay.querySelector('.overlay-eyebrow').innerHTML = '<i></i> OPERATION FAILED';
  overlay.querySelector('h1').innerHTML = 'CORE<br /><span>BREACHED.</span>';
  overlay.querySelector('p').textContent = `You held through wave ${state.wave} and eliminated ${state.kills} enemies.`;
  beginButton.innerHTML = 'REDEPLOY <b>↻</b>';
  beginButton.onclick = restart;
}
function restart() {
  for (const tower of [...state.towers]) { towerLayer.remove(tower.mesh); disposeObject(tower.mesh); }
  for (const enemy of [...state.enemies]) removeEnemy(enemy);
  for (const projectile of [...state.projectiles]) removeProjectile(projectile);
  clearRangeRing();
  state.towers = []; state.enemies = []; state.projectiles = []; state.effects = [];
  state.money = 1000; state.lives = BASE_LIVES; state.wave = 0; state.kills = 0;
  state.running = false; state.gameOver = false; state.waveActive = false; state.spawnQueue = 0;
  state.selectedTower = null; state.selectedKind = 'dart';
  beginButton.onclick = beginGame;
  beginButton.innerHTML = 'DEPLOY COMMAND <b>→</b>';
  overlay.querySelector('.overlay-eyebrow').innerHTML = '<i></i> OPERATION GREENLIGHT';
  overlay.querySelector('h1').innerHTML = 'HOLD THE<br /><span>FRONTLINE.</span>';
  overlay.querySelector('p').textContent = 'Deploy a defense grid. Survive the escalating enemy waves.';
  overlay.hidden = false;
  renderTowerCards(); updateHud(); updateSelectionPanel();
}
function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  state.toastTimer = 2.2;
}

function renderTowerCards() {
  towerList.replaceChildren();
  for (const [kind, spec] of Object.entries(TOWERS)) {
    const button = document.createElement('button');
    button.className = 'tower-card';
    button.style.setProperty('--tower', `#${tempColor.set(spec.color).getHexString()}`);
    button.innerHTML = `<span class="tower-glyph">${spec.icon}</span><span class="tower-copy"><b>${spec.key} · ${spec.name}</b><small>${spec.desc}</small></span><span class="tower-cost">${spec.cost}¢</span>`;
    button.addEventListener('click', () => {
      state.selectedKind = kind;
      state.selectedTower = null;
      clearRangeRing();
      updateSelectionPanel();
      notify(`${spec.name} selected · click open ground to place`);
    });
    towerList.append(button);
  }
  syncTowerCards();
}
function syncTowerCards() {
  [...towerList.children].forEach((button, index) => {
    const kind = Object.keys(TOWERS)[index];
    button.classList.toggle('selected', kind === state.selectedKind && !state.selectedTower);
    button.disabled = state.money < TOWERS[kind].cost;
  });
}
function updateSelectionPanel() {
  const tower = state.selectedTower;
  if (!tower) {
    selectedName.textContent = 'NO TOWER SELECTED';
    selectedStats.textContent = `Placement mode · ${TOWERS[state.selectedKind].name} · ${TOWERS[state.selectedKind].cost}¢`;
    upgradeButton.disabled = true; sellButton.disabled = true;
    return;
  }
  const stats = tower.stats;
  selectedName.textContent = `${TOWERS[tower.kind].name.toUpperCase()} · LEVEL ${tower.level}`;
  selectedStats.textContent = `DAMAGE ${Math.round(stats.damage)} · RANGE ${stats.range.toFixed(1)} · ${stats.rate.toFixed(2)}s / SHOT`;
  upgradeButton.disabled = tower.level >= 5 || state.money < towerUpgradeCost(tower);
  upgradeButton.textContent = tower.level >= 5 ? 'MAX LEVEL' : `UPGRADE ${towerUpgradeCost(tower)}¢`;
  sellButton.disabled = false;
}
function updateHud() {
  waveValue.textContent = String(state.wave).padStart(2, '0');
  moneyValue.innerHTML = `${state.money.toLocaleString()} <em>¢</em>`;
  livesValue.textContent = String(Math.max(0, state.lives));
  integrityBar.style.width = `${Math.max(0, state.lives / BASE_LIVES * 100)}%`;
  integrityBar.style.background = state.lives <= 5 ? 'linear-gradient(90deg,#ff647b,#ffae73)' : 'linear-gradient(90deg,#61d99e,#b3ffc1)';
  killsValue.textContent = String(state.kills).padStart(3, '0');
  towerCount.textContent = String(state.towers.length).padStart(2, '0');
  waveButton.disabled = !state.running || state.gameOver || state.waveActive;
  waveButtonSub.textContent = state.waveActive ? `${state.spawnQueue + state.enemies.length} HOSTILES REMAIN` : state.wave ? 'READY FOR NEXT DEPLOYMENT' : 'READY FOR DEPLOYMENT';
  syncTowerCards();
  updateSelectionPanel();
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  raycaster.ray.intersectPlane(groundPlane, hitPoint);
  return hitPoint;
}
function pointerMove(event) {
  updatePointer(event);
  if (!state.running || state.gameOver || state.selectedTower) return;
  const spec = TOWERS[state.selectedKind];
  const x = THREE.MathUtils.clamp(hitPoint.x, -FIELD.halfX, FIELD.halfX);
  const z = THREE.MathUtils.clamp(hitPoint.z, -FIELD.halfZ, FIELD.halfZ);
  if (!state.previewTower) {
    state.previewTower = createTowerModel(state.selectedKind, true);
    scene.add(state.previewTower);
  }
  state.previewTower.visible = true;
  state.previewTower.position.set(x, 0.02, z);
  const legal = distanceToPath(x, z) >= FIELD.roadWidth / 2 + 0.45 && !state.towers.some((tower) => Math.hypot(tower.x - x, tower.z - z) < 1.05) && state.money >= spec.cost;
  state.previewTower.traverse((obj) => { if (obj.material?.color) obj.material.color.set(legal ? spec.color : '#ff586c'); });
}
function pointerLeave() { if (state.previewTower) state.previewTower.visible = false; }
function pointerDown(event) {
  if (event.button !== 0 || !state.running || state.gameOver) return;
  updatePointer(event);
  const x = THREE.MathUtils.clamp(hitPoint.x, -FIELD.halfX, FIELD.halfX);
  const z = THREE.MathUtils.clamp(hitPoint.z, -FIELD.halfZ, FIELD.halfZ);
  const clicked = [...state.towers].reverse().find((tower) => Math.hypot(tower.x - x, tower.z - z) < 0.55);
  if (clicked) return selectTower(clicked);
  selectTower(null);
  addTower(state.selectedKind, x, z);
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.fov = rect.width < 600 ? 50 : 42;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
function renderTowerCardsInit() { renderTowerCards(); updateHud(); }
function animate(timestamp = 0) {
  requestAnimationFrame(animate);
  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.04) : 0;
  state.lastTime = timestamp;
  tick(dt);
  renderer.render(scene, camera);
}

buildMap();
renderTowerCardsInit();
resize();
new ResizeObserver(resize).observe(canvas);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerleave', pointerLeave);
canvas.addEventListener('pointerdown', pointerDown);
waveButton.addEventListener('click', startWave);
beginButton.addEventListener('click', beginGame);
upgradeButton.addEventListener('click', upgradeTower);
sellButton.addEventListener('click', sellTower);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') { event.preventDefault(); startWave(); }
  const kind = Object.keys(TOWERS).find((key) => TOWERS[key].key === event.key);
  if (kind && state.running && !state.gameOver) {
    state.selectedKind = kind;
    selectTower(null);
    updateHud();
    notify(`${TOWERS[kind].name} selected`);
  }
  if (event.key === 'r' && state.gameOver) restart();
});
requestAnimationFrame(animate);
