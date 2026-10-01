export interface Stations {
  nearby: string;
  destination: string;
  nearbyId?: string;
  destinationId?: string;
}
export const STORAGE_KEY = "quick-route.stations.v1";
export function validateStations(value: Stations): string {
  if (!value.nearby.trim() || !value.destination.trim())
    return "最寄り駅と目的地駅を両方入力してください。";
  if (value.nearby.length > 100 || value.destination.length > 100)
    return "駅名は100文字以内で入力してください。";
  if (
    value.nearby.trim().normalize("NFKC").toLowerCase() ===
      value.destination.trim().normalize("NFKC").toLowerCase() &&
    !(
      value.nearbyId &&
      value.destinationId &&
      value.nearbyId !== value.destinationId
    )
  )
    return "同じ駅が入力されています。異なる2駅を登録してください。";
  return "";
}
export function loadStations(): { stations: Stations | null; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stations: null, error: "" };
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("nearby" in value) ||
      !("destination" in value) ||
      typeof value.nearby !== "string" ||
      typeof value.destination !== "string" ||
      validateStations(value as Stations)
    )
      throw new Error("Invalid settings");
    return {
      stations: {
        nearby: value.nearby.trim(),
        destination: value.destination.trim(),
        ...("nearbyId" in value && typeof value.nearbyId === "string"
          ? { nearbyId: value.nearbyId }
          : {}),
        ...("destinationId" in value && typeof value.destinationId === "string"
          ? { destinationId: value.destinationId }
          : {}),
      },
      error: "",
    };
  } catch {
    return {
      stations: null,
      error: "保存した設定を読み込めませんでした。駅を再登録してください。",
    };
  }
}
export function saveStations(value: Stations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
