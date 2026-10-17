(() => {
  const root = document.getElementById('scene');
  const overlay = document.getElementById('overlay');
  const shop = document.getElementById('shop');
  const startButton = document.getElementById('startButton');
  const nextWaveButton = document.getElementById('nextWave');
  const keys = new Set();
  const arenaLimit = 15;
  const waveLength = 30;
  const weaponInfo = {
    blaster: { name: 'Root Blaster', icon: '✹', color: 0xffc763, cost: 14, damage: 14, rate: 0.7, speed: 17, desc: 'Balanced shots seek the nearest threat.' },
    lance: { name: 'Spud Lance', icon: '➤', color: 0x75e3ff, cost: 18, damage: 25, rate: 1.15, speed: 24, desc: 'Long-range bolts hit hard and fast.' },
    orbit: { name: 'Orbiting Tater', icon: '✦', color: 0xc28aff, cost: 20, damage: 10, rate: 0.42, speed: 12, desc: 'A heavy spinning shot circles toward danger.' },
    scatter: { name: 'Peel Popper', icon: '✺', color: 0xff8c76, cost: 17, damage: 8, rate: 0.95, speed: 15, desc: 'Fires a quick fan of three little bolts.' },
  };

  let renderer;
  let scene;
  let camera;
  let clock;
  let player;
  let running = false;
  let mode = 'menu';
  let wave = 1;
  let waveClock = waveLength;
  let spawnClock = 0;
  let fireClock = 0;
  let cash = 25;
  let bestWave = Number(localStorage.getItem('spudboundBestWave') || 1);
  let invulnerability = 0;
  let enemySerial = 0;
  const enemies = [];
  const coins = [];
  const projectiles = [];
  const weapons = [];
  const obstacles = [];

  document.getElementById('bestWave').textContent = bestWave;

  function initThree() {
    if (!window.THREE) {
      document.querySelector('.intro-modal p').textContent = 'The 3D engine could not load. Check your internet connection and refresh to try again.';
      startButton.disabled = true;
      return false;
    }
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171d1b);
    scene.fog = new THREE.Fog(0x171d1b, 24, 54);
    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    root.appendChild(renderer.domElement);
    clock = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xe8f3d9, 0x424c3e, 0.32));
    const sun = new THREE.DirectionalLight(0xffedca, 0.52);
    sun.position.set(-7, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const fill = new THREE.PointLight(0xc8f36a, 0.7, 27, 2);
    fill.position.set(8, 5, -7);
    scene.add(fill);

    makeArena();
    player = makePotato();
    scene.add(player.group);
    camera.position.set(0, 24, 10);
    camera.lookAt(0, 0, 0);
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!renderer) return;
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function makeArena() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshStandardMaterial({ color: 0x20281f, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.18;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(36, 36, 0x59654a, 0x424c3d);
    grid.position.y = -0.16;
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x555f4c, roughness: 0.9 });
    for (const [x, z, sx, sz] of [[0, -16, 33, 0.6], [0, 16, 33, 0.6], [-16, 0, 0.6, 33], [16, 0, 0.6, 33]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.5, sz), wallMat);
      wall.position.set(x, 0.04, z);
      wall.receiveShadow = true;
      scene.add(wall);
    }

    for (let i = 0; i < 14; i++) {
      const x = THREE.MathUtils.randFloat(-13, 13);
      const z = THREE.MathUtils.randFloat(-13, 13);
      if (Math.hypot(x, z) < 4.5) continue;
      const height = THREE.MathUtils.randFloat(0.35, 1.2);
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.25, 0.55), 0),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x59624d : 0x717355, roughness: 1 }),
      );
      rock.position.set(x, height * 0.35, z);
      rock.scale.y = height;
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
      obstacles.push({ x, z, radius: 0.55 });
    }
  }

  function makePotato() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0xb99055, roughness: 0.85 }),
    );
    body.scale.set(0.86, 0.76, 1.08);
    body.castShadow = true;
    group.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x20251c, roughness: 0.35 });
    for (const x of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
      eye.position.set(x, 0.14, 0.53);
      group.add(eye);
    }
    const sprout = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 7),
      new THREE.MeshStandardMaterial({ color: 0x8bc66a, roughness: 0.75 }),
    );
    sprout.position.set(0.08, 0.72, -0.02);
    sprout.rotation.z = -0.28;
    sprout.castShadow = true;
    group.add(sprout);
    group.position.y = 0.62;
    return { group, health: 100, maxHealth: 100, x: 0, z: 0, speed: 5.8 };
  }

  function makeEnemy(x, z) {
    const group = new THREE.Group();
    const size = THREE.MathUtils.randFloat(0.42, 0.65);
    const skin = new THREE.MeshStandardMaterial({ color: [0x849c68, 0xb26f5e, 0x8a75aa][Math.floor(Math.random() * 3)], roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), skin);
    body.scale.set(1, 0.83, 1.1);
    body.position.y = size * 0.86;
    body.castShadow = true;
    group.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x211b1a, emissive: 0x3d1710, emissiveIntensity: 0.45 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.105, 8, 8), eyeMat);
      eye.position.set(side * size * 0.25, size * 0.98, size * 0.82);
      group.add(eye);
    }
    group.position.set(x, 0, z);
    scene.add(group);
    return { group, x, z, size, health: 25 + wave * 3, speed: 1.2 + Math.min(wave * 0.045, 1.2), hitClock: 0, id: enemySerial++ };
  }

  function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const edge = THREE.MathUtils.randFloat(12.6, 14.2);
    let x = Math.cos(angle) * edge;
    let z = Math.sin(angle) * edge;
    for (const obstacle of obstacles) {
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 1) {
        x += Math.sign(x || 1) * 1.3;
        z += Math.sign(z || 1) * 1.3;
      }
    }
    enemies.push(makeEnemy(x, z));
  }

  function spawnCoin(x, z, amount = 1) {
    const group = new THREE.Group();
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.075, 16),
      new THREE.MeshStandardMaterial({ color: 0xc7df69, emissive: 0x526d19, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.3 }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.28;
    coin.castShadow = true;
    group.add(coin);
    const glint = new THREE.PointLight(0xc8f36a, 0.7, 2.4);
    glint.position.y = 0.45;
    group.add(glint);
    group.position.set(x, 0, z);
    scene.add(group);
    coins.push({ group, x, z, amount, phase: Math.random() * Math.PI * 2 });
  }

  function addWeapon(type, level = 1) {
    weapons.push({ type, level, cooldown: 0.15 + Math.random() * 0.35 });
    mergeWeapons();
    renderWeapons();
  }

  function mergeWeapons() {
    for (let i = 0; i < weapons.length; i++) {
      const pair = weapons.findIndex((weapon, index) => index !== i && weapon.type === weapons[i].type && weapon.level === weapons[i].level);
      if (pair !== -1) {
        const first = weapons[i];
        const second = weapons[pair];
        first.level += 1;
        first.cooldown = Math.min(first.cooldown, second.cooldown);
        weapons.splice(pair, 1);
        i = -1;
      }
    }
  }

  function weaponCost(type) {
    const matching = weapons.filter((weapon) => weapon.type === type);
    const level = matching.length ? Math.min(...matching.map((weapon) => weapon.level)) : 0;
    return weaponInfo[type].cost + level * 9;
  }

  function buyWeapon(type) {
    const alreadyOwned = weapons.some((weapon) => weapon.type === type);
    if (cash < weaponCost(type) || (!alreadyOwned && weapons.length >= 4)) return;
    cash -= weaponCost(type);
    addWeapon(type);
    updateHud();
    renderShop();
  }

  function showShop() {
    mode = 'shop';
    shop.classList.remove('hidden');
    document.getElementById('shopMoney').textContent = cash;
    renderShop();
  }

  function renderShop() {
    document.getElementById('shopMoney').textContent = cash;
    const cards = document.getElementById('shopCards');
    cards.replaceChildren();
    const offerTypes = ['blaster', 'lance', 'orbit', 'scatter'];
    const offset = (wave - 1) % offerTypes.length;
    const offered = [...offerTypes.slice(offset), ...offerTypes.slice(0, offset)].slice(0, 3);
    for (const type of offered) {
      const info = weaponInfo[type];
      const cost = weaponCost(type);
      const atLimit = !weapons.some((weapon) => weapon.type === type) && weapons.length >= 4;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-card';
      button.disabled = cash < cost || atLimit;
      button.innerHTML = `<span class="card-icon" style="color:#${info.color.toString(16).padStart(6, '0')}">${info.icon}</span><span class="card-name">${info.name}</span><span class="card-desc">${info.desc}</span><span class="card-cost">◆ ${cost} SCRAP${weapons.some((weapon) => weapon.type === type) ? ' · MERGES' : ''}</span>`;
      button.addEventListener('click', () => buyWeapon(type));
      cards.appendChild(button);
    }
    const heal = document.createElement('button');
    heal.type = 'button';
    heal.className = 'shop-card';
    heal.disabled = cash < 12 || player.health >= player.maxHealth;
    heal.innerHTML = '<span class="card-icon" style="color:#c8f36a">✚</span><span class="card-name">Field Tonic</span><span class="card-desc">Restore 35 vitality before the next wave.</span><span class="card-cost">◆ 12 SCRAP</span>';
    heal.addEventListener('click', () => {
      if (cash < 12 || player.health >= player.maxHealth) return;
      cash -= 12;
      player.health = Math.min(player.maxHealth, player.health + 35);
      updateHud();
      renderShop();
    });
    cards.appendChild(heal);
    const list = document.getElementById('weaponList');
    list.replaceChildren();
    if (!weapons.length) list.textContent = 'No gear yet — buy a weapon above.';
    for (const weapon of weapons) {
      const chip = document.createElement('span');
      chip.className = 'weapon-chip';
      chip.innerHTML = `${weaponInfo[weapon.type].icon} ${weaponInfo[weapon.type].name} <b>MK ${weapon.level}</b>`;
      list.appendChild(chip);
    }
  }

  function beginWave() {
    mode = 'combat';
    running = true;
    waveClock = waveLength;
    spawnClock = 0.2;
    shop.classList.add('hidden');
    updateHud();
    clock.getDelta();
  }

  function startRun() {
    if (!renderer) return;
    clearDynamicObjects();
    weapons.length = 0;
    wave = 1;
    waveClock = waveLength;
    spawnClock = 0.2;
    fireClock = 0;
    cash = 25;
    player.health = player.maxHealth;
    player.x = 0;
    player.z = 0;
    player.group.position.set(0, 0.62, 0);
    addWeapon('blaster');
    mode = 'combat';
    running = true;
    overlay.classList.add('hidden');
    shop.classList.add('hidden');
    clock.getDelta();
    updateHud();
  }

  function clearDynamicObjects() {
    for (const enemy of enemies) scene.remove(enemy.group);
    for (const coin of coins) scene.remove(coin.group);
    for (const projectile of projectiles) scene.remove(projectile.mesh);
    enemies.length = 0;
    coins.length = 0;
    projectiles.length = 0;
  }

  function endRun() {
    running = false;
    mode = 'over';
    if (wave > bestWave) {
      bestWave = wave;
      localStorage.setItem('spudboundBestWave', String(bestWave));
      document.getElementById('bestWave').textContent = bestWave;
    }
    shop.classList.add('hidden');
    overlay.classList.remove('hidden');
    document.querySelector('.intro-modal .overline').textContent = 'THE ARENA CLAIMED ANOTHER SPUD';
    document.querySelector('.intro-modal h1').innerHTML = 'RUN<span>ENDED</span>';
    document.querySelector('.intro-modal p').textContent = `You reached wave ${wave} and collected ${cash} scrap. Tune your loadout and give it another go.`;
    startButton.innerHTML = 'TRY AGAIN <span>↻</span>';
  }

  function updateHud() {
    document.getElementById('wave').textContent = wave;
    document.getElementById('money').textContent = cash;
    document.getElementById('healthText').textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    document.getElementById('healthBar').style.width = `${Math.max(0, player.health / player.maxHealth * 100)}%`;
    document.getElementById('threats').textContent = enemies.length;
    document.getElementById('timer').textContent = Math.ceil(waveClock);
    document.getElementById('weaponCount').textContent = `${weapons.length} / 4`;
    const quick = document.getElementById('quickWeapons');
    quick.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('span');
      slot.className = 'quick-slot';
      slot.textContent = weapons[i] ? weaponInfo[weapons[i].type].icon : '·';
      quick.appendChild(slot);
    }
  }

  function movePlayer(dt) {
    let x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const length = Math.hypot(x, z);
    if (length) {
      x /= length;
      z /= length;
      player.x += x * player.speed * dt;
      player.z += z * player.speed * dt;
      player.group.rotation.y = Math.atan2(x, z);
    }
    player.x = THREE.MathUtils.clamp(player.x, -arenaLimit, arenaLimit);
    player.z = THREE.MathUtils.clamp(player.z, -arenaLimit, arenaLimit);
    player.group.position.x = player.x;
    player.group.position.z = player.z;
    player.group.position.y = 0.62 + Math.sin(performance.now() * 0.005) * 0.035;
    camera.position.x += (player.x - camera.position.x) * Math.min(1, dt * 2.7);
    camera.position.z += (player.z + 10 - camera.position.z) * Math.min(1, dt * 2.7);
    camera.lookAt(player.x, 0, player.z);
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distance = Math.hypot(dx, dz) || 1;
      if (distance > 0.95) {
        enemy.x += (dx / distance) * enemy.speed * dt;
        enemy.z += (dz / distance) * enemy.speed * dt;
        enemy.group.position.set(enemy.x, 0, enemy.z);
        enemy.group.rotation.y = Math.atan2(dx, dz);
      }
      enemy.hitClock = Math.max(0, enemy.hitClock - dt);
      if (distance < 1.05 && enemy.hitClock <= 0 && invulnerability <= 0) {
        player.health -= Math.max(7, 11 - wave * 0.15);
        invulnerability = 0.65;
        enemy.hitClock = 0.85;
        updateHud();
        if (player.health <= 0) {
          player.health = 0;
          updateHud();
          endRun();
          return;
        }
      }
    }
  }

  function findTarget() {
    let target = null;
    let distance = Infinity;
    for (const enemy of enemies) {
      const current = (enemy.x - player.x) ** 2 + (enemy.z - player.z) ** 2;
      if (current < distance) {
        distance = current;
        target = enemy;
      }
    }
    return target;
  }

  function shoot(weapon, target) {
    const info = weaponInfo[weapon.type];
    const count = weapon.type === 'scatter' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(target.x - player.x, target.z - player.z) + (i - (count - 1) / 2) * 0.16;
      const geometry = weapon.type === 'lance'
        ? new THREE.CylinderGeometry(0.07, 0.07, 0.48, 8)
        : new THREE.SphereGeometry(weapon.type === 'orbit' ? 0.19 : 0.13, 10, 8);
      const material = new THREE.MeshStandardMaterial({ color: info.color, emissive: info.color, emissiveIntensity: 0.9, roughness: 0.3 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(player.x, 0.75, player.z);
      if (weapon.type === 'lance') mesh.rotation.x = Math.PI / 2;
      scene.add(mesh);
      projectiles.push({ mesh, vx: Math.sin(angle) * info.speed, vz: Math.cos(angle) * info.speed, damage: info.damage * weapon.level, life: 1.7, type: weapon.type, level: weapon.level });
    }
  }

  function updateWeapons(dt) {
    const target = findTarget();
    if (!target) return;
    for (const weapon of weapons) {
      weapon.cooldown -= dt;
      if (weapon.cooldown <= 0) {
        shoot(weapon, target);
        weapon.cooldown = weaponInfo[weapon.type].rate / (1 + (weapon.level - 1) * 0.09);
      }
    }
  }

  function damageEnemy(enemy, damage) {
    enemy.health -= damage;
    enemy.group.scale.setScalar(enemy.health > 0 ? 0.88 : 0.72);
    if (enemy.health <= 0) {
      scene.remove(enemy.group);
      const index = enemies.indexOf(enemy);
      if (index !== -1) enemies.splice(index, 1);
      if (Math.random() < 0.72) spawnCoin(enemy.x, enemy.z, Math.random() < 0.15 ? 3 : 1);
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      projectile.mesh.position.x += projectile.vx * dt;
      projectile.mesh.position.z += projectile.vz * dt;
      projectile.life -= dt;
      let hit = false;
      for (const enemy of enemies) {
        if (Math.hypot(projectile.mesh.position.x - enemy.x, projectile.mesh.position.z - enemy.z) < enemy.size + 0.2) {
          damageEnemy(enemy, projectile.damage);
          hit = true;
          break;
        }
      }
      if (hit || projectile.life <= 0) {
        scene.remove(projectile.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function updateCoins(dt) {
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.phase += dt * 3;
      coin.group.rotation.y += dt * 1.8;
      coin.group.position.y = Math.sin(coin.phase) * 0.08;
      if (Math.hypot(player.x - coin.x, player.z - coin.z) < 0.95) {
        cash += coin.amount;
        scene.remove(coin.group);
        coins.splice(i, 1);
        updateHud();
      }
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (running && mode === 'combat') {
      invulnerability = Math.max(0, invulnerability - dt);
      player.group.visible = invulnerability <= 0 || Math.floor(performance.now() / 90) % 2 === 0;
      movePlayer(dt);
      waveClock -= dt;
      spawnClock -= dt;
      if (spawnClock <= 0) {
        spawnEnemy();
        spawnClock = wave > 5 ? 0.4 : 0.75;
      }
      updateEnemies(dt);
      if (running) {
        updateWeapons(dt);
        updateProjectiles(dt);
        updateCoins(dt);
      }
      if (running && waveClock <= 0) {
        running = false;
        cash += 5 + wave * 2;
        showShop();
      }
      updateHud();
    } else {
      player.group.rotation.y += dt * 0.28;
      for (const coin of coins) {
        coin.phase += dt * 2;
        coin.group.position.y = Math.sin(coin.phase) * 0.08;
        coin.group.rotation.y += dt;
      }
    }
    renderer.render(scene, camera);
  }

  function renderWeapons() {
    const quick = document.getElementById('quickWeapons');
    quick.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('span');
      slot.className = 'quick-slot';
      slot.textContent = weapons[i] ? weaponInfo[weapons[i].type].icon : '·';
      quick.appendChild(slot);
    }
    document.getElementById('weaponCount').textContent = `${weapons.length} / 4`;
  }

  startButton.addEventListener('click', startRun);
  nextWaveButton.addEventListener('click', () => {
    wave++;
    beginWave();
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      keys.add(key);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  if (initThree()) {
    updateHud();
    frame();
  }
})();