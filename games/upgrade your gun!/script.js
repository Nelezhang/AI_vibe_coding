(() => {
  const root = document.getElementById('game');
  const screen = document.getElementById('screen');
  const startButton = document.getElementById('startButton');
  const app = document.querySelector('.app');
  const keys = new Set();
  const arena = { x: 18, z: 10 };
  const player = { x: 0, z: 0, health: 150, maxHealth: 150, speed: 7.4, invulnerable: 0, yaw: 0, group: null, gun: null };
  const aim = { x: 0, z: -1, firing: false };
  const enemies = [];
  const bullets = [];
  const scraps = [];
  const particles = [];
  const upgrades = { damage: 0, rate: 0, multishot: 0 };
  const upgradeBaseCosts = { damage: 8, rate: 10, multishot: 16 };
  let renderer;
  let scene;
  let camera;
  let clock;
  let phase = 'ready';
  let wave = 1;
  let quota = 0;
  let spawned = 0;
  let spawnTimer = 0;
  let fireTimer = 0;
  let cash = 0;
  let kills = 0;
  let best = readBest();
  let shake = 0;
  let noticeTimer = 0;
  let enemySerial = 0;

  document.getElementById('bestScore').textContent = best;

  if (!window.THREE) {
    showFatal('Three.js did not load. Check your internet connection and refresh.');
    return;
  }

  initializeScene();
  connectControls();
  updateHud();
  requestAnimationFrame(frame);

  function readBest() {
    try { return Number(localStorage.getItem('scrapline3dBest')) || 0; }
    catch { return 0; }
  }

  function writeBest() {
    try { localStorage.setItem('scrapline3dBest', String(best)); }
    catch { /* Continue without saved best score when storage is unavailable. */ }
  }

  function showFatal(message) {
    document.getElementById('eyebrow').textContent = 'ENGINE UNAVAILABLE';
    document.getElementById('screenCopy').textContent = message;
    startButton.disabled = true;
  }

  function initializeScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121a1e);
    scene.fog = new THREE.Fog(0x121a1e, 27, 58);
    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    clock = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xe8f4dc, 0x3c4a43, 0.42));
    const sun = new THREE.DirectionalLight(0xffedcc, 0.72);
    sun.position.set(-8, 17, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    scene.add(sun);
    const rim = new THREE.PointLight(0x8bba76, 1.1, 34, 2);
    rim.position.set(10, 7, -8);
    scene.add(rim);

    buildArena();
    player.group = makePlayer();
    scene.add(player.group);
    camera.position.set(0, 20, 16);
    camera.lookAt(0, 0, 0);
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!renderer) return;
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function buildArena() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.MeshStandardMaterial({ color: 0x303b35, roughness: 0.96, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.16;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x738a68, 0x536653);
    grid.scale.z = 0.6;
    grid.position.y = -0.145;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    scene.add(grid);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x55634e, roughness: 0.8, metalness: 0.1 });
    addBox(0, 0.25, -arena.z, arena.x * 2, 0.5, 0.45, wallMaterial);
    addBox(0, 0.25, arena.z, arena.x * 2, 0.5, 0.45, wallMaterial);
    addBox(-arena.x, 0.25, 0, 0.45, 0.5, arena.z * 2, wallMaterial);
    addBox(arena.x, 0.25, 0, 0.45, 0.5, arena.z * 2, wallMaterial);

    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x687057, roughness: 1 });
    for (const [x, z, size] of [[-9,-5,1.2],[7,-6,1.4],[-12,3,1],[11,5,1.2],[-3,7,.9],[3,-3,.7],[13,-1,.8],[-7,1,.8]]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), obstacleMaterial);
      rock.position.set(x, size * 0.48, z);
      rock.scale.y = 0.72;
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }
    const centerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.55, 64),
      new THREE.MeshBasicMaterial({ color: 0xc2d773, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    );
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = -0.13;
    scene.add(centerRing);
  }

  function addBox(x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function makePlayer() {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8b777, roughness: 0.78 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 20), skin);
    body.scale.set(0.85, 0.72, 1.05);
    body.position.y = 0.68;
    body.castShadow = true;
    group.add(body);

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x17201d, roughness: 0.3 });
    for (const x of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeMaterial);
      eye.position.set(x, 0.78, 0.58);
      group.add(eye);
    }
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 8), new THREE.MeshStandardMaterial({ color: 0x88c86c, roughness: 0.7 }));
    sprout.position.set(0.06, 1.24, -0.05);
    sprout.rotation.z = -0.24;
    sprout.castShadow = true;
    group.add(sprout);

    const gun = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.48), new THREE.MeshStandardMaterial({ color: 0x525b5b, metalness: 0.48, roughness: 0.42 }));
    gunBody.position.set(0, 0.62, 0.66);
    gunBody.castShadow = true;
    gun.add(gunBody);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.48, 10), new THREE.MeshStandardMaterial({ color: 0xf1c968, metalness: 0.55, roughness: 0.32, emissive: 0x4a3008 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.67, 0.98);
    gun.add(barrel);
    group.add(gun);
    player.gun = gun;
    group.position.set(player.x, 0, player.z);
    return group;
  }

  function makeEnemy(x, z) {
    const heavy = Math.random() < Math.min(0.08 + wave * 0.012, 0.25);
    const radius = heavy ? random(0.68, 0.82) : random(0.43, 0.56);
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: heavy ? 0xb86658 : [0x8aa66d, 0x9d806b, 0x8879a4][Math.floor(Math.random() * 3)],
      roughness: 0.82,
      emissive: heavy ? 0x42130e : 0x18230d,
      emissiveIntensity: 0.28,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
    body.scale.set(1, 0.9, 1.12);
    body.position.y = radius * 0.92;
    body.castShadow = true;
    group.add(body);
    const eyes = new THREE.MeshStandardMaterial({ color: 0x211d1b, emissive: heavy ? 0x54110c : 0x233411, emissiveIntensity: 0.6 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.12, 9, 8), eyes);
      eye.position.set(side * radius * 0.28, radius * 0.95, radius * 0.83);
      group.add(eye);
    }
    group.position.set(x, 0, z);
    scene.add(group);
    const hp = (heavy ? 68 : 28) + wave * (heavy ? 6 : 3);
    return { group, x, z, radius, hp, maxHp: hp, speed: (heavy ? 2.2 : 3.1) + Math.min(wave * 0.06, 1.1), damage: heavy ? 13 : 8, heavy, cooldown: 0, phase: Math.random() * 6.28, id: enemySerial++ };
  }

  function makeScrap(x, z, amount) {
    const group = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd267, emissive: 0x73500e, emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.3 }),
    );
    gem.position.y = 0.34;
    gem.castShadow = true;
    group.add(gem);
    const light = new THREE.PointLight(0xffc857, 1.1, 2.5);
    light.position.y = 0.55;
    group.add(light);
    group.position.set(x, 0, z);
    scene.add(group);
    scraps.push({ group, x, z, amount, phase: Math.random() * 6 });
  }

  function clearDynamic() {
    for (const item of [...enemies, ...bullets, ...scraps, ...particles]) {
      const object = item.group || item.mesh;
      if (object) {
        scene.remove(object);
        disposeObject(object);
      }
    }
    enemies.length = 0;
    bullets.length = 0;
    scraps.length = 0;
    particles.length = 0;
  }

  function disposeObject(object) {
    object.traverse(child => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
      else child.material.dispose();
    });
  }

  function startRun() {
    clearDynamic();
    cash = 0;
    kills = 0;
    wave = 1;
    player.health = player.maxHealth;
    player.x = 0;
    player.z = 0;
    player.invulnerable = 1.4;
    upgrades.damage = 0;
    upgrades.rate = 0;
    upgrades.multishot = 0;
    startWave();
  }

  function startWave() {
    phase = 'combat';
    quota = 4 + wave * 2;
    spawned = 0;
    spawnTimer = 0.65;
    fireTimer = 0;
    aim.firing = false;
    screen.classList.add('hidden');
    app.classList.remove('between-waves');
    startButton.disabled = false;
    showNotice(`WAVE ${wave} — ${quota} HOSTILES`);
    updateHud();
  }

  function openIntermission() {
    if (phase !== 'combat') return;
    phase = 'intermission';
    player.health = Math.min(player.maxHealth, player.health + 16);
    for (let i = scraps.length - 1; i >= 0; i--) {
      cash += scraps[i].amount;
      scene.remove(scraps[i].group);
      disposeObject(scraps[i].group);
      scraps.splice(i, 1);
    }
    document.getElementById('eyebrow').textContent = `WAVE ${wave} CLEARED · LOADOUT BREAK`;
    document.getElementById('screenTitle').innerHTML = 'BENCH<br /><em>TIME</em>';
    document.getElementById('screenCopy').textContent = `The arena is paused. Spend your ${cash} scrap on upgrades, then launch wave ${wave + 1}. Repaired 16 hull.`;
    startButton.innerHTML = `START WAVE ${wave + 1} <b>↗</b>`;
    screen.classList.remove('hidden');
    app.classList.add('between-waves');
    showNotice('WAVE CLEAR — UPGRADE YOUR GUN');
    updateHud();
  }

  function endGame() {
    if (phase === 'over') return;
    phase = 'over';
    aim.firing = false;
    if (kills > best) {
      best = kills;
      document.getElementById('bestScore').textContent = best;
      try { localStorage.setItem('scrapline3dBest', String(best)); } catch { /* Ignore storage failures. */ }
    }
    document.getElementById('eyebrow').textContent = `RUN ENDED · ${kills} TARGET${kills === 1 ? '' : 'S'} DOWN`;
    document.getElementById('screenTitle').innerHTML = 'BACK TO<br /><em>THE BENCH</em>';
    document.getElementById('screenCopy').textContent = `You reached wave ${wave} with ${cash} scrap. Refit your blaster and jump back in.`;
    startButton.innerHTML = 'RUN IT BACK <b>↗</b>';
    screen.classList.remove('hidden');
    app.classList.remove('between-waves');
    updateHud();
  }

  function getCost(type) {
    const levels = upgrades[type];
    return upgradeBaseCosts[type] + levels * (type === 'multishot' ? 14 : type === 'rate' ? 9 : 8);
  }

  function buyUpgrade(type) {
    if (phase !== 'intermission') return;
    const cost = getCost(type);
    if (cash < cost) {
      showNotice(`NEED ${cost - cash} MORE SCRAP`);
      return;
    }
    cash -= cost;
    upgrades[type]++;
    const names = { damage: 'HEAVY ROUNDS', rate: 'RAPID TRIGGER', multishot: 'SPLIT BARREL' };
    showNotice(`${names[type]} INSTALLED`);
    updateHud();
  }

  function updateHud() {
    document.getElementById('wave').textContent = wave;
    document.getElementById('scrap').textContent = cash;
    const fraction = Math.max(0, player.health / player.maxHealth);
    document.getElementById('healthText').textContent = `${Math.ceil(fraction * 100)}%`;
    document.getElementById('healthFill').style.width = `${fraction * 100}%`;
    document.getElementById('weaponLevel').textContent = `MK ${1 + upgrades.damage + upgrades.rate + upgrades.multishot}`;
    document.getElementById('damageStat').textContent = 26 + upgrades.damage * 12;
    document.getElementById('rateStat').textContent = `${(4.5 + upgrades.rate * 1.4).toFixed(1)} / SEC`;
    document.getElementById('barrelStat').textContent = 1 + upgrades.multishot;
    document.getElementById('damageCost').textContent = getCost('damage');
    document.getElementById('rateCost').textContent = getCost('rate');
    document.getElementById('multishotCost').textContent = getCost('multishot');
    for (const button of document.querySelectorAll('.upgrade')) {
      button.disabled = phase !== 'intermission' || cash < getCost(button.dataset.upgrade);
    }
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x;
    let z;
    if (edge === 0) { x = random(-arena.x + 1, arena.x - 1); z = -arena.z + 0.6; }
    else if (edge === 1) { x = arena.x - 0.6; z = random(-arena.z + 1, arena.z - 1); }
    else if (edge === 2) { x = random(-arena.x + 1, arena.x - 1); z = arena.z - 0.6; }
    else { x = -arena.x + 0.6; z = random(-arena.z + 1, arena.z - 1); }
    enemies.push(makeEnemy(x, z));
    spawned++;
  }

  function addParticle(x, y, z, color, count = 7) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(random(0.035, 0.09), 6, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      particles.push({ mesh, vx: Math.cos(angle) * random(1, 4), vy: random(1, 4), vz: Math.sin(angle) * random(1, 4), life: random(0.25, 0.65) });
    }
  }

  function shoot() {
    const barrels = 1 + upgrades.multishot;
    const baseAngle = Math.atan2(aim.x, aim.z);
    for (let i = 0; i < barrels; i++) {
      const angle = baseAngle + (i - (barrels - 1) / 2) * 0.15;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd16e, emissive: 0xffa620, emissiveIntensity: 1.5, roughness: 0.25 }),
      );
      mesh.position.set(player.x + Math.sin(angle) * 0.85, 0.78, player.z + Math.cos(angle) * 0.85);
      scene.add(mesh);
      bullets.push({ mesh, vx: Math.sin(angle) * 15, vz: Math.cos(angle) * 15, damage: 26 + upgrades.damage * 12, life: 1.5 });
    }
    player.gun.rotation.y = baseAngle;
    addParticle(player.x + aim.x * 0.9, 0.78, player.z + aim.z * 0.9, 0xffdf8d, 2);
  }

  function updateCombat(dt) {
    if (phase !== 'combat') return;
    if (player.invulnerable > 0) {
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.group.visible = Math.floor(performance.now() / 90) % 2 === 0;
    } else player.group.visible = true;

    let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let mz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const magnitude = Math.hypot(mx, mz) || 1;
    player.x = THREE.MathUtils.clamp(player.x + mx / magnitude * player.speed * dt, -arena.x + 0.9, arena.x - 0.9);
    player.z = THREE.MathUtils.clamp(player.z + mz / magnitude * player.speed * dt, -arena.z + 0.9, arena.z - 0.9);
    player.group.position.set(player.x, Math.sin(performance.now() * 0.004) * 0.045, player.z);

    camera.position.x += (player.x - camera.position.x) * Math.min(1, dt * 3.2);
    camera.position.z += (player.z + 16 - camera.position.z) * Math.min(1, dt * 3.2);
    camera.lookAt(player.x, 0, player.z);

    if (spawned < quota) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = Math.max(0.46, 1.0 - wave * 0.035) * random(0.8, 1.15);
      }
    }

    fireTimer -= dt;
    if ((aim.firing || keys.has(' ') || keys.has('space')) && fireTimer <= 0) {
      shoot();
      fireTimer = 1 / (4.5 + upgrades.rate * 1.4);
    }

    updateBullets(dt);
    updateEnemies(dt);
    updateScraps(dt);
    updateParticles(dt);
    if (spawned >= quota && enemies.length === 0) openIntermission();
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.mesh.position.x += bullet.vx * dt;
      bullet.mesh.position.z += bullet.vz * dt;
      bullet.life -= dt;
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (Math.hypot(bullet.mesh.position.x - enemy.x, bullet.mesh.position.z - enemy.z) < enemy.radius + 0.18) {
          enemy.hp -= bullet.damage;
          hit = true;
          if (enemy.hp <= 0) defeatEnemy(j);
          break;
        }
      }
      if (hit || bullet.life <= 0 || Math.abs(bullet.mesh.position.x) > arena.x + 2 || Math.abs(bullet.mesh.position.z) > arena.z + 2) {
        scene.remove(bullet.mesh);
        disposeObject(bullet.mesh);
        bullets.splice(i, 1);
      }
    }
  }

  function defeatEnemy(index) {
    const enemy = enemies[index];
    scene.remove(enemy.group);
    disposeObject(enemy.group);
    enemies.splice(index, 1);
    kills++;
    makeScrap(enemy.x, enemy.z, enemy.heavy ? 6 : randomInt(3, 5));
    addParticle(enemy.x, 0.6, enemy.z, enemy.heavy ? 0xff8266 : 0xaeea79, 11);
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      enemy.phase += dt * 3.5;
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distance = Math.hypot(dx, dz) || 1;
      if (distance > 0.98) {
        enemy.x += dx / distance * enemy.speed * dt;
        enemy.z += dz / distance * enemy.speed * dt;
        enemy.group.position.set(enemy.x, Math.sin(enemy.phase) * 0.05, enemy.z);
        enemy.group.rotation.y = Math.atan2(dx, dz);
      }
      if (distance < enemy.radius + 0.55 && enemy.cooldown <= 0 && player.invulnerable <= 0) {
        player.health -= enemy.damage;
        player.invulnerable = 0.78;
        enemy.cooldown = 1.05;
        shake = 0.2;
        const retreat = Math.min(1.4, enemy.radius + 0.5);
        player.x = THREE.MathUtils.clamp(player.x - dx / distance * retreat, -arena.x + 0.9, arena.x - 0.9);
        player.z = THREE.MathUtils.clamp(player.z - dz / distance * retreat, -arena.z + 0.9, arena.z - 0.9);
        addParticle(player.x, 0.8, player.z, 0xff6e70, 9);
        updateHud();
        if (player.health <= 0) {
          player.health = 0;
          updateHud();
          endGame();
          return;
        }
      }
    }
  }

  function updateScraps(dt) {
    for (let i = scraps.length - 1; i >= 0; i--) {
      const item = scraps[i];
      item.phase += dt * 3;
      item.group.rotation.y += dt * 1.5;
      item.group.position.y = 0.07 + Math.sin(item.phase) * 0.1;
      if (Math.hypot(player.x - item.x, player.z - item.z) < 0.95) {
        cash += item.amount;
        scene.remove(item.group);
        disposeObject(item.group);
        scraps.splice(i, 1);
        updateHud();
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.vy -= 7 * dt;
      particle.life -= dt;
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
        disposeObject(particle.mesh);
        particles.splice(i, 1);
      }
    }
  }

  function updateNotice(dt) {
    if (noticeTimer > 0) {
      noticeTimer -= dt;
      if (noticeTimer <= 0) document.getElementById('notice').textContent = '';
    }
  }

  function showNotice(text) {
    document.getElementById('notice').textContent = text;
    noticeTimer = 1.8;
  }

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.04);
    if (phase === 'combat') {
      updateCombat(dt);
      updateNotice(dt);
    } else if (phase === 'intermission') {
      updateParticles(dt);
      player.group.rotation.y += dt * 0.25;
    } else if (phase === 'ready' || phase === 'over') {
      player.group.rotation.y += dt * 0.3;
      updateParticles(dt);
    }
    if (shake > 0) {
      camera.position.x += random(-shake, shake);
      shake = Math.max(0, shake - dt * 0.7);
    }
    renderer.render(scene, camera);
  }

  function updateAim(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(ground, target)) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const length = Math.hypot(dx, dz) || 1;
      aim.x = dx / length;
      aim.z = dz / length;
      player.gun.rotation.y = Math.atan2(aim.x, aim.z);
    }
  }

  function connectControls() {
    renderer.domElement.addEventListener('pointermove', updateAim);
    renderer.domElement.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      updateAim(event);
      aim.firing = true;
      renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener('pointerup', () => { aim.firing = false; });
    renderer.domElement.addEventListener('pointercancel', () => { aim.firing = false; });
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
      keys.add(key);
      if (event.code === 'Space') keys.add(' ');
      if (event.key === 'Enter' && phase === 'ready') startRun();
      if (event.key === 'Enter' && phase === 'intermission') launchNextWave();
    });
    window.addEventListener('keyup', event => { keys.delete(event.key.toLowerCase()); if (event.code === 'Space') keys.delete(' '); });
    window.addEventListener('blur', () => { keys.clear(); aim.firing = false; });
    startButton.addEventListener('click', () => {
      if (phase === 'ready' || phase === 'over') startRun();
      else if (phase === 'intermission') launchNextWave();
    });
    for (const button of document.querySelectorAll('.upgrade')) {
      button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade));
    }
  }

  function launchNextWave() {
    if (phase !== 'intermission') return;
    wave++;
    startWave();
  }

  function random(min, max) { return Math.random() * (max - min) + min; }
  function randomInt(min, max) { return Math.floor(random(min, max + 1)); }
})();
