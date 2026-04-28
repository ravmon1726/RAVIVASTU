import { Point, Room, RoomType, Defect, Planet, AnalysisResult } from '../types';

// ─── Zone System ────────────────────────────────────────────────────────────

export const ZONES_16 = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
] as const;

export type Zone16 = typeof ZONES_16[number];

export const ZONE_ELEMENTS: Record<Zone16, { element: string; deity: string; quality: string; color: string }> = {
  N:   { element: 'Water', deity: 'Kubera',   quality: 'Wealth & prosperity',   color: 'rgba(59,130,246,0.18)' },
  NNE: { element: 'Water', deity: 'Soma',     quality: 'Health & vitality',     color: 'rgba(99,179,237,0.18)' },
  NE:  { element: 'Space', deity: 'Ishanya',  quality: 'Divine & spiritual',    color: 'rgba(52,211,153,0.22)' },
  ENE: { element: 'Space', deity: 'Parjanya', quality: 'Knowledge & learning',  color: 'rgba(110,231,183,0.18)' },
  E:   { element: 'Air',   deity: 'Indra',    quality: 'Social & health',       color: 'rgba(34,197,94,0.18)' },
  ESE: { element: 'Air',   deity: 'Agni',     quality: 'Purification',          color: 'rgba(132,204,22,0.18)' },
  SE:  { element: 'Fire',  deity: 'Agni',     quality: 'Energy & fire',         color: 'rgba(253,224,71,0.22)' },
  SSE: { element: 'Fire',  deity: 'Yama',     quality: 'Transformation',        color: 'rgba(251,146,60,0.18)' },
  S:   { element: 'Earth', deity: 'Yama',     quality: 'Discipline & endings',  color: 'rgba(239,68,68,0.18)' },
  SSW: { element: 'Earth', deity: 'Niriti',   quality: 'Heaviness & stability', color: 'rgba(220,38,38,0.16)' },
  SW:  { element: 'Earth', deity: 'Niriti',   quality: 'Strength & stability',  color: 'rgba(180,83,9,0.18)' },
  WSW: { element: 'Earth', deity: 'Varuna',   quality: 'Storage & gains',       color: 'rgba(161,98,7,0.18)' },
  W:   { element: 'Water', deity: 'Varuna',   quality: 'Gains & profit',        color: 'rgba(107,114,128,0.18)' },
  WNW: { element: 'Water', deity: 'Vayu',     quality: 'Travel & movement',     color: 'rgba(156,163,175,0.16)' },
  NW:  { element: 'Air',   deity: 'Vayu',     quality: 'Air & movement',        color: 'rgba(147,197,253,0.18)' },
  NNW: { element: 'Air',   deity: 'Soma',     quality: 'Attraction & change',   color: 'rgba(186,230,253,0.16)' },
};

// Good zones per room type (ordered best → acceptable)
const IDEAL_ZONES: Partial<Record<RoomType, Zone16[]>> = {
  Kitchen:       ['SE', 'ESE', 'NW'],
  MasterBedroom: ['SW', 'SSW', 'S', 'W'],
  Bedroom:       ['S', 'W', 'NW', 'SW'],
  Toilet:        ['NW', 'WNW', 'ESE', 'SSE'],
  Bathroom:      ['NW', 'WNW', 'E', 'N'],
  Pooja:         ['NE', 'ENE', 'E', 'N'],
  LivingRoom:    ['N', 'NE', 'E', 'NW'],
  DiningRoom:    ['W', 'WNW', 'E', 'SE'],
  StudyRoom:     ['W', 'WNW', 'N', 'ENE'],
  StoreRoom:     ['SW', 'WSW', 'NW'],
  Garage:        ['NW', 'W', 'SW'],
  Balcony:       ['N', 'E', 'NE'],
  Staircase:     ['S', 'SW', 'W'],
  Basement:      ['N', 'E', 'NE'],
  Well:          ['NE', 'N', 'E'],
  Overhead_Tank: ['SW', 'W', 'NW'],
  MainDoor:      ['N', 'NE', 'E', 'NW'],
};

// Critical forbidden zones per room
const FORBIDDEN_ZONES: Partial<Record<RoomType, { zones: Zone16[]; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }[]>> = {
  Kitchen: [
    { zones: ['NE', 'ENE'], severity: 'CRITICAL' },
    { zones: ['SW', 'SSW'], severity: 'HIGH' },
    { zones: ['N', 'NNE'], severity: 'MEDIUM' },
  ],
  Toilet: [
    { zones: ['NE', 'ENE'], severity: 'CRITICAL' },
    { zones: ['SW', 'SSW'], severity: 'CRITICAL' },
    { zones: ['N', 'S'], severity: 'HIGH' },
    { zones: ['SE'], severity: 'HIGH' },
  ],
  Bathroom: [
    { zones: ['NE', 'ENE'], severity: 'CRITICAL' },
    { zones: ['SW', 'SSW'], severity: 'HIGH' },
  ],
  Pooja: [
    { zones: ['S', 'SSE', 'SSW', 'SW'], severity: 'CRITICAL' },
    { zones: ['W', 'WSW', 'WNW'], severity: 'HIGH' },
  ],
  MasterBedroom: [
    { zones: ['NE', 'ENE'], severity: 'HIGH' },
    { zones: ['SE', 'SSE'], severity: 'MEDIUM' },
  ],
  Well: [
    { zones: ['SW', 'SSW', 'SE', 'S'], severity: 'HIGH' },
  ],
  Overhead_Tank: [
    { zones: ['NE', 'N', 'E'], severity: 'HIGH' },
  ],
};

// Brahmasthan forbidden room types
const BRAHMASTHAN_FORBIDDEN: RoomType[] = ['Kitchen', 'Toilet', 'Bathroom', 'Staircase'];

// Remedies database
const REMEDIES: Record<string, string> = {
  Kitchen_NE:     'Install a copper Sri Yantra in the NE corner. Paint walls light green. Avoid red color in this kitchen. Place a tulsi plant outside the kitchen door.',
  Kitchen_SW:     'Place heavy items like refrigerator in SW. Use earthy tones. Hang a copper wind chime to balance energies.',
  Toilet_NE:      'Place sea salt in a copper bowl inside. Install a mirror on the East wall to reflect energies. Paint walls white. Keep the toilet lid closed always.',
  Toilet_SW:      'Hang a Vastu dosh nivaran yantra on the toilet door. Use white or grey tiles. Never leave the door open.',
  Toilet_N:       'Install a green Vastu pyramid inside. Keep toilet fragrant and clean at all times.',
  MainDoor_S7:    'Place a Vastu yantra above the door lintel. Hang a seven-horse painting inside facing North. Use a bright red door mat.',
  MainDoor_S6:    'Install a copper Swastika symbol above the door. Place two potted plants flanking the entrance.',
  MainDoor_S8:    'Place nine coins (copper) under the door threshold. Hang a wind chime with 7 rods. Paint the door dark red or brown.',
  Brahmasthan:    'The Brahmasthan must be kept free. If a pillar exists, keep it round, never square. Leave open as a courtyard or skylight if possible.',
  Staircase_NE:   'The staircase in NE disturbs spiritual energy. Place a small Ganesha idol at the staircase base. Use light colors.',
  MasterBedroom_NE: 'Place a heavy wooden bed with head toward South or West. Use earthy colors. Avoid blue color in this bedroom.',
  Kitchen_N:      'Place a red colored cloth or curtain at the kitchen entrance. Avoid placing the cooking stove facing North.',
  Positive_SE_Kitchen:    'Excellent kitchen placement in SE (Agni corner). This enhances digestive health and family harmony.',
  Positive_SW_MasterBedroom: 'Ideal master bedroom in SW. This promotes stability, sound sleep, and marital harmony.',
  Positive_NE_Pooja:      'Perfect Pooja room placement in NE (Ishanya). This magnifies prayers and spiritual growth.',
};

function getRemedy(roomType: RoomType, zone: Zone16 | string): string {
  const key = `${roomType}_${zone}`;
  if (REMEDIES[key]) return REMEDIES[key];
  // Generic remedy based on zone character
  const zoneInfo = ZONE_ELEMENTS[zone as Zone16];
  if (!zoneInfo) return 'Consult a certified Vastu expert for personalised remedies for this placement.';
  return `This ${roomType} placement in the ${zone} (${zoneInfo.deity} zone) creates imbalance. Use Vastu pyramids, copper yantras, or mirrors to redirect energies. Consider relocating if possible.`;
}

// ─── Geometry Helpers ───────────────────────────────────────────────────────

export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

export function allRoomsCentroid(rooms: Room[]): Point | null {
  const allPoints = rooms.flatMap(r => r.points);
  if (allPoints.length === 0) return null;
  return polygonCentroid(allPoints);
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Zone Calculation ────────────────────────────────────────────────────────

export function getZoneIndex(
  point: Point,
  center: Point,
  northOffset: number
): number {
  const dy = point.y - center.y;
  const dx = point.x - center.x;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90 - northOffset;
  // Normalize to 0..360
  angle = ((angle % 360) + 360) % 360;
  return Math.floor((angle + 11.25) / 22.5) % 16;
}

export function getZone(point: Point, center: Point, northOffset: number): Zone16 {
  return ZONES_16[getZoneIndex(point, center, northOffset)];
}

export function getZonesForPolygon(
  points: Point[],
  center: Point,
  northOffset: number
): Zone16[] {
  const zoneSet = new Set<Zone16>();
  // Sample centroid + multiple interior/edge points
  const centroid = polygonCentroid(points);
  zoneSet.add(getZone(centroid, center, northOffset));
  // Add zones for each vertex
  for (const p of points) {
    // Mid point between centroid and vertex
    const mid = { x: (centroid.x + p.x) / 2, y: (centroid.y + p.y) / 2 };
    zoneSet.add(getZone(mid, center, northOffset));
  }
  return Array.from(zoneSet);
}

// ─── 32-Pada System ─────────────────────────────────────────────────────────

export const GOOD_PADAS: Record<string, number[]> = {
  N: [3, 4],
  E: [3, 4],
  S: [1, 2, 3, 4],
  W: [3, 4],
};

export const BAD_PADAS: Record<string, number[]> = {
  S: [6, 7, 8],
};

export const PADA_NAMES: Record<string, string[]> = {
  N: ['Shikhi', 'Parjanya', 'Jayantha', 'Indra', 'Surya', 'Satya', 'Bhrisha', 'Akasha'],
  E: ['Jayantha', 'Indra', 'Surya', 'Satya', 'Bhrisha', 'Akasha', 'Anil', 'Pusha'],
  S: ['Vitatha', 'Grihakshat', 'Yama', 'Gandharva', 'Bhringaraj', 'Mrigha', 'Pitru', 'Dauvarika'],
  W: ['Shukra', 'Roga', 'Naga', 'Mukhya', 'Bhallat', 'Soma', 'Bhujaga', 'Aditi'],
};

export function getDoorWallAndPada(
  doorCentroid: Point,
  center: Point,
  northOffset: number
): { wall: 'N' | 'E' | 'S' | 'W'; pada: number; padaName: string } {
  let angle = (Math.atan2(doorCentroid.y - center.y, doorCentroid.x - center.x) * 180) / Math.PI + 90 - northOffset;
  angle = ((angle % 360) + 360) % 360;

  let wall: 'N' | 'E' | 'S' | 'W';
  let wallCenter: number;

  if (angle <= 45 || angle > 315) { wall = 'N'; wallCenter = 0; }
  else if (angle > 45 && angle <= 135) { wall = 'E'; wallCenter = 90; }
  else if (angle > 135 && angle <= 225) { wall = 'S'; wallCenter = 180; }
  else { wall = 'W'; wallCenter = 270; }

  let offset = angle - wallCenter;
  if (offset > 180) offset -= 360;
  if (offset < -180) offset += 360;
  // Offset ranges from -45 to +45 for the wall
  // Map to pada 1-8: pada 1 = left end (negative offset), pada 8 = right end
  const pada = Math.max(1, Math.min(8, Math.floor((offset + 45) / 11.25) + 1));
  const padaName = PADA_NAMES[wall]?.[pada - 1] ?? `Pada ${pada}`;
  return { wall, pada, padaName };
}

// ─── Planet Directions ───────────────────────────────────────────────────────

export const PLANET_ZONES: Record<Planet, Zone16[]> = {
  Sun:     ['E', 'ESE'],
  Moon:    ['NW', 'NNW'],
  Mars:    ['S', 'SSW'],
  Mercury: ['N', 'NNE'],
  Jupiter: ['NE', 'ENE'],
  Venus:   ['SE', 'ESE'],
  Saturn:  ['W', 'WSW'],
  Rahu:    ['SW', 'SSW'],
  Ketu:    ['NW', 'WNW'],
};

// ─── Main Analysis Engine ────────────────────────────────────────────────────

export function analyzeVastu(
  rooms: Room[],
  center: Point,
  northOffset: number,
  weakPlanets: Planet[]
): AnalysisResult {
  const defects: Defect[] = [];
  const positives: string[] = [];
  let penaltyTotal = 0;

  // Classify each room by zone
  const classifiedRooms = rooms.map(room => {
    const centroid = polygonCentroid(room.points);
    const zone = getZone(centroid, center, northOffset);
    const allZones = getZonesForPolygon(room.points, center, northOffset);
    let pada: number | undefined;
    let wallSide: 'N' | 'E' | 'S' | 'W' | undefined;

    if (room.type === 'MainDoor') {
      const doorInfo = getDoorWallAndPada(centroid, center, northOffset);
      pada = doorInfo.pada;
      wallSide = doorInfo.wall;
    }

    return { ...room, zone, subZones: allZones, centroid, pada, wallSide };
  });

  // Check Brahmasthan
  let brahmasthhanSafe = true;
  for (const room of classifiedRooms) {
    if (!BRAHMASTHAN_FORBIDDEN.includes(room.type)) continue;
    if (pointInPolygon(center, room.points)) {
      brahmasthhanSafe = false;
      const penalty = room.type === 'Toilet' || room.type === 'Bathroom' ? 20 : 15;
      penaltyTotal += penalty;
      defects.push({
        severity: 'CRITICAL',
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        zone: 'Brahmasthan',
        issue: `${room.name} (${room.type}) is located at the Brahmasthan — the sacred center of the house. This severely disrupts the cosmic energy flow.`,
        remedy: REMEDIES['Brahmasthan'],
      });
    }
  }

  // Check room placement rules
  for (const room of classifiedRooms) {
    const zone = room.zone as Zone16;
    if (!zone) continue;

    // Check forbidden zones
    const forbiddenList = FORBIDDEN_ZONES[room.type] ?? [];
    for (const { zones, severity } of forbiddenList) {
      if (zones.includes(zone as Zone16)) {
        const penalty = severity === 'CRITICAL' ? 20 : severity === 'HIGH' ? 10 : 5;

        // Check planet amplification
        let amplifedByPlanet = false;
        let planetName: string | undefined;
        for (const planet of weakPlanets) {
          if (PLANET_ZONES[planet]?.includes(zone)) {
            amplifedByPlanet = true;
            planetName = planet;
            penaltyTotal += Math.round(penalty * 0.5); // extra 50% for weak planet
          }
        }

        penaltyTotal += penalty;
        defects.push({
          severity,
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
          zone,
          issue: `${room.name} (${room.type}) in ${zone} zone${amplifedByPlanet ? ` — amplified by weak ${planetName}` : ''}. ${ZONE_ELEMENTS[zone]?.deity} zone is incompatible with ${room.type}.`,
          remedy: getRemedy(room.type, zone),
          planet: planetName,
          amplifedByPlanet,
        });
        break; // Report worst violation per room
      }
    }

    // Check ideal placement for positives
    const idealList = IDEAL_ZONES[room.type] ?? [];
    if (idealList.length > 0 && idealList[0] === zone) {
      positives.push(`${room.name} (${room.type}) is in the ideal ${zone} zone — excellent Vastu placement.`);
      if (REMEDIES[`Positive_${zone}_${room.type}`]) {
        positives.push(REMEDIES[`Positive_${zone}_${room.type}`]);
      }
    }
  }

  // Check Main Door padas
  const mainDoors = classifiedRooms.filter(r => r.type === 'MainDoor');
  for (const door of mainDoors) {
    if (!door.wallSide || !door.pada) continue;
    const wall = door.wallSide;
    const pada = door.pada;
    const badPadas = BAD_PADAS[wall] ?? [];
    const goodPadas = GOOD_PADAS[wall] ?? [];

    if (badPadas.includes(pada)) {
      const severity = pada === 7 ? 'HIGH' : 'MEDIUM';
      const penalty = severity === 'HIGH' ? 10 : 5;
      penaltyTotal += penalty;
      defects.push({
        severity,
        roomId: door.id,
        roomName: door.name,
        roomType: 'MainDoor',
        zone: door.zone,
        issue: `Main door on ${wall} wall at Pada ${pada} (${PADA_NAMES[wall]?.[pada - 1] ?? ''}). ${wall}${pada} is an inauspicious pada — brings obstacles and financial stress.`,
        remedy: getRemedy('MainDoor', `${wall}${pada}` as Zone16),
      });
    } else if (goodPadas.includes(pada)) {
      positives.push(`Main door on ${wall} wall at Pada ${pada} (${PADA_NAMES[wall]?.[pada - 1] ?? ''}) — an auspicious ${wall}${pada} pada bringing wealth and good fortune.`);
    }
  }

  // Check NE zone health
  const neRooms = classifiedRooms.filter(r => r.zone === 'NE' || r.zone === 'ENE');
  const divineRooms = neRooms.filter(r =>
    r.type === 'Pooja' || r.type === 'LivingRoom' || r.type === 'Bedroom'
  );
  if (neRooms.length > 0 && divineRooms.length === neRooms.length) {
    positives.push('NE (Ishanya) zone has auspicious rooms — spiritual energy is well preserved.');
  }

  // Clamp score
  const score = Math.max(0, Math.min(100, 100 - penaltyTotal));

  const planetWeightage: Partial<Record<Planet, number>> = {};
  for (const planet of weakPlanets) {
    const zones = PLANET_ZONES[planet];
    const problematic = classifiedRooms.filter(r => zones.includes(r.zone as Zone16));
    if (problematic.length > 0) {
      planetWeightage[planet] = problematic.length * 5;
    }
  }

  return {
    score,
    defects,
    positives,
    brahmasthhanSafe,
    planetWeightage,
  };
}
