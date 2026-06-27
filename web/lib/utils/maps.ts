// 2gis deep links from coordinates (no API key, no scraping — just a link).

/** Directions in 2gis from the user's location to the clinic point. */
export function twogisRoute(lat: number, lng: number): string {
  return `https://2gis.kz/directions/points/%7C${lng}%2C${lat}`;
}

/** Show the clinic point on 2gis. */
export function twogisPoint(lat: number, lng: number): string {
  return `https://2gis.kz/geo/${lng},${lat}`;
}
