// Boot and the one loop for SOLMAR BAY: input is read every frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there, and the audio
// follows speed and heat. The game moves between title, play, paused, wasted,
// busted and story-complete screens, and saves progress to localStorage.
//
// ?seed=N fixes the city. ?shot=start|drive|mission|chase (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, SCREEN, START_MONEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BUSTED, EVENT_COMPLETE, EVENT_CRIME, EVENT_EXPLOSION,
  EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || !Array.isArray(save.doneIds)) return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.save()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

const save = readSave();
const world = createWorld(createRandom(seed), save);
const renderer = createRenderer(canvas);

function runShot(name) {
  // Paint synchronously, twice, right at load: headless browsers throttle
  // requestAnimationFrame when no frame is being produced, so a shot must not
  // wait for one. The frame is then ready the moment the page has loaded.
  const scene = stageShot(name, world);
  const info = { best: save?.earned ?? 0, hasSave: !!save, mouse: null, muted: false };
  renderer.draw(world.state, scene.screen, info);
  renderer.draw(world.state, scene.screen, info);
  window.__shotReady = true;
  // A read-only debug handle for checking a staged scene.
  window.__solmar = { world, screen: () => scene.screen, state: () => readState(scene.screen) };
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN.TITLE;
  let best = save?.earned ?? 0;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function respawn() {
    const p = world.state.player;
    if (p.inCar) {
      p.inCar.player = false;
      p.inCar = null;
    }
    p.onFoot = true;
    p.x = 300;
    p.y = 750;
    p.angle = -Math.PI / 2;
    p.health = 100;
    p.mag = 12;
    p.reloadTimer = 0;
    p.bustedTimer = 0;
    world.state.wanted = 0;
    world.state.wantedTimer = 0;
    world.state.mission = null;
    for (const car of world.state.cars) {
      if (car.police) car.dead = true;
    }
    world.state.cops.length = 0;
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      world.state.player.money = START_MONEY;
      world.state.doneIds = [];
      world.state.stats.earned = 0;
      best = 0;
      writeSave(world);
    } else if (world.state.player.health <= 0 || screen === SCREEN.WASTED || screen === SCREEN.BUSTED) {
      respawn();
    }
    screen = SCREEN.PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Follow the yellow M to start a job.');
  }

  function endGame(kind) {
    screen = kind;
    if (world.state.stats.earned > best) best = world.state.stats.earned;
    writeSave(world);
    announce(kind === SCREEN.WASTED ? 'Wasted. Press Enter to get back on your feet.' : 'Busted. Press Enter to post bail.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_EXPLOSION) audio.explosion();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_MISSION) {
      audio.missionDone();
      if (world.state.stats.earned > best) best = world.state.stats.earned;
      writeSave(world);
    }
    if (events & EVENT_WASTED) endGame(SCREEN.WASTED);
    else if (events & EVENT_BUSTED) endGame(SCREEN.BUSTED);
    else if (events & EVENT_COMPLETE) {
      screen = SCREEN.COMPLETE;
      writeSave(world);
      announce('Story complete. The Big Score is yours.');
    }
  }

  function buildInput() {
    const move = input.move();
    const drive = input.drive();
    const mouse = input.mouse();
    // Mouse position in world pixels, for aiming on foot.
    const rect = canvas.getBoundingClientRect();
    const p = world.state.player;
    const zoom = p.inCar ? 1 - Math.min(1, Math.abs(p.inCar.speed) / p.inCar.top) * 0.18 : 1;
    const vw = rect.width / zoom;
    const vh = rect.height / zoom;
    const camX = Math.max(-60, Math.min(3600 - vw + 60, p.x - vw / 2));
    const camY = Math.max(-60, Math.min(2600 - vh + 60, p.y - vh / 2));
    return {
      moveX: move.x,
      moveY: move.y,
      gas: drive.gas,
      brake: drive.brake,
      steer: drive.steer,
      enter: false,
      shoot: false,
      interactHeld: input.interactHeld(),
      reload: input.reloadHeld(),
      aimX: camX + mouse.x / zoom,
      aimY: camY + mouse.y / zoom,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN.TITLE) startGame(false);
      else if (screen === SCREEN.WASTED || screen === SCREEN.BUSTED) startGame(false);
      else if (screen === SCREEN.COMPLETE) screen = SCREEN.PLAY;
      else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
        announce('Playing.');
      }
    }
    // R on the title or pause screen restarts the whole story from scratch.
    if (input.reloadHeld() && (screen === SCREEN.TITLE || screen === SCREEN.PAUSED)) {
      startGame(true);
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN.PLAY) {
        screen = SCREEN.PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
        announce('Playing.');
      }
    }
    // The world only advances while playing; the title keeps its traffic rolling.
    if (screen === SCREEN.PLAY) {
      const worldInput = buildInput();
      // E (enter a car / start a job) and clicks are edge-triggered: fold them in.
      if (actions & ACTION_CONFIRM) worldInput.enter = true;
      if (input.takeShot()) worldInput.shoot = true;
      while (accumulator >= STEP) {
        const events = world.step(STEP, worldInput);
        worldInput.enter = false;
        worldInput.shoot = false;
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN.PLAY) break;
      }
    } else if (screen === SCREEN.TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { moveX: 0, moveY: 0, gas: 0, brake: 0, steer: 0, enter: false, shoot: false, interactHeld: false, reload: false, aimX: 0, aimY: 0 });
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    audio.setEngine(p.inCar ? Math.abs(p.inCar.speed) / p.inCar.top : 0, !!p.inCar);
    audio.setSiren(world.state.wanted > 0 && screen === SCREEN.PLAY);
    renderer.draw(world.state, screen, {
      best, hasSave: !!save, mouse: input.mouse(), muted,
    });
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN.PLAY) {
      screen = SCREEN.PAUSED;
      announce('Paused.');
    }
  });

  // A small debug handle for playtesting (start a mission, move the player,
  // read the state). It changes nothing about the shipped game.
  window.__solmar = {
    world,
    screen: () => screen,
    startMission: (id) => world.startMission(id),
    teleport: (x, y) => {
      const p = world.state.player;
      p.x = x; p.y = y;
      if (p.inCar) { p.inCar.x = x; p.inCar.y = y; }
    },
    pressEnter: () => {
      if (screen === SCREEN.TITLE) startGame(false);
      else if (screen === SCREEN.WASTED || screen === SCREEN.BUSTED) startGame(false);
      else if (screen === SCREEN.COMPLETE) screen = SCREEN.PLAY;
      else if (screen === SCREEN.PAUSED) screen = SCREEN.PLAY;
    },
    state: () => readState(screen),
  };

  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

function readState(screen) {
  return {
    screen,
    x: Math.round(world.state.player.x),
    y: Math.round(world.state.player.y),
    money: world.state.player.money,
    health: Math.round(world.state.player.health),
    wanted: world.state.wanted,
    inCar: !!world.state.player.inCar,
    car: world.state.player.inCar?.model ?? null,
    carSpeed: Math.round(world.state.player.inCar?.speed ?? 0),
    carHealth: Math.round(world.state.player.inCar?.health ?? 0),
    mission: world.state.mission?.def.id ?? null,
    missionStep: world.state.mission?.step ?? null,
    done: world.state.doneIds.slice(),
    police: world.state.cars.filter((c) => c.police && !c.dead).length,
    cars: world.state.cars.length,
    peds: world.state.peds.length,
  };
}

if (shot) runShot(shot);
else runGame();
