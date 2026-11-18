// Keyboard and mouse input for SOLMAR BAY. Held keys give movement and driving;
// one-shot presses (enter a car, shoot, pause, reload) are queued as flags and
// taken once by the loop, so a press between two frames is never lost or doubled.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const ENTER = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let shootQueued = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || ENTER.has(event.code) || RELOAD.has(event.code)) {
      held.add(event.code);
      if (!event.repeat && ENTER.has(event.code)) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
    mouseDown = false;
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    shootQueued = true;
  }
  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement on foot: -1..1 on each axis. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { x, y };
    },
    /** Driving: gas 0/1, brake 0/1, steer -1..1. */
    drive() {
      return {
        gas: has(UP) ? 1 : 0,
        brake: has(DOWN) ? 1 : 0,
        steer: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
      };
    },
    /** True while E is held down (vault cracking, holding a marker). */
    interactHeld() {
      return has(ENTER);
    },
    /** True while R is held down. */
    reloadHeld() {
      return has(RELOAD);
    },
    /** Mouse position in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** One queued shot (a click) since the last call. */
    takeShot() {
      const shot = shootQueued;
      shootQueued = false;
      return shot;
    },
    /** The one-shot action flags since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test hook: pretend a key is held. */
    testHold(code, down) {
      if (down) held.add(code);
      else held.delete(code);
    },
  };
}
