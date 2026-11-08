import React, { useEffect, useRef, useState } from 'react';
import { loadLeaflet, searchPlaces, nominatimReverse } from './mapProvider';

const SL_CENTER = { lat: 6.9271, lng: 79.8612 }; // Default center: Colombo, Sri Lanka

/**
 * LocationPickerModal — Always renders an interactive map (Google Hybrid/Streets + OpenStreetMap)
 * with instant place search, click-to-pin, and draggable pin.
 * Props: isOpen, onClose, onConfirm({address,lat,lng}), title, initialLat, initialLng
 */
function LocationPickerModal({ isOpen, onClose, onConfirm, title = 'Pick a Location', initialLat, initialLng }) {
    const mapDivRef      = useRef(null);
    const mapRef         = useRef(null);
    const markerRef      = useRef(null);
    const debounceRef    = useRef(null);

    const [searchQuery,  setSearchQuery]  = useState('');
    const [selectedAddr, setSelectedAddr] = useState('');
    const [selectedLat,  setSelectedLat]  = useState(null);
    const [selectedLng,  setSelectedLng]  = useState(null);
    const [isLocating,   setIsLocating]   = useState(false);
    const [isSearching,  setIsSearching]  = useState(false);
    const [mapReady,     setMapReady]     = useState(false);
    const [suggestions,  setSuggestions]  = useState([]);
    const [tileMode,     setTileMode]     = useState('gstreets'); // 'gstreets' | 'ghybrid' | 'osm'
    const tileLayerRef   = useRef(null);

    const getTileUrl = (mode) => {
        if (mode === 'ghybrid') {
            return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        }
        if (mode === 'osm') {
            return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        }
        // Default: Google Maps clean streets view (never shows billing popup!)
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    };

    // ── Reverse geocode ──────────────────────────────────────────────────────
    const reverseGeocode = async (lat, lng) => {
        try {
            const addr = await nominatimReverse(lat, lng);
            if (addr) {
                setSelectedAddr(addr);
                setSearchQuery(addr);
            }
        } catch { /* ignore */ }
    };

    // ── Place / move marker ──────────────────────────────────────────────────
    const placeMarker = (lat, lng) => {
        const map = mapRef.current;
        const L = window.L;
        if (!map || !L) return;

        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng], {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div class="loc-pin"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                }),
            }).addTo(map);

            markerRef.current.on('dragend', (e) => {
                const p = e.target.getLatLng();
                setSelectedLat(p.lat);
                setSelectedLng(p.lng);
                reverseGeocode(p.lat, p.lng);
            });
        }
        setSelectedLat(lat);
        setSelectedLng(lng);
    };

    const moveTo = (lat, lng, zoom = 16) => {
        if (mapRef.current) {
            mapRef.current.setView([lat, lng], zoom);
        }
    };

    // ── Initialize Map when modal opens ──────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setMapReady(false);

        loadLeaflet().then((L) => {
            if (cancelled || !mapDivRef.current) return;

            // Clean up any existing instance on this container
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }

            const hasInit = typeof initialLat === 'number' && typeof initialLng === 'number';
            const startLat = hasInit ? initialLat : SL_CENTER.lat;
            const startLng = hasInit ? initialLng : SL_CENTER.lng;

            const map = L.map(mapDivRef.current, { zoomControl: true }).setView(
                [startLat, startLng],
                hasInit ? 16 : 11
            );

            tileLayerRef.current = L.tileLayer(getTileUrl(tileMode), {
                attribution: '© Google Maps / OpenStreetMap',
                maxZoom: 20,
            }).addTo(map);

            mapRef.current = map;

            if (hasInit) {
                placeMarker(initialLat, initialLng);
                reverseGeocode(initialLat, initialLng);
            }

            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                placeMarker(lat, lng);
                reverseGeocode(lat, lng);
            });

            setTimeout(() => map.invalidateSize(), 120);
            setMapReady(true);
        }).catch((err) => console.error('Map load error:', err));

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── Switch map tile layer (Google Streets / Google Satellite / OSM) ──────
    const handleSwitchTile = (newMode) => {
        setTileMode(newMode);
        if (mapRef.current && window.L) {
            if (tileLayerRef.current) {
                mapRef.current.removeLayer(tileLayerRef.current);
            }
            tileLayerRef.current = window.L.tileLayer(getTileUrl(newMode), {
                attribution: '© Google Maps / OpenStreetMap',
                maxZoom: 20,
            }).addTo(mapRef.current);
        }
    };

    // ── Search-as-you-type + Enter to search ─────────────────────────────────
    const runSearch = async (val) => {
        if (!val || val.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await searchPlaces(val);
            setSuggestions(results || []);
        } catch {
            setSuggestions([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        clearTimeout(debounceRef.current);
        if (val.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        debounceRef.current = setTimeout(() => runSearch(val), 350);
    };

    const handleSearchKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceRef.current);
            if (suggestions.length > 0) {
                handleSuggestionClick(suggestions[0]);
            } else if (searchQuery.trim().length >= 2) {
                setIsSearching(true);
                const results = await searchPlaces(searchQuery);
                setIsSearching(false);
                if (results && results.length > 0) {
                    handleSuggestionClick(results[0]);
                }
            }
        }
    };

    const handleSuggestionClick = (item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng ?? item.lon);
        placeMarker(lat, lng);
        moveTo(lat, lng, 16);
        setSelectedAddr(item.display_name);
        setSearchQuery(item.display_name);
        setSuggestions([]);
    };

    // ── GPS ──────────────────────────────────────────────────────────────────
    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation not supported by your browser.');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                placeMarker(lat, lng);
                moveTo(lat, lng, 16);
                reverseGeocode(lat, lng);
                setIsLocating(false);
            },
            () => {
                alert('Could not get your location. Please search or click on the map to pin.');
                setIsLocating(false);
            },
            { timeout: 10000 }
        );
    };

    const handleConfirm = () => {
        if (selectedLat === null || selectedLng === null) {
            alert('Please select a location by clicking on the map or searching.');
            return;
        }
        onConfirm({
            address: selectedAddr || searchQuery || `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`,
            lat: selectedLat,
            lng: selectedLng,
        });
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                            type="button"
                            onClick={() => handleSwitchTile('gstreets')}
                            style={{
                                padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: tileMode === 'gstreets' ? 'var(--accent-color)' : 'rgba(255,255,255,0.06)',
                                color: '#fff', fontWeight: 600
                            }}
                        >
                            Google Map
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchTile('ghybrid')}
                            style={{
                                padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: tileMode === 'ghybrid' ? 'var(--accent-color)' : 'rgba(255,255,255,0.06)',
                                color: '#fff', fontWeight: 600
                            }}
                        >
                            Satellite
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchTile('osm')}
                            style={{
                                padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: tileMode === 'osm' ? 'var(--accent-color)' : 'rgba(255,255,255,0.06)',
                                color: '#fff', fontWeight: 600
                            }}
                        >
                            OSM
                        </button>
                        <button className="loc-modal-close" onClick={onClose} title="Close"><i className='bx bx-x'></i></button>
                    </div>
                </div>

                <div className="loc-search-bar">
                    <div className="loc-search-input-wrap">
                        <i className='bx bx-search'></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search place, street, city in Sri Lanka (e.g. Pugoda, Kandy)..."
                            autoComplete="off"
                        />
                        {isSearching && <i className='bx bx-loader-alt bx-spin' style={{ color: 'var(--accent-color)' }}></i>}
                    </div>
                    <button
                        type="button"
                        onClick={() => runSearch(searchQuery)}
                        title="Search place"
                        style={{
                            padding: '0 0.85rem', borderRadius: '10px', border: '1px solid rgba(249,115,22,0.4)',
                            background: 'rgba(249,115,22,0.15)', color: 'var(--accent-color)', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap'
                        }}
                    >
                        Search
                    </button>
                    <button type="button" className="loc-gps-btn" onClick={handleUseMyLocation}
                        disabled={isLocating || !mapReady} title="Use my current location">
                        {isLocating ? <i className='bx bx-loader-alt bx-spin'></i> : <i className='bx bx-current-location'></i>}
                    </button>
                </div>

                {suggestions.length > 0 && (
                    <ul className="loc-suggestions">
                        {suggestions.map((item) => (
                            <li key={item.place_id} onClick={() => handleSuggestionClick(item)}>
                                <i className='bx bx-map-pin'></i><span>{item.display_name}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="loc-map-container">
                    <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
                    {!mapReady && (
                        <div className="loc-map-loading">
                            <i className='bx bx-loader-alt bx-spin'></i>
                            <span>Loading map...</span>
                        </div>
                    )}
                    {mapReady && selectedLat === null && (
                        <div className="loc-map-hint"><i className='bx bx-pointer'></i> Search above or click anywhere on the map to pin</div>
                    )}
                </div>

                {selectedLat !== null && (
                    <div className="loc-selected-info">
                        <i className='bx bx-check-circle' style={{ color: 'var(--success)', fontSize: '1.2rem', flexShrink: 0 }}></i>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedAddr || 'Location pinned'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                                📍 Lat: {selectedLat.toFixed(6)}, Lng: {selectedLng.toFixed(6)}
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
