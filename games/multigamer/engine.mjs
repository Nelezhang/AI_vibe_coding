// The simulation is independent of Three.js so each game's rules can be tested.
export const GAMES = [
  {id:'gem', name:'Gem Dash', group:'COLLECT', icon:'◆', color:'#b59aff', desc:'Find all eight gems scattered around the arena.', kind:'collect', goal:8, time:45},
  {id:'coin', name:'Coin Rush', group:'COLLECT', icon:'●', color:'#ffd779', desc:'Collect ten coins before they disappear; keep the combo alive.', kind:'collect', goal:10, time:60, hazards:2},
  {id:'rainbow', name:'Rainbow Run', group:'COLLECT', icon:'✦', color:'#ff95c0', desc:'Choose pink then cyan crystals in alternating order. Wrong colors cost a heart.', kind:'collect', goal:8, time:70, alternate:true},
  {id:'key', name:'Key Quest', group:'COLLECT', icon:'⚿', color:'#8ce6d0', desc:'Find five keys, then reach the green exit portal.', kind:'collect', goal:5, time:60, exit:true},
  {id:'harvest', name:'Garden Harvest', group:'COLLECT', icon:'✿', color:'#9de58a', desc:'Wait for fruit to ripen, then pick it while avoiding bugs.', kind:'collect', goal:8, time:75, hazards:2},
  {id:'target', name:'Target Practice', group:'BLAST', icon:'◎', color:'#ffb27b', desc:'Shoot the glowing target, then find the next one.', kind:'blast', goal:8, time:55},
  {id:'drone', name:'Drone Hunter', group:'BLAST', icon:'✣', color:'#8fdcff', desc:'Shoot ten moving drones before they touch you.', kind:'blast', goal:10, time:60, moving:true},
  {id:'armor', name:'Armor Breaker', group:'BLAST', icon:'⬡', color:'#b8a7ff', desc:'Shoot armored targets only while their shield is down.', kind:'blast', goal:6, time:75, hp:2},
  {id:'sniper', name:'Rapid Fire', group:'BLAST', icon:'➤', color:'#ffe08c', desc:'Clear twelve targets with a three-shot magazine. Release space to reload.', kind:'blast', goal:12, time:60, fastFire:true},
  {id:'boss', name:'Boss Battle', group:'BLAST', icon:'✹', color:'#ff8d9c', desc:'Defeat the moving boss while dodging its aimed projectiles.', kind:'blast', goal:1, time:75, moving:true, hp:12, boss:true},
  {id:'survive', name:'Meteor Dodge', group:'SURVIVE', icon:'☄', color:'#ff9f91', desc:'Escape meteor landing circles before they strike.', kind:'survive', time:30},
  {id:'swarm', name:'Swarm Escape', group:'SURVIVE', icon:'✺', color:'#f6c276', desc:'Outrun three chasing bots for 30 seconds.', kind:'survive', time:30, hazards:3, chase:true},
  {id:'storm', name:'Shrinking Storm', group:'SURVIVE', icon:'◉', color:'#bb9aff', desc:'Stay inside the shrinking safe zone for 35 seconds.', kind:'survive', time:35, hazards:2, shrink:true},
  {id:'oneheart', name:'One Heart', group:'SURVIVE', icon:'♥', color:'#ff91ad', desc:'Keep moving: standing still for two seconds ends your run.', kind:'survive', time:25, hazards:2, lives:1},
  {id:'rush', name:'Speed Trap', group:'SURVIVE', icon:'ϟ', color:'#ffd986', desc:'Dodge laser sweeps that alternate between rows and columns.', kind:'survive', time:25},
  {id:'trail', name:'Checkpoint Chase', group:'RACE', icon:'⚑', color:'#8be4c8', desc:'Run a fixed circuit of six checkpoints in order.', kind:'race', goal:6, time:45},
  {id:'sprint', name:'Speed Circuit', group:'RACE', icon:'➜', color:'#8cc8ff', desc:'Run through checkpoints; each one gives you a speed boost.', kind:'race', goal:8, time:35},
  {id:'maze', name:'Minefield Run', group:'RACE', icon:'⌁', color:'#ffbd8b', desc:'Navigate eight checkpoints in 60 seconds. Dodge five fast mines with only two hearts.', kind:'race', goal:8, time:60, hazards:5, lives:2},
  {id:'marathon', name:'Marathon', group:'RACE', icon:'♢', color:'#9ce9df', desc:'Hold space to sprint, then rest to recover stamina.', kind:'race', goal:12, time:80},
  {id:'precision', name:'Precision Path', group:'RACE', icon:'⌖', color:'#d5b5ff', desc:'Catch seven moving rings. Touching a red hazard ends the run.', kind:'race', goal:7, time:60, hazards:2, lives:1, small:true},
];

const LIMIT = 9;
const PLAYER_RADIUS = 0.48;
const PICKUP_RADIUS = 0.7;
const MOVE_SPEED = 5.8;
const SHOT_SPEED = 13;

function distance(a,b) { return Math.hypot(a.x-b.x,a.z-b.z); }
function randomPosition(rng, away = {x:0,z:0}, minimum = 2.5) {
  for (let i=0;i<80;i++) {
    const point = {x:(rng()*2-1)*7.5,z:(rng()*2-1)*7.5};
    if (distance(point,away)>=minimum) return point;
  }
  return {x: away.x > 0 ? -7 : 7, z: away.z > 0 ? -7 : 7};
}

export function createGame(id, rng = Math.random) {
  const config = GAMES.find(game => game.id === id);
  if (!config) throw new Error(`Unknown game: ${id}`);
  const state = {config, rng, player:{x:0,z:0}, entities:[], shots:[], elapsed:0, score:0,
    lives:config.lives ?? 3, invulnerable:0, fireCooldown:0, status:'playing', message:'', serial:0,
    ammo:3, reload:0, stamina:100, boost:0, still:0, combo:0, spawnTimer:0};
  for(let i=0;i<(config.hazards ?? 0);i++) spawnHazard(state, i);
  if(config.kind==='collect') {
    const count=id==='gem'?config.goal:id==='rainbow'?2:id==='harvest'?3:1;
    for(let i=0;i<count;i++) spawnPickup(state,i);
  }
  if(config.kind==='blast') {
    const count=config.boss ? 1 : Math.min(config.goal,4);
    for(let i=0;i<count;i++) spawnTarget(state);
  }
  if(id==='maze') {
    for(const [x,z,w,h] of [[-4,-3,1,10],[4,3,1,10],[0,2,6,1]])
      add(state,'wall',{x,z},{width:w,depth:h});
  }
  if(config.kind==='race') spawnCheckpoint(state);
  return state;
}

function add(state, type, pos, props={}) {
  const entity={id:++state.serial,type,x:pos.x,z:pos.z,...props};
  state.entities.push(entity);
  return entity;
}
function spawnPickup(state, index=0) {
  const type=state.config.alternate && index%2 ? 'cyan' : 'pickup';
  add(state,type,randomPosition(state.rng,state.player,3),{radius:PICKUP_RADIUS,
    age:0, ripe:state.config.id!=='harvest', lifetime:state.config.id==='coin'?6:Infinity});
}
function spawnCheckpoint(state) {
  const circuit=[[-7,-7],[0,-7],[7,-7],[7,7],[0,7],[-7,7]];
  const minefieldRoute=[[-7,-7],[-7,6],[0,7],[0,-5],[7,-5],[7,6],[0,7],[-7,-7]];
  let point;
  if(state.config.id==='trail') point={x:circuit[state.score][0],z:circuit[state.score][1]};
  else if(state.config.id==='maze') point={x:minefieldRoute[state.score][0],z:minefieldRoute[state.score][1]};
  else point=randomPosition(state.rng,state.player,4);
  const angle=state.rng()*Math.PI*2;
  add(state,'checkpoint',point,{radius:state.config.small?0.48:0.85,
    vx:Math.cos(angle)*2,vz:Math.sin(angle)*2});
}
function spawnTarget(state) {
  const hp=state.config.hp ?? 1;
  const angle=state.rng()*Math.PI*2;
  add(state,'target',randomPosition(state.rng,state.player,4),{hp,maxHp:hp, order:state.serial,
    radius:state.config.boss?1.15:0.65,vx:Math.cos(angle)*1.8,vz:Math.sin(angle)*1.8});
}
function spawnHazard(state, index) {
  const angle=state.rng()*Math.PI*2;
  const speed=state.config.id==='maze'?3.6:state.config.fast?4:2.5;
  add(state,'hazard',randomPosition(state.rng,state.player,4),{radius:0.62,
    vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed, phase:index});
}
function hurt(state) {
  if(state.invulnerable>0) return;
  state.lives--;
  state.invulnerable=1.35;
  if(state.lives<=0) finish(state,false,'You ran out of hearts.');
}
function finish(state,win,message) {
  state.status=win?'won':'lost';
  state.message=message;
}
function shoot(state) {
  if(state.config.kind!=='blast'||state.fireCooldown>0) return;
  if(state.config.id==='sniper'&&state.ammo===0) return;
  const targets=state.entities.filter(entity=>entity.type==='target');
  if(!targets.length) return;
  const target=state.config.id==='target'?targets.reduce((first,item)=>item.order<first.order?item:first):
    targets.reduce((nearest,item)=>distance(item,state.player)<distance(nearest,state.player)?item:nearest);
  const dx=target.x-state.player.x, dz=target.z-state.player.z;
  const length=Math.hypot(dx,dz)||1;
  state.shots.push({x:state.player.x,z:state.player.z,vx:dx/length*SHOT_SPEED,vz:dz/length*SHOT_SPEED,life:2});
  state.fireCooldown=state.config.fastFire?0.12:0.28;
  if(state.config.id==='sniper') {state.ammo--;state.reload=0;}
}

export function step(state, input, dt) {
  if(state.status!=='playing') return;
  dt=Math.max(0,Math.min(dt,0.05));
  state.elapsed+=dt;
  state.invulnerable=Math.max(0,state.invulnerable-dt);
  state.fireCooldown=Math.max(0,state.fireCooldown-dt);
  const dx=Number(Boolean(input.right))-Number(Boolean(input.left));
  const dz=Number(Boolean(input.down))-Number(Boolean(input.up));
  const length=Math.hypot(dx,dz)||1;
  state.boost=Math.max(0,state.boost-dt);
  let speed=MOVE_SPEED*(state.boost>0?1.55:1);
  if(state.config.id==='marathon') {
    if(input.fire && (dx||dz) && state.stamina>0) {
      speed*=1.7;
      state.stamina=Math.max(0,state.stamina-35*dt);
    } else state.stamina=Math.min(100,state.stamina+22*dt);
  }
  const blocked=(x,z)=>state.entities.some(entity=>entity.type==='wall' &&
    Math.abs(x-entity.x)<entity.width/2+PLAYER_RADIUS &&
    Math.abs(z-entity.z)<entity.depth/2+PLAYER_RADIUS);
  const nextX=Math.max(-LIMIT,Math.min(LIMIT,state.player.x+dx/length*speed*dt));
  const nextZ=Math.max(-LIMIT,Math.min(LIMIT,state.player.z+dz/length*speed*dt));
  const previousX=state.player.x, previousZ=state.player.z;
  if(!blocked(nextX,state.player.z)) state.player.x=nextX;
  if(!blocked(state.player.x,nextZ)) state.player.z=nextZ;
  if(state.config.id==='oneheart') {
    state.still=(state.player.x!==previousX||state.player.z!==previousZ)?0:state.still+dt;
    if(state.still>=2) {finish(state,false,'You stopped moving for too long.');return;}
  }
  if(state.config.id==='sniper' && !input.fire && state.ammo<3) {
    state.reload+=dt;
    if(state.reload>=1) {state.ammo=3;state.reload=0;}
  }
  if(input.fire) shoot(state);

  state.spawnTimer-=dt;
  if(state.config.id==='survive' && state.spawnTimer<=0) {
    add(state,'warning',randomPosition(state.rng,{x:20,z:20},0),{radius:1.55,age:0});
    state.spawnTimer=0.8;
  }
  if(state.config.id==='rush' && state.spawnTimer<=0) {
    const horizontal=Math.floor(state.elapsed/3)%2===0;
    add(state,'laser',{x:horizontal?0:-9,z:horizontal?-9:0},
      {horizontal,width:horizontal?20:1,depth:horizontal?1:20,vx:horizontal?0:4,vz:horizontal?4:0});
    state.spawnTimer=2.5;
  }
  if(state.config.id==='boss' && state.spawnTimer<=0) {
    const boss=state.entities.find(entity=>entity.type==='target');
    if(boss) {
      const vx=state.player.x-boss.x,vz=state.player.z-boss.z;
      const d=Math.hypot(vx,vz)||1;
      add(state,'projectile',boss,{radius:0.35,vx:vx/d*5,vz:vz/d*5,age:0});
    }
    state.spawnTimer=1.5;
  }
  if(state.config.shrink) {
    const safe=Math.max(3,8.5-state.elapsed*0.14);
    if(Math.abs(state.player.x)>safe||Math.abs(state.player.z)>safe) hurt(state);
  }
  for(const entity of [...state.entities]) {
    if(entity.type==='warning') {
      entity.age+=dt;
      if(entity.age>=1) {entity.type='impact';entity.age=0;}
    } else if(entity.type==='impact') {
      entity.age+=dt;
      if(distance(entity,state.player)<entity.radius+PLAYER_RADIUS) hurt(state);
      if(entity.age>=0.5) state.entities.splice(state.entities.indexOf(entity),1);
    }
    if(entity.type==='laser') {
      entity.x+=entity.vx*dt;entity.z+=entity.vz*dt;
      if(Math.abs(entity.x-state.player.x)<entity.width/2+PLAYER_RADIUS &&
        Math.abs(entity.z-state.player.z)<entity.depth/2+PLAYER_RADIUS) hurt(state);
      if(Math.abs(entity.x)>11||Math.abs(entity.z)>11) state.entities.splice(state.entities.indexOf(entity),1);
    }
    if(entity.type==='projectile') {
      entity.x+=entity.vx*dt;entity.z+=entity.vz*dt;entity.age+=dt;
      if(distance(entity,state.player)<entity.radius+PLAYER_RADIUS) {
        hurt(state);state.entities.splice(state.entities.indexOf(entity),1);
      } else if(entity.age>5) state.entities.splice(state.entities.indexOf(entity),1);
    }
    if(entity.type==='pickup'||entity.type==='cyan') {
      entity.age+=dt;
      if(state.config.id==='harvest') entity.ripe=entity.age>=2;
      if(entity.age>=entity.lifetime) {
        state.entities.splice(state.entities.indexOf(entity),1);
        state.combo=0;
        spawnPickup(state);
        continue;
      }
    }
    if(entity.type==='hazard'||(entity.type==='target'&&state.config.moving)||
      (entity.type==='checkpoint'&&state.config.id==='precision')) {
      if(entity.type==='hazard'&&state.config.chase) {
        const vx=state.player.x-entity.x,vz=state.player.z-entity.z;
        const d=Math.hypot(vx,vz)||1;
        entity.vx=vx/d*2.7; entity.vz=vz/d*2.7;
      }
      entity.x+=entity.vx*dt; entity.z+=entity.vz*dt;
      if(Math.abs(entity.x)>8.4) {entity.x=Math.max(-8.4,Math.min(8.4,entity.x));entity.vx*=-1;}
      if(Math.abs(entity.z)>8.4) {entity.z=Math.max(-8.4,Math.min(8.4,entity.z));entity.vz*=-1;}
    }
    if((entity.type==='hazard'||(entity.type==='target'&&state.config.moving))&&distance(entity,state.player)<entity.radius+PLAYER_RADIUS) hurt(state);
    if(state.status!=='playing') return;
    if(['pickup','cyan','checkpoint','exit'].includes(entity.type)&&distance(entity,state.player)<entity.radius+PLAYER_RADIUS) {
      if(entity.type==='pickup'||entity.type==='cyan') {
        if(!entity.ripe) continue;
        if(state.config.alternate && (entity.type==='cyan')!==(state.score%2===1)) {
          hurt(state);
          if(state.status!=='playing') return;
          continue;
        }
      }
      state.entities.splice(state.entities.indexOf(entity),1);
      if(entity.type==='exit') { finish(state,true,'You found every key and reached the exit!'); return; }
      state.score++;
      if(state.config.id==='coin') state.combo++;
      if(state.config.id==='sprint') state.boost=2.5;
      if(state.score>=state.config.goal) {
        if(state.config.exit) add(state,'exit',randomPosition(state.rng,state.player,4),{radius:0.9});
        else {finish(state,true,'Challenge complete!');return;}
      } else if(state.config.id==='gem') {
        // All gems are present from the start.
      } else if(state.config.alternate) spawnPickup(state,entity.type==='cyan'?1:0);
      else if(state.config.kind==='collect') spawnPickup(state);
      else if(state.config.kind==='race') spawnCheckpoint(state);
    }
  }
  for(const shot of [...state.shots]) {
    shot.x+=shot.vx*dt; shot.z+=shot.vz*dt; shot.life-=dt;
    const target=state.entities.find(entity=>entity.type==='target'&&distance(entity,shot)<entity.radius+0.18);
    if(target) {
      const shielded=state.config.id==='armor' && Math.floor(state.elapsed/2)%2===0;
      if(!shielded) target.hp--;
      if(target.hp<=0) {
        state.entities.splice(state.entities.indexOf(target),1);
        state.score++;
        if(state.score>=state.config.goal) {finish(state,true,'Every target is down!');return;}
        if(state.score+state.entities.filter(entity=>entity.type==='target').length<state.config.goal) spawnTarget(state);
      }
    }
    if(target||shot.life<=0||Math.abs(shot.x)>10||Math.abs(shot.z)>10) state.shots.splice(state.shots.indexOf(shot),1);
  }
  if(state.elapsed>=state.config.time) {
    if(state.config.kind==='survive') finish(state,true,'You survived the challenge!');
    else finish(state,false,'Time is up. Try again!');
  }
}

export function progressText(state) {
  if(state.config.id==='oneheart') return `${Math.max(0,2-state.still).toFixed(1)}s to move`;
  if(state.config.id==='coin') return `${state.score} / ${state.config.goal} · ${state.combo} combo`;
  if(state.config.id==='sniper') return `${state.score} / ${state.config.goal} · ${state.ammo}/3 shots`;
  if(state.config.id==='marathon') return `${state.score} / ${state.config.goal} · ${Math.round(state.stamina)}% energy`;
  if(state.config.id==='rainbow') return `${state.score} / ${state.config.goal} · ${state.score%2?'CYAN':'PINK'}`;
  if(state.config.id==='armor') return `${state.score} / ${state.config.goal} · ${Math.floor(state.elapsed/2)%2===0?'SHIELD UP':'SHIELD DOWN'}`;
  if(state.config.kind==='survive') return `${Math.min(Math.floor(state.elapsed),state.config.time)} / ${state.config.time} sec`;
  if(state.config.exit && state.score>=state.config.goal) return 'REACH THE EXIT';
  if(state.config.boss) {
    const boss=state.entities.find(entity=>entity.type==='target');
    return boss ? `${boss.maxHp-boss.hp} / ${boss.maxHp} hits` : '12 / 12 hits';
  }
  return `${state.score} / ${state.config.goal}`;
}
