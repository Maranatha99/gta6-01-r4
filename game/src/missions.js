// The story of SOLMAR BAY, in six missions. Riko Vale, a wheelman fresh out of the
// county lockup, works off a debt to Mara Solis, the fixer who runs the bay's night
// trade. Each mission is a list of steps; the world walks them in order and the
// renderer shows the current one as the objective. All names are original.
import { PLACES } from './city.js';

export const STORY_INTRO =
  'Riko Vale is out. The bay still owes him — and Mara Solis still owns his debt. ' +
  'Six jobs. One way out.';

// step kinds:
//   goto    — reach the marker (on foot or in a car)
//   steal   — get into any car that is not yours, then the step completes
//   deliver  — reach the marker while carrying the package (in a car)
//   survive  — stay alive and unwasted until the timer runs out
//   hold     — stand inside the marker and hold E until the bar fills
//   escort   — pick up the passenger (drive to the marker), then drive them on
//   escape   — reach the marker while the wanted level is at its peak
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 400,
    briefing: 'Mara: "You need wheels before you need courage. Take any car on the street — parked or rolling — and bring it to my garage."',
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)', x: PLACES.spawn.x, y: PLACES.spawn.y, r: 90 },
      { kind: 'goto', text: "Drive the car to Mara's Garage", x: PLACES.garage.x, y: PLACES.garage.y, r: 90 },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    reward: 600,
    briefing: 'Mara: "The bay cops are sweeping the strip tonight. Get in a car, let them see you, and lose them at the hideout. Do not get caught."',
    steps: [
      { kind: 'goto', text: 'Get in a car and drive to the strip marker', x: 1650, y: 750, r: 90, wanted: 3 },
      { kind: 'survive', text: 'Lose the heat — reach the Hideout with the cops behind you', x: PLACES.hideout.x, y: PLACES.hideout.y, r: 100, time: 75 },
    ],
  },
  {
    id: 'package-run',
    title: 'Package Run',
    reward: 800,
    briefing: 'Mara: "Three drops, one clock. Pier Market, North Mall, East Diner. Drive fast, drive clean — the packages do not wait."',
    steps: [
      { kind: 'deliver', text: 'Deliver the package: Pier Market', x: PLACES.drop1.x, y: PLACES.drop1.y, r: 90, time: 150 },
      { kind: 'deliver', text: 'Deliver the package: North Mall', x: PLACES.drop2.x, y: PLACES.drop2.y, r: 90 },
      { kind: 'deliver', text: 'Deliver the package: East Diner', x: PLACES.drop3.x, y: PLACES.drop3.y, r: 90 },
    ],
  },
  {
    id: 'getaway-driver',
    title: 'Getaway Driver',
    reward: 1000,
    briefing: 'Mara: "I am walking out of the courthouse in five minutes and the whole precinct knows my face. Pick me up. Then drive like the bay is on fire."',
    steps: [
      { kind: 'escort', text: 'Pick up Mara at the courthouse', x: 1200, y: 1650, r: 90 },
      { kind: 'goto', text: 'Drive Mara to the Safehouse — cops are coming', x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 100, wanted: 2 },
    ],
  },
  {
    id: 'turbo-heist',
    title: 'Turbo Heist',
    reward: 1500,
    briefing: 'Mara: "A Vortex GT sits in the south lot, guarded by men who shoot first. Take it. Bring it to my garage. Try not to die."',
    steps: [
      { kind: 'goto', text: 'Reach the Vortex Lot', x: PLACES.lot.x, y: PLACES.lot.y, r: 110 },
      { kind: 'steal', text: 'Steal the Vortex GT', x: PLACES.lot.x, y: PLACES.lot.y, r: 130, vortex: true },
      { kind: 'goto', text: "Deliver the Vortex GT to Mara's Garage", x: PLACES.garage.x, y: PLACES.garage.y, r: 90 },
    ],
  },
  {
    id: 'big-score',
    title: 'Big Score',
    reward: 5000,
    briefing: 'Mara: "Solmar Bank. The vault, the boat, the tide. Get inside, hold the vault door, grab the cash — then run for the marina while every cop in the bay hunts you."',
    steps: [
      { kind: 'goto', text: 'Reach Solmar Bank', x: PLACES.bank.x, y: PLACES.bank.y, r: 110 },
      { kind: 'hold', text: 'Hold E to crack the vault (stay inside the marker)', x: PLACES.bank.x, y: PLACES.bank.y, r: 110, holdSeconds: 6 },
      { kind: 'escape', text: 'ESCAPE! Reach the marina boat — 5 stars on your head', x: PLACES.marina.x, y: PLACES.marina.y, r: 110, wanted: 5 },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? null;
}

/** The next mission the player has not finished yet, or null when the story is done. */
export function nextMission(doneIds) {
  return MISSIONS.find((m) => !doneIds.includes(m.id)) ?? null;
}
