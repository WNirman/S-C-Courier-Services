import { useEffect, useState } from 'react';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyArfrBIf3sqWRnA5MvMOowVSfntyvLTRus';

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
