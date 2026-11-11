import test from 'node:test';
import assert from 'node:assert/strict';
import {GAMES, createGame, step, progressText} from './engine.mjs';

function rng() {
  let seed=1234567;
  return () => {seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
}
const idle={};

test('all twenty unique games initialize and advance',()=>{
  assert.equal(GAMES.length,20);
  assert.equal(new Set(GAMES.map(game=>game.id)).size,20);
  for(const game of GAMES) {
    const state=createGame(game.id,rng());
    step(state,idle,0.05);
    assert.equal(state.status,'playing',game.name);
    assert.ok(progressText(state),game.name);
  }
  assert.throws(()=>createGame('unknown'),/Unknown game/);
});

test('all collect and race games can complete their objective',()=>{
  for(const game of GAMES.filter(item=>item.kind==='collect'||item.kind==='race')) {
    const state=createGame(game.id,rng());
    while(state.status==='playing') {
      const target=state.entities.find(item=>['pickup','cyan','checkpoint','exit'].includes(item.type) &&
        (!game.alternate || item.type===(state.score%2?'cyan':'pickup')));
      assert.ok(target,game.name);
      state.player.x=target.x;state.player.z=target.z;
      state.invulnerable=10;
      if(game.id==='harvest') target.age=2;
      step(state,idle,0.01);
    }
    assert.equal(state.status,'won',game.name);
    assert.equal(state.score,game.goal,game.name);
  }
});

test('all blasting games can defeat their targets',()=>{
  for(const game of GAMES.filter(item=>item.kind==='blast')) {
    const state=createGame(game.id,rng());
    for(let frame=0;frame<10000&&state.status==='playing';frame++) {
      state.invulnerable=10;
      step(state,{fire:game.id!=='sniper'||state.ammo>0},0.05);
    }
    assert.equal(state.status,'won',`${game.name}: ${progressText(state)}`);
  }
});

test('all survival games win after their timer and collisions lose hearts',()=>{
  for(const game of GAMES.filter(item=>item.kind==='survive')) {
    const state=createGame(game.id,rng());
    state.entities=[];
    for(let frame=0;frame<1000&&state.status==='playing';frame++) {
      state.invulnerable=10;
      step(state,game.id==='oneheart'?{left:frame%40<20,right:frame%40>=20}:idle,0.05);
    }
    assert.equal(state.status,'won',game.name);
  }
  const state=createGame('oneheart',rng());
  const hazard=state.entities[0];
  hazard.x=state.player.x;hazard.z=state.player.z;hazard.vx=0;hazard.vz=0;
  step(state,idle,0.01);
  assert.equal(state.status,'lost');
  assert.equal(state.lives,0);
});

test('collection games each implement their own mechanic',()=>{
  const gems=createGame('gem',rng());
  assert.equal(gems.entities.filter(e=>e.type==='pickup').length,8);
  const coins=createGame('coin',rng());
  const coin=coins.entities.find(e=>e.type==='pickup');
  coin.age=coin.lifetime;
  step(coins,idle,0.01);
  assert.ok(!coins.entities.includes(coin));
  const rainbow=createGame('rainbow',rng());
  const wrong=rainbow.entities.find(e=>e.type==='cyan');
  rainbow.player.x=wrong.x;rainbow.player.z=wrong.z;
  step(rainbow,idle,0.01);
  assert.equal(rainbow.lives,2);
  assert.equal(rainbow.score,0);
  const fruit=createGame('harvest',rng());
  const unripe=fruit.entities.find(e=>e.type==='pickup');
  fruit.player.x=unripe.x;fruit.player.z=unripe.z;
  step(fruit,idle,0.01);
  assert.equal(fruit.score,0);
  unripe.age=2;
  step(fruit,idle,0.01);
  assert.equal(fruit.score,1);
});

test('special blasting rules enforce shields and reloads',()=>{
  const armor=createGame('armor',rng());
  const target=armor.entities.find(e=>e.type==='target');
  armor.shots.push({x:target.x,z:target.z,vx:0,vz:0,life:1});
  step(armor,idle,0.01);
  assert.equal(target.hp,2);
  armor.elapsed=2;
  armor.shots.push({x:target.x,z:target.z,vx:0,vz:0,life:1});
  step(armor,idle,0.01);
  assert.equal(target.hp,1);
  const rapid=createGame('sniper',rng());
  for(let i=0;i<20;i++) step(rapid,{fire:true},0.05);
  assert.equal(rapid.ammo,0);
  for(let i=0;i<21;i++) step(rapid,idle,0.05);
  assert.equal(rapid.ammo,3);
  const boss=createGame('boss',rng());
  step(boss,idle,0.05);
  assert.ok(boss.entities.some(e=>e.type==='projectile'));
});

test('survival and racing mechanics respond to player actions',()=>{
  const meteor=createGame('survive',rng());
  step(meteor,idle,0.05);
  assert.ok(meteor.entities.some(e=>e.type==='warning'));
  const lasers=createGame('rush',rng());
  step(lasers,idle,0.05);
  assert.ok(lasers.entities.some(e=>e.type==='laser'));
  const still=createGame('oneheart',rng());
  for(let i=0;i<41;i++) step(still,idle,0.05);
  assert.equal(still.status,'lost');
  const marathon=createGame('marathon',rng());
  step(marathon,{right:true,fire:true},0.05);
  assert.ok(marathon.stamina<100);
  const energy=marathon.stamina;
  step(marathon,idle,0.05);
  assert.ok(marathon.stamina>energy);
  const maze=createGame('maze',rng());
  assert.equal(maze.entities.filter(e=>e.type==='wall').length,3);
  maze.player.x=-3; maze.player.z=-3;
  step(maze,{left:true},0.05);
  assert.equal(maze.player.x,-3);
  const precision=createGame('precision',rng());
  const ring=precision.entities.find(e=>e.type==='checkpoint');
  const x=ring.x,z=ring.z;
  step(precision,idle,0.05);
  assert.ok(ring.x!==x||ring.z!==z);
});

test('movement is normalized, limited, and non-survival games lose at timeout',()=>{
  const state=createGame('gem',rng());
  step(state,{right:true,down:true},0.05);
  assert.ok(Math.abs(Math.hypot(state.player.x,state.player.z)-5.8*0.05)<0.00001);
  state.player.x=9;
  step(state,{right:true},0.05);
  assert.equal(state.player.x,9);
  state.elapsed=state.config.time-0.01;
  step(state,idle,0.05);
  assert.equal(state.status,'lost');
});

test('Minefield Run is substantially harder and its checkpoint route is navigable',()=>{
  const state=createGame('maze',rng());
  assert.equal(state.config.goal,8);
  assert.equal(state.config.time,60);
  assert.equal(state.lives,2);
  const hazards=state.entities.filter(e=>e.type==='hazard');
  assert.equal(hazards.length,5);
  for(const hazard of hazards) {
    assert.ok(Math.abs(Math.hypot(hazard.vx,hazard.vz)-3.6)<1e-9);
    assert.ok(Math.hypot(hazard.x,hazard.z)>=4);
  }
  // Verify movement and time along a real collision-respecting path; test hazards separately.
  state.entities=state.entities.filter(e=>e.type!=='hazard');
  const walls=state.entities.filter(e=>e.type==='wall');
  const spacing=0.29;
  const blocked=(x,z)=>Math.abs(x)>9||Math.abs(z)>9||walls.some(w=>
    Math.abs(x-w.x)<w.width/2+0.48 && Math.abs(z-w.z)<w.depth/2+0.48);
  const directions=[[1,0,'right'],[-1,0,'left'],[0,1,'down'],[0,-1,'up']];
  while(state.status==='playing') {
    const target=state.entities.find(e=>e.type==='checkpoint');
    assert.ok(target);
    const startX=state.player.x,startZ=state.player.z;
    const queue=[[0,0,[]]], seen=new Set(['0,0']);
    let path;
    for(let i=0;i<queue.length;i++) {
      const [x,z,steps]=queue[i];
      const px=startX+x*spacing,pz=startZ+z*spacing;
      if(Math.hypot(px-target.x,pz-target.z)<target.radius+0.48-0.01) {path=steps;break;}
      for(const [dx,dz,key] of directions) {
        const nx=x+dx,nz=z+dz,id=`${nx},${nz}`;
        if(!seen.has(id)&&!blocked(startX+nx*spacing,startZ+nz*spacing)) {
          seen.add(id);queue.push([nx,nz,[...steps,key]]);
        }
      }
    }
    assert.ok(path,`Checkpoint ${state.score+1} must be reachable`);
    for(const key of path) {
      step(state,{[key]:true},0.05);
      if(state.status!=='playing'||!state.entities.includes(target)) break;
    }
  }
  assert.equal(state.status,'won');
  assert.ok(state.elapsed<60);
});

test('Minefield Run ends after two mine hits and after its time limit',()=>{
  const state=createGame('maze',rng());
  const hazard=state.entities.find(e=>e.type==='hazard');
  hazard.x=0;hazard.z=0;hazard.vx=0;hazard.vz=0;
  step(state,idle,0.01);
  assert.equal(state.lives,1);
  state.invulnerable=0;
  step(state,idle,0.01);
  assert.equal(state.status,'lost');
  const timed=createGame('maze',rng());
  timed.elapsed=59.99;
  step(timed,idle,0.05);
  assert.equal(timed.status,'lost');
});
