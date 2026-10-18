'use client';

import { CSSProperties, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface DashboardSummary {
  shippers_total: number | string;
  drivers_total: number | string;
  drivers_verified: number | string;
  drivers_pending: number | string;
  users_active: number | string;
  users_blacklisted: number | string;
  drivers_online: number | string;
  trucks_total: number | string;
  shipments_total: number | string;
  shipments_open: number | string;
  shipments_accepted: number | string;
  shipments_in_transit: number | string;
  shipments_delivered: number | string;
  shipments_cancelled: number | string;
  ratings_total: number | string;
  rating_average: number | string;
}

interface TruckRecord {
  id: string;
  plate_number: string;
  truck_type: string;
  truck_model?: string;
  capacity_tons?: number;
  year?: number;
  is_primary: boolean;
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  is_active: boolean;
  updated_at: string;
}

interface OperatorUser {
  id: string;
  name: string;
  email: string;
  role: 'DRIVER' | 'SENDER';
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  rating_avg: number;
  rating_count: number;
  consecutive_low_ratings: number;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  blacklisted_at?: string;
  created_at: string;
  updated_at: string;
  email_verified: boolean;
  email_verified_at?: string;
  legal_name?: string;
  cnic_number?: string;
  vehicle_number?: string;
  license_number?: string;
  license_expiry?: string;
  profile_completed?: boolean;
  verification_status?: string;
  verified_at?: string;
  location?: DriverLocation | null;
  trucks: TruckRecord[];
}

interface OperatorRating {
  id: string;
  rater_id: string;
  ratee_id: string;
  rating: number;
  on_time: boolean;
  items_intact: boolean;
  paid_agreed: boolean;
  accurate_description: boolean;
  comment?: string;
  created_at: string;
}

interface OperatorShipment {
  id: string;
  sender_id: string;
  driver_id?: string;
  title: string;
  description?: string;
  cargo_type: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  weight_kg?: number;
  budget?: number;
  status: string;
  accepted_at?: string;
  has_pod_image: boolean;
  created_at: string;
  updated_at: string;
  sender_name: string;
  sender_email: string;
  sender_phone?: string;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  ratings: OperatorRating[];
}

interface DriverReview {
  id: string;
  name: string;
  email: string;
  phone?: string;
  legal_name?: string;
  cnic_number?: string;
  vehicle_number?: string;
  license_number?: string;
  license_expiry?: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

type DashboardTab = 'overview' | 'users' | 'shipments' | 'reviews';

const panelStyle = { background: '#111827', border: '1px solid #334155', borderRadius: 16, padding: 20 };
const mutedStyle = { color: '#94a3b8' };
const fieldStyle = { background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px' };

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, initFromStorage, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [drivers, setDrivers] = useState<DriverReview[]>([]);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [shipments, setShipments] = useState<OperatorShipment[]>([]);
  const [usersPagination, setUsersPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [shipmentsPagination, setShipmentsPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [userRole, setUserRole] = useState<'ALL' | 'DRIVER' | 'SENDER'>('ALL');
  const [shipmentStatus, setShipmentStatus] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  const fetchSummary = useCallback(async () => {
    const res = await api.get('/admin/dashboard/summary');
    setSummary(res.data.summary);
  }, []);

  const fetchPendingDrivers = useCallback(async () => {
    const res = await api.get('/admin/drivers/pending');
    setDrivers(res.data.drivers || []);
  }, []);

  const fetchUsers = async (page = 1, role = userRole, search = userSearch) => {
    setUsersLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/dashboard/users', { params: { page, limit: 25, role, search } });
      setUsers(res.data.users || []);
      setUsersPagination(res.data.pagination);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to fetch users');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchShipments = async (page = 1, status = shipmentStatus, search = shipmentSearch) => {
    setShipmentsLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/dashboard/shipments', { params: { page, limit: 25, status, search } });
      setShipments(res.data.shipments || []);
      setShipmentsPagination(res.data.pagination);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to fetch shipments');
    } finally {
      setShipmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace('/admin/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/login');
      return;
    }

    let mounted = true;
    void Promise.resolve()
      .then(() => Promise.all([fetchSummary(), fetchPendingDrivers()]))
      .catch((err: unknown) => {
        if (mounted) {
          setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to load operator dashboard');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [isAuthenticated, user, router, fetchSummary, fetchPendingDrivers]);

  const reviewDriver = async (driverId: string, status: 'VERIFIED' | 'REJECTED') => {
    setProcessing(driverId);
    setError('');
    try {
      await api.patch(`/admin/drivers/${driverId}`, { status });
      setDrivers((current) => current.filter((driver) => driver.id !== driverId));
      await fetchSummary();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to update driver status');
    } finally {
      setProcessing(null);
    }
  };

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === 'users' && users.length === 0) void fetchUsers();
    if (tab === 'shipments' && shipments.length === 0) void fetchShipments();
    if (tab === 'reviews') {
      void fetchPendingDrivers().catch((err: unknown) => {
        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to fetch pending driver applications');
      });
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/admin/login');
  };

  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Shippers & drivers' },
    { id: 'shipments', label: 'Shipments' },
    { id: 'reviews', label: `Driver applications${drivers.length ? ` (${drivers.length})` : ''}` },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#020817', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#fbbf24', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>Operator console</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>RoadLifter operations</h1>
            <div style={{ ...mutedStyle, marginTop: 6 }}>Signed in as {user?.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { void fetchSummary().catch(() => setError('Unable to refresh dashboard totals')); }} style={buttonStyle}>Refresh totals</button>
            <button onClick={handleLogout} style={buttonStyle}>Sign out</button>
          </div>
        </header>

        <nav style={{ display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid #334155', marginBottom: 20 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => selectTab(tab.id)} style={{
              ...buttonStyle,
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === tab.id ? '2px solid #f97316' : '2px solid transparent',
              color: activeTab === tab.id ? '#fdba74' : '#cbd5e1',
              whiteSpace: 'nowrap',
            }}>{tab.label}</button>
          ))}
        </nav>

        {error && <div role="alert" style={{ marginBottom: 18, padding: 12, borderRadius: 10, background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca' }}>⚠️ {error}</div>}
        {loading ? (
          <div style={{ ...panelStyle, textAlign: 'center', color: '#94a3b8' }}>Loading operator data…</div>
        ) : (
          <>
            {activeTab === 'overview' && <Overview summary={summary} onOpenUsers={() => selectTab('users')} onOpenShipments={() => selectTab('shipments')} />}
            {activeTab === 'users' && (
              <section style={panelStyle}>
                <SectionHeader title="Shippers and drivers" count={usersPagination.total} />
                <form onSubmit={(event) => { event.preventDefault(); void fetchUsers(1, userRole, userSearch); }} style={filterRowStyle}>
                  <input aria-label="Search people" placeholder="Search name, email, phone" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} style={{ ...fieldStyle, flex: '1 1 240px' }} />
                  <select aria-label="Filter by role" value={userRole} onChange={(event) => setUserRole(event.target.value as typeof userRole)} style={fieldStyle}>
                    <option value="ALL">All roles</option><option value="SENDER">Shippers</option><option value="DRIVER">Drivers</option>
                  </select>
                  <button type="submit" style={primaryButtonStyle}>Search</button>
                </form>
                {usersLoading ? <Loading /> : users.length === 0 ? <Empty>No users matched this search.</Empty> : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {users.map((record) => <UserCard key={record.id} record={record} />)}
                  </div>
                )}
                <PaginationBar pagination={usersPagination} onChange={(page) => void fetchUsers(page)} />
              </section>
            )}
            {activeTab === 'shipments' && (
              <section style={panelStyle}>
                <SectionHeader title="Shipment records" count={shipmentsPagination.total} />
                <form onSubmit={(event) => { event.preventDefault(); void fetchShipments(1, shipmentStatus, shipmentSearch); }} style={filterRowStyle}>
                  <input aria-label="Search shipments" placeholder="Search load, route, shipper or driver" value={shipmentSearch} onChange={(event) => setShipmentSearch(event.target.value)} style={{ ...fieldStyle, flex: '1 1 240px' }} />
                  <select aria-label="Filter shipment status" value={shipmentStatus} onChange={(event) => setShipmentStatus(event.target.value)} style={fieldStyle}>
                    <option value="ALL">All statuses</option>
                    {['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                  </select>
                  <button type="submit" style={primaryButtonStyle}>Search</button>
                </form>
                {shipmentsLoading ? <Loading /> : shipments.length === 0 ? <Empty>No shipments matched this search.</Empty> : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {shipments.map((shipment) => <ShipmentCard key={shipment.id} shipment={shipment} />)}
                  </div>
                )}
                <PaginationBar pagination={shipmentsPagination} onChange={(page) => void fetchShipments(page)} />
              </section>
            )}
            {activeTab === 'reviews' && (
              <section style={panelStyle}>
                <SectionHeader title="Driver applications awaiting review" count={drivers.length} />
                {drivers.length === 0 ? <Empty>No pending driver applications.</Empty> : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {drivers.map((driver) => (
                      <div key={driver.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div><h3 style={{ margin: 0, fontSize: 20 }}>{driver.legal_name || driver.name}</h3><div style={mutedStyle}>{driver.email}</div></div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => void reviewDriver(driver.id, 'VERIFIED')} disabled={processing === driver.id} style={{ ...primaryButtonStyle, background: '#16a34a' }}>{processing === driver.id ? 'Processing…' : 'Verify'}</button>
                            <button onClick={() => void reviewDriver(driver.id, 'REJECTED')} disabled={processing === driver.id} style={{ ...primaryButtonStyle, background: '#dc2626' }}>Reject</button>
                          </div>
                        </div>
                        <div style={detailGridStyle}>
                          <DetailCell label="Phone" value={driver.phone} />
                          <DetailCell label="CNIC" value={driver.cnic_number} />
                          <DetailCell label="Vehicle" value={driver.vehicle_number} />
                          <DetailCell label="License" value={driver.license_number} />
                          <DetailCell label="Expiry" value={driver.license_expiry} />
                          <DetailCell label="Applied" value={formatDate(driver.created_at)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ summary, onOpenUsers, onOpenShipments }: {
  summary: DashboardSummary | null;
  onOpenUsers: () => void;
  onOpenShipments: () => void;
}) {
  if (!summary) return <Empty>Dashboard totals are not available.</Empty>;

  const cards: [string, string | number][] = [
    ['Shippers', summary.shippers_total],
    ['Drivers', summary.drivers_total],
    ['Drivers online', summary.drivers_online],
    ['Verified drivers', summary.drivers_verified],
    ['Pending applications', summary.drivers_pending],
    ['Active accounts', summary.users_active],
    ['Blacklisted accounts', summary.users_blacklisted],
    ['Registered trucks', summary.trucks_total],
    ['Total shipments', summary.shipments_total],
    ['Ratings', summary.ratings_total],
    ['Average rating', `${summary.rating_average} / 5`],
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
        {cards.map(([label, value]) => (
          <div key={label} style={{ ...panelStyle, padding: 16 }}>
            <div style={{ ...mutedStyle, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>
      <section style={panelStyle}>
        <SectionHeader title="Shipment status" />
        <div style={detailGridStyle}>
          <DetailCell label="Open" value={summary.shipments_open} />
          <DetailCell label="Accepted" value={summary.shipments_accepted} />
          <DetailCell label="In transit" value={summary.shipments_in_transit} />
          <DetailCell label="Delivered" value={summary.shipments_delivered} />
          <DetailCell label="Cancelled" value={summary.shipments_cancelled} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={onOpenUsers} style={primaryButtonStyle}>Browse shipper and driver records</button>
          <button onClick={onOpenShipments} style={buttonStyle}>Browse all shipments</button>
        </div>
      </section>
      <div style={{ ...mutedStyle, fontSize: 12 }}>Private user and driver verification details are visible only to authenticated operator accounts. Password hashes and account security tokens are never returned.</div>
    </div>
  );
}

function UserCard({ record }: { record: OperatorUser }) {
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20 }}>{record.name}</h3>
          <div style={mutedStyle}>{record.email} · {record.role === 'SENDER' ? 'Shipper' : 'Driver'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill label={record.is_active ? 'Active' : 'Inactive'} color={record.is_active ? '#166534' : '#475569'} />
          <StatusPill label={record.email_verified ? 'Email verified' : 'Email unverified'} color={record.email_verified ? '#166534' : '#854d0e'} />
          {record.role === 'DRIVER' && <StatusPill label={record.verification_status || 'Unreviewed'} color="#1e40af" />}
          {record.is_blacklisted && <StatusPill label="Blacklisted" color="#991b1b" />}
        </div>
      </div>
      <div style={detailGridStyle}>
        <DetailCell label="User ID" value={record.id} />
        <DetailCell label="Phone" value={record.phone} />
        <DetailCell label="Rating" value={`${record.rating_avg ?? '—'} (${record.rating_count ?? 0} ratings)`} />
        <DetailCell label="Joined" value={formatDate(record.created_at)} />
        <DetailCell label="Updated" value={formatDate(record.updated_at)} />
        <DetailCell label="Email verified at" value={formatDate(record.email_verified_at)} />
        {record.role === 'DRIVER' && <>
          <DetailCell label="Legal name" value={record.legal_name} />
          <DetailCell label="CNIC" value={record.cnic_number} />
          <DetailCell label="Vehicle number" value={record.vehicle_number} />
          <DetailCell label="License number" value={record.license_number} />
          <DetailCell label="License expiry" value={record.license_expiry} />
          <DetailCell label="Profile completed" value={record.profile_completed ? 'Yes' : 'No'} />
          <DetailCell label="Verified at" value={formatDate(record.verified_at)} />
        </>}
        {record.is_blacklisted && <>
          <DetailCell label="Blacklist reason" value={record.blacklist_reason} />
          <DetailCell label="Blacklisted at" value={formatDate(record.blacklisted_at)} />
        </>}
      </div>
      {record.role === 'DRIVER' && (
        <>
          {record.location && <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Latest recorded location</h4>
            <div style={detailGridStyle}>
              <DetailCell label="Coordinates" value={`${record.location.lat}, ${record.location.lng}`} />
              <DetailCell label="Online" value={record.location.is_active ? 'Yes' : 'No'} />
              <DetailCell label="Speed" value={record.location.speed == null ? undefined : `${record.location.speed} km/h`} />
              <DetailCell label="Heading" value={record.location.heading == null ? undefined : `${record.location.heading}°`} />
              <DetailCell label="Location updated" value={formatDate(record.location.updated_at)} />
            </div>
          </div>}
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Registered trucks ({record.trucks?.length || 0})</h4>
            {!record.trucks?.length ? <div style={mutedStyle}>No trucks registered.</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {record.trucks.map((truck) => (
                  <div key={truck.id} style={{ ...detailCellStyle, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <strong>{truck.plate_number}</strong>
                    <span>{truck.truck_type} {truck.truck_model || ''}</span>
                    <span>{truck.capacity_tons ?? '—'} tons</span>
                    <span>{truck.year ?? 'Year unknown'}</span>
                    {truck.is_primary && <StatusPill label="Primary" color="#1e40af" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function ShipmentCard({ shipment }: { shipment: OperatorShipment }) {
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><h3 style={{ margin: 0, fontSize: 20 }}>{shipment.title}</h3><div style={mutedStyle}>{shipment.cargo_type} · {shipment.status.replace('_', ' ')}</div></div>
        <StatusPill label={shipment.status.replace('_', ' ')} color={shipment.status === 'DELIVERED' ? '#166534' : shipment.status === 'CANCELLED' ? '#991b1b' : '#1e40af'} />
      </div>
      <div style={detailGridStyle}>
        <DetailCell label="Shipment ID" value={shipment.id} />
        <DetailCell label="Pickup" value={`${shipment.pickup_address} (${shipment.pickup_lat}, ${shipment.pickup_lng})`} />
        <DetailCell label="Delivery" value={`${shipment.delivery_address}${shipment.delivery_lat == null ? '' : ` (${shipment.delivery_lat}, ${shipment.delivery_lng})`}`} />
        <DetailCell label="Weight" value={shipment.weight_kg == null ? undefined : `${shipment.weight_kg} kg`} />
        <DetailCell label="Budget" value={shipment.budget == null ? undefined : `$${shipment.budget}`} />
        <DetailCell label="Posted" value={formatDate(shipment.created_at)} />
        <DetailCell label="Accepted at" value={formatDate(shipment.accepted_at)} />
        <DetailCell label="Updated" value={formatDate(shipment.updated_at)} />
        <DetailCell label="Proof of delivery" value={shipment.has_pod_image ? 'Stored' : 'None'} />
        <DetailCell label="Shipper" value={`${shipment.sender_name} · ${shipment.sender_email}${shipment.sender_phone ? ` · ${shipment.sender_phone}` : ''}`} />
        <DetailCell label="Driver" value={shipment.driver_name ? `${shipment.driver_name} · ${shipment.driver_email}${shipment.driver_phone ? ` · ${shipment.driver_phone}` : ''}` : 'Unassigned'} />
      </div>
      {shipment.description && <p style={{ margin: '14px 0 0', whiteSpace: 'pre-wrap' }}>{shipment.description}</p>}
      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: '0 0 8px' }}>Ratings ({shipment.ratings?.length || 0})</h4>
        {!shipment.ratings?.length ? <div style={mutedStyle}>No ratings for this shipment.</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {shipment.ratings.map((rating) => (
              <div key={rating.id} style={detailCellStyle}>
                <strong>{rating.rating}/5</strong>
                <div style={{ ...mutedStyle, marginTop: 4 }}>Rater {rating.rater_id} · Ratee {rating.ratee_id} · {formatDate(rating.created_at)}</div>
                <div style={{ marginTop: 4 }}>On time: {rating.on_time ? 'Yes' : 'No'} · Items intact: {rating.items_intact ? 'Yes' : 'No'} · Paid as agreed: {rating.paid_agreed ? 'Yes' : 'No'} · Accurate description: {rating.accurate_description ? 'Yes' : 'No'}</div>
                {rating.comment && <p style={{ margin: '6px 0 0' }}>{rating.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>{count !== undefined && <span style={mutedStyle}>{count} records</span>}</div>;
}

function DetailCell({ label, value }: { label: string; value?: string | number | null }) {
  return <div style={detailCellStyle}><div style={{ ...mutedStyle, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div><div style={{ marginTop: 6, fontWeight: 600, overflowWrap: 'anywhere' }}>{value == null || value === '' ? '—' : value}</div></div>;
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return <span style={{ background: color, color: '#fff', borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 700 }}>{label}</span>;
}

function PaginationBar({ pagination, onChange }: { pagination: Pagination; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18 }}>
      <span style={mutedStyle}>Page {pagination.page} of {pages} · {pagination.total} records</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={pagination.page <= 1} onClick={() => onChange(pagination.page - 1)} style={buttonStyle}>Previous</button>
        <button disabled={pagination.page >= pages} onClick={() => onChange(pagination.page + 1)} style={buttonStyle}>Next</button>
      </div>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 24, textAlign: 'center', ...mutedStyle }}>Loading records…</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, textAlign: 'center', ...mutedStyle }}>{children}</div>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const cardStyle = { border: '1px solid #334155', borderRadius: 12, padding: 18, background: '#0f172a' };
const detailCellStyle = { background: '#0b1220', border: '1px solid #1e293b', borderRadius: 9, padding: 10, minWidth: 0 };
const detailGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 9, marginTop: 14 };
const filterRowStyle: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 };
const buttonStyle = { background: '#1f2937', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' };
const primaryButtonStyle = { ...buttonStyle, background: '#f97316', border: '1px solid #f97316', color: '#fff', fontWeight: 700 };
