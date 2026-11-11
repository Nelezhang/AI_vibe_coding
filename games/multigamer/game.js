import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {GAMES, createGame, step, progressText} from './engine.mjs';

const $ = selector => document.querySelector(selector);
const menu = $('#menu');
const gameScreen = $('#gameScreen');
const grid = $('#gameGrid');
const result = $('#result');
const canvas = $('#canvas');
const skinSelect = $('#skinSelect');
let renderer;
let scene;
let camera;
let world;
let playerMesh;
let safeZone;
let current;
let lastTime = 0;
const entityMeshes = new Map();
const shotMeshes = [];
const keys = new Set();
const resources = [];
let skin='buddy';

GAMES.forEach((game,index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-card';
  button.style.setProperty('--accent',game.color);
  button.innerHTML = `<span class="card-top"><span class="game-icon">${game.icon}</span><span class="card-number">${String(index+1).padStart(2,'0')} / 20</span></span><h3>${game.name}</h3><p>${game.desc}</p><span class="card-foot"><span>${game.group}</span><span>PLAY →</span></span>`;
  button.addEventListener('click',()=>startGame(game.id));
  grid.append(button);
});
$('#gameCount').textContent=GAMES.length;

function tracked(resource) {resources.push(resource);return resource;}
function mat(color,options={}) {
  return tracked(new THREE.MeshStandardMaterial({color,roughness:0.55,metalness:0.15,...options}));
}
function mesh(parent,geometry,material,x,y,z) {
  const object=new THREE.Mesh(tracked(geometry),material);
  object.position.set(x,y,z);
  object.castShadow=true;
  object.receiveShadow=true;
  parent.add(object);
  return object;
}
function makePlayer() {
  const group=new THREE.Group();
  const resourceStart=resources.length;
  const colors={buddy:'#c8f76c',robot:'#70caff',cat:'#c6a2ff',knight:'#b6c4df',alien:'#ff8ac6'};
  const body=mat(colors[skin]);
  const dark=mat('#29374b');
  if(skin==='robot') {
    mesh(group,new THREE.BoxGeometry(1,1,0.8),body,0,0.8,0);
    mesh(group,new THREE.BoxGeometry(0.65,0.25,0.08),dark,0,0.95,0.42);
    mesh(group,new THREE.CylinderGeometry(0.04,0.04,0.35),dark,0,1.45,0);
    mesh(group,new THREE.SphereGeometry(0.12),mat('#ffe287'),0,1.64,0);
  } else if(skin==='knight') {
    mesh(group,new THREE.CylinderGeometry(0.42,0.55,0.95,8),body,0,0.65,0);
    mesh(group,new THREE.SphereGeometry(0.5,16,10),body,0,1.24,0);
    mesh(group,new THREE.BoxGeometry(0.7,0.18,0.12),dark,0,1.25,0.46);
    mesh(group,new THREE.ConeGeometry(0.16,0.48,6),mat('#ffd36d'),0,1.86,0);
    const shield=mesh(group,new THREE.CylinderGeometry(0.35,0.35,0.12,6),mat('#9e83ee'),0.6,0.65,0.2);
    shield.rotation.x=Math.PI/2;
  } else {
    const head=mesh(group,new THREE.SphereGeometry(0.55,20,14),body,0,0.7,0);
    if(skin==='alien') head.scale.set(1.25,1.05,0.9);
    for(const x of [-0.19,0.19]) {
      mesh(group,new THREE.SphereGeometry(skin==='alien'?0.12:0.065,10,8),dark,x,0.83,0.49);
      if(skin==='cat') {
        const ear=mesh(group,new THREE.ConeGeometry(0.2,0.45,4),body,x*2,1.27,0);
        ear.rotation.z=x<0?-0.2:0.2;
      }
      if(skin==='alien') {
        mesh(group,new THREE.CylinderGeometry(0.035,0.035,0.35),dark,x*2,1.35,0);
        mesh(group,new THREE.SphereGeometry(0.1),mat('#83f7ff'),x*2,1.55,0);
      }
    }
    mesh(group,new THREE.CylinderGeometry(0.28,0.4,0.12,16),body,0,0.13,0);
  }
  group.userData.resources=resources.splice(resourceStart);
  return group;
}
function createScene() {
  if(playerMesh) playerMesh.userData.resources.forEach(resource=>resource.dispose());
  resources.forEach(resource=>resource.dispose());
  resources.length=0;
  entityMeshes.clear();
  shotMeshes.length=0;
  scene=new THREE.Scene();
  const themes={
    COLLECT:{sky:'#222039',floor:'#4c4269',grid:'#6a5a81'},
    BLAST:{sky:'#171d38',floor:'#343c63',grid:'#4b557a'},
    SURVIVE:{sky:'#28192d',floor:'#5b384d',grid:'#805363'},
    RACE:{sky:'#132d35',floor:'#315660',grid:'#477782'},
  };
  const theme=themes[current.config.group];
  scene.background=new THREE.Color(theme.sky);
  scene.fog=new THREE.Fog(theme.sky,30,56);
  camera=new THREE.PerspectiveCamera(42,1,0.1,100);
  camera.position.set(0,21,24);
  camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight('#e5edff','#333452',2.2));
  const sun=new THREE.DirectionalLight('#fff0d6',2.7);
  sun.position.set(-8,18,8);
  scene.add(sun);
  world=new THREE.Group();
  scene.add(world);
  const floor=mesh(world,new THREE.BoxGeometry(20.8,0.4,20.8),mat(theme.floor),0,-0.25,0);
  floor.receiveShadow=true;
  for(let i=-9;i<=9;i+=2) {
    mesh(world,new THREE.BoxGeometry(0.03,0.01,19),mat(theme.grid),i,-0.035,0);
    mesh(world,new THREE.BoxGeometry(19,0.01,0.03),mat(theme.grid),0,-0.035,i);
  }
  const rail=mat('#a994ff',{emissive:'#56449b',emissiveIntensity:0.35});
  for(const x of [-10.2,10.2]) mesh(world,new THREE.BoxGeometry(0.22,0.35,20.6),rail,x,0.09,0);
  for(const z of [-10.2,10.2]) mesh(world,new THREE.BoxGeometry(20.6,0.35,0.22),rail,0,0.09,z);
  for(let i=0;i<32;i++) {
    const angle=i*Math.PI*2/32;
    const radius=14+(i%4)*1.5;
    const item=mesh(world,new THREE.OctahedronGeometry(0.13+(i%3)*0.07),mat(i%2?'#b8a1ff':'#8de1c7',{emissive:'#373662'}),Math.cos(angle)*radius,0.4+(i%5)*0.3,Math.sin(angle)*radius);
    item.rotation.set(i,i*0.4,i*0.7);
  }
  playerMesh=makePlayer();
  world.add(playerMesh);
  if(current.config.shrink) {
    safeZone=new THREE.Group();
    const material=mat('#a993ff',{emissive:'#7359d2'});
    for(const z of [-1,1]) mesh(safeZone,new THREE.BoxGeometry(2,0.07,0.03),material,0,0.035,z);
    for(const x of [-1,1]) mesh(safeZone,new THREE.BoxGeometry(0.03,0.07,2),material,x,0.035,0);
    world.add(safeZone);
  } else safeZone=null;
  resize();
}

function entityMesh(entity) {
  const group=new THREE.Group();
  const colors={pickup:current.config.alternate?'#ff95c0':current.config.id==='harvest'?'#ff987d':'#ffd36d',cyan:'#7be7fa',checkpoint:'#86f2c3',exit:'#8efca5',hazard:'#ff758f',target:'#a995ff',wall:'#53658d',warning:'#ffd36d',impact:'#ff6378',laser:'#ff6378',projectile:'#ff6378'};
  const color=colors[entity.type];
  if(entity.type==='wall') {
    mesh(group,new THREE.BoxGeometry(entity.width,1.3,entity.depth),mat(color),0,0.65,0);
    mesh(group,new THREE.BoxGeometry(entity.width,0.08,entity.depth),mat('#a3b8ef'),0,1.32,0);
  } else if(entity.type==='warning'||entity.type==='impact') {
    const ring=mesh(group,new THREE.TorusGeometry(entity.radius,entity.type==='impact'?0.18:0.07,8,36),mat(color,{emissive:color,emissiveIntensity:0.5}),0,0.08,0);
    ring.rotation.x=Math.PI/2;
    if(entity.type==='impact') mesh(group,new THREE.SphereGeometry(0.7,12,8),mat(color),0,0.7,0);
  } else if(entity.type==='laser') {
    mesh(group,new THREE.BoxGeometry(entity.width,0.12,entity.depth),mat(color,{emissive:color,emissiveIntensity:0.7}),0,0.1,0);
  } else if(entity.type==='projectile') {
    mesh(group,new THREE.SphereGeometry(entity.radius,12,8),mat(color,{emissive:color,emissiveIntensity:0.5}),0,0.6,0);
  } else if(entity.type==='hazard') {
    mesh(group,new THREE.IcosahedronGeometry(entity.radius,0),mat(color,{emissive:'#7f1f3a',emissiveIntensity:0.3}),0,0.7,0);
    for(let i=0;i<4;i++) {
      const spike=mesh(group,new THREE.ConeGeometry(0.15,0.45,5),mat('#ffd0d8'),Math.cos(i*Math.PI/2)*0.54,0.7,Math.sin(i*Math.PI/2)*0.54);
      spike.rotation.z=Math.PI/2;
      spike.rotation.y=-i*Math.PI/2;
    }
  } else if(entity.type==='target') {
    const size=entity.radius;
    mesh(group,new THREE.DodecahedronGeometry(size,0),mat(color,{emissive:'#493590',emissiveIntensity:0.3}),0,size+0.12,0);
    const eye=mesh(group,new THREE.SphereGeometry(size*0.35,12,8),mat('#ffb6db',{emissive:'#9a3972'}),0,size+0.12,size*0.86);
    eye.userData.eye=true;
    if(entity.maxHp>1) {
      const ring=mesh(group,new THREE.TorusGeometry(size*1.25,0.06,8,32),mat('#ffd77c'),0,size+0.12,0);
      ring.rotation.x=Math.PI/2;
    }
  } else if(entity.type==='checkpoint'||entity.type==='exit') {
    const ring=mesh(group,new THREE.TorusGeometry(entity.radius,0.12,8,36),mat(color,{emissive:'#34856a',emissiveIntensity:0.5}),0,0.16,0);
    ring.rotation.x=Math.PI/2;
    mesh(group,new THREE.CylinderGeometry(0.08,0.08,1.4,8),mat(color),0,0.8,0);
    mesh(group,new THREE.OctahedronGeometry(0.25),mat('#f6fff8'),0,1.55,0);
  } else {
    const pickupMat=mat(color,{emissive:entity.type==='cyan'?'#155f6b':'#805420',emissiveIntensity:0.4});
    if(current.config.id==='key') {
      mesh(group,new THREE.TorusGeometry(0.3,0.1,8,24),pickupMat,0,1.05,0);
      mesh(group,new THREE.BoxGeometry(0.13,0.7,0.14),pickupMat,0,0.6,0);
      mesh(group,new THREE.BoxGeometry(0.25,0.13,0.14),pickupMat,0.12,0.3,0);
    } else if(current.config.id==='coin') {
      const coin=mesh(group,new THREE.CylinderGeometry(0.55,0.55,0.15,24),pickupMat,0,0.75,0);
      coin.rotation.x=Math.PI/2;
    } else if(current.config.id==='harvest') {
      mesh(group,new THREE.SphereGeometry(0.55,16,12),pickupMat,0,0.7,0);
      const leaf=mesh(group,new THREE.SphereGeometry(0.2,12,8),mat('#a3ee8d'),0.16,1.25,0);
      leaf.scale.set(1.6,0.4,0.8);
    } else {
      mesh(group,new THREE.OctahedronGeometry(0.6),pickupMat,0,0.75,0);
    }
    const ring=mesh(group,new THREE.TorusGeometry(0.72,0.04,6,24),mat(color),0,0.18,0);
    ring.rotation.x=Math.PI/2;
  }
  group.position.set(entity.x,0,entity.z);
  group.userData.entityType=entity.type;
  world.add(group);
  return group;
}

function syncScene(time) {
  playerMesh.position.set(current.player.x,0,current.player.z);
  playerMesh.visible=current.invulnerable<=0 || Math.floor(time*12)%2===0;
  playerMesh.rotation.y=Math.sin(time*3)*0.04;
  const present=new Set(current.entities.map(entity=>entity.id));
  for(const [id,object] of entityMeshes) {
    if(!present.has(id)) {world.remove(object);entityMeshes.delete(id);}
  }
  for(const entity of current.entities) {
    let object=entityMeshes.get(entity.id);
    if(object && object.userData.entityType!==entity.type) {
      world.remove(object);
      entityMeshes.delete(entity.id);
      object=null;
    }
    if(!object) {object=entityMesh(entity);entityMeshes.set(entity.id,object);}
    object.position.set(entity.x,0,entity.z);
    if(current.config.id==='harvest' && entity.type==='pickup') object.scale.setScalar(entity.ripe?1:0.55);
    if(current.config.id==='armor' && entity.type==='target') object.children[2].visible=Math.floor(current.elapsed/2)%2===0;
    if(current.config.id==='target' && entity.type==='target') {
      const first=current.entities.filter(item=>item.type==='target').reduce((a,b)=>a.order<b.order?a:b);
      object.scale.setScalar(entity.id===first.id?1.25:0.75);
    }
    if(entity.type==='pickup'||entity.type==='cyan') object.rotation.y=time*1.5;
    if(entity.type==='hazard') object.rotation.y=time*1.2;
  }
  while(shotMeshes.length<current.shots.length) {
    const shot=mesh(world,new THREE.SphereGeometry(0.15,10,8),mat('#dcff9c',{emissive:'#a9e658',emissiveIntensity:1}),0,0.6,0);
    shotMeshes.push(shot);
  }
  shotMeshes.forEach((object,index)=>{
    object.visible=index<current.shots.length;
    if(object.visible) object.position.set(current.shots[index].x,0.65,current.shots[index].z);
  });
  if(safeZone) {
    const radius=Math.max(3,8.5-current.elapsed*0.14);
    safeZone.scale.set(radius,1,radius);
  }
}

function resize() {
  if(!renderer||!camera||gameScreen.hidden) return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height) return;
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect=rect.width/rect.height;
  camera.position.set(0, camera.aspect<1?25:21, camera.aspect<1?27:24);
  camera.updateProjectionMatrix();
  camera.lookAt(0,0,0);
}
function startGame(id) {
  current=createGame(id);
  keys.clear();
  result.hidden=true;
  menu.hidden=true;
  gameScreen.hidden=false;
  $('#gameTitle').textContent=current.config.name;
  $('#gameCategory').textContent=`${current.config.group} / 3D ARCADE`;
  $('#mission').textContent=current.config.name;
  $('#description').textContent=current.config.desc;
  $('#actionHint').textContent=current.config.id==='marathon'?'hold to sprint; release to recover':current.config.id==='sniper'?'fire; release for 1 second to reload':current.config.id==='target'?'fire at the enlarged target':current.config.kind==='blast'?'fire at the nearest target':'not needed in this game';
  $('#tip').textContent=current.config.id==='target'?'Your shots aim at the larger highlighted target.':
    current.config.id==='armor'?'Gold rings show active shields. Wait for them to disappear before shooting.':
    current.config.id==='sniper'?'Fire three shots, then release space for one second to reload.':
    current.config.id==='boss'?'Keep moving to avoid the boss projectiles while firing.':
    current.config.id==='survive'?'Yellow circles warn where meteors will land. Escape before they turn red.':
    current.config.id==='rush'?'Red laser bars sweep across the arena. Move out of their path.':
    current.config.id==='oneheart'?'Never stop moving for two seconds. Red hazards still hurt.':
    current.config.id==='marathon'?'Hold space to sprint. Release it to recover energy.':
    current.config.id==='maze'?'Eight checkpoints, five fast mines, two hearts. Use the openings around the walls and keep moving.':
    current.config.id==='harvest'?'Small fruit is unripe. Wait until it grows before collecting it.':
    current.config.id==='rainbow'?'Pick the color shown in progress. The wrong crystal costs a heart.':
    current.config.kind==='blast'?'Hold space to fire. Your shots aim at the closest target.':
    current.config.kind==='race'?'The glowing ring is your next checkpoint. Touch it to reveal the next one.':
    current.config.kind==='survive'?'Red shapes hurt on contact. After a hit you briefly blink and are invulnerable.':
    current.config.exit?'Collect all the keys, then touch the green portal.':'Touch the glowing item to collect it. Avoid red hazards.';
  if(!renderer) {
    try {
      renderer=new THREE.WebGLRenderer({canvas,antialias:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.1;
    } catch(error) {
      $('#resultEyebrow').textContent='GRAPHICS ERROR';
      $('#resultTitle').textContent='Unable to start';
      $('#resultText').textContent=`WebGL could not start: ${error.message}. Try a WebGL-enabled browser.`;
      result.hidden=false;
      return;
    }
  }
  createScene();
  lastTime=0;
  updateHud();
}
function goMenu() {
  current=null;
  keys.clear();
  gameScreen.hidden=true;
  menu.hidden=false;
  result.hidden=true;
}
function updateHud() {
  const remaining=Math.max(0,Math.ceil(current.config.time-current.elapsed));
  $('#timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('#progress').textContent=progressText(current);
  $('#lives').textContent='♥ '.repeat(Math.max(0,current.lives)).trim() || '—';
  $('#status').textContent=current.status==='playing'?'GAME IN PROGRESS':current.status==='won'?'CHALLENGE COMPLETE':'GAME OVER';
}
function frame(time) {
  requestAnimationFrame(frame);
  if(!current||!renderer||!scene) return;
  const dt=lastTime?Math.min((time-lastTime)/1000,0.05):0;
  lastTime=time;
  if(current.status==='playing') {
    step(current,{up:keys.has('w')||keys.has('arrowup'),down:keys.has('s')||keys.has('arrowdown'),
      left:keys.has('a')||keys.has('arrowleft'),right:keys.has('d')||keys.has('arrowright'),fire:keys.has(' ')},dt);
    updateHud();
    if(current.status!=='playing') {
      $('#resultEyebrow').textContent=current.status==='won'?'MISSION COMPLETE':'BETTER LUCK NEXT TIME';
      $('#resultTitle').textContent=current.status==='won'?'YOU WIN!':'GAME OVER';
      $('#resultText').textContent=current.message;
      result.hidden=false;
    }
  }
  syncScene(time/1000);
  renderer.render(scene,camera);
}
window.addEventListener('keydown',event=>{
  if(!current) return;
  if(event.target instanceof HTMLSelectElement) return;
  const key=event.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
  if(key==='escape') {goMenu();return;}
  keys.add(key);
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('resize',resize);
skinSelect.addEventListener('change',()=>{
  skin=skinSelect.value;
  if(current && world && playerMesh) {
    world.remove(playerMesh);
    playerMesh.userData.resources.forEach(resource=>resource.dispose());
    playerMesh=makePlayer();
    world.add(playerMesh);
  }
});
$('#menuButton').addEventListener('click',goMenu);
$('#resultMenuButton').addEventListener('click',goMenu);
$('#retryButton').addEventListener('click',()=>startGame(current.config.id));
$('#restartButton').addEventListener('click',()=>startGame(current.config.id));
requestAnimationFrame(frame);
