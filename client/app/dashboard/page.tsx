'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';
import { useAuthStore } from '@/store/authStore';
import { getSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Shipment } from '@/types';
import StarRating from '@/components/ratings/StarRating';
import RatingModal from '@/components/ratings/RatingModal';
import RatingProfileModal from '@/components/ratings/RatingProfileModal';
import { escapeHtml } from '@/lib/mapUtils';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });

// Cargo type colors
const cargoColors: Record<string, string> = {
  ELECTRONICS: '#3b82f6', PERISHABLE: '#22c55e', CONSTRUCTION: '#f59e0b',
  FURNITURE: '#a855f7', AUTO_PARTS: '#ef4444', GENERAL: '#f97316', DEFAULT: '#94a3b8',
};

const cargoIcons: Record<string, string> = {
  ELECTRONICS: '💻', PERISHABLE: '🥬', CONSTRUCTION: '🏗️',
  FURNITURE: '🛋️', AUTO_PARTS: '⚙️', GENERAL: '📦', HAZARDOUS: '⚠️',
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, initFromStorage, updateUser } = useAuthStore();
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentsError, setShipmentsError] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [radius, setRadius] = useState(50);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number]>([40.7128, -74.006]);
  const [stats, setStats] = useState({ total: 0, nearby: 0, accepted: 0 });
  const [activeTab, setActiveTab] = useState<'available' | 'myloads'>('available');
  const [myLoads, setMyLoads] = useState<Shipment[]>([]);
  const [myLoadsError, setMyLoadsError] = useState('');
  const [myLoadsLoading, setMyLoadsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Shipment | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'DRIVER') {
      router.replace('/shipper/dashboard');
      return;
    }
    // Check if driver has completed profile
    if (!user.profile_completed || user.verification_status !== 'VERIFIED') {
      router.replace('/driver/onboarding');
      return;
    }
  }, [isAuthenticated, user, router]);

  // Fetch nearby shipments
  const fetchShipments = useCallback(async (lat: number, lng: number, r: number) => {
    setShipmentsError('');
    try {
      const res = await api.get(`/cargo/nearby?lat=${lat}&lng=${lng}&radius=${r}`);
      setShipments(res.data.shipments || []);
      setStats(prev => ({ ...prev, nearby: res.data.shipments?.length || 0 }));
    } catch (error: unknown) {
      setShipmentsError((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load nearby shipments. Check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyLoads = useCallback(async () => {
    setMyLoadsLoading(true);
    setMyLoadsError('');
    try {
      const res = await api.get('/cargo/my/driver');
      setMyLoads(res.data.shipments || []);
    } catch (error: unknown) {
      setMyLoadsError((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load your active loads. Check your connection and retry.');
    } finally {
      setMyLoadsLoading(false);
    }
  }, []);

  // Draw shipment markers on map
  const drawShipmentMarkers = useCallback(async (newShipments: Shipment[]) => {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    newShipments.forEach((s) => {
      const color = cargoColors[s.cargo_type] || cargoColors.DEFAULT;
      const icon = cargoIcons[s.cargo_type] || '📦';

      const markerHtml = `
        <div style="
          width:42px; height:42px;
          background:${color}20;
          border:2px solid ${color};
          border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:18px;
          cursor:pointer;
          box-shadow:0 0 12px ${color}50;
          transition:transform 0.2s;
        " title="${escapeHtml(s.title)}">
          ${icon}
        </div>`;

      const leafletIcon = L.divIcon({
        html: markerHtml, className: '', iconSize: [42, 42], iconAnchor: [21, 21],
      });

      const marker = L.marker([s.pickup_lat, s.pickup_lng], { icon: leafletIcon }).addTo(mapRef.current!);
      marker.on('click', () => setSelectedShipment(s));

      marker.bindPopup(`
        <div class="map-popup">
          <div class="map-popup-title">${escapeHtml(s.title)}</div>
          <div class="map-popup-body">
            <span>📍 ${escapeHtml(s.pickup_address)}</span>
            <span>➡️ ${escapeHtml(s.delivery_address)}</span>
            ${s.sender_phone ? `<span>📞 ${escapeHtml(s.sender_phone)}</span>` : ''}
            ${s.weight_kg ? `<span>⚖️ ${escapeHtml(s.weight_kg)} kg</span>` : ''}
            ${s.budget ? `<span>💰 $${escapeHtml(s.budget)}</span>` : ''}
            ${s.distance_km ? `<span>📏 ${escapeHtml(s.distance_km.toFixed(1))} km away</span>` : ''}
          </div>
        </div>
      `);

      markersRef.current.set(s.id, marker);
    });
  }, []);

  useEffect(() => {
    if (shipments.length > 0) drawShipmentMarkers(shipments);
  }, [shipments, drawShipmentMarkers]);

  // Draw driver's own position
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const drawDriverMarker = useCallback(async (lat: number, lng: number) => {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;

    const markerHtml = `
      <div style="
        width:48px; height:48px;
        background:linear-gradient(135deg,#f97316,#ea580c);
        border:3px solid #fff;
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:22px;
        box-shadow:0 0 20px rgba(249,115,22,0.6);
      " class="truck-marker-pulse">🚛</div>`;

    const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [48, 48], iconAnchor: [24, 24] });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([lat, lng]);
    } else {
      driverMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current);
      driverMarkerRef.current?.bindPopup('<div class="map-popup"><div class="map-popup-title">📍 Your Location</div></div>');
    }
  }, []);

  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;

    // Get geolocation or use NY default
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocation([lat, lng]);
          map.setView([lat, lng], 13);
          fetchShipments(lat, lng, radius);
          fetchMyLoads();
          drawDriverMarker(lat, lng);
          getSocket().emit('driver:setViewport', { lat, lng, radius });
        },
        () => {
          showToast('error', 'Location access is required. Please allow location access in your browser to show your nearby loads.');
          fetchShipments(myLocation[0], myLocation[1], radius);
          fetchMyLoads();
          drawDriverMarker(myLocation[0], myLocation[1]);
          getSocket().emit('driver:setViewport', { lat: myLocation[0], lng: myLocation[1], radius });
        }
      );
    } else {
      showToast('error', 'Location access is required. Please allow location access in your browser to show your nearby loads.');
      fetchShipments(myLocation[0], myLocation[1], radius);
      fetchMyLoads();
      drawDriverMarker(myLocation[0], myLocation[1]);
      getSocket().emit('driver:setViewport', { lat: myLocation[0], lng: myLocation[1], radius });
    }
  }, [radius, myLocation, fetchShipments, fetchMyLoads, drawDriverMarker, showToast]);

  // Socket.io: listen for new shipments + accept events
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    socket.on('shipment:new', (shipment: Shipment) => {
      showToast('info', `📦 New load posted: ${shipment.title}`);
      setShipments((prev) => [shipment, ...prev]);
    });

    socket.on('shipment:accepted', ({ shipmentId }: { shipmentId: string }) => {
      setShipments((prev) => prev.filter((s) => s.id !== shipmentId));
      setSelectedShipment((current) => current?.id === shipmentId ? null : current);
    });

    socket.on('rating:received', (payload: { newStats?: { rating_avg: number; rating_count: number } }) => {
      if (payload?.newStats) {
        updateUser({
          rating_avg: payload.newStats.rating_avg,
          rating_count: payload.newStats.rating_count,
        });
        showToast('info', `⭐ New rating received — ${Number(payload.newStats.rating_avg).toFixed(1)} avg`);
      }
    });

    socket.on('user:barred', ({ reason }: { reason?: string }) => {
      sessionStorage.setItem('rl_barred', reason || 'You are barred from using the service');
      disconnectSocket();
      logout();
      router.push('/login');
    });

    return () => {
      socket.off('shipment:new');
      socket.off('shipment:accepted');
      socket.off('rating:received');
      socket.off('user:barred');
    };
  }, [user, updateUser, logout, router]);

  useEffect(() => {
    if (!user || !isOnline) return;
    if (!navigator.geolocation) return;

    const socket = getSocket();
    let hasReportedLocation = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const nextLocation: [number, number] = [latitude, longitude];
        setMyLocation(nextLocation);
        drawDriverMarker(latitude, longitude);
        socket.emit('driver:updateLocation', {
          lat: latitude,
          lng: longitude,
          heading: heading ?? 0,
          speed: speed ?? 0,
          isActive: true,
        });
        hasReportedLocation = true;
      },
      () => {
        showToast('error', 'Location could not be accessed. Allow location access to go online.');
        setIsOnline(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (hasReportedLocation) socket.emit('driver:offline');
    };
  }, [user, isOnline, drawDriverMarker]);

  // Accept shipment
  const acceptShipment = async (shipmentId: string) => {
    setAccepting(shipmentId);
    try {
      await api.post(`/cargo/${shipmentId}/accept`);
      showToast('success', '✅ Load accepted! Check your active loads.');
      setShipments((prev) => prev.filter((s) => s.id !== shipmentId));
      setSelectedShipment(null);
      setStats(prev => ({ ...prev, accepted: prev.accepted + 1 }));
      fetchMyLoads();
      setActiveTab('myloads');
    } catch (err: unknown) {
      showToast('error', (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to accept load');
    } finally {
      setAccepting(null);
    }
  };

  const updateLoadStatus = async (shipmentId: string, status: 'IN_TRANSIT' | 'DELIVERED') => {
    setStatusUpdating(shipmentId);
    try {
      await api.patch(`/cargo/${shipmentId}/status`, { status });
      setMyLoads((prev) => prev.map((s) => s.id === shipmentId ? { ...s, status } : s));
      showToast('success', status === 'DELIVERED' ? 'Marked delivered — you can rate the shipper.' : 'Load is now in transit.');
    } catch (err: unknown) {
      showToast('error', (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  // Radius change
  const handleRadiusChange = (r: number) => {
    setRadius(r);
    setIsLoading(true);
    fetchShipments(myLocation[0], myLocation[1], r);
    getSocket().emit('driver:setViewport', { lat: myLocation[0], lng: myLocation[1], radius: r });
  };

  const handleLogout = () => {
    disconnectSocket();
    logout();
    router.push('/');
  };

  const formatBudget = (b?: number) => b ? `$${b.toLocaleString()}` : 'Open';
  const formatWeight = (w?: number) => w ? `${w.toLocaleString()} kg` : '—';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🚛</div>
            <span className="logo-text">RoadLifter</span>
          </div>

          {/* Driver status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="driver-avatar" style={{ width: 32, height: 32, fontSize: '0.8125rem' }}>
                {user?.name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user?.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Driver
                  <StarRating
                    value={user?.rating_avg}
                    count={user?.rating_count}
                    onClick={() => user && setProfileUserId(user.id)}
                  />
                </div>
              </div>
            </div>
            <button
              className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => {
                if (!isOnline && !navigator.geolocation) {
                  showToast('error', 'Location access is required to go online.');
                  return;
                }
                setIsOnline(!isOnline);
              }}
            >
              <span className={`status-dot ${isOnline ? 'status-dot-online' : 'status-dot-offline'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </button>
          </div>

          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${activeTab === 'available' ? 'active' : ''}`} onClick={() => setActiveTab('available')}>
              📦 Available ({shipments.length})
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'myloads' ? 'active' : ''}`}
              onClick={() => { setActiveTab('myloads'); fetchMyLoads(); }}
            >
              🚛 My Loads ({myLoads.length})
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Nearby</span>
            <span className="stat-value orange">{shipments.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Accepted</span>
            <span className="stat-value green">{stats.accepted}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Radius</span>
            <span className="stat-value blue">{radius}km</span>
          </div>
        </div>

        {/* Radius control */}
        {activeTab === 'available' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="radius-control">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="radius-label">Search Radius</span>
                <span className="radius-value">{radius} km</span>
              </div>
              <input
                type="range" min={5} max={300} step={5} value={radius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {/* Shipment list */}
        <div className="sidebar-content">
          {activeTab === 'available' && (
            <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Available Loads</h2>
            {isLoading && <div className="spinner" style={{ width: 16, height: 16 }} />}
          </div>

          {shipmentsError && (
            <div className="auth-error" role="alert">
              {shipmentsError}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => {
                setIsLoading(true);
                fetchShipments(myLocation[0], myLocation[1], radius);
              }}>Retry</button>
            </div>
          )}

          {!isLoading && !shipmentsError && shipments.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No loads found</div>
              <div className="empty-desc">Try increasing your search radius or check back soon</div>
            </div>
          )}

          {shipments.map((s) => (
            <div
              key={s.id}
              className={`shipment-card ${selectedShipment?.id === s.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedShipment(s);
                if (mapRef.current) {
                  mapRef.current.setView([s.pickup_lat, s.pickup_lng], 14, { animate: true });
                  markersRef.current.get(s.id)?.openPopup();
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="shipment-card-title">{s.title}</span>
                <span className="badge badge-open">Open</span>
              </div>

              <div className="shipment-card-meta">
                <div className="shipment-meta-row">
                  <span className="shipment-meta-icon">📍</span>
                  <span className="truncate">{s.pickup_address}</span>
                </div>
                <div className="shipment-meta-row">
                  <span className="shipment-meta-icon">🏁</span>
                  <span className="truncate">{s.delivery_address}</span>
                </div>
                {s.sender_name && (
                  <div className="shipment-meta-row">
                    <span className="shipment-meta-icon">👤</span>
                    <span className="truncate">{s.sender_name}</span>
                    <StarRating
                      value={s.sender_rating_avg}
                      count={s.sender_rating_count}
                      onClick={() => setProfileUserId(s.sender_id)}
                    />
                  </div>
                )}
                {s.sender_phone && (
                  <div className="shipment-meta-row">
                    <span className="shipment-meta-icon">📞</span>
                    <span>{s.sender_phone}</span>
                  </div>
                )}
              </div>

              <div className="shipment-card-footer">
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    ⚖️ {formatWeight(s.weight_kg)}
                  </span>
                  {s.distance_km !== undefined && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      📏 {s.distance_km.toFixed(1)} km
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9375rem' }}>
                  {formatBudget(s.budget)}
                </span>
              </div>

              {selectedShipment?.id === s.id && (
                <button
                  className="btn btn-primary w-full"
                  style={{ marginTop: 12 }}
                  disabled={accepting === s.id}
                  onClick={(e) => { e.stopPropagation(); acceptShipment(s.id); }}
                >
                  {accepting === s.id ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Accepting...</>
                  ) : '✅ Accept This Load'}
                </button>
              )}
            </div>
          ))}
            </>
          )}

          {activeTab === 'myloads' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>My Loads</h2>
                <button className="btn btn-ghost btn-sm" onClick={fetchMyLoads}>🔄</button>
              </div>
              {myLoadsLoading && <div className="spinner" style={{ margin: '20px auto' }} />}
              {myLoadsError && (
                <div className="auth-error" role="alert">
                  {myLoadsError}
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={fetchMyLoads}>Retry</button>
                </div>
              )}
              {!myLoadsLoading && !myLoadsError && myLoads.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🚛</div>
                  <div className="empty-title">No accepted loads</div>
                  <div className="empty-desc">Accept a nearby shipment to start a haul</div>
                </div>
              )}
              {myLoads.map((s) => (
                <div key={s.id} className="shipment-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="shipment-card-title">{s.title}</span>
                    <span className={`badge ${s.status === 'DELIVERED' ? 'badge-delivered' : s.status === 'IN_TRANSIT' ? 'badge-transit' : 'badge-accepted'}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="shipment-card-meta">
                    <div className="shipment-meta-row">
                      <span className="shipment-meta-icon">📍</span>
                      <span className="truncate">{s.pickup_address}</span>
                    </div>
                    <div className="shipment-meta-row">
                      <span className="shipment-meta-icon">🏁</span>
                      <span className="truncate">{s.delivery_address}</span>
                    </div>
                    {s.sender_name && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">👤</span>
                        <span className="truncate">{s.sender_name}</span>
                        <StarRating
                          value={s.sender_rating_avg}
                          count={s.sender_rating_count}
                          onClick={() => setProfileUserId(s.sender_id)}
                        />
                      </div>
                    )}
                    {s.sender_email && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">✉️</span>
                        <a href={`mailto:${s.sender_email}`}>{s.sender_email}</a>
                      </div>
                    )}
                    {s.sender_phone && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">📞</span>
                        <a href={`tel:${s.sender_phone}`}>{s.sender_phone}</a>
                      </div>
                    )}
                  </div>
                  {s.status === 'ACCEPTED' && (
                    <button
                      className="btn btn-primary w-full"
                      style={{ marginTop: 12 }}
                      disabled={statusUpdating === s.id}
                      onClick={() => updateLoadStatus(s.id, 'IN_TRANSIT')}
                    >
                      {statusUpdating === s.id ? 'Updating...' : 'Start transit'}
                    </button>
                  )}
                  {s.status === 'IN_TRANSIT' && (
                    <button
                      className="btn btn-primary w-full"
                      style={{ marginTop: 12 }}
                      disabled={statusUpdating === s.id}
                      onClick={() => updateLoadStatus(s.id, 'DELIVERED')}
                    >
                      {statusUpdating === s.id ? 'Updating...' : 'Mark delivered'}
                    </button>
                  )}
                  {s.status === 'DELIVERED' && !s.my_rating_id && (
                    <button
                      className="btn btn-primary w-full"
                      style={{ marginTop: 12 }}
                      onClick={() => setRatingTarget(s)}
                    >
                      ⭐ Rate shipper
                    </button>
                  )}
                  {s.status === 'DELIVERED' && s.my_rating_id && (
                    <div style={{ marginTop: 10, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      You rated this shipper {s.my_rating}/5
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => router.push('/home')}>
            🏠 Home
          </button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Map */}
      <main className="dashboard-map">
        <LiveMap center={myLocation} zoom={12} onMapReady={onMapReady} />

        {/* Map overlay controls */}
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (mapRef.current) mapRef.current.setView(myLocation, 13, { animate: true });
            }}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            📍 My Location
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setIsLoading(true); fetchShipments(myLocation[0], myLocation[1], radius); }}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '10px 14px',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
              <span style={{ fontSize: 16 }}>🚛</span> <span>Your Position</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
              <span style={{ fontSize: 16 }}>📦</span> <span>Open Shipments</span>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {ratingTarget && (
        <RatingModal
          cargoId={ratingTarget.id}
          cargoTitle={ratingTarget.title}
          rateeName={ratingTarget.sender_name || 'Shipper'}
          rateeRole="SENDER"
          onClose={() => setRatingTarget(null)}
          onSubmitted={(rating) => {
            setMyLoads((prev) => prev.map((s) =>
              s.id === ratingTarget.id ? { ...s, my_rating_id: 'local', my_rating: rating } : s
            ));
            setRatingTarget(null);
            showToast('success', 'Rating submitted');
          }}
        />
      )}

      {profileUserId && (
        <RatingProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
}
