'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';
import { useAuthStore } from '@/store/authStore';
import { getSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Driver, Shipment, CreateShipmentPayload, CargoType } from '@/types';
import StarRating from '@/components/ratings/StarRating';
import RatingModal from '@/components/ratings/RatingModal';
import RatingProfileModal from '@/components/ratings/RatingProfileModal';
import { escapeHtml } from '@/lib/mapUtils';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });

const truckTypes: Record<string, string> = {
  FLATBED: '🚛', DRY_VAN: '�', REFRIGERATED: '🚛',
  TANKER: '🚛', LOWBOY: '🚛', BOX_TRUCK: '🚛',
};

const cargoTypeOptions: CargoType[] = [
  'GENERAL', 'ELECTRONICS', 'PERISHABLE', 'CONSTRUCTION', 'FURNITURE', 'AUTO_PARTS',
];

export default function ShipperDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, initFromStorage, updateUser } = useAuthStore();
  const mapRef = useRef<LeafletMap | null>(null);
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversError, setDriversError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [radius, setRadius] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  const [myShipmentsError, setMyShipmentsError] = useState('');
  const [myShipmentsLoading, setMyShipmentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'drivers' | 'myloads'>('drivers');
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number]>([40.7128, -74.006]);
  const [ratingTarget, setRatingTarget] = useState<Shipment | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateShipmentPayload>({
    title: '', description: '', cargo_type: 'GENERAL',
    pickup_address: '',
    delivery_address: '', weight_kg: undefined, budget: undefined,
  });

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { initFromStorage(); }, [initFromStorage]);

  useEffect(() => {
    if (!isAuthenticated || !user) { router.replace('/login'); return; }
    if (user.role !== 'SENDER') { router.replace('/dashboard'); return; }
  }, [isAuthenticated, user, router]);

  // Fetch nearby drivers
  const fetchDrivers = useCallback(async (lat: number, lng: number, r: number) => {
    setDriversError('');
    try {
      const res = await api.get(`/drivers/nearby?lat=${lat}&lng=${lng}&radius=${r}`);
      setDrivers(res.data.drivers || []);
    } catch (error: unknown) {
      setDriversError((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load nearby trucks. Check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch my shipments
  const fetchMyShipments = useCallback(async () => {
    setMyShipmentsLoading(true);
    setMyShipmentsError('');
    try {
      const res = await api.get('/cargo/my/sender');
      setMyShipments(res.data.shipments || []);
    } catch (error: unknown) {
      setMyShipmentsError((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load your shipments. Check your connection and retry.');
    } finally {
      setMyShipmentsLoading(false);
    }
  }, []);

  // Draw driver markers
  const drawDriverMarkers = useCallback(async (driversToShow: Driver[]) => {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;

    // Remove stale markers
    const newIds = new Set(driversToShow.map((d) => d.id));
    driverMarkersRef.current.forEach((m, id) => {
      if (!newIds.has(id)) { m.remove(); driverMarkersRef.current.delete(id); }
    });

    driversToShow.forEach((driver) => {
      const truckIcon = truckTypes[driver.truck_type || ''] || '🚛';
      const markerHtml = `
        <div style="
          width:44px; height:44px;
          background:rgba(59,130,246,0.15);
          border:2px solid #3b82f6;
          border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:20px;
          box-shadow:0 0 14px rgba(59,130,246,0.4);
          transform:rotate(${driver.heading || 0}deg);
          transition:transform 0.5s;
          cursor:pointer;
        ">
          ${truckIcon}
        </div>`;

      const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });

      const existing = driverMarkersRef.current.get(driver.id);
      if (existing) {
        existing.setLatLng([driver.lat, driver.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([driver.lat, driver.lng], { icon }).addTo(mapRef.current!);
        marker.on('click', () => setSelectedDriver(driver));
        marker.bindPopup(`
          <div class="map-popup">
            <div class="map-popup-title">🚛 ${escapeHtml(driver.name)}</div>
            <div class="map-popup-body">
              ${driver.phone ? `<span>📞 ${escapeHtml(driver.phone)}</span>` : ''}
              ${driver.truck_type ? `<span>${truckIcon} ${escapeHtml(driver.truck_type.replace('_', ' '))}</span>` : ''}
              ${driver.truck_model ? `<span>🚐 ${escapeHtml(driver.truck_model)}</span>` : ''}
              ${driver.plate_number ? `<span>🪪 ${escapeHtml(driver.plate_number)}</span>` : ''}
              ${driver.capacity_tons ? `<span>⚖️ ${escapeHtml(driver.capacity_tons)}t capacity</span>` : ''}
              ${driver.distance_km ? `<span>📏 ${escapeHtml(driver.distance_km.toFixed(1))} km away</span>` : ''}
            </div>
          </div>
        `);
        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, []);

  useEffect(() => {
    if (drivers.length > 0 || driverMarkersRef.current.size > 0) drawDriverMarkers(drivers);
  }, [drivers, drawDriverMarkers]);

  // Draw sender's own pin
  const senderMarkerRef = useRef<L.Marker | null>(null);
  const drawSenderMarker = useCallback(async (lat: number, lng: number) => {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;
    const html = `
      <div style="
        width:22px;height:22px;
        background:#2563eb;
        border:4px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 8px rgba(37,99,235,0.2),0 2px 8px rgba(0,0,0,0.4);
      "></div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
    if (senderMarkerRef.current) {
      senderMarkerRef.current.setLatLng([lat, lng]);
      senderMarkerRef.current.setIcon(icon);
    } else {
      senderMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current!);
      senderMarkerRef.current.bindPopup('<div class="map-popup"><div class="map-popup-title">📍 Your current location</div></div>');
    }
  }, []);

  const goToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('error', 'Location is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyLocation([lat, lng]);
        mapRef.current?.setView([lat, lng], 13, { animate: true });
        drawSenderMarker(lat, lng);
        setIsLoading(true);
        fetchDrivers(lat, lng, radius);
        getSocket().emit('sender:setViewport', { lat, lng, radius });
      },
      () => showToast('error', 'Could not get your location. Check your browser location permission and try again.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [drawSenderMarker, fetchDrivers, radius]);

  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocation([lat, lng]);
          map.setView([lat, lng], 13);
          fetchDrivers(lat, lng, radius);
          drawSenderMarker(lat, lng);
          fetchMyShipments();

          // Notify socket of viewport
          const socket = getSocket();
          socket.emit('sender:setViewport', { lat, lng, radius });
        },
        () => {
          showToast('error', 'Location access is required. Please allow location access in your browser to show nearby drivers.');
          fetchDrivers(myLocation[0], myLocation[1], radius);
          drawSenderMarker(myLocation[0], myLocation[1]);
          fetchMyShipments();
          getSocket().emit('sender:setViewport', { lat: myLocation[0], lng: myLocation[1], radius });
        }
      );
    } else {
      showToast('error', 'Location access is required. Please allow location access in your browser to show nearby drivers.');
      fetchDrivers(myLocation[0], myLocation[1], radius);
      drawSenderMarker(myLocation[0], myLocation[1]);
      fetchMyShipments();
      getSocket().emit('sender:setViewport', { lat: myLocation[0], lng: myLocation[1], radius });
    }
  }, [radius, myLocation, fetchDrivers, fetchMyShipments, drawSenderMarker]);

  // Socket.io: listen for live driver location updates
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    socket.on('driver:locationUpdate', (data: { driverId: string; name: string; lat: number; lng: number; heading: number; isActive: boolean }) => {
      setDrivers((prev) => {
        const existing = prev.find((d) => d.id === data.driverId);
        if (existing) {
          return prev.map((d) =>
            d.id === data.driverId
              ? { ...d, lat: data.lat, lng: data.lng, heading: data.heading, isActive: data.isActive }
              : d
          );
        }
        return prev;
      });
    });

    socket.on('driver:statusChange', ({ driverId, isActive }: { driverId: string; isActive: boolean }) => {
      if (!isActive) {
        setDrivers((prev) => prev.filter((d) => d.id !== driverId));
        const marker = driverMarkersRef.current.get(driverId);
        if (marker) { marker.remove(); driverMarkersRef.current.delete(driverId); }
      }
    });

    socket.on('shipment:statusUpdate', ({ shipmentId, status }: { shipmentId: string; status: string }) => {
      setMyShipments((prev) => prev.map((s) => s.id === shipmentId ? { ...s, status: status as Shipment['status'] } : s));
      if (status === 'DELIVERED') {
        showToast('success', 'Load delivered — you can rate the driver.');
        setActiveTab('myloads');
      }
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
      socket.off('driver:locationUpdate');
      socket.off('driver:statusChange');
      socket.off('shipment:statusUpdate');
      socket.off('rating:received');
      socket.off('user:barred');
    };
  }, [user, updateUser, logout, router]);

  const removeShipment = async (shipmentId: string) => {
    const confirmed = window.confirm('Remove this shipment? Drivers will no longer see it and it will be cancelled.');
    if (!confirmed) return;

    try {
      await api.delete(`/cargo/${shipmentId}`);
      setMyShipments((prev) => prev.filter((shipment) => shipment.id !== shipmentId));
      showToast('success', 'Shipment removed');
    } catch (err: unknown) {
      showToast('error', (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to remove shipment');
    }
  };

  // Post new shipment
  const postShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.pickup_address || !form.delivery_address) {
      showToast('error', 'Please fill all required fields');
      return;
    }
    setIsPosting(true);
    try {
      // Use sender's location as pickup coords
      await api.post('/cargo', form);
      showToast('success', '✅ Shipment posted! Drivers near you will see it on their map.');
      setShowPostModal(false);
      setForm({ title: '', description: '', cargo_type: 'GENERAL', pickup_address: '', delivery_address: '' });
      fetchMyShipments();
    } catch (err: unknown) {
      showToast('error', (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to post shipment');
    } finally {
      setIsPosting(false);
    }
  };

  const handleRadiusChange = (r: number) => {
    setRadius(r);
    setIsLoading(true);
    fetchDrivers(myLocation[0], myLocation[1], r);
    getSocket().emit('sender:setViewport', { lat: myLocation[0], lng: myLocation[1], radius: r });
  };

  const handleLogout = () => { disconnectSocket(); logout(); router.push('/'); };

  const statusBadgeClass = (s: string) => {
    const map: Record<string, string> = { OPEN: 'badge-open', ACCEPTED: 'badge-accepted', IN_TRANSIT: 'badge-transit', DELIVERED: 'badge-delivered' };
    return map[s] || 'badge-open';
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🚛</div>
            <span className="logo-text">RoadLifter</span>
          </div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="driver-avatar" style={{ width: 32, height: 32, fontSize: '0.8125rem', background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user?.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Shipper
                  <StarRating
                    value={user?.rating_avg}
                    count={user?.rating_count}
                    onClick={() => user && setProfileUserId(user.id)}
                  />
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPostModal(true)}>
              + Post Load
            </button>
          </div>

          {/* Tabs */}
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${activeTab === 'drivers' ? 'active' : ''}`} onClick={() => setActiveTab('drivers')}>
              🚛 Nearby Trucks ({drivers.length})
            </button>
            <button className={`sidebar-tab ${activeTab === 'myloads' ? 'active' : ''}`} onClick={() => { setActiveTab('myloads'); fetchMyShipments(); }}>
              📦 My Loads ({myShipments.length})
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Live Trucks</span>
            <span className="stat-value blue">{drivers.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">My Loads</span>
            <span className="stat-value orange">{myShipments.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Radius</span>
            <span className="stat-value green">{radius}km</span>
          </div>
        </div>

        {/* Radius */}
        {activeTab === 'drivers' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="radius-control">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="radius-label">Search Radius</span>
                <span className="radius-value">{radius} km</span>
              </div>
              <input type="range" min={5} max={300} step={5} value={radius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))} />
            </div>
          </div>
        )}

        <div className="sidebar-content">
          {/* Nearby drivers tab */}
          {activeTab === 'drivers' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Available Trucks</h2>
                {isLoading && <div className="spinner" style={{ width: 16, height: 16 }} />}
              </div>

              {!isLoading && drivers.length === 0 && (
                !driversError && (
                <div className="empty-state">
                  <div className="empty-icon">🚛</div>
                  <div className="empty-title">No trucks nearby</div>
                  <div className="empty-desc">Try increasing your search radius to find available drivers</div>
                </div>
                )
              )}
              {driversError && (
                <div className="auth-error" role="alert">
                  {driversError}
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => {
                    setIsLoading(true);
                    fetchDrivers(myLocation[0], myLocation[1], radius);
                  }}>Retry</button>
                </div>
              )}

              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="driver-card"
                  onClick={() => {
                    setSelectedDriver(driver);
                    if (mapRef.current) {
                      mapRef.current.setView([driver.lat, driver.lng], 15, { animate: true });
                      driverMarkersRef.current.get(driver.id)?.openPopup();
                    }
                  }}
                  style={{ borderColor: selectedDriver?.id === driver.id ? 'rgba(59,130,246,0.4)' : '' }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="driver-avatar">{driver.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{driver.name}</span>
                        <span className="badge badge-online">
                          <span className="status-dot status-dot-online" />
                          Live
                        </span>
                      </div>
                      <StarRating
                        value={driver.rating_avg}
                        count={driver.rating_count}
                        onClick={() => setProfileUserId(driver.id)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {driver.phone && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            📞 {driver.phone}
                          </span>
                        )}
                        {driver.truck_type && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {truckTypes[driver.truck_type]} {driver.truck_type.replace('_', ' ')}
                            {driver.truck_model && ` • ${driver.truck_model}`}
                          </span>
                        )}
                        {driver.capacity_tons && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            ⚖️ {driver.capacity_tons}t capacity
                          </span>
                        )}
                        {driver.distance_km !== undefined && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            📏 {driver.distance_km.toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {driver.plate_number && (
                    <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--color-surface-3)', borderRadius: 8, fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Plate:</span>
                      <span style={{ fontWeight: 600 }}>{driver.plate_number}</span>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* My shipments tab */}
          {activeTab === 'myloads' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>My Shipments</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowPostModal(true)}>+ New</button>
              </div>

              {myShipmentsLoading && <div className="spinner" style={{ margin: '20px auto' }} />}
              {myShipmentsError && (
                <div className="auth-error" role="alert">
                  {myShipmentsError}
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={fetchMyShipments}>Retry</button>
                </div>
              )}
              {!myShipmentsLoading && !myShipmentsError && myShipments.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <div className="empty-title">No shipments yet</div>
                  <div className="empty-desc">Post your first load and drivers near you will see it on their map</div>
                  <button className="btn btn-primary btn-sm" style={{ margin: '16px auto 0' }} onClick={() => setShowPostModal(true)}>
                    Post a Load
                  </button>
                </div>
              )}

              {myShipments.map((s) => (
                <div key={s.id} className="shipment-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="shipment-card-title">{s.title}</span>
                    <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status.replace('_', ' ')}</span>
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
                    {s.driver_name && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">🚛</span>
                        <span>Driver: <strong>{s.driver_name}</strong></span>
                        <StarRating
                          value={s.driver_rating_avg}
                          count={s.driver_rating_count}
                          onClick={() => s.driver_id && setProfileUserId(s.driver_id)}
                        />
                      </div>
                    )}
                    {s.driver_phone && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">📞</span>
                        <a href={`tel:${s.driver_phone}`}>{s.driver_phone}</a>
                      </div>
                    )}
                    {s.driver_email && (
                      <div className="shipment-meta-row">
                        <span className="shipment-meta-icon">✉️</span>
                        <a href={`mailto:${s.driver_email}`}>{s.driver_email}</a>
                      </div>
                    )}
                  </div>
                  <div className="shipment-card-footer">
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    {s.budget && (
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>${s.budget}</span>
                    )}
                  </div>
                  {(s.status === 'OPEN' || s.status === 'ACCEPTED') && (
                    <button
                      className="btn btn-ghost w-full"
                      style={{ marginTop: 12, borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }}
                      onClick={() => removeShipment(s.id)}
                    >
                      🗑 Remove Load
                    </button>
                  )}
                  {s.status === 'DELIVERED' && s.driver_id && !s.my_rating_id && (
                    <button
                      className="btn btn-primary w-full"
                      style={{ marginTop: 12 }}
                      onClick={() => setRatingTarget(s)}
                    >
                      ⭐ Rate driver
                    </button>
                  )}
                  {s.status === 'DELIVERED' && s.my_rating_id && (
                    <div style={{ marginTop: 10, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      You rated this driver {s.my_rating}/5
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => router.push('/home')}>🏠 Home</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Map */}
      <main className="dashboard-map">
        <LiveMap center={myLocation} zoom={12} onMapReady={onMapReady} />

        {/* Map controls */}
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowPostModal(true)}
            style={{ boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
            + Post a Load
          </button>
          <button className="btn btn-secondary btn-sm" onClick={goToCurrentLocation}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            📍 My Location
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setIsLoading(true); fetchDrivers(myLocation[0], myLocation[1], radius); }}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            🔄 Refresh
          </button>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
              <span style={{ fontSize: 16 }}>📦</span> <span>Your Location</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
              <span style={{ fontSize: 16 }}>🚛</span> <span>Live Drivers</span>
            </div>
          </div>
        </div>
      </main>

      {/* Post Shipment Modal */}
      {showPostModal && (
        <div className="modal-backdrop" onClick={() => setShowPostModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📦 Post a Shipment</h2>
              <button className="modal-close" onClick={() => setShowPostModal(false)}>✕</button>
            </div>

            <p className="text-sm text-muted">
              After a driver accepts, you can contact each other directly. RoadLifter has no in-app chat and does not process payments; arrange both outside the platform.
            </p>

            <form onSubmit={postShipment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Load Title *</label>
                <input className="form-input" placeholder="e.g. Electronics Shipment"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Cargo Type</label>
                  <select className="form-input" value={form.cargo_type}
                    onChange={(e) => setForm({ ...form, cargo_type: e.target.value as CargoType })}>
                    {cargoTypeOptions.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input className="form-input" type="number" placeholder="e.g. 1500"
                    value={form.weight_kg || ''} onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) || undefined })} />
                </div>
              </div>

              <div className="form-group">
              <label className="form-label">Pickup Address *</label>
              <input className="form-input" placeholder="Street, city, region, country"
                value={form.pickup_address}
                onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                required />
              <span className="text-xs text-muted">
                Enter a complete pickup address so drivers can find the correct location. Address coordinates are matched using OpenStreetMap Nominatim.
              </span>
              <span className="text-xs text-muted">
                Geocoding data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
              </span>
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Address *</label>
                <input className="form-input" placeholder="Street, City, State"
                  value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Budget (USD)</label>
                  <input className="form-input" type="number" placeholder="e.g. 1200"
                    value={form.budget || ''} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) || undefined })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input" placeholder="Special handling instructions, dimensions, etc."
                  value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ minHeight: 80 }} />
              </div>

              <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPostModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isPosting}>
                  {isPosting ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Posting...</>
                  ) : '🚀 Post Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          rateeName={ratingTarget.driver_name || 'Driver'}
          rateeRole="DRIVER"
          onClose={() => setRatingTarget(null)}
          onSubmitted={(rating) => {
            setMyShipments((prev) => prev.map((s) =>
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
