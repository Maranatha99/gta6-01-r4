// SOLMAR BAY — everything the player sees, painted on one canvas: the sun-soaked
// city from above, its cars and people, the HUD with its minimap, and the menus.
// The renderer only reads state; it never changes it.
import { SCREEN, WORLD_H, WORLD_W } from './config.js';
import { PLACES } from './city.js';
import { nextMission } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 800;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCity(state, cam) {
    const { city } = state;
    const t = state.elapsed;
    // Grass base.
    ctx.fillStyle = '#86a860';
    ctx.fillRect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80);
    // Blocks as sidewalks.
    ctx.fillStyle = '#c9c2b2';
    for (const b of city.buildings) {
      if (b.park) continue;
      ctx.fillRect(b.x - 12, b.y - 12, b.w + 24, b.h + 24);
    }
    // Roads: asphalt with a pale edge and a dashed centre line.
    ctx.fillStyle = '#3a3d44';
    for (const rx of [300, 750, 1200, 1650, 2100, 2550, 3000]) {
      ctx.fillRect(rx - 48, cam.y - 40, 96, cam.h + 80);
    }
    for (const ry of [300, 750, 1200, 1650, 2100]) {
      ctx.fillRect(cam.x - 40, ry - 48, cam.w + 80, 96);
    }
    ctx.strokeStyle = '#e8e4da';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    for (const rx of [300, 750, 1200, 1650, 2100, 2550, 3000]) {
      ctx.moveTo(rx, cam.y - 40);
      ctx.lineTo(rx, cam.y + cam.h + 40);
    }
    for (const ry of [300, 750, 1200, 1650, 2100]) {
      ctx.moveTo(cam.x - 40, ry);
      ctx.lineTo(cam.x + cam.w + 40, ry);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(232, 228, 218, 0.85)';
    for (const rx of [300, 750, 1200, 1650, 2100, 2550, 3000]) {
      for (const ry of [300, 750, 1200, 1650, 2100]) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx - 44 + i * 13, ry - 58, 7, 16);
          ctx.fillRect(rx - 44 + i * 13, ry + 42, 7, 16);
        }
      }
    }
    // Beach and water along the south edge.
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(cam.x - 40, 2330, cam.w + 80, 150);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(cam.x - 40, 2480, cam.w + 80, 140);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = Math.floor(cam.x / 60) * 60; x < cam.x + cam.w + 60; x += 60) {
      const y = 2510 + Math.sin(x * 0.02 + t * 1.4) * 5;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 30, y - 6, x + 60, y);
    }
    ctx.stroke();
    // Boardwalk line.
    ctx.fillStyle = '#b08968';
    ctx.fillRect(cam.x - 40, 2322, cam.w + 80, 8);
    // Parks, buildings and parking lots.
    for (const b of city.buildings) {
      if (b.park) {
        ctx.fillStyle = '#6f9e5f';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        continue;
      }
      // Fake height: a shadow offset to the south-east, then the roof.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.colour;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, Math.min(26, b.w - 16), Math.min(18, b.h - 16));
      if (b.height > 30) {
        // Downtown glass: window grid.
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 16) {
          for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 16) {
            ctx.fillRect(wx, wy, 7, 9);
          }
        }
      }
    }
    for (const lot of city.parking) {
      ctx.fillStyle = '#4a4d55';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(232,228,218,0.6)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 14; x < lot.x + lot.w - 10; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 8);
        ctx.lineTo(x, lot.y + 30);
        ctx.stroke();
      }
    }
    // Marina boats.
    for (const boat of city.boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = boat.colour;
      roundRect(ctx, -26, -9, 52, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#2e7fa8';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.restore();
    }
    // Trees: palms and round-crowned park trees.
    for (const tree of city.trees) {
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(tree.x - 2, tree.y - 2, 4, 8);
      ctx.fillStyle = tree.palm ? '#4e9e4e' : '#3f8a3f';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y - 4, tree.palm ? 11 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 7, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, isPlayer) {
    const w = 44;
    const h = 22;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7);
    ctx.fill();
    if (car.dead) {
      ctx.fillStyle = '#2b2b2b';
      roundRect(ctx, -w / 2, -h / 2, w, h, 7);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = car.colour;
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(w / 2 - 14, -h / 2 + 3, 8, h - 6);
    ctx.fillRect(-w / 2 + 4, -h / 2 + 3, 7, h - 6);
    // Roof.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, -6, -h / 2 + 3, 16, h - 6, 4);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-w / 2 + 4, -h / 2 - 3, 9, 4);
    ctx.fillRect(-w / 2 + 4, h / 2 - 1, 9, 4);
    ctx.fillRect(w / 2 - 13, -h / 2 - 3, 9, 4);
    ctx.fillRect(w / 2 - 13, h / 2 - 1, 9, 4);
    if (car.police) {
      // Flashing light bar.
      const phase = Math.floor(car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -h / 2 - 1, 8, 5);
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, h / 2 - 4, 8, 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 2;
      roundRect(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, colour, dead, bob) {
    ctx.save();
    ctx.translate(x, y);
    if (dead) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = colour;
      roundRect(ctx, -12, -5, 24, 10, 5);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Facing nose and a little walk bob.
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(8 + Math.sin(bob) * 1.5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMarker(x, y, r, label, pulse) {
    const s = 1 + Math.sin(pulse * 4) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 62, 0.25)';
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 210, 62, 0.12)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255, 210, 62, 0.95)';
      roundRect(ctx, x - tw / 2 - 8, y - 52, tw + 16, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#1c1c1c';
      ctx.fillText(label, x, y - 37);
    }
  }

  function drawMinimap(state, mx, my, mw, mh) {
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#22301f';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(mx, my + 2480 * sy, mw, mh - 2480 * sy);
    ctx.fillStyle = '#3a3d44';
    for (const rx of [300, 750, 1200, 1650, 2100, 2550, 3000]) {
      ctx.fillRect(mx + rx * sx - 1.5, my, 3, mh);
    }
    for (const ry of [300, 750, 1200, 1650, 2100]) {
      ctx.fillRect(mx, my + ry * sy - 1.5, mw, 3);
    }
    ctx.fillStyle = 'rgba(232,228,218,0.7)';
    for (const b of state.city.buildings) {
      if (!b.park) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    }
    // Objective blip.
    const objective = objectivePoint(state);
    if (objective) {
      const pulse = 3 + Math.sin(state.elapsed * 5) * 1.5;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(mx + objective.x * sx, my + objective.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips flash red/blue; the player is white.
    for (const car of state.cars) {
      if (car.police && !car.dead) {
        ctx.fillStyle = Math.floor(car.sirenPhase) % 2 === 0 ? '#ff2e2e' : '#2e6bff';
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SOLMAR BAY', mx + 4, my + 13);
  }

  /** Where the current objective (or the next mission start) is, for markers. */
  function objectivePoint(state) {
    if (state.mission) {
      const step = state.mission.def.steps[state.mission.step];
      if (step) return { x: step.x, y: step.y, r: step.r ?? 90, text: step.text };
    }
    const next = nextMission(state.doneIds);
    if (next) {
      const start = { 'first-wheels': PLACES.spawn, 'heat-wave': PLACES.garage, 'package-run': PLACES.garage, 'getaway-driver': { x: 1200, y: 1650 }, 'turbo-heist': PLACES.garage, 'big-score': PLACES.bank }[next.id] ?? PLACES.garage;
      return { x: start.x, y: start.y, r: 80, text: next.title };
    }
    return null;
  }

  function drawHud(state, info) {
    const p = state.player;
    // Top-left: money, health, ammo.
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 14, 14, 218, 92, 10);
    ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 26, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('RIKO VALE', 26, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 26, 66, 150, 10, 5);
    ctx.fill();
    ctx.fillStyle = p.health > 40 ? '#7ee787' : '#ff5a5a';
    roundRect(ctx, 26, 66, 150 * Math.max(0, p.health) / 100, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.onFoot ? `PISTOL  ${p.mag}/12` : `${p.inCar ? p.inCar.model.toUpperCase() : ''}  ${Math.round(Math.abs(p.inCar ? p.inCar.speed : 0) * 0.12)} MPH`, 26, 96);
    // Wanted stars, top centre.
    ctx.textAlign = 'center';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const sw = 190;
    roundRect(ctx, viewW / 2 - sw / 2, 14, sw, 34, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? '#ffd23e' : 'rgba(255,255,255,0.3)';
      ctx.font = '20px sans-serif';
      ctx.fillText('★', viewW / 2 - 64 + i * 32, 40);
    }
    // Minimap, top right.
    drawMinimap(state, viewW - 234, 14, 220, 158);
    // Objective, bottom centre.
    const objective = objectivePoint(state);
    const mission = state.mission;
    ctx.textAlign = 'center';
    let objectiveText = '';
    if (mission) {
      const step = mission.def.steps[mission.step];
      objectiveText = step ? `${mission.def.title} — ${step.text}` : '';
      if (step && step.kind === 'hold' && mission.hold > 0) {
        objectiveText += `  (${Math.ceil((step.holdSeconds ?? 5) - mission.hold)}s)`;
      }
      if (mission.timeLeft > 0) objectiveText += `   ⏱ ${Math.ceil(mission.timeLeft)}s`;
    } else if (objective) {
      objectiveText = `Next job: ${objective.text} — follow the yellow M`;
    } else {
      objectiveText = 'Story complete — Solmar Bay is yours. Free roam!';
    }
    ctx.font = `600 15px ${FONT}`;
    const tw = ctx.measureText(objectiveText).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, viewW / 2 - tw / 2 - 14, viewH - 52, tw + 28, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(objectiveText, viewW / 2, viewH - 29);
    // Prompt (press E) above the objective.
    if (state.prompt) {
      ctx.font = `600 14px ${FONT}`;
      const pw = ctx.measureText(state.prompt).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, viewW / 2 - pw / 2 - 12, viewH - 96, pw + 24, 30, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.prompt, viewW / 2, viewH - 75);
    }
    // Messages, under the stars. Long lines are cut to fit the screen.
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'center';
    const recent = state.message.slice(-3);
    recent.forEach((msg, i) => {
      const age = state.elapsed - msg.t;
      const alpha = age > 6 ? Math.max(0, 1 - (age - 6) / 2) : 1;
      if (alpha <= 0) return;
      const text = msg.text.length > 110 ? `${msg.text.slice(0, 107)}…` : msg.text;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const mw = ctx.measureText(text).width;
      roundRect(ctx, viewW / 2 - mw / 2 - 10, 58 + i * 26, mw + 20, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, viewW / 2, 58 + i * 26 + 15);
      ctx.globalAlpha = 1;
    });
    // Controls hint, bottom left.
    ctx.textAlign = 'left';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(p.onFoot ? 'WASD move · E enter car · Click shoot · R reload · P pause · M mute' : 'W/S drive · A/D steer · E exit car · P pause · M mute', 16, viewH - 16);
    // Car damage warning.
    if (p.inCar && p.inCar.health < 40) {
      ctx.textAlign = 'center';
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = '#ff5a5a';
      ctx.fillText('⚠ CAR DAMAGED — drive to the garage (E to repair)', viewW / 2, viewH - 112);
    }
    // Crosshair on foot.
    if (p.onFoot && info.mouse) {
      const { x, y } = info.mouse;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 14, y); ctx.lineTo(x - 6, y);
      ctx.moveTo(x + 6, y); ctx.lineTo(x + 14, y);
      ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 6);
      ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 14);
      ctx.stroke();
    }
    if (info.muted) {
      ctx.textAlign = 'right';
      ctx.font = `600 12px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('MUTED (M)', viewW - 16, viewH - 16);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    const w = Math.min(640, viewW - 60);
    const h = 150 + lines.length * 30 + 74;
    const x = (viewW - w) / 2;
    const y = (viewH - h) / 2;
    ctx.fillStyle = '#141a24';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 16);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `800 ${Math.min(44, w / 11)}px ${FONT}`;
    ctx.fillText(title, viewW / 2, y + 62);
    ctx.fillStyle = '#eef1f5';
    ctx.font = `500 16px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, viewW / 2, y + 108 + i * 30);
    });
    ctx.fillStyle = '#ffd23e';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(prompt, viewW / 2, y + h - 30);
  }

  function drawTitle(state, info) {
    drawPanel(
      'SOLMAR BAY',
      [
        'Riko Vale is out of the county lockup. The bay still owes him —',
        'and Mara Solis still owns his debt. Six jobs. One way out.',
        '',
        'WASD move / drive · E steal & enter cars · Mouse + Click shoot',
        'R reload · P pause · M mute · Follow the yellow M to start a job',
        '',
        `Jobs done: ${state.doneIds.length} / 6      Best haul: $${(info.best ?? 0).toLocaleString('en-US')}`,
        info.hasSave ? 'Save found — press ENTER to continue where you left off.' : 'No save yet — press ENTER to start a new story.',
      ],
      'ENTER — START',
      '#ffd23e',
    );
  }

  /** Paint one frame. `screen` is one of SCREEN.*; `info` carries mouse and save info. */
  function draw(state, screen, info) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    // Camera follows the player, easing out a little at speed.
    const p = state.player;
    const speedRatio = p.inCar ? Math.abs(p.inCar.speed) / p.inCar.top : 0;
    const zoom = p.inCar ? 1 - speedRatio * 0.18 : 1;
    const vw = viewW / zoom;
    const vh = viewH / zoom;
    const cam = {
      x: Math.max(-60, Math.min(WORLD_W - vw + 60, p.x - vw / 2)),
      y: Math.max(-60, Math.min(WORLD_H - vh + 60, p.y - vh / 2)),
      w: vw, h: vh,
    };
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom);
    drawCity(state, cam);
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 5;
    for (const skid of state.skids) {
      ctx.globalAlpha = Math.min(1, skid.life);
      ctx.beginPath();
      ctx.moveTo(skid.x1, skid.y1);
      ctx.lineTo(skid.x2, skid.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + pickup.bob) * 3;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      if (pickup.kind === 'cash') {
        ctx.fillStyle = '#2fae5f';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 5);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d21f5e';
        ctx.fillRect(-2.5, -8, 5, 16);
        ctx.fillRect(-8, -2.5, 16, 5);
      }
      ctx.restore();
    }
    // Objective marker (world space) and the off-screen arrow.
    const objective = objectivePoint(state);
    if (objective) {
      drawMarker(objective.x, objective.y, objective.r, objective.text, state.elapsed);
      const dx = objective.x - p.x;
      const dy = objective.y - p.y;
      if (Math.hypot(dx, dy) > 500) {
        const a = Math.atan2(dy, dx);
        const ax = p.x + Math.cos(a) * 190;
        const ay = p.y + Math.sin(a) * 140;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // Garage marker.
    if (state.nearGarage) drawMarker(PLACES.garage.x, PLACES.garage.y, 90, "Mara's Garage", state.elapsed);
    // Cars, people, bullets, particles.
    for (const car of state.cars) drawCar(car, car === p.inCar);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.colour, ped.dead, ped.bob);
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1c2a44', cop.dead, state.elapsed * 6);
      ctx.fillStyle = '#ffd23e';
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', cop.x, cop.y - 18);
    }
    if (p.onFoot) drawPerson(p.x, p.y, p.aimAngle || p.angle, '#ff7a1a', false, state.elapsed * 6);
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.colour;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Warm sunlight wash and vignette.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wash = ctx.createLinearGradient(0, 0, viewW, viewH);
    wash.addColorStop(0, 'rgba(255, 214, 130, 0.05)');
    wash.addColorStop(1, 'rgba(255, 140, 60, 0.06)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, viewW, viewH);
    const vig = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.45, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewW, viewH);

    if (screen === SCREEN.TITLE) drawTitle(state, info);
    else if (screen === SCREEN.PAUSED) {
      drawPanel('PAUSED', ['The bay waits for no one — except right now.', '', 'ENTER resume · M mute · R restart the story'], 'ENTER — RESUME', '#e8e4da');
    } else if (screen === SCREEN.WASTED) {
      drawPanel('WASTED', ['Riko went down in the streets of Solmar Bay.', `The story keeps your $${p.money.toLocaleString('en-US')} and your finished jobs.`, ''], 'ENTER — BACK ON YOUR FEET', '#ff5a5a');
    } else if (screen === SCREEN.BUSTED) {
      drawPanel('BUSTED', ['The Solmar Bay PD finally put the cuffs on Riko.', `The story keeps your $${p.money.toLocaleString('en-US')} and your finished jobs.`, ''], 'ENTER — OUT ON BAIL', '#2e6bff');
    } else if (screen === SCREEN.COMPLETE) {
      drawPanel('THE BIG SCORE', ['The vault is empty, the boat is gone, and Mara is smiling.', `Final haul: $${(state.stats.earned).toLocaleString('en-US')}. Solmar Bay is yours.`, ''], 'ENTER — FREE ROAM', '#7ee787');
    } else {
      drawHud(state, info);
    }
  }

  return { draw, resize };
}
