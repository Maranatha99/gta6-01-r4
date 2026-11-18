// SOLMAR BAY — the rules and the state, with no drawing and no browser in it.
// The player walks and drives around the city, steals cars, earns wanted stars,
// fights the police and works through six story missions. step() advances one
// fixed step and returns what happened as bit flags, so the caller (main.js) can
// play sounds and change screens without the world knowing about them.
import {
  BULLET_RANGE, BULLET_SPEED, CAR_MODELS, CRIME, LANE, MAG_SIZE, PED_COUNT, PICKUP_COUNT,
  PISTOL_DAMAGE, PLAYER_HEALTH, PLAYER_RADIUS, REPAIR_COST, SAND_TOP, START_MONEY,
  STEP, TRAFFIC_COUNT, WALK_SPEED, WANTED_DECAY_SECONDS, WATER_TOP, WORLD_H, WORLD_W,
} from './config.js';
import { buildCity, nearestRoad, onRoad, PLACES } from './city.js';
import { missionById, nextMission } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_EXPLOSION = 4;
export const EVENT_PICKUP = 8;
export const EVENT_MISSION = 16;
export const EVENT_WASTED = 32;
export const EVENT_BUSTED = 64;
export const EVENT_CRIME = 128;
export const EVENT_COMPLETE = 256;
export const EVENT_RELOAD = 512;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function createWorld(random, save) {
  const city = buildCity(random);
  let carId = 0;

  const player = {
    x: PLACES.spawn.x, y: PLACES.spawn.y, angle: -Math.PI / 2,
    health: PLAYER_HEALTH, money: START_MONEY, inCar: null,
    mag: MAG_SIZE, reserve: 999, reloadTimer: 0, aimAngle: 0,
    bustedTimer: 0, invuln: 0, onFoot: true,
  };
  const state = {
    player, city, cars: [], peds: [], cops: [], bullets: [], particles: [],
    skids: [], pickups: [], wanted: 0, wantedTimer: 0, crimeTimer: 99,
    elapsed: 0, mission: null, doneIds: [], message: [], stats: { earned: 0, stolen: 0, escaped: 0 },
    nearStart: null, nearGarage: false, prompt: '',
  };
  if (save) {
    if (Number.isFinite(save.money)) player.money = save.money;
    if (Array.isArray(save.doneIds)) state.doneIds = save.doneIds.slice();
    if (Number.isFinite(save.earned)) state.stats.earned = save.earned;
  }

  function addMessage(text) {
    state.message.push({ text, t: state.elapsed });
    if (state.message.length > 4) state.message.shift();
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    state.wantedTimer = 0;
    if (state.wanted > before) return EVENT_CRIME;
    return 0;
  }

  function spawnParticles(x, y, count, colour, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * TAU;
      const s = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: random.range(life * 0.5, life), maxLife: life,
        size: random.range(size * 0.6, size * 1.4), colour, kind: 'dot',
      });
      if (state.particles.length > 400) state.particles.shift();
    }
  }

  function explode(x, y, big) {
    spawnParticles(x, y, big ? 42 : 22, '#ff9d2e', big ? 420 : 300, 0.9, big ? 16 : 10);
    spawnParticles(x, y, big ? 26 : 12, '#5a5a5a', 140, 1.6, 14);
    spawnParticles(x, y, 10, '#ffe08a', 520, 0.4, 8);
    if (dist(player.x, player.y, x, y) < 150) hurtPlayer(big ? 30 : 15);
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(car.x, car.y, x, y);
      if (d < 150) damageCar(car, big ? 120 : 60, false);
    }
    return EVENT_EXPLOSION;
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0) return;
    player.health -= amount;
    player.invuln = 0.4;
    spawnParticles(player.x, player.y, 8, '#d21f5e', 200, 0.5, 6);
  }

  function makeCar(modelIndex, x, y, angle, opts = {}) {
    const model = CAR_MODELS[modelIndex];
    const car = {
      id: carId += 1, model: model.name, modelIndex, top: model.top, accel: model.accel,
      colour: opts.colour ?? model.colour, x, y, angle, speed: 0,
      health: 100, traffic: !!opts.traffic, police: !!opts.police, driver: !!opts.driver,
      dead: false, parked: !!opts.parked, player: false, stolen: false,
      dirX: 0, dirY: 0, targetSpeed: 0, turnCooldown: 0, ramCooldown: 0,
      smoke: 0, sirenPhase: random.next() * TAU,
    };
    if (opts.traffic) {
      const road = nearestRoad(x, y);
      car.dirX = road.vertical ? 0 : 1;
      car.dirY = road.vertical ? 1 : 0;
      if (random.chance(0.5)) { car.dirX *= -1; car.dirY *= -1; }
      car.angle = Math.atan2(car.dirY, car.dirX);
      car.targetSpeed = random.range(130, 185);
      car.speed = car.targetSpeed;
    }
    return car;
  }

  function spawnTrafficCar() {
    const vertical = random.chance(0.5);
    let x; let y;
    if (vertical) {
      x = random.pick([300, 750, 1200, 1650, 2100, 2550, 3000]);
      y = random.range(200, 2200);
    } else {
      x = random.range(200, 3200);
      y = random.pick([300, 750, 1200, 1650, 2100]);
    }
    return makeCar(random.int(0, 4), x, y, 0, { traffic: true, driver: true });
  }

  function spawnPed() {
    const vertical = random.chance(0.5);
    let x; let y;
    if (vertical) {
      const rx = random.pick([300, 750, 1200, 1650, 2100, 2550, 3000]);
      x = rx + (random.chance(0.5) ? 62 : -62);
      y = random.range(150, 2250);
    } else {
      const ry = random.pick([300, 750, 1200, 1650, 2100]);
      x = random.range(150, 3250);
      y = ry + (random.chance(0.5) ? 62 : -62);
    }
    return {
      x, y, angle: random.next() * TAU, speed: random.range(45, 75),
      colour: random.pick(['#e8e4da', '#3f6fb5', '#c94f43', '#7a7d84', '#e8b93a', '#81b29a']),
      flee: 0, fleeX: 0, fleeY: 0, dead: false, deadTimer: 0, bob: random.next() * TAU,
    };
  }

  function resetWorld() {
    state.cars.length = 0;
    state.peds.length = 0;
    state.cops.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.skids.length = 0;
    state.pickups.length = 0;
    player.x = PLACES.spawn.x;
    player.y = PLACES.spawn.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER_HEALTH;
    player.inCar = null;
    player.onFoot = true;
    player.mag = MAG_SIZE;
    player.reloadTimer = 0;
    player.bustedTimer = 0;
    player.invuln = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeTimer = 99;
    state.elapsed = 0;
    state.mission = null;
    state.message.length = 0;

    // Parked cars: a few along the roads plus the Vortex GT in its lot.
    for (let i = 0; i < 12; i += 1) {
      const vertical = random.chance(0.5);
      let x; let y; let angle;
      if (vertical) {
        x = random.pick([300, 750, 1200, 1650, 2100, 2550, 3000]) + (random.chance(0.5) ? 34 : -34);
        y = random.range(200, 2200);
        angle = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = random.range(200, 3200);
        y = random.pick([300, 750, 1200, 1650, 2100]) + (random.chance(0.5) ? 34 : -34);
        angle = random.chance(0.5) ? 0 : Math.PI;
      }
      state.cars.push(makeCar(random.int(0, 4), x, y, angle, { parked: true }));
    }
    state.cars.push(makeCar(5, 2612, 2130, Math.PI / 2, { parked: true }));
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed());
    for (let i = 0; i < PICKUP_COUNT; i += 1) {
      const cash = random.chance(0.7);
      state.pickups.push({
        x: random.range(150, 3350), y: random.range(150, 2250),
        kind: cash ? 'cash' : 'health', taken: false, bob: random.next() * TAU,
      });
    }
    addMessage('SOLMAR BAY — Riko Vale is out. Find Mara. Start the first job at the yellow M.');
  }

  // ---- damage & death -------------------------------------------------------
  function damageCar(car, amount, byPlayer) {
    if (car.dead) return 0;
    car.health -= amount;
    car.smoke = clamp(100 - car.health, 0, 100);
    if (car.health <= 0) {
      car.dead = true;
      car.speed = 0;
      let events = explode(car.x, car.y, true);
      if (car.police) events |= addWanted(CRIME.killCop);
      else if (byPlayer) events |= addWanted(CRIME.explode);
      if (car.player) {
        player.inCar = null;
        player.onFoot = true;
        player.x = car.x + 40;
        player.y = car.y;
        hurtPlayer(20);
      }
      return events;
    }
    return 0;
  }

  function nearestCar(x, y, maxDist, filter) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (car.dead || car.police) continue;
      if (filter && !filter(car)) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function blockedByBuilding(x, y, r) {
    for (const b of city.buildings) {
      if (b.park) continue;
      if (circleHitsRect(x, y, r, b)) return true;
    }
    return false;
  }

  function moveWithBuildings(entity, nx, ny, r) {
    // Slide along walls: try the full step, then each axis alone. A step that
    // would still overlap a building is refused — and if the entity is already
    // overlapping one (a tight corner cut), push it out along the shortest way,
    // so nothing can ever wedge itself into a gap narrower than its radius.
    if (!blockedByBuilding(nx, ny, r) && ny < WATER_TOP) {
      entity.x = nx; entity.y = ny;
    } else if (!blockedByBuilding(nx, entity.y, r) && entity.y < WATER_TOP) {
      entity.x = nx;
    } else if (!blockedByBuilding(entity.x, ny, r) && ny < WATER_TOP) {
      entity.y = ny;
    }
    for (const b of city.buildings) {
      if (b.park) continue;
      const cx = clamp(entity.x, b.x, b.x + b.w);
      const cy = clamp(entity.y, b.y, b.y + b.h);
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = r - d;
          entity.x += (dx / d) * push;
          entity.y += (dy / d) * push;
        } else {
          entity.y = b.y - r;
        }
      }
    }
    if (entity.y >= WATER_TOP) entity.y = WATER_TOP - 1;
  }

  // ---- player actions -------------------------------------------------------
  function enterCar() {
    const car = nearestCar(player.x, player.y, 70);
    if (!car) return 0;
    car.traffic = false;
    car.parked = false;
    car.player = true;
    car.speed = 0;
    player.inCar = car;
    player.onFoot = false;
    let events = 0;
    if (car.driver) {
      // The driver bails and runs.
      car.driver = false;
      const driver = spawnPed();
      driver.x = car.x + 30; driver.y = car.y + 10;
      driver.flee = 4; driver.fleeX = car.x; driver.fleeY = car.y;
      state.peds.push(driver);
      car.stolen = true;
      state.stats.stolen += 1;
      events |= addWanted(CRIME.steal);
      addMessage(`Stole a ${car.model} — the cops noticed.`);
    } else if (car.parked) {
      car.stolen = true;
      state.stats.stolen += 1;
      events |= addWanted(CRIME.steal);
      addMessage(`Stole a parked ${car.model}.`);
    }
    if (state.mission) {
      const step = currentStep();
      if (step && step.kind === 'steal' && (!step.vortex || car.modelIndex === 5)) {
        car.stolenDuringMission = true;
      }
    }
    return events;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    car.player = false;
    car.speed = 0;
    player.inCar = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.angle = car.angle;
  }

  function shoot(aimX, aimY) {
    if (player.reloadTimer > 0) return 0;
    if (player.mag <= 0) {
      player.reloadTimer = 1.1;
      return EVENT_RELOAD;
    }
    player.mag -= 1;
    player.aimAngle = angleTo(player.x, player.y, aimX, aimY);
    const gx = player.x + Math.cos(player.aimAngle) * 22;
    const gy = player.y + Math.sin(player.aimAngle) * 22;
    state.bullets.push({
      x: gx, y: gy,
      vx: Math.cos(player.aimAngle) * BULLET_SPEED,
      vy: Math.sin(player.aimAngle) * BULLET_SPEED,
      life: BULLET_RANGE / BULLET_SPEED, fromPlayer: true,
    });
    spawnParticles(gx, gy, 4, '#ffe08a', 260, 0.15, 5);
    // The shot echoes: peds nearby run, and the law takes notice.
    let events = EVENT_SHOT | addWanted(CRIME.shoot);
    for (const ped of state.peds) {
      if (!ped.dead && dist(ped.x, ped.y, player.x, player.y) < 320) {
        ped.flee = 3; ped.fleeX = player.x; ped.fleeY = player.y;
      }
    }
    return events;
  }

  // ---- traffic --------------------------------------------------------------
  function stepTraffic(car, dt) {
    if (car.dead) return;
    // Lane keeping: right-hand traffic, one lane each way.
    if (car.dirX !== 0) {
      const road = nearestRoad(car.x, car.y);
      // Horizontal road: desired y is the lane.
      const wantY = road.centre + (car.dirX > 0 ? LANE : -LANE);
      car.y += clamp(wantY - car.y, -90 * dt, 90 * dt);
    } else {
      const road = nearestRoad(car.x, car.y);
      const wantX = road.centre + (car.dirY > 0 ? -LANE : LANE);
      car.x += clamp(wantX - car.x, -90 * dt, 90 * dt);
    }
    // Turning at intersections.
    car.turnCooldown -= dt;
    const nearX = car.dirX !== 0
      ? [300, 750, 1200, 1650, 2100, 2550, 3000].find((rx) => Math.abs(car.x - rx) < 46)
      : undefined;
    const nearY = car.dirY !== 0
      ? [300, 750, 1200, 1650, 2100].find((ry) => Math.abs(car.y - ry) < 46)
      : undefined;
    if (car.turnCooldown <= 0 && (nearX !== undefined || nearY !== undefined)) {
      const roll = random.next();
      if (roll < 0.22) {
        // Turn left or right onto the crossing road.
        const turnRight = random.chance(0.5);
        if (car.dirX !== 0) {
          car.dirY = turnRight ? car.dirX : -car.dirX;
          car.dirX = 0;
        } else {
          car.dirX = turnRight ? -car.dirY : car.dirY;
          car.dirY = 0;
        }
        car.turnCooldown = 1.2;
      } else if (roll < 0.3) {
        // U-turn, rarely.
        car.dirX *= -1; car.dirY *= -1;
        car.turnCooldown = 1.2;
      }
    }
    // Do not rear-end the car ahead.
    let target = car.targetSpeed;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * car.dirX + dy * car.dirY;
      const side = Math.abs(dx * car.dirY - dy * car.dirX);
      if (ahead > 0 && ahead < 85 && side < 34) {
        target = ahead < 46 ? 0 : Math.min(target, other.speed * 0.7);
      }
    }
    car.speed += clamp(target - car.speed, -420 * dt, 260 * dt);
    car.x += car.dirX * car.speed * dt;
    car.y += car.dirY * car.speed * dt;
    car.angle = Math.atan2(car.dirY, car.dirX);
    // Keep traffic on the map; respawn far away if it wanders off.
    if (car.x < 80 || car.x > WORLD_W - 80 || car.y < 80 || car.y > 2280) {
      const fresh = spawnTrafficCar();
      car.x = fresh.x; car.y = fresh.y; car.dirX = fresh.dirX; car.dirY = fresh.dirY;
      car.speed = fresh.speed; car.targetSpeed = fresh.targetSpeed;
      car.angle = fresh.angle;
    }
  }

  // ---- pedestrians ----------------------------------------------------------
  function stepPed(ped, dt) {
    if (ped.dead) {
      ped.deadTimer += dt;
      return;
    }
    ped.bob += dt * 6;
    let mx; let my;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      mx = Math.cos(a); my = Math.sin(a);
      ped.speed = 150;
    } else {
      ped.speed = 60;
      mx = Math.cos(ped.angle); my = Math.sin(ped.angle);
      // Wander: at an intersection, sometimes pick a new direction along a road.
      if (random.chance(dt * 0.25)) {
        const road = nearestRoad(ped.x, ped.y);
        if (road.vertical) ped.angle = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        else ped.angle = random.chance(0.5) ? 0 : Math.PI;
      }
    }
    const nx = clamp(ped.x + mx * ped.speed * dt, 40, WORLD_W - 40);
    const ny = clamp(ped.y + my * ped.speed * dt, 40, SAND_TOP + 90);
    if (!blockedByBuilding(nx, ny, 10)) {
      ped.x = nx; ped.y = ny;
    }
    if (ped.flee <= 0) ped.angle = Math.atan2(my, mx);
  }

  // ---- police ---------------------------------------------------------------
  function spawnPoliceCar() {
    const road = nearestRoad(player.x, player.y);
    const angle = random.next() * TAU;
    const px = clamp(player.x + Math.cos(angle) * random.range(650, 850), 150, WORLD_W - 150);
    const py = clamp(player.y + Math.sin(angle) * random.range(650, 850), 150, 2250);
    const car = makeCar(6, px, py, angle, { police: true, driver: true });
    car.colour = '#1c2a44';
    car.speed = 300;
    state.cars.push(car);
    return car;
  }

  function stepPolice(car, dt) {
    if (car.dead) return;
    car.sirenPhase += dt * 6;
    car.ramCooldown -= dt;
    const tx = player.x + (player.inCar ? Math.cos(player.inCar.angle) * player.inCar.speed * 0.35 : 0);
    const ty = player.y + (player.inCar ? Math.sin(player.inCar.angle) * player.inCar.speed * 0.35 : 0);
    const want = angleTo(car.x, car.y, tx, ty);
    const turn = clamp(angleDiff(car.angle, want), -2.6 * dt, 2.6 * dt);
    car.angle += turn;
    const target = state.wanted >= 4 ? 600 : 540;
    car.speed += clamp(target - car.speed, -500 * dt, 380 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!blockedByBuilding(nx, ny, 20) && ny < WATER_TOP) {
      car.x = nx; car.y = ny;
    } else {
      car.angle += 0.9 * dt * 8;
      car.speed *= 0.92;
    }
    // Ram the player's car, or corner the player on foot.
    const d = dist(car.x, car.y, player.x, player.y);
    if (player.inCar && d < 52 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.5;
      player.inCar.speed *= 0.75;
      const ev = damageCar(player.inCar, 6, false);
      state.pendingEvents = (state.pendingEvents ?? 0) | ev;
      spawnParticles(player.x, player.y, 10, '#ffe08a', 300, 0.4, 6);
      if (player.inCar && player.inCar.health < 40) addMessage('Your car is smoking — get to the garage!');
    }
    if (player.onFoot && d < 48) {
      player.bustedTimer += dt;
      if (player.bustedTimer > 1.5) state.pendingEvents = (state.pendingEvents ?? 0) | EVENT_BUSTED;
    }
  }

  function spawnFootCop() {
    const angle = random.next() * TAU;
    state.cops.push({
      x: clamp(player.x + Math.cos(angle) * 320, 60, WORLD_W - 60),
      y: clamp(player.y + Math.sin(angle) * 320, 60, 2250),
      angle, health: 50, shootTimer: random.range(0.6, 1.4), dead: false,
    });
  }

  function stepFootCop(cop, dt) {
    if (cop.dead) return;
    const d = dist(cop.x, cop.y, player.x, player.y);
    const want = angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle += clamp(angleDiff(cop.angle, want), -3 * dt, 3 * dt);
    if (d > 300) {
      cop.x += Math.cos(cop.angle) * 205 * dt;
      cop.y += Math.sin(cop.angle) * 205 * dt;
    } else if (d > 150) {
      cop.x += Math.cos(cop.angle) * 120 * dt;
      cop.y += Math.sin(cop.angle) * 120 * dt;
    }
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0 && d < 380 && player.onFoot) {
      cop.shootTimer = 1.4;
      state.bullets.push({
        x: cop.x + Math.cos(cop.angle) * 20, y: cop.y + Math.sin(cop.angle) * 20,
        vx: Math.cos(want) * 700, vy: Math.sin(want) * 700,
        life: 0.6, fromPlayer: false,
      });
      spawnParticles(cop.x, cop.y, 3, '#ffe08a', 200, 0.12, 4);
    }
  }

  // ---- missions ---------------------------------------------------------------
  function currentStep() {
    if (!state.mission) return null;
    return state.mission.def.steps[state.mission.step] ?? null;
  }

  function missionStartPoint(id) {
    switch (id) {
      case 'first-wheels': return PLACES.spawn;
      case 'heat-wave': return PLACES.garage;
      case 'package-run': return PLACES.garage;
      case 'getaway-driver': return { x: 1200, y: 1650 };
      case 'turbo-heist': return PLACES.garage;
      case 'big-score': return PLACES.bank;
      default: return PLACES.garage;
    }
  }

  function startMission(id) {
    const def = missionById(id);
    if (!def) return;
    state.mission = { def, step: 0, timer: 0, hold: 0, timeLeft: 0, passenger: false };
    const step = def.steps[0];
    if (step.time) state.mission.timeLeft = step.time;
    if (step.wanted) state.wanted = step.wanted;
    addMessage(`${def.title} — ${def.briefing}`);
  }

  function completeStep() {
    const mission = state.mission;
    mission.step += 1;
    mission.hold = 0;
    const next = currentStep();
    if (next) {
      if (next.wanted) state.wanted = Math.max(state.wanted, next.wanted);
      if (next.time) mission.timeLeft = next.time;
      addMessage(`Objective: ${next.text}`);
    } else {
      completeMission();
    }
  }

  function completeMission() {
    const mission = state.mission;
    const def = mission.def;
    player.money += def.reward;
    state.stats.earned += def.reward;
    state.doneIds.push(def.id);
    state.mission = null;
    addMessage(`${def.title} complete! +$${def.reward}.`);
    state.pendingEvents = (state.pendingEvents ?? 0) | EVENT_MISSION;
    if (state.doneIds.length >= 6) {
      state.pendingEvents = (state.pendingEvents ?? 0) | EVENT_COMPLETE;
    }
  }

  function failMission(reason) {
    state.mission = null;
    addMessage(`Mission failed: ${reason}. Drive to the yellow M to retry.`);
  }

  function stepMission(dt, input) {
    // Standing near a mission start: offer it.
    const next = nextMission(state.doneIds);
    state.nearStart = null;
    if (!state.mission && next) {
      const start = missionStartPoint(next.id);
      if (dist(player.x, player.y, start.x, start.y) < 80) {
        state.nearStart = next;
        state.prompt = `Press E — start "${next.title}" ($${next.reward})`;
        if (input.enter) startMission(next.id);
      }
    }
    if (!state.mission) return 0;
    const mission = state.mission;
    const step = currentStep();
    if (!step) return 0;
    if (mission.timeLeft > 0) {
      mission.timeLeft -= dt;
      if (mission.timeLeft <= 0) {
        failMission('out of time');
        return 0;
      }
    }
    const px = player.x;
    const py = player.y;
    const d = dist(px, py, step.x, step.y);
    switch (step.kind) {
      case 'goto':
        if (d < step.r) completeStep();
        break;
      case 'deliver':
        if (!player.inCar) { state.prompt = 'Get in a car to deliver the package.'; break; }
        if (d < step.r) completeStep();
        break;
      case 'steal':
        if (player.inCar && player.inCar.stolenDuringMission) completeStep();
        break;
      case 'survive':
        if (d < step.r) { completeStep(); break; }
        mission.timer += dt;
        if (mission.timer >= (step.time ?? 60)) completeStep();
        break;
      case 'hold': {
        if (player.onFoot && d < step.r && input.interactHeld) {
          mission.hold += dt;
          if (mission.hold >= (step.holdSeconds ?? 5)) completeStep();
        } else {
          mission.hold = Math.max(0, mission.hold - dt * 2);
        }
        break;
      }
      case 'escort':
        if (d < step.r) {
          mission.passenger = true;
          addMessage('Mara is in the car. Drive!');
          completeStep();
        }
        break;
      case 'escape':
        if (!player.inCar) { state.prompt = 'Get in a car — the cops are everywhere.'; break; }
        if (d < step.r) {
          state.stats.escaped += 1;
          completeStep();
        }
        break;
      default:
        break;
    }
    return 0;
  }

  // ---- the main step ------------------------------------------------------------
  function stepPlayerOnFoot(dt, input) {
    const len = Math.hypot(input.moveX, input.moveY);
    let mx = 0;
    let my = 0;
    if (len > 0.01) {
      mx = input.moveX / Math.max(1, len);
      my = input.moveY / Math.max(1, len);
      player.angle = Math.atan2(my, mx);
    }
    const nx = clamp(player.x + mx * WALK_SPEED * dt, 20, WORLD_W - 20);
    const ny = clamp(player.y + my * WALK_SPEED * dt, 20, WORLD_H - 20);
    moveWithBuildings(player, nx, ny, PLAYER_RADIUS);
    if (player.reloadTimer > 0) player.reloadTimer -= dt;
    if (input.reload && player.mag < MAG_SIZE && player.reloadTimer <= 0) {
      player.reloadTimer = 1.1;
      player.mag = MAG_SIZE;
    }
    if (input.shoot) return shoot(input.aimX, input.aimY);
    return 0;
  }

  function stepPlayerCar(dt, input) {
    const car = player.inCar;
    if (!car) return 0;
    // Steering: the turn rate is highest at low speed and eases off at pace, so
    // the turning circle stays tight enough for a 90-degree street corner
    // (about 60 px at cornering speed) instead of swinging into the buildings.
    // A minimum authority keeps a wedged car able to turn itself out.
    const speedRatio = clamp(Math.abs(car.speed) / car.top, 0, 1);
    const turnRate = 2.9 * (1 - 0.55 * speedRatio);
    car.angle += input.steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
    if (input.gas) car.speed += car.accel * dt;
    else if (input.brake) {
      // Brake toward a stop; once nearly stopped, the same pedal reverses.
      if (car.speed > 5) car.speed = Math.max(0, car.speed - car.accel * 1.6 * dt);
      else car.speed = Math.max(-170, car.speed - car.accel * 0.5 * dt);
    } else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
    car.speed = clamp(car.speed, -170, car.top);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const beforeX = car.x;
    const beforeY = car.y;
    moveWithBuildings(car, nx, ny, 16);
    if ((car.x === beforeX && Math.abs(nx - beforeX) > 0.5) || (car.y === beforeY && Math.abs(ny - beforeY) > 0.5)) {
      // Scraped a wall: lose speed, spark, a little damage at pace (not every step).
      car.scrapeTimer = (car.scrapeTimer ?? 0) - dt;
      if (Math.abs(car.speed) > 200 && car.scrapeTimer <= 0) {
        car.health -= 4;
        car.scrapeTimer = 0.5;
        spawnParticles(car.x, car.y, 6, '#ffe08a', 240, 0.3, 5);
      }
      car.speed *= 0.7;
    }
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, WORLD_H - 20);
    car.smoke = clamp(100 - car.health, 0, 100);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Skid marks on hard turns at speed.
    if (Math.abs(input.steer) > 0.6 && Math.abs(car.speed) > 260) {
      state.skids.push({
        x1: car.x - Math.cos(car.angle) * 16, y1: car.y - Math.sin(car.angle) * 16,
        x2: car.x - Math.cos(car.angle) * 26, y2: car.y - Math.sin(car.angle) * 26,
        life: 2.5,
      });
      if (state.skids.length > 220) state.skids.shift();
    }
    // Running over a pedestrian is a crime, and it slows the car.
    let events = 0;
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        ped.deadTimer = 0;
        car.speed *= 0.7;
        events |= addWanted(CRIME.hitPed);
        spawnParticles(ped.x, ped.y, 10, '#d21f5e', 200, 0.6, 6);
        addMessage('You hit a pedestrian! The cops are coming.');
      }
    }
    if (car.health <= 0) events |= damageCar(car, 1, false);
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
      if (!dead) {
        for (const rect of city.buildings) {
          if (!rect.park && pointInRect(b.x, b.y, rect)) {
            spawnParticles(b.x, b.y, 4, '#cfd6dd', 160, 0.25, 4);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.dead) continue;
          if (dist(b.x, b.y, car.x, car.y) < 24) {
            dead = true;
            if (b.fromPlayer) events |= damageCar(car, PISTOL_DAMAGE, true);
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 14) {
            dead = true;
            if (b.fromPlayer) {
              ped.dead = true;
              ped.deadTimer = 0;
              events |= addWanted(CRIME.hitPed);
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (cop.dead) continue;
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            dead = true;
            if (b.fromPlayer) {
              cop.health -= PISTOL_DAMAGE;
              if (cop.health <= 0) {
                cop.dead = true;
                events |= addWanted(CRIME.killCop);
                addMessage('You took down a cop. The heat just doubled.');
              }
            }
            break;
          }
        }
      }
      if (!dead && !b.fromPlayer && dist(b.x, b.y, player.x, player.y) < 16) {
        dead = true;
        hurtPlayer(6);
        events |= EVENT_HIT;
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function stepPickups() {
    let events = 0;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (dist(player.x, player.y, pickup.x, pickup.y) < 34) {
        pickup.taken = true;
        if (pickup.kind === 'cash') {
          player.money += 50;
          state.stats.earned += 50;
          addMessage('Found $50 stashed cash.');
        } else {
          player.health = Math.min(PLAYER_HEALTH, player.health + 40);
          addMessage('Health pack: +40.');
        }
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepWanted(dt) {
    state.crimeTimer += dt;
    // More police as the heat rises; fewer as it cools.
    const wantCount = state.wanted === 0 ? 0 : state.wanted <= 2 ? state.wanted : state.wanted;
    const alive = state.cars.filter((c) => c.police && !c.dead).length;
    if (state.wanted > 0 && alive < wantCount) {
      spawnPoliceCar();
    }
    // Foot cops join the hunt at three stars and up.
    const wantCops = state.wanted >= 3 ? Math.min(2, state.wanted - 2) : 0;
    const aliveCops = state.cops.filter((c) => !c.dead).length;
    if (aliveCops < wantCops) spawnFootCop();
    // Cool down when no police can see the player and no fresh crime.
    if (state.wanted > 0 && state.crimeTimer > 6) {
      const nearestPolice = state.cars.reduce(
        (best, c) => (c.police && !c.dead ? Math.min(best, dist(c.x, c.y, player.x, player.y)) : best),
        Infinity,
      );
      if (nearestPolice > 600) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED_DECAY_SECONDS) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          addMessage(state.wanted === 0 ? 'You lost them. The heat is off.' : `Heat dropping — ${state.wanted} star${state.wanted === 1 ? '' : 's'} left.`);
        }
      } else {
        state.wantedTimer = 0;
      }
    }
    // Despawn police that fell far behind once the heat is off.
    if (state.wanted === 0) {
      for (let i = state.cars.length - 1; i >= 0; i -= 1) {
        const car = state.cars[i];
        if (car.police && dist(car.x, car.y, player.x, player.y) > 1200) state.cars.splice(i, 1);
      }
      for (let i = state.cops.length - 1; i >= 0; i -= 1) {
        if (state.cops[i].dead || dist(state.cops[i].x, state.cops[i].y, player.x, player.y) > 900) state.cops.splice(i, 1);
      }
    }
  }

  function step(dt, input) {
    let events = 0;
    state.pendingEvents = 0;
    state.elapsed += dt;
    state.prompt = '';
    if (player.invuln > 0) player.invuln -= dt;
    if (player.bustedTimer > 0 && state.cars.every((c) => !c.police || dist(c.x, c.y, player.x, player.y) > 48)) {
      player.bustedTimer = 0;
    }

    // Enter / exit a car (edge-triggered). Repair first: E inside the garage while
    // driving fixes the car instead of stepping out of it. And while the player
    // stands in a vault marker on foot, E cracks the vault instead of entering
    // the car parked beside them.
    if (state.mission) {
      const holdStep = currentStep();
      if (player.onFoot && holdStep && holdStep.kind === 'hold'
        && dist(player.x, player.y, holdStep.x, holdStep.y) < (holdStep.r ?? 90)) {
        input.enter = false;
      }
    }
    state.nearGarage = false;
    if (player.inCar && dist(player.x, player.y, PLACES.garage.x, PLACES.garage.y) < 90) {
      state.nearGarage = true;
      if (input.enter && player.inCar.health < 100) {
        if (player.money >= REPAIR_COST) {
          player.money -= REPAIR_COST;
          player.inCar.health = 100;
          player.inCar.smoke = 0;
          addMessage(`Car repaired for $${REPAIR_COST}.`);
          events |= EVENT_PICKUP;
        } else {
          state.prompt = `Repair costs $${REPAIR_COST} — you are short.`;
        }
        input.enter = false;
      }
    }
    if (input.enter) {
      if (player.onFoot) events |= enterCar();
      else exitCar();
    }

    if (player.onFoot) events |= stepPlayerOnFoot(dt, input);
    else events |= stepPlayerCar(dt, input);

    for (const car of state.cars) {
      if (car.traffic) stepTraffic(car, dt);
      else if (car.police) stepPolice(car, dt);
      else if (!car.player && !car.dead && car.smoke > 0) {
        // A wrecked or smoking car that is nobody's: let it sit.
      }
    }
    for (const ped of state.peds) stepPed(ped, dt);
    for (const cop of state.cops) stepFootCop(cop, dt);

    // Car-to-car bumps: the player's car shoves traffic aside.
    if (player.inCar) {
      const pc = player.inCar;
      for (const car of state.cars) {
        if (car === pc || car.dead || car.police) continue;
        const d = dist(pc.x, pc.y, car.x, car.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = (car.x - pc.x) / d;
          const ny = (car.y - pc.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          if (Math.abs(pc.speed) > 240 && car.traffic) {
            car.speed = Math.max(0, car.speed - 60);
            pc.speed *= 0.85;
          }
        }
      }
    }

    events |= stepBullets(dt);
    events |= stepPickups();
    events |= stepMission(dt, input);
    stepWanted(dt);

    // Particles and skids fade.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    // Dead pedestrians fade away.
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      if (state.peds[i].dead && state.peds[i].deadTimer > 9) state.peds.splice(i, 1);
    }
    // Smoking cars puff.
    for (const car of state.cars) {
      if (!car.dead && car.smoke > 35 && random.chance(dt * 8)) {
        state.particles.push({
          x: car.x + random.range(-8, 8), y: car.y + random.range(-8, 8),
          vx: random.range(-10, 10), vy: random.range(-40, -15),
          life: 0.9, maxLife: 0.9, size: 9, colour: '#5a5a5a', kind: 'smoke',
        });
      }
    }

    if (player.health <= 0) events |= EVENT_WASTED;
    events |= state.pendingEvents ?? 0;
    state.pendingEvents = 0;
    return events;
  }

  resetWorld();

  return {
    state,
    step,
    reset: resetWorld,
    startMission,
    nextMission: () => nextMission(state.doneIds),
    missionStartPoint,
    save() {
      return { money: player.money, doneIds: state.doneIds.slice(), earned: state.stats.earned };
    },
  };
}
