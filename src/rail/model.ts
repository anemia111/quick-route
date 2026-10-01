export interface NationalStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  operators: string[];
  lines: string[];
}
export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
// stop id, arrival/departure seconds after service midnight (may exceed 86400), sequence, pickup, dropoff
export type StopTime = [string, number, number, number, boolean, boolean];
export interface Trip {
  id: string;
  service: string;
  route: string;
  headsign: string;
  times: StopTime[];
}
export interface Transfer {
  from: string;
  to: string;
  seconds: number;
  source: string;
}
export interface RailPackage {
  schema: 1;
  id: string;
  version: string;
  validFrom: string;
  validTo: string;
  source: string;
  license: string;
  operator: string;
  routes: { id: string; name: string }[];
  stops: Stop[];
  calendars: { id: string; start: string; end: string; days: number[] }[];
  exceptions: { service: string; date: string; added: boolean }[];
  trips: Trip[];
  transfers: Transfer[];
  completeTransfers: boolean;
  synthetic: boolean;
}
export interface PackageMeta {
  id: string;
  version: string;
  name: string;
  operator: string;
  validFrom: string;
  validTo: string;
  url: string;
  bytes: number;
  sha256: string;
  stopNames: string[];
  alternatives: string[];
  source: string;
  license: string;
}
export interface Manifest {
  schema: 1;
  generatedAt: string;
  stations: {
    url: string;
    bytes: number;
    sha256: string;
    version: string;
    source: string;
    license: string;
    baseline: string;
  };
  packages: PackageMeta[];
}
export interface SearchUsage {
  id: string;
  from: string;
  to: string;
  at: number;
  count: number;
}
export interface StoredPackage {
  id: string;
  data: RailPackage;
  bytes: number;
  lastUsed: number;
  savedAt: number;
}
export type Evidence = "schedule" | "official-prediction" | "simulation";
export interface Leg {
  fromSequence?: number;
  toSequence?: number;
  scheduledDeparture?: number;
  scheduledArrival?: number;
  packageId: string;
  tripId: string;
  serviceDate: string;
  route: string;
  from: Stop;
  to: Stop;
  departure: number;
  arrival: number;
  evidence: Evidence;
}
export interface Journey {
  realtimeExpiresAt?: number;
  realtimeSource?: string;
  realtimeFetchedAt?: number;
  id: string;
  legs: Leg[];
  arrival: number;
  departure: number;
  changes: number;
  evidence: Evidence;
  scope: "available-data";
}
export interface RoutingResult {
  journeys: Journey[];
  reason?: string;
  nextTrainSameArrival: boolean;
  elapsedMs: number;
}
export interface RealtimeTrip {
  tripId: string;
  startDate?: string;
  canceled: boolean;
  stops: {
    stopId?: string;
    sequence?: number;
    arrival?: number;
    departure?: number;
    arrivalDelay?: number;
    departureDelay?: number;
    skipped?: boolean;
    noData?: boolean;
  }[];
}
export interface RealtimeSnapshot {
  source: string;
  fetchedAt: number;
  timestamp: number;
  expiresAt: number;
  trips: RealtimeTrip[];
}
export interface ActiveJourney {
  journey: Journey;
  startedAt: number;
  status: "active" | "paused";
  lastEvaluated: number;
  anchor?: string;
}
