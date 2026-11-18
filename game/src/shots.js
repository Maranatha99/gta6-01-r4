// The four screenshot scenes behind ?shot=start|drive|mission|chase. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot that follows the road ahead, so the frame is what a short
// stretch of real play looks like — and the same seed always gives the same frame.
import { SCREEN, STEP } from './config.js';
import { PLACES } from './city.js';

const SAMPLE = STEP;

/** Blank held input: the autopilot fills in the fields it needs each step. */
function blankInput() {
  return {
    moveX: 0, moveY: 0, gas: 0, brake: 0, steer: 0,
    enter: false, shoot: false, interactHeld: false, reload: false,
    aimX: 0, aimY: 0,
  };
}

const ROAD_XS = [300, 750, 1200, 1650, 2100, 2550, 3000];
const ROAD_YS = [300, 750, 1200, 1650, 2100];

/** The intersections reachable from (x, y) by driving one step in `dir`. */
function nextIntersection(x, y, dir) {
  if (dir.x > 0) {
    const nx = ROAD_XS.find((rx) => rx > x + 40);
    if (nx === undefined) return null;
    let best = null;
    for (const ry of ROAD_YS) {
      if (best === null || Math.abs(ry - y) < Math.abs(best - y)) best = ry;
    }
    return { x: nx, y: best };
  }
  if (dir.x < 0) {
    const xs = ROAD_XS.filter((rx) => rx < x - 40);
    const nx = xs[xs.length - 1];
    if (nx === undefined) return null;
    let best = null;
    for (const ry of ROAD_YS) {
      if (best === null || Math.abs(ry - y) < Math.abs(best - y)) best = ry;
    }
    return { x: nx, y: best };
  }
  if (dir.y > 0) {
    const ny = ROAD_YS.find((ry) => ry > y + 40);
    if (ny === undefined) return null;
    let best = null;
    for (const rx of ROAD_XS) {
      if (best === null || Math.abs(rx - x) < Math.abs(best - x)) best = rx;
    }
    return { x: best, y: ny };
  }
  const ys = ROAD_YS.filter((ry) => ry < y - 40);
  const ny = ys[ys.length - 1];
  if (ny === undefined) return null;
  let best = null;
  for (const rx of ROAD_XS) {
    if (best === null || Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  }
  return { x: best, y: ny };
}

function rotateDir(dir, clockwise) {
  return clockwise ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
}

/**
 * A road-following autopilot that stays in its lane: it aims at a lookahead
 * point on the centre line of the road it is on, and only picks a new
 * direction once it reaches the intersection ahead — usually straight, right
 * every third crossing, and never off the grid — so the car cruises the city
 * instead of cutting diagonals through the blocks.
 */
function makeRoadPilot() {
  let dir = null;
  let legRoad = 0;
  let next = null;
  let crossings = 0;
  let cooldown = 0;
  return function roadPilot(world) {
    const input = blankInput();
    const car = world.state.player.inCar;
    if (!car) return input;
    if (!dir) {
      // Start in the direction the car already faces, snapped to the grid,
      // on the nearest road centre line for that direction.
      dir = Math.abs(Math.cos(car.angle)) >= 0.5
        ? { x: Math.cos(car.angle) >= 0 ? 1 : -1, y: 0 }
        : { x: 0, y: Math.sin(car.angle) >= 0 ? 1 : -1 };
      if (dir.x !== 0) {
        legRoad = ROAD_YS.reduce((best, ry) => (Math.abs(ry - car.y) < Math.abs(best - car.y) ? ry : best), ROAD_YS[0]);
      } else {
        legRoad = ROAD_XS.reduce((best, rx) => (Math.abs(rx - car.x) < Math.abs(best - car.x) ? rx : best), ROAD_XS[0]);
      }
      next = nextIntersection(car.x, car.y, dir);
    }
    cooldown -= 1;
    if (next && Math.hypot(next.x - car.x, next.y - car.y) < 100 && cooldown <= 0) {
      crossings += 1;
      const straight = nextIntersection(next.x, next.y, dir);
      const right = rotateDir(dir, true);
      const left = rotateDir(dir, false);
      let choice = null;
      if (straight && crossings % 3 !== 0) {
        choice = { dir, point: straight };
      } else if (nextIntersection(next.x, next.y, right)) {
        choice = { dir: right, point: nextIntersection(next.x, next.y, right) };
      } else if (nextIntersection(next.x, next.y, left)) {
        choice = { dir: left, point: nextIntersection(next.x, next.y, left) };
      } else if (straight) {
        choice = { dir, point: straight };
      }
      if (choice) {
        dir = choice.dir;
        legRoad = dir.x !== 0 ? next.y : next.x;
        next = choice.point;
        cooldown = 30;
      }
    }
    if (!next) {
      input.brake = 1;
      input.steer = 1;
      return input;
    }
    // Lookahead on the centre line of the current leg, never off it.
    const lookX = dir.x !== 0 ? car.x + dir.x * 180 : legRoad;
    const lookY = dir.y !== 0 ? car.y + dir.y * 180 : legRoad;
    const want = Math.atan2(lookY - car.y, lookX - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.steer = Math.max(-1, Math.min(1, diff * 2.4));
    // Brake into a sharp turn, but only while still fast: braking to a stop
    // would leave the car reversing through the intersection.
    if (Math.abs(diff) > 0.5 && car.speed > 100) {
      input.brake = 1;
      input.gas = 0;
    } else {
      input.gas = 1;
    }
    return input;
  };
}

/** Put the player in the nearest parked car (a real steal, through the rules). */
function stealNearest(world) {
  const input = blankInput();
  input.enter = true;
  world.step(STEP, input);
  return world.state.player.inCar !== null;
}

/** Teleport the player next to a car, then steal it. If no car is close enough, tow
 *  the nearest parked one over first — the scene still plays through the real rules. */
function stealCarAt(world, x, y) {
  const p = world.state.player;
  p.x = x;
  p.y = y;
  p.onFoot = true;
  p.inCar = null;
  let best = null;
  let bestD = Infinity;
  for (const car of world.state.cars) {
    if (car.dead || car.police) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best && bestD > 60) {
    best.x = x + 40;
    best.y = y;
    best.angle = Math.PI / 2;
    best.traffic = false;
    best.parked = true;
    best.speed = 0;
  }
  return stealNearest(world);
}

function simulate(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, pilot ? pilot(world) : blankInput());
  }
}

/**
 * Stage the named scene and return the screen to draw over it.
 * start   — title screen over a living city (traffic rolling for a few seconds)
 * drive   — Riko cruising the strip in a stolen sedan, traffic around him
 * mission — the Heat Wave chase: three stars, police closing in on the highway
 * chase   — the Big Score escape: five stars, the Vortex GT, smoke and sirens
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const p = state.player;
  if (name === 'start') {
    simulate(world, 6, null);
    return { screen: SCREEN.TITLE };
  }
  if (name === 'drive') {
    // A sedan parked on the strip, then a cruise north.
    stealCarAt(world, 1200 - 34, 750);
    simulate(world, 9, makeRoadPilot());
    return { screen: SCREEN.PLAY };
  }
  if (name === 'mission') {
    world.startMission('heat-wave');
    stealCarAt(world, 1650 - 34, 750);
    // Drive toward the hideout while the police close in.
    simulate(world, 7, makeRoadPilot());
    return { screen: SCREEN.PLAY };
  }
  if (name === 'chase') {
    world.startMission('big-score');
    // Jump straight to the escape: five stars, the Vortex GT, the marina ahead.
    const mission = state.mission;
    mission.step = 2;
    state.wanted = 5;
    p.x = 2100;
    p.y = 2100;
    stealCarAt(world, 2612, 2130);
    // Swap the stolen car for the Vortex GT is already the target; drive east.
    p.inCar.angle = 0;
    simulate(world, 6, makeRoadPilot());
    return { screen: SCREEN.PLAY };
  }
  simulate(world, 4, null);
  return { screen: SCREEN.TITLE };
}
