// SOLMAR BAY — tunables for the whole game. One place for sizes, speeds, money and
// balance so the world, the renderer and the missions all agree on the same numbers.
export const STEP = 1 / 60;

export const WORLD_W = 3600;
export const WORLD_H = 2600;

// The road grid: every vertical and horizontal road centre, in world pixels.
export const ROAD_XS = [300, 750, 1200, 1650, 2100, 2550, 3000];
export const ROAD_YS = [300, 750, 1200, 1650, 2100];
export const ROAD_W = 96;
export const LANE = 24;

// The beach strip along the south edge: sand, then open water.
export const SAND_TOP = 2330;
export const WATER_TOP = 2480;

// Player on foot.
export const WALK_SPEED = 235;
export const PLAYER_RADIUS = 14;
export const PLAYER_HEALTH = 100;

// Cars: [name, topSpeed, accel, colour]
export const CAR_MODELS = [
  { name: 'Civic', top: 430, accel: 300, colour: '#c94f43' },
  { name: 'Sedan', top: 460, accel: 320, colour: '#3f6fb5' },
  { name: 'Pickup', top: 440, accel: 290, colour: '#7a7d84' },
  { name: 'Taxi', top: 470, accel: 330, colour: '#e8b93a' },
  { name: 'Van', top: 400, accel: 260, colour: '#e8e4da' },
  { name: 'Vortex GT', top: 620, accel: 460, colour: '#d21f5e' },
  { name: 'Interceptor', top: 590, accel: 430, colour: '#1c2a44' },
];

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 42;
export const PICKUP_COUNT = 8;

export const BULLET_SPEED = 950;
export const BULLET_RANGE = 560;
export const PISTOL_DAMAGE = 34;
export const MAG_SIZE = 12;

export const SAVE_KEY = 'solmar-bay-save-v1';
export const START_MONEY = 250;

// Wanted: stars 0..5. Each crime adds the listed stars (clamped at 5).
export const CRIME = { steal: 1, hitPed: 1, shoot: 1, killCop: 2, explode: 1 };
export const WANTED_DECAY_SECONDS = 10;

export const REPAIR_COST = 50;

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSED: 'paused',
  WASTED: 'wasted',
  BUSTED: 'busted',
  COMPLETE: 'complete',
};
