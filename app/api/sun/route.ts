import { callApi, fail, fromCache, guard, respond, str, toCache } from '@/lib/apiverve';

// Sun times for a place and day never change, so cache them for a day.
const TTL_MS = 24 * 60 * 60_000;

/** GET /api/sun?lat=36.46&lon=25.38&date=2026-06-21: sunrise, sunset, golden and blue hour times (UTC) and the timezone. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const date = str(params.get('date'), 10);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return fail('Pick a place on the map, or use your location');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Pick a date');

  // Round to ~1 km so nearby visitors share the cache.
  const la = lat.toFixed(2);
  const lo = lon.toFixed(2);
  const key = `sun:${la}:${lo}:${date}`;
  const hit = fromCache(key, TTL_MS);
  if (hit) return Response.json(hit);

  const blocked = guard(request);
  if (blocked) return blocked;

  return respond(async () => {
    const [y, m, d] = date.split('-');
    // The API takes MM-DD-YYYY. local=true adds the place's timezone, which the page uses to show local times.
    const data = await callApi('sunrisesunset', { query: { lat: la, lon: lo, date: `${m}-${d}-${y}`, local: 'true' } });
    toCache(key, data);
    return data;
  });
}
