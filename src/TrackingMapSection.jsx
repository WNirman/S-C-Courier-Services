import React, { useEffect, useRef, useState } from 'react';
import { loadLeaflet, geocodeLocation, getDrivingRoute, formatDuration } from './mapProvider';

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidCoord(val) {
    return val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val));
}

/**
 * Interactive tracking map displayed when a rider is assigned to an ATR or Personal Delivery.
 * Shows Pickup/Origin, Destination, live or stage-estimated Rider marker, distance/duration summary,
 * and a blue road-route polyline connecting the route points.
 */
function TrackingMapSection({
    trackingId,
    status,
    originAddress,
    destinationAddress,
    originLat,
    originLng,
    destLat,
    destLng,
    estimatedDistance,
    actualDistance,
    rider,
    onRefresh,
    isRefreshing = false
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);

    const [routeSummary, setRouteSummary] = useState(null);
    const [mapLoading, setMapLoading] = useState(true);
    const [mapError, setMapError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function initRouteMap() {
            setMapLoading(true);
            setMapError('');

            try {
                const L = await loadLeaflet();
                if (cancelled || !mapContainerRef.current) return;

                // Resolve Pickup / Origin coordinates
                let pickup = (isValidCoord(originLat) && isValidCoord(originLng))
                    ? { lat: Number(originLat), lng: Number(originLng), label: originAddress || 'Pickup Point' }
                    : await geocodeLocation(originAddress);

                if (!pickup) {
                    pickup = { lat: 6.9271, lng: 79.8612, label: originAddress || 'Colombo Hub' };
                }

                // Resolve Destination coordinates
                let drop = (isValidCoord(destLat) && isValidCoord(destLng))
                    ? { lat: Number(destLat), lng: Number(destLng), label: destinationAddress || 'Destination' }
                    : await geocodeLocation(destinationAddress);

                if (!drop) {
                    if (!cancelled) {
                        setMapError('Could not locate destination coordinates on the map.');
                        setMapLoading(false);
                    }
                    return;
                }

                if (cancelled || !mapContainerRef.current) return;

                // Clean up any existing Leaflet instance before recreating
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }
                if (mapContainerRef.current._leaflet_id) {
                    mapContainerRef.current._leaflet_id = null;
                }

                const map = L.map(mapContainerRef.current, {
                    zoomControl: true,
                    attributionControl: true
                });
                mapInstanceRef.current = map;

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(map);

                // Compute main blue route between Origin and Destination
                const mainRoute = await getDrivingRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
                if (cancelled) return;

                const hasLiveGps = Boolean(
                    rider &&
                    isValidCoord(rider.currentLat) &&
                    isValidCoord(rider.currentLng) &&
                    Number(rider.currentLat) !== 0 &&
                    Number(rider.currentLng) !== 0
                );

                let riderLatLng = null;
                let riderPositionLabel = '';
                let activeSegmentRoute = null;

                if (hasLiveGps) {
                    riderLatLng = [Number(rider.currentLat), Number(rider.currentLng)];
                    riderPositionLabel = 'Live Rider GPS Location';

                    if (status === 'In Transit') {
                        activeSegmentRoute = await getDrivingRoute(
                            riderLatLng[0],
                            riderLatLng[1],
                            drop.lat,
                            drop.lng
                        );
                    } else if (status === 'Assigned') {
                        activeSegmentRoute = await getDrivingRoute(
                            riderLatLng[0],
                            riderLatLng[1],
                            pickup.lat,
                            pickup.lng
                        );
                    }
                } else {
                    // Fallback rider marker along the route based on delivery stage when mobile GPS is pending
                    if (status === 'Completed' || status === 'Delivered') {
                        riderLatLng = [drop.lat, drop.lng];
                        riderPositionLabel = 'Delivered at Destination';
                    } else if (status === 'In Transit' && mainRoute.coords.length > 1) {
                        const midIndex = Math.floor(mainRoute.coords.length * 0.5);
                        riderLatLng = mainRoute.coords[midIndex];
                        riderPositionLabel = 'En Route (Awaiting Live GPS Sync)';
                    } else {
                        riderLatLng = [pickup.lat, pickup.lng];
                        riderPositionLabel = rider?.branch
                            ? `Dispatched (${rider.branch}) • Preparing Pickup`
                            : 'Assigned • Preparing Pickup';
                    }
                }

                if (cancelled) return;

                // Draw route lines: always show a prominent blue route connecting the two points
                const boundsPoints = [[pickup.lat, pickup.lng], [drop.lat, drop.lng]];

                if (hasLiveGps && status === 'In Transit' && activeSegmentRoute) {
                    // Completed trail from Pickup to current Rider GPS
                    L.polyline([[pickup.lat, pickup.lng], riderLatLng], {
                        color: '#60a5fa',
                        weight: 3,
                        opacity: 0.6,
                        dashArray: '6, 8'
                    }).addTo(map);

                    // Active blue route from Rider GPS -> Destination
                    L.polyline(activeSegmentRoute.coords, {
                        color: '#2563eb',
                        weight: 8,
                        opacity: 0.25
                    }).addTo(map);
                    L.polyline(activeSegmentRoute.coords, {
                        color: '#3b82f6',
                        weight: 5,
                        opacity: 0.95
                    }).addTo(map);
                } else {
                    // Main blue route line between Origin and Destination
                    L.polyline(mainRoute.coords, {
                        color: '#2563eb',
                        weight: 8,
                        opacity: 0.25
                    }).addTo(map);
                    L.polyline(mainRoute.coords, {
                        color: '#3b82f6',
                        weight: 5,
                        opacity: 0.95
                    }).addTo(map);

                    if (hasLiveGps && status === 'Assigned' && activeSegmentRoute) {
                        // Approach dashed line from Rider GPS -> Pickup
                        L.polyline(activeSegmentRoute.coords, {
                            color: '#38bdf8',
                            weight: 4,
                            opacity: 0.85,
                            dashArray: '8, 8'
                        }).addTo(map);
                    }
                }

                // Pickup marker
                const pickupIcon = L.divIcon({
                    className: '',
                    html: '<div class="track-pin track-pin--pickup" title="Pickup">A</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });
                L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
                    .addTo(map)
                    .bindPopup(`<strong>Pickup / Origin</strong><br/>${escapeHtml(originAddress || pickup.label)}`);

                // Destination marker
                const dropIcon = L.divIcon({
                    className: '',
                    html: '<div class="track-pin track-pin--drop" title="Destination">B</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });
                L.marker([drop.lat, drop.lng], { icon: dropIcon })
                    .addTo(map)
                    .bindPopup(`<strong>Destination</strong><br/>${escapeHtml(destinationAddress || drop.label)}`);

                // Rider marker
                if (riderLatLng) {
                    boundsPoints.push(riderLatLng);
                    const riderIcon = L.divIcon({
                        className: '',
                        html: '<div class="track-pin track-pin--rider" title="Assigned Rider"><i class="bx bx-cycling"></i></div>',
                        iconSize: [34, 34],
                        iconAnchor: [17, 17]
                    });
                    const riderName = escapeHtml(rider?.name || 'Assigned Rider');
                    const vehicleInfo = escapeHtml([rider?.vehicleType, rider?.vehicleNumber].filter(Boolean).join(' • '));
                    L.marker(riderLatLng, { icon: riderIcon, zIndexOffset: 500 })
                        .addTo(map)
                        .bindPopup(
                            `<strong>${riderName}</strong><br/>` +
                            `${escapeHtml(riderPositionLabel)}` +
                            (vehicleInfo ? `<br/><span>${vehicleInfo}</span>` : '')
                        );
                }

                const bounds = L.latLngBounds(boundsPoints);
                map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });

                setTimeout(() => {
                    if (!cancelled && mapInstanceRef.current) {
                        mapInstanceRef.current.invalidateSize();
                    }
                }, 150);

                const preferredDistanceKm = actualDistance
                    ? Number(actualDistance)
                    : estimatedDistance
                        ? Number(estimatedDistance)
                        : mainRoute.distanceKm;

                setRouteSummary({
                    totalDistanceKm: preferredDistanceKm || mainRoute.distanceKm,
                    totalDurationText: formatDuration(mainRoute.durationMins),
                    riderLegDistanceKm: activeSegmentRoute ? activeSegmentRoute.distanceKm : null,
                    riderLegDurationText: activeSegmentRoute ? formatDuration(activeSegmentRoute.durationMins) : null,
                    hasLiveGps,
                    riderPositionLabel
                });
            } catch (err) {
                console.error('Tracking map error:', err);
                if (!cancelled) {
                    setMapError('Unable to load live map tiles right now.');
                }
            } finally {
                if (!cancelled) {
                    setMapLoading(false);
                }
            }
        }

        initRouteMap();

        return () => {
            cancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [
        trackingId,
        status,
        originAddress,
        destinationAddress,
        originLat,
        originLng,
        destLat,
        destLng,
        estimatedDistance,
        actualDistance,
        rider?.nic,
        rider?.currentLat,
        rider?.currentLng,
        rider?.branch
    ]);

    return (
        <div className="tracking-map-card">
            <div className="tracking-map-header">
                <div className="tracking-map-title">
                    <i className='bx bx-map-alt'></i>
                    <span>Live Route & Rider Map</span>
                    {routeSummary && (
                        <span className={`tracking-gps-pill ${routeSummary.hasLiveGps ? 'is-live' : 'is-pending'}`}>
                            <span className="gps-dot"></span>
                            {routeSummary.hasLiveGps ? 'Live GPS' : 'Route Stage'}
                        </span>
                    )}
                </div>
                {onRefresh && (
                    <button
                        type="button"
                        className="tracking-refresh-btn"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        title="Refresh live rider location"
                    >
                        <i className={`bx bx-refresh ${isRefreshing ? 'bx-spin' : ''}`}></i>
                        <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
                    </button>
                )}
            </div>

            {routeSummary && (
                <div className="tracking-distance-strip">
                    <div className="dist-metric">
                        <span className="dist-label">Route Distance</span>
                        <strong className="dist-val">{Number(routeSummary.totalDistanceKm).toFixed(1)} km</strong>
                    </div>
                    <div className="dist-metric">
                        <span className="dist-label">Est. Travel Time</span>
                        <strong className="dist-val">{routeSummary.totalDurationText || '—'}</strong>
                    </div>
                    {routeSummary.riderLegDistanceKm !== null && (
                        <div className="dist-metric dist-metric--accent">
                            <span className="dist-label">
                                {status === 'In Transit' ? 'Rider to Drop-off' : 'Rider to Pickup'}
                            </span>
                            <strong className="dist-val">
                                {Number(routeSummary.riderLegDistanceKm).toFixed(1)} km ({routeSummary.riderLegDurationText})
                            </strong>
                        </div>
                    )}
                </div>
            )}

            <div className="tracking-map-viewport">
                {mapLoading && (
                    <div className="tracking-map-overlay">
                        <i className='bx bx-loader-alt bx-spin'></i> Loading route map...
                    </div>
                )}
                {mapError && !mapLoading && (
                    <div className="tracking-map-overlay is-error">
                        <i className='bx bx-info-circle'></i> {mapError}
                    </div>
                )}
                <div ref={mapContainerRef} className="tracking-leaflet-box" />
            </div>

            <div className="tracking-map-legend">
                <span><i className="legend-dot legend-dot--pickup"></i> Origin / Pickup (A)</span>
                <span><i className="legend-dot legend-dot--drop"></i> Destination (B)</span>
                <span><i className="legend-dot legend-dot--rider"></i> Rider</span>
                <span><i className="legend-line"></i> Route Path</span>
            </div>
        </div>
    );
}

export default TrackingMapSection;
