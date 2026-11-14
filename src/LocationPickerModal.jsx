import React, { useEffect, useRef, useState } from 'react';
import { useMapProvider, loadLeaflet, nominatimSearch, nominatimReverse } from './mapProvider';

const DARK_MAP_STYLE = [
    { elementType: 'geometry',                                           stylers: [{ color: '#1a1f2e' }] },
    { elementType: 'labels.text.fill',                                   stylers: [{ color: '#8a9bb5' }] },
    { elementType: 'labels.text.stroke',                                 stylers: [{ color: '#1a1f2e' }] },
    { featureType: 'administrative', elementType: 'geometry',            stylers: [{ color: '#2d3748' }] },
    { featureType: 'poi',            elementType: 'labels.text.fill',    stylers: [{ color: '#8a9bb5' }] },
    { featureType: 'poi.park',       elementType: 'geometry',            stylers: [{ color: '#17213a' }] },
    { featureType: 'road',           elementType: 'geometry',            stylers: [{ color: '#2d3748' }] },
    { featureType: 'road',           elementType: 'labels.text.fill',    stylers: [{ color: '#9aa5be' }] },
    { featureType: 'road.highway',   elementType: 'geometry',            stylers: [{ color: '#3d4f6b' }] },
    { featureType: 'water',          elementType: 'geometry',            stylers: [{ color: '#0d1b2a' }] },
];

const SL_CENTER = { lat: 7.8731, lng: 80.7718 };

/**
 * LocationPickerModal — Google Maps, with automatic OpenStreetMap (Leaflet) fallback.
 * Props: isOpen, onClose, onConfirm({address,lat,lng}), title, initialLat, initialLng
 */
function LocationPickerModal({ isOpen, onClose, onConfirm, title = 'Pick a Location', initialLat, initialLng }) {
    const provider = useMapProvider();          // 'loading' | 'google' | 'osm'

    const mapDivRef      = useRef(null);
    const mapRef         = useRef(null);
    const markerRef      = useRef(null);
    const geocoderRef    = useRef(null);
    const searchInputRef = useRef(null);
    const debounceRef    = useRef(null);
    const providerRef    = useRef(provider);
    providerRef.current  = provider;

    const [selectedAddr, setSelectedAddr] = useState('');
    const [selectedLat,  setSelectedLat]  = useState(null);
    const [selectedLng,  setSelectedLng]  = useState(null);
    const [isLocating,   setIsLocating]   = useState(false);
    const [mapReady,     setMapReady]     = useState(false);
    const [suggestions,  setSuggestions]  = useState([]);

    // ── Reverse geocode ──────────────────────────────────────────────────────
    const reverseGeocode = async (lat, lng) => {
        let addr = '';
        if (providerRef.current === 'google' && geocoderRef.current) {
            addr = await new Promise((resolve) => {
                geocoderRef.current.geocode({ location: { lat, lng } }, (results, st) => {
                    resolve(st === 'OK' && results[0] ? results[0].formatted_address : '');
                });
            });
        } else {
            try { addr = await nominatimReverse(lat, lng); } catch { /* ignore */ }
        }
        if (addr) {
            setSelectedAddr(addr);
            if (searchInputRef.current) searchInputRef.current.value = addr;
        }
    };

    // ── Place / move marker (works for both providers) ───────────────────────
    const placeMarker = (lat, lng) => {
        const map = mapRef.current;
        if (!map) return;

        if (providerRef.current === 'google') {
            const G = window.google.maps;
            if (markerRef.current) {
                markerRef.current.setPosition({ lat, lng });
            } else {
                markerRef.current = new G.Marker({
                    position: { lat, lng }, map, draggable: true, animation: G.Animation.DROP,
                    icon: { path: G.SymbolPath.CIRCLE, scale: 10, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
                });
                markerRef.current.addListener('dragend', (e) => {
                    const lt = e.latLng.lat(), ln = e.latLng.lng();
                    setSelectedLat(lt); setSelectedLng(ln);
                    reverseGeocode(lt, ln);
                });
            }
        } else {
            const L = window.L;
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng], {
                    draggable: true,
                    icon: L.divIcon({ className: '', html: '<div class="loc-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
                }).addTo(map);
                markerRef.current.on('dragend', (e) => {
                    const p = e.target.getLatLng();
                    setSelectedLat(p.lat); setSelectedLng(p.lng);
                    reverseGeocode(p.lat, p.lng);
                });
            }
        }
        setSelectedLat(lat);
        setSelectedLng(lng);
    };

    const moveTo = (lat, lng, zoom = 16) => {
        const map = mapRef.current;
        if (!map) return;
        if (providerRef.current === 'google') { map.setCenter({ lat, lng }); map.setZoom(zoom); }
        else map.setView([lat, lng], zoom);
    };

    const resetSelection = () => {
        setSelectedAddr(''); setSelectedLat(null); setSelectedLng(null); setSuggestions([]);
        if (searchInputRef.current) searchInputRef.current.value = '';
    };

    // ── Init GOOGLE map ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen || provider !== 'google') return;
        let ac = null;
        setMapReady(false);
        resetSelection();

        const t = setTimeout(() => {
            if (!mapDivRef.current || !window.google?.maps) return;
            const G = window.google.maps;
            const hasInit = initialLat && initialLng;

            const map = new G.Map(mapDivRef.current, {
                center: hasInit ? { lat: initialLat, lng: initialLng } : SL_CENTER,
                zoom: hasInit ? 16 : 8,
                mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
                styles: DARK_MAP_STYLE,
            });
            mapRef.current = map;
            geocoderRef.current = new G.Geocoder();

            if (hasInit) { placeMarker(initialLat, initialLng); reverseGeocode(initialLat, initialLng); }

            map.addListener('click', (e) => {
                const lat = e.latLng.lat(), lng = e.latLng.lng();
                placeMarker(lat, lng);
                reverseGeocode(lat, lng);
            });

            if (searchInputRef.current) {
                ac = new G.places.Autocomplete(searchInputRef.current, {
                    componentRestrictions: { country: 'lk' },
                    fields: ['geometry', 'formatted_address', 'name'],
                });
                ac.addListener('place_changed', () => {
                    const place = ac.getPlace();
                    if (!place.geometry?.location) return;
                    const lat = place.geometry.location.lat(), lng = place.geometry.location.lng();
                    placeMarker(lat, lng);
                    moveTo(lat, lng);
                    setSelectedAddr(place.formatted_address || place.name || '');
                });
            }
            setMapReady(true);
        }, 60);

        return () => {
            clearTimeout(t);
            if (ac) window.google?.maps?.event?.clearInstanceListeners(ac);
            if (mapRef.current) window.google?.maps?.event?.clearInstanceListeners(mapRef.current);
            mapRef.current = null; markerRef.current = null; geocoderRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, provider]);

    // ── Init OPENSTREETMAP (Leaflet) map ─────────────────────────────────────
    useEffect(() => {
        if (!isOpen || provider !== 'osm') return;
        let cancelled = false;
        setMapReady(false);
        resetSelection();
        document.querySelectorAll('.pac-container').forEach((el) => el.remove());

        loadLeaflet().then((L) => {
            if (cancelled || !mapDivRef.current) return;
            const hasInit = initialLat && initialLng;

            const map = L.map(mapDivRef.current).setView(
                hasInit ? [initialLat, initialLng] : [SL_CENTER.lat, SL_CENTER.lng],
                hasInit ? 16 : 8
            );
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors', maxZoom: 19,
            }).addTo(map);
            mapRef.current = map;

            if (hasInit) { placeMarker(initialLat, initialLng); reverseGeocode(initialLat, initialLng); }

            map.on('click', (e) => {
                placeMarker(e.latlng.lat, e.latlng.lng);
                reverseGeocode(e.latlng.lat, e.latlng.lng);
            });

            setTimeout(() => map.invalidateSize(), 100);   // fixes "map not visible" inside modals
            setMapReady(true);
        }).catch((err) => console.error(err));

        return () => {
            cancelled = true;
            if (mapRef.current) { mapRef.current.remove(); }
            mapRef.current = null; markerRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, provider]);

    // ── Reset when closed ────────────────────────────────────────────────────
    useEffect(() => { if (!isOpen) { resetSelection(); setMapReady(false); } }, [isOpen]);

    // ── OSM search-as-you-type (Google mode uses Places Autocomplete instead) ─
    const handleSearchChange = (e) => {
        if (providerRef.current !== 'osm') return;
        const val = e.target.value;
        clearTimeout(debounceRef.current);
        if (val.trim().length < 3) { setSuggestions([]); return; }
        debounceRef.current = setTimeout(async () => {
            try { setSuggestions((await nominatimSearch(val)) || []); } catch { /* ignore */ }
        }, 500);
    };

    const handleSuggestionClick = (item) => {
        const lat = parseFloat(item.lat), lng = parseFloat(item.lon);
        placeMarker(lat, lng);
        moveTo(lat, lng);
        setSelectedAddr(item.display_name);
        if (searchInputRef.current) searchInputRef.current.value = item.display_name;
        setSuggestions([]);
    };

    // ── GPS ──────────────────────────────────────────────────────────────────
    const handleUseMyLocation = () => {
        if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                placeMarker(lat, lng); moveTo(lat, lng); reverseGeocode(lat, lng);
                setIsLocating(false);
            },
            () => { alert('Could not get your location. Please pin manually on the map.'); setIsLocating(false); },
            { timeout: 10000 }
        );
    };

    const handleConfirm = () => {
        if (selectedLat === null || selectedLng === null) {
            alert('Please select a location by clicking on the map or searching.');
            return;
        }
        onConfirm({ address: selectedAddr || searchInputRef.current?.value || '', lat: selectedLat, lng: selectedLng });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="loc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="loc-modal">

                <div className="loc-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <i className='bx bxs-map-pin' style={{ color: 'var(--accent-color)', fontSize: '1.4rem' }}></i>
                        <h3 style={{ margin: 0, color: '#fff', fontWeight: 700 }}>{title}</h3>
                    </div>
                    <button className="loc-modal-close" onClick={onClose} title="Close"><i className='bx bx-x'></i></button>
                </div>

                <div className="loc-search-bar">
                    <div className="loc-search-input-wrap">
                        <i className='bx bx-search'></i>
                        <input
                            ref={searchInputRef}
                            type="text"
                            onChange={handleSearchChange}
                            placeholder="Search place, street, city in Sri Lanka..."
                            autoComplete="off"
                        />
                    </div>
                    <button type="button" className="loc-gps-btn" onClick={handleUseMyLocation}
                        disabled={isLocating || !mapReady} title="Use my current location">
                        {isLocating ? <i className='bx bx-loader-alt bx-spin'></i> : <i className='bx bx-current-location'></i>}
                    </button>
                </div>

                {provider === 'osm' && suggestions.length > 0 && (
                    <ul className="loc-suggestions">
                        {suggestions.map((item) => (
                            <li key={item.place_id} onClick={() => handleSuggestionClick(item)}>
                                <i className='bx bx-map-pin'></i><span>{item.display_name}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="loc-map-container">
                    {/* key forces a fresh DOM node when switching Google ↔ OSM */}
                    <div key={provider} ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
                    {(provider === 'loading' || !mapReady) && (
                        <div className="loc-map-loading">
                            <i className='bx bx-loader-alt bx-spin'></i>
                            <span>Loading map...</span>
                        </div>
                    )}
                    {mapReady && selectedLat === null && (
                        <div className="loc-map-hint"><i className='bx bx-pointer'></i> Click anywhere on the map to pin</div>
                    )}
                </div>

                {provider === 'osm' && (
                    <div style={{ margin: '0 1.25rem 0.5rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        <i className='bx bx-info-circle'></i> Using OpenStreetMap (Google Maps unavailable)
                    </div>
                )}

                {selectedLat !== null && (
                    <div className="loc-selected-info">
                        <i className='bx bx-check-circle' style={{ color: 'var(--success)', fontSize: '1.2rem', flexShrink: 0 }}></i>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedAddr || 'Location pinned'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                                📍 {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                            </div>
                        </div>
                    </div>
                )}

                <div className="loc-modal-footer">
                    <button type="button" className="atr-btn atr-btn-secondary" onClick={onClose}>
                        <i className='bx bx-x'></i> Cancel
                    </button>
                    <button type="button" className="atr-btn atr-btn-primary" onClick={handleConfirm}
                        disabled={selectedLat === null} style={{ opacity: selectedLat === null ? 0.5 : 1 }}>
                        <i className='bx bx-check'></i> Confirm Location
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LocationPickerModal;
