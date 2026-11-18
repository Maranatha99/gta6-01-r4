// Solmar Bay itself: a sun-soaked coastal city on a road grid, built once from a seed.
// Blocks hold buildings (downtown glass in the middle, houses and shops elsewhere),
// parks, parking lots and palms; the south edge is sand and open water with a marina.
// Key story places sit at fixed road corners so missions always know where to point.
import { ROAD_W, ROAD_XS, ROAD_YS, SAND_TOP, WATER_TOP, WORLD_H, WORLD_W } from './config.js';

const HOUSE_COLOURS = ['#e8a87c', '#d9a05b', '#c97b6a', '#a8b8a0', '#d8c49a', '#b08968', '#e0b184'];
const SHOP_COLOURS = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d9dc5', '#c1666b', '#8a7f8d'];
const GLASS_COLOURS = ['#5b7d9e', '#6e8ca8', '#4f6f8e', '#7d9db5', '#5f7f95'];

export const PLACES = {
  garage: { x: 300, y: 300, label: "Mara's Garage" },
  hideout: { x: 3000, y: 300, label: 'Hideout' },
  bank: { x: 1650, y: 1200, label: 'Solmar Bank' },
  lot: { x: 2550, y: 2100, label: 'Vortex Lot' },
  safehouse: { x: 750, y: 2100, label: 'Safehouse' },
  marina: { x: 3250, y: 2440, label: 'Marina Boat' },
  drop1: { x: 300, y: 1650, label: 'Drop: Pier Market' },
  drop2: { x: 2100, y: 750, label: 'Drop: North Mall' },
  drop3: { x: 3000, y: 1650, label: 'Drop: East Diner' },
  spawn: { x: 300, y: 750, label: 'Spawn' },
};

/** Is the point on a road (within the asphalt)? */
export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

/** The nearest road centre to a point, and whether that road runs vertically. */
export function nearestRoad(x, y) {
  let bestX = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  let bestY = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  return Math.abs(x - bestX) <= Math.abs(y - bestY)
    ? { centre: bestX, vertical: true }
    : { centre: bestY, vertical: false };
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parking = [];
  const boats = [];

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROAD_XS, WORLD_W];
  const ys = [0, ...ROAD_YS, SAND_TOP];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_W / 2 + 14;
      const x1 = xs[bx + 1] - ROAD_W / 2 - 14;
      const y0 = ys[by] + ROAD_W / 2 + 14;
      const y1 = ys[by + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const downtown = bx >= 2 && bx <= 4 && by >= 1 && by <= 3;
      const roll = random.next();
      if (roll < 0.16) {
        // A park: grass and a scatter of palms.
        const count = random.int(4, 8);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), palm: random.chance(0.5) });
        }
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, park: true, colour: '#7fae6b', roof: '#7fae6b', height: 0 });
        continue;
      }
      if (roll < 0.24) {
        // A parking lot with a few parked cars (filled in by the world).
        parking.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One or two buildings per block.
      const split = random.chance(0.45) && x1 - x0 > 260;
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p += 1) {
        const px0 = split ? x0 + (p * (x1 - x0)) / 2 + 8 : x0;
        const px1 = split ? x0 + ((p + 1) * (x1 - x0)) / 2 - 8 : x1;
        const bw = random.range((px1 - px0) * 0.55, (px1 - px0) * 0.9);
        const bh = random.range((y1 - y0) * 0.5, (y1 - y0) * 0.88);
        const bx0 = px0 + (px1 - px0 - bw) / 2;
        const by0 = y0 + (y1 - y0 - bh) / 2;
        const colour = downtown ? random.pick(GLASS_COLOURS) : random.chance(0.5) ? random.pick(HOUSE_COLOURS) : random.pick(SHOP_COLOURS);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          colour, roof: colour, height: downtown ? random.int(26, 60) : random.int(6, 18),
          park: false,
        });
      }
      // Street trees along the block edge.
      const edgeTrees = random.int(0, 3);
      for (let i = 0; i < edgeTrees; i += 1) {
        trees.push({ x: random.range(x0, x1), y: y0 + random.range(0, 10), palm: true });
      }
    }
  }

  // Palms along the boardwalk and a few boats at the marina.
  for (let x = 120; x < WORLD_W - 120; x += 130) {
    trees.push({ x: x + random.range(-20, 20), y: SAND_TOP + 22, palm: true });
  }
  for (let i = 0; i < 5; i += 1) {
    boats.push({ x: 3080 + i * 90, y: WATER_TOP + 46, angle: random.range(-0.1, 0.1), colour: random.pick(['#e8e4da', '#c94f43', '#3f6fb5']) });
  }

  return { buildings, trees, parking, boats };
}
