'use client';

import { useEffect, useState } from 'react';

type Sun = Record<
  | 'sunrise' | 'sunset' | 'solarNoon' | 'dawn' | 'dusk' | 'nauticalDawn' | 'nauticalDusk'
  | 'nightEnd' | 'night' | 'goldenHourEnd' | 'goldenHour',
  string | null
> & { timezone?: string };

type Place = { name: string; lat: number; lon: number };

const PLACES: Place[] = [
  { name: 'Santorini', lat: 36.46, lon: 25.38 },
  { name: 'Reykjavík', lat: 64.15, lon: -21.94 },
  { name: 'Kyoto', lat: 35.01, lon: 135.77 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 }
];

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the viewer's zone

/** Minutes past local midnight in the place's timezone, for laying out the day bar. */
function minutes(iso: string | null, tz?: string) {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get('hour') * 60 + get('minute');
}

/** The calendar date (YYYY-MM-DD) an instant falls on in the place's timezone. */
const dayIn = (iso: string, tz?: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });

const clock = (iso: string | null, tz?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en', { timeZone: tz, hour: 'numeric', minute: '2-digit' }) : '—';

/** The bands of the day, in order: [from, to, kind]. Missing times (polar day or night) drop their band. */
function bands(s: Sun) {
  const order: [keyof Sun, keyof Sun, string][] = [
    ['nightEnd', 'dawn', 'twilight'],
    ['dawn', 'sunrise', 'blue'],
    ['sunrise', 'goldenHourEnd', 'golden'],
    ['goldenHourEnd', 'goldenHour', 'day'],
    ['goldenHour', 'sunset', 'golden'],
    ['sunset', 'dusk', 'blue'],
    ['dusk', 'night', 'twilight']
  ];
  return order
    .map(([a, b, kind]) => [minutes(s[a] as string | null, s.timezone), minutes(s[b] as string | null, s.timezone), kind] as const)
    .filter(([a, b]) => a != null && b != null && (b as number) > (a as number)) as [number, number, string][];
}

export default function Home() {
  const [place, setPlace] = useState<Place>(PLACES[0]);
  const [date, setDate] = useState('');
  const [sun, setSun] = useState<Sun | null>(null);
  const [error, setError] = useState('');
  const [missingKey, setMissingKey] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load(p: Place, d: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sun?lat=${p.lat}&lon=${p.lon}&date=${d}`);
      const body = await res.json();
      if (body.code === 'missing_key') return setMissingKey(true);
      if (!res.ok) throw new Error(body.error || 'Something went wrong');
      setSun(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ?lat=&lon=&name=&date= opens a place directly; otherwise Santorini, today.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const lat = Number(q.get('lat'));
    const lon = Number(q.get('lon'));
    const p = q.get('lat') && q.get('lon') ? { name: q.get('name') || 'Pinned place', lat, lon } : PLACES[0];
    const d = q.get('date') || today();
    setPlace(p);
    setDate(d);
    load(p, d);
  }, []);

  function choose(p: Place) {
    setPlace(p);
    load(p, date);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => choose({ name: 'Your location', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => setError('Location is blocked. Pick a place instead.')
    );
  }

  if (missingKey) {
    return (
      <main className="shell">
        <section className="panel missing">
          <h1>Add your API key</h1>
          <p>Golden Hour needs an APIVerve key. Set <code>APIVERVE_API_KEY</code> in <code>.env</code>, or in your Vercel project&rsquo;s environment variables, then restart or redeploy.</p>
          <a href="https://dashboard.apiverve.com/signup?api=sunrisesunset" target="_blank" rel="noreferrer">Get a free key</a>
        </section>
      </main>
    );
  }

  const tz = sun?.timezone;
  // Free plans get solar noon as null; it sits halfway between sunrise and sunset to within a minute.
  const noon = sun?.solarNoon ?? (sun?.sunrise && sun?.sunset
    ? new Date((new Date(sun.sunrise).getTime() + new Date(sun.sunset).getTime()) / 2).toISOString()
    : null);
  // Free plans always answer for today, whatever date was asked for. Show the day the times are really for.
  const shownDate = sun?.sunrise ? dayIn(sun.sunrise, tz) : date;
  const otherDayLocked = Boolean(sun && date && shownDate !== date);
  const allDayGolden = sun && sun.sunrise && !sun.goldenHourEnd;
  const noSun = sun && !sun.sunrise;
  const dayLength =
    sun?.sunrise && sun?.sunset ? (new Date(sun.sunset).getTime() - new Date(sun.sunrise).getTime()) / 60000 : null;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Golden Hour</p>
        <h1>{place.name}</h1>
        <p className="sub">
          {shownDate && new Date(shownDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {tz ? ` · ${tz.replace('_', ' ')}` : ''}
        </p>
      </header>

      <section className="controls">
        <div className="chips">
          {PLACES.map((p) => (
            <button key={p.name} className={p.name === place.name ? 'on' : ''} onClick={() => choose(p)}>{p.name}</button>
          ))}
          <button onClick={locate}>◎ My location</button>
        </div>
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value) load(place, e.target.value); }} aria-label="Date" />
      </section>

      {error && <p className="error">{error}</p>}

      {sun && (
        <section className={`panel ${loading ? 'dim' : ''}`}>
          <div className="bar" aria-hidden>
            {bands(sun).map(([a, b, kind], i) => (
              <span key={i} className={kind} style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />
            ))}
            {minutes(noon, tz) != null && <i className="noon" style={{ left: `${(minutes(noon, tz)! / 1440) * 100}%` }} />}
          </div>
          <div className="hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>

          {otherDayLocked && (
            <p className="note">
              These are today&rsquo;s times. Other dates need a paid plan: <a href="https://apiverve.com/pricing" target="_blank" rel="noreferrer">see pricing</a>.
            </p>
          )}
          {noSun && <p className="note">The sun doesn&rsquo;t rise here on this day. Twilight is all the light there is.</p>}
          {allDayGolden && <p className="note">The sun stays low all day: it&rsquo;s golden hour from sunrise to sunset.</p>}

          <div className="moments">
            <div className="golden">
              <h2>Morning golden hour</h2>
              <p>{allDayGolden ? 'All day' : `${clock(sun.sunrise, tz)} – ${clock(sun.goldenHourEnd, tz)}`}</p>
            </div>
            <div className="golden">
              <h2>Evening golden hour</h2>
              <p>{allDayGolden ? 'All day' : `${clock(sun.goldenHour, tz)} – ${clock(sun.sunset, tz)}`}</p>
            </div>
            <div className="blue">
              <h2>Morning blue hour</h2>
              <p>{clock(sun.dawn, tz)} – {clock(sun.sunrise, tz)}</p>
            </div>
            <div className="blue">
              <h2>Evening blue hour</h2>
              <p>{clock(sun.sunset, tz)} – {clock(sun.dusk, tz)}</p>
            </div>
          </div>

          <dl className="facts">
            <div><dt>Sunrise</dt><dd>{clock(sun.sunrise, tz)}</dd></div>
            <div><dt>Solar noon</dt><dd>{clock(noon, tz)}</dd></div>
            <div><dt>Sunset</dt><dd>{clock(sun.sunset, tz)}</dd></div>
            <div><dt>Daylight</dt><dd>{dayLength ? `${Math.floor(dayLength / 60)}h ${Math.round(dayLength % 60)}m` : '—'}</dd></div>
          </dl>
        </section>
      )}

      <footer className="foot">
        Sun times from <a href="https://apiverve.com/marketplace/sunrisesunset" target="_blank" rel="noreferrer">APIVerve Sunrise Sunset</a>
      </footer>
    </main>
  );
}
