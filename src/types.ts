export interface Point {
  x: number;
  y: number;
}

export type RoomType =
  | 'Kitchen'
  | 'MasterBedroom'
  | 'Bedroom'
  | 'Toilet'
  | 'Bathroom'
  | 'MainDoor'
  | 'Pooja'
  | 'LivingRoom'
  | 'DiningRoom'
  | 'StudyRoom'
  | 'StoreRoom'
  | 'Garage'
  | 'Balcony'
  | 'Staircase'
  | 'Basement'
  | 'Well'
  | 'Overhead_Tank';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  points: Point[];
  zone?: string;
  subZones?: string[];
  pada?: number;
  wallSide?: 'N' | 'E' | 'S' | 'W';
  centroid?: Point;
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE';

export interface Defect {
  severity: Severity;
  roomId: string;
  roomName: string;
  roomType: RoomType;
  issue: string;
  remedy: string;
  planet?: string;
  zone?: string;
  amplifedByPlanet?: boolean;
}

export interface AnalysisResult {
  score: number;
  defects: Defect[];
  positives: string[];
  brahmasthhanSafe: boolean;
  planetWeightage: Partial<Record<Planet, number>>;
}

export type Planet = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

export interface SavedAnalysis {
  id: string;
  user_id: string;
  score: number;
  defects_json: Defect[];
  rooms_json: Room[];
  north_offset: number;
  floor_name: string;
  created_at: string;
}
