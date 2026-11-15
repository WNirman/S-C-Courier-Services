import { useEffect, useState } from 'react';

const GOOGLE_KEY = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyArfrBIf3sqWRnA5MvMOowVSfntyvLTRus';

let status = 'osm';
let googleScriptLoaded = false;
let googleAuthFailed = false;
const listeners = new Set();

function notifyListeners() {
    listeners.forEach((fn) => fn(status));
}

function loadGooglePlacesScript() {
    if (googleScriptLoaded || !GOOGLE_KEY) return;
    googleScriptLoaded = true;

    window.gm_authFailure = () => {
        console.warn('Google Maps billing/auth failed – using OpenStreetMap tiles & search fallback');
        googleAuthFailed = true;
        status = 'osm';
        notifyListeners();
    };

    window.__gmapsReady = () => {
        if (!googleAuthFailed) {
            // Probe Geocoder to see if full Google Maps + Billing is active
            try {
                new window.google.maps.Geocoder().geocode({ address: 'Colombo' }, (_res, st) => {
                    if (st === 'OK' && !googleAuthFailed) {
                        status = 'google';
                        notifyListeners();
                    }
                });
            } catch {
                // Keep 'osm'
            }
        }
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&callback=__gmapsReady`;
    script.async = true;
    document.head.appendChild(script);
}

/** React hook → 'google' | 'osm' (never gets stuck on 'loading') */
export function useMapProvider() {
    const [s, setS] = useState(status);
    useEffect(() => {
        loadGooglePlacesScript();
        listeners.add(setS);
        setS(status);
        return () => { listeners.delete(setS); };
    }, []);
    return s;
}

// ── Leaflet (OpenStreetMap) lazy loader ──────────────────────────────────────
let leafletPromise = null;
export function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);
        }

        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = () => resolve(window.L);
        js.onerror = () => { leafletPromise = null; reject(new Error('Leaflet failed to load')); };
        document.head.appendChild(js);
    });
    return leafletPromise;
}

// ── Multi-source Place Search (Nominatim + Photon fallback for fast Sri Lanka search) ──
export async function searchPlaces(query) {
    if (!query || query.trim().length < 2) return [];
    const raw = query.trim();
    const q = raw.toLowerCase().includes('sri lanka') ? raw : `${raw}, Sri Lanka`;

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&countrycodes=lk&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data.map((item) => ({
                    place_id: item.place_id,
                    display_name: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                }));
            }
        }
    } catch (e) {
        console.warn('Nominatim search fallback to Photon:', e);
    }

    // Fallback: Komoot Photon geocoder (very fast & lenient with partial/typo names)
    try {
        const res2 = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`
        );
        if (res2.ok) {
            const data2 = await res2.json();
            if (data2?.features?.length > 0) {
                return data2.features.map((f, idx) => {
                    const [lng, lat] = f.geometry.coordinates;
                    const p = f.properties || {};
                    const parts = [p.name, p.street, p.city || p.town || p.village, p.district, p.state, p.country].filter(Boolean);
                    return {
                        place_id: p.osm_id || idx,
                        display_name: parts.join(', '),
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                    };
                });
            }
        }
    } catch (e2) {
        console.warn('Photon search error:', e2);
    }

    return [];
}

// Keep alias for compatibility
export const nominatimSearch = searchPlaces;

export async function nominatimReverse(lat, lng) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data?.display_name) return data.display_name;
    } catch { /* ignore */ }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// ── Shared Sri Lanka coordinate fallback & routing helpers ───────────────────
const KNOWN_LK_LOCATIONS = {
    colombo: { lat: 6.9271, lng: 79.8612 },
    kandy: { lat: 7.2906, lng: 80.6337 },
    galle: { lat: 6.0535, lng: 80.2210 },
    jaffna: { lat: 9.6615, lng: 80.0255 },
    kurunegala: { lat: 7.4863, lng: 80.3623 },
    gampaha: { lat: 7.0840, lng: 79.9941 },
    negombo: { lat: 7.2008, lng: 79.8736 },
    matara: { lat: 5.9549, lng: 80.5550 },
    radawana: { lat: 7.0339, lng: 80.0684 },
    pugoda: { lat: 6.9765, lng: 80.1235 },
    nugegoda: { lat: 6.8649, lng: 79.8997 },
    maharagama: { lat: 6.8480, lng: 79.9265 },
    dehiwala: { lat: 6.8511, lng: 79.8659 },
    moratuwa: { lat: 6.7730, lng: 79.8816 },
    panadura: { lat: 6.7133, lng: 79.9026 },
    kalutara: { lat: 6.5854, lng: 79.9607 },
    kaduwela: { lat: 6.9333, lng: 79.9833 },
    malabe: { lat: 6.9061, lng: 79.9697 },
    battaramulla: { lat: 6.8980, lng: 79.9223 },
    rajagiriya: { lat: 6.9094, lng: 79.8944 },
    kelaniya: { lat: 6.9553, lng: 79.9220 },
    wattala: { lat: 6.9892, lng: 79.8917 },
    avissawella: { lat: 6.9543, lng: 80.2046 },
    anuradhapura: { lat: 8.3114, lng: 80.4037 },
    ratnapura: { lat: 6.6828, lng: 80.3992 },
    badulla: { lat: 6.9934, lng: 81.0550 },
    batticaloa: { lat: 7.7310, lng: 81.6747 },
    trincomalee: { lat: 8.5874, lng: 81.2152 }
};

export function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDuration(minutes) {
    if (minutes == null || isNaN(minutes)) return '';
    const mins = Math.max(1, Math.round(minutes));
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''} ${rem} min` : `${hrs} hr${hrs > 1 ? 's' : ''}`;
}

export async function geocodeLocation(address) {
    if (!address || typeof address !== 'string') return null;
    const clean = address.trim();
    if (!clean) return null;

    // Build candidate queries (full string, extracted "(Destination: X)" or "(City)", last comma segment)
    const candidates = [clean];
    const destMatch = clean.match(/\(Destination:\s*(.+?)\)/i);
    if (destMatch && destMatch[1]) {
        candidates.push(destMatch[1].trim());
    }
    const parenMatch = clean.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
        const inside = parenMatch[1].replace(/^Destination:\s*/i, '').trim();
        if (inside && !candidates.includes(inside)) candidates.push(inside);
    }

    // 1. Live geocoding via Nominatim / Photon
    for (const candidate of candidates) {
        try {
            const results = await searchPlaces(candidate);
            if (results && results.length > 0 && !isNaN(results[0].lat) && !isNaN(results[0].lng)) {
                return { lat: results[0].lat, lng: results[0].lng, label: results[0].display_name };
            }
        } catch { /* try next candidate / city fallback */ }
    }

    // 2. Fallback match against known Sri Lankan branch / city names
    const lower = clean.toLowerCase();
    for (const [city, coords] of Object.entries(KNOWN_LK_LOCATIONS)) {
        if (lower.includes(city)) {
            return { lat: coords.lat, lng: coords.lng, label: clean };
        }
    }

    return null;
}

export async function getDrivingRoute(fromLat, fromLng, toLat, toLng) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
            const data = await res.json();
            if (data?.routes?.length > 0) {
                const route = data.routes[0];
                const coords = Array.isArray(route.geometry?.coordinates)
                    ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
                    : [[fromLat, fromLng], [toLat, toLng]];
                return {
                    coords,
                    distanceKm: Number((route.distance / 1000).toFixed(2)),
                    durationMins: Math.max(1, Math.round((route.duration || 0) / 60)),
                    source: 'osrm'
                };
            }
        }
    } catch { /* fallback to Haversine */ }

    const approxKm = Number((haversineKm(fromLat, fromLng, toLat, toLng) * 1.25).toFixed(2));
    const approxMins = Math.max(5, Math.round((approxKm / 40) * 60));
    return {
        coords: [[fromLat, fromLng], [toLat, toLng]],
        distanceKm: approxKm,
        durationMins: approxMins,
        source: 'estimate'
    };
}
