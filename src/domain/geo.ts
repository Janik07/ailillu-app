export interface Point {
  lat: number;
  lon: number;
}

export function distanceKm(a: Point, b: Point) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Walking time only makes sense close by; further away the distance says more. */
export function distanceLabel(km: number) {
  const dist = km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km));
  if (km > 2.5) return `${dist} км`;
  return `${Math.max(1, Math.round((km / 4.8) * 60))} мин · ${dist} км`;
}
