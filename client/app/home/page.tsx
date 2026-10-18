'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from '@/lib/socket';

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const howItWorksDriver = [
  { step: '01', icon: '📝', title: 'Create a Driver Account', desc: `Sign up and select "Driver" as your role. Add your truck details and you're ready in under 2 minutes.` },
  { step: '02', icon: '📍', title: 'Share Your Location', desc: 'Allow location access so the live map can show you open shipments near you in real-time.' },
  { step: '03', icon: '🗺️', title: 'Browse Nearby Loads', desc: 'See cargo posted by shippers on an interactive map. Filter by distance, cargo type, and offered budget.' },
  { step: '04', icon: '✅', title: 'Accept & Deliver', desc: 'Accept a load, pick it up, and update its status as you move it to delivery.' },
];

const howItWorksSender = [
  { step: '01', icon: '📝', title: 'Create a Shipper Account', desc: 'Sign up and select "Shipper" as your role. No truck needed — just your shipment details.' },
  { step: '02', icon: '📦', title: 'Post a Shipment', desc: 'Enter pickup address, delivery address, cargo type, weight, and your budget. Takes under a minute.' },
  { step: '03', icon: '🚛', title: 'Watch Drivers Near You', desc: 'The live map shows every available truck in your area moving in real-time.' },
  { step: '04', icon: '📊', title: 'Track Until Delivery', desc: 'Once a driver accepts your load, track live status updates from pickup all the way to delivery.' },
];

const driverBenefits = [
  { icon: '💰', title: 'Find Nearby Loads', desc: 'Browse available offers near you and coordinate directly with the shipper after accepting.' },
  { icon: '🗺️', title: 'Real-Time Cargo Map', desc: 'Browse nearby shipment offers and contact the shipper directly after accepting a load.' },
  { icon: '⚡', title: 'Instant Notifications', desc: 'Get pinged the second a new load is posted near you — before other drivers even see it.' },
  { icon: '🔒', title: 'Reviewed Driver Profiles', desc: 'Driver load access and live location sharing require profile approval.' },
];

const senderBenefits = [
  { icon: '⏱️', title: 'Freight Moved Fast', desc: 'Post a shipment and get a driver accept it within minutes — not days like traditional freight brokers.' },
  { icon: '🚛', title: 'See Real Trucks Near You', desc: 'Watch available drivers on a live map so you know exactly what capacity is near your pickup.' },
  { icon: '📊', title: 'End-to-End Tracking', desc: 'Follow your cargo from the moment a driver accepts through pickup, transit, and final delivery.' },
  { icon: '💸', title: 'Set Your Offer', desc: 'Drivers can review your offer before accepting. Agree on and arrange payment directly outside RoadLifter.' },
];

const faqs = [
  {
    q: 'Can a driver see other drivers on the map?',
    a: 'No. Drivers only see open shipments (cargo posted by shippers) on their map. Other drivers are completely hidden from driver accounts — this keeps the platform focused and prevents competitive intel leaks.',
  },
  {
    q: 'Can a shipper see what other shippers have posted?',
    a: 'No. Shippers only see available truck drivers near them. Other customers\' cargo listings are never visible to shippers. Each user only sees what is relevant to their role.',
  },
  {
    q: 'What happens if I click the wrong dashboard button?',
    a: 'If your account type doesn\'t match the dashboard you\'re trying to open, you\'ll see an "Account type does not match" warning right on this page. Each button is locked to the correct role.',
  },
  {
    q: 'How do I change my role after signing up?',
    a: 'Roles are fixed at signup to keep the driver and shipper experiences clean and separate. If you need a different role, create a new account with a different email.',
  },
  {
    q: 'Is my location data shared?',
    a: 'Driver locations are shared only with shippers (so they can find trucks near them). Shipper locations are only used to find nearby drivers and are never broadcast to other users.',
  },
  {
    q: 'Does RoadLifter provide chat or process payments?',
    a: 'No. After a driver accepts a shipment, the matched parties can view each other’s contact details and coordinate directly outside RoadLifter. The platform does not provide chat, collect payments, or process transactions.',
  },
];

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, initFromStorage } = useAuthStore();
  const [mismatchMsg, setMismatchMsg] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => { initFromStorage(); }, [initFromStorage]);

  const handleRoleNav = (targetRole: 'DRIVER' | 'SENDER', path: string) => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }
    if (user.role !== targetRole) {
      const yourRole = user.role === 'DRIVER' ? 'Driver' : 'Shipper';
      const targetLabel = targetRole === 'DRIVER' ? 'Driver Dashboard' : 'Shipper Dashboard';
      setMismatchMsg(
        `⚠️ Account type does not match — You are logged in as a ${yourRole}. The ${targetLabel} is for ${targetRole === 'DRIVER' ? 'Drivers' : 'Shippers'} only. Please use the button below that matches your account.`
      );
      setTimeout(() => setMismatchMsg(''), 5000);
      return;
    }
    // Check if driver has completed profile
    if (targetRole === 'DRIVER' && (!user.profile_completed || user.verification_status !== 'VERIFIED')) {
      router.push('/driver/onboarding');
      return;
    }
    setMismatchMsg('');
    router.push(path);
  };

  const handleLogout = () => {
    disconnectSocket();
    logout();
    router.push('/');
  };

  const isDriver = user?.role === 'DRIVER';
  const isSender = user?.role === 'SENDER';
  const howItWorks = isDriver ? howItWorksDriver : howItWorksSender;
  const benefits = isDriver ? driverBenefits : senderBenefits;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

      {/* ── NAVBAR ── */}
      <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="logo-icon">🚛</div>
          <span className="logo-text">RoadLifter</span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isAuthenticated && user ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.85rem',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isDriver ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {user.name?.[0]?.toUpperCase() || '?'}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{user.name}</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: isDriver ? 'var(--color-primary)' : 'var(--color-accent)',
                  background: isDriver ? 'var(--color-primary-dim)' : 'var(--color-accent-dim)',
                  padding: '2px 8px', borderRadius: 'var(--radius-full)',
                }}>
                  {isDriver ? 'DRIVER' : 'SHIPPER'}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" style={{ paddingTop: 100, paddingBottom: 60 }}>
        {/* Welcome badge */}
        {isAuthenticated && user && (
          <div className="hero-badge" style={{ marginBottom: 20 }}>
            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
            Welcome back, {user.name}! You&apos;re logged in as a {isDriver ? 'Driver' : 'Shipper'}.
          </div>
        )}

        <h1 className="hero-title">
          {isAuthenticated
            ? (isDriver ? <>Find Loads,<br /><span className="highlight">Earn More Miles</span></> : <>Ship Freight,<br /><span className="highlight">Track Live</span></>)
            : <>Move Freight<br /><span className="highlight">Smarter &amp; Faster</span></>}
        </h1>

        <p className="hero-subtitle">
          {isAuthenticated
            ? (isDriver
              ? 'Browse nearby open shipments, accept a load, and update its status through delivery.'
              : 'Post a shipment, watch nearby drivers on a live map, and track your cargo from pickup to delivery in real-time.')
            : 'RoadLifter connects truck drivers with shippers on a real-time live map. Find loads nearby, post shipments instantly, watch trucks move — all in one place.'}
        </p>

        {/* ── ROLE-AWARE CTA BUTTONS ── */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          {/* Driver button */}
          <button
            onClick={() => handleRoleNav('DRIVER', '/dashboard')}
            className="btn btn-xl"
            style={{
              background: isDriver
                ? 'var(--gradient-primary)'
                : 'var(--color-surface-2)',
              color: isDriver ? '#fff' : 'var(--color-text-muted)',
              border: isDriver ? 'none' : '1px solid var(--color-border)',
              cursor: 'pointer',
              position: 'relative',
              opacity: (!isAuthenticated || isDriver) ? 1 : 0.6,
            }}
          >
            🚛 Driver Dashboard
            {isSender && (
              <span style={{
                position: 'absolute', top: -8, right: -8,
                background: 'var(--color-danger)', color: '#fff',
                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px',
                borderRadius: 'var(--radius-full)', letterSpacing: '0.05em',
              }}>DRIVER ONLY</span>
            )}
          </button>

          {/* Shipper button */}
          <button
            onClick={() => handleRoleNav('SENDER', '/shipper/dashboard')}
            className="btn btn-xl"
            style={{
              background: isSender
                ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                : 'var(--color-surface-2)',
              color: isSender ? '#fff' : 'var(--color-text-muted)',
              border: isSender ? 'none' : '1px solid var(--color-border)',
              cursor: 'pointer',
              position: 'relative',
              opacity: (!isAuthenticated || isSender) ? 1 : 0.6,
            }}
          >
            📦 Shipper Dashboard
            {isDriver && (
              <span style={{
                position: 'absolute', top: -8, right: -8,
                background: 'var(--color-danger)', color: '#fff',
                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px',
                borderRadius: 'var(--radius-full)', letterSpacing: '0.05em',
              }}>SHIPPER ONLY</span>
            )}
          </button>
        </div>

        {/* ── ROLE MISMATCH WARNING ── */}
        {mismatchMsg && (
          <div style={{
            marginTop: 20,
            maxWidth: 560,
            marginInline: 'auto',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            fontSize: '0.9rem',
            color: '#fca5a5',
            lineHeight: 1.6,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
          }}>
            {mismatchMsg}
          </div>
        )}

        {/* ── INSTRUCTIONS NOTE ── */}
        {isAuthenticated && user && (
          <div style={{
            marginTop: 24,
            maxWidth: 540,
            marginInline: 'auto',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--color-accent)' }}>ℹ️ Important:</strong> Each dashboard is locked to its account type.
            If you click a button that doesn&apos;t match your role (<strong style={{ color: 'var(--color-text)' }}>{isDriver ? 'DRIVER' : 'SHIPPER'}</strong>), you will see an
            &quot;Account type does not match&quot; warning above the buttons instead of being redirected.
            This keeps driver and shipper experiences fully separate.
          </div>
        )}

        {/* Not logged in: show signup options */}
        {!isAuthenticated && (
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?role=DRIVER" className="btn btn-primary btn-lg">🚛 Join as Driver</Link>
            <Link href="/register?role=SENDER" className="btn btn-secondary btn-lg">📦 Join as Shipper</Link>
          </div>
        )}

      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: 'var(--color-surface)', padding: '80px 24px', borderTop: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>
              How It Works
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: 14 }}>
              {isAuthenticated
                ? (isDriver ? 'How Drivers Use RoadLifter' : 'How Shippers Use RoadLifter')
                : 'Simple Steps to Get Started'}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>
              {isAuthenticated
                ? (isDriver
                  ? 'Everything you need to find loads and grow your trucking business.'
                  : 'Post a shipment and have it moving in minutes — not days.')
                : 'Whether you\'re a driver or a shipper, getting started takes under 2 minutes.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {(isAuthenticated ? howItWorks : howItWorksDriver).map((item, i) => (
              <div key={item.step} style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '28px 24px',
                position: 'relative',
                transition: 'border-color var(--transition-base)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${i % 2 === 0 ? '#f97316' : '#3b82f6'}, ${i % 2 === 0 ? '#ea580c' : '#2563eb'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem', marginBottom: 16, boxShadow: `0 0 16px ${i % 2 === 0 ? 'rgba(249,115,22,0.3)' : 'rgba(59,130,246,0.3)'}`,
                }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-faint)', letterSpacing: '0.1em', marginBottom: 8 }}>
                  STEP {item.step}
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10, color: 'var(--color-text)' }}>{item.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Show both if not logged in */}
          {!isAuthenticated && (
            <div style={{ marginTop: 48 }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)' }}>...and for Shippers</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
                {howItWorksSender.map((item, i) => (
                  <div key={item.step} style={{
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)', padding: '28px 24px',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.25rem', marginBottom: 16,
                    }}>{item.icon}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-faint)', letterSpacing: '0.1em', marginBottom: 8 }}>STEP {item.step}</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>{item.title}</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 24px', borderTop: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>
              Why RoadLifter
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: 14 }}>
              {isAuthenticated
                ? (isDriver ? 'Built for Drivers Who Mean Business' : 'Built for Shippers Who Need Speed')
                : 'Benefits for Everyone on the Road'}
            </h2>
          </div>

          <div className="features-grid">
            {(isAuthenticated ? benefits : [...driverBenefits, ...senderBenefits]).map((b) => (
              <div key={b.title} className="feature-card">
                <div className="feature-icon">{b.icon}</div>
                <h3 className="feature-title">{b.title}</h3>
                <p className="feature-desc">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLE SEPARATION EXPLAINER ── */}
      <section style={{ background: 'var(--color-surface)', padding: '64px 24px', borderTop: '1px solid var(--color-border)' }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>
              Privacy by Design
            </div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', marginBottom: 14 }}>
              Separate Worlds, Zero Overlap
            </h2>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: 540, margin: '0 auto', lineHeight: 1.7 }}>
              RoadLifter keeps driver and shipper data strictly separated. Here&apos;s exactly what each role can see:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Driver column */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: 'var(--radius-lg)', padding: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: '1.5rem' }}>🚛</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Driver Account</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>What you can and cannot see</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { ok: true,  txt: 'Open shipments near you' },
                  { ok: true,  txt: 'Shipment details & budget' },
                  { ok: true,  txt: 'Your own accepted loads' },
                  { ok: false, txt: 'Other drivers\' locations' },
                  { ok: false, txt: 'Other drivers\' earnings' },
                  { ok: false, txt: 'Shipper cargo feed' },
                ].map((row) => (
                  <li key={row.txt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: row.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${row.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem',
                    }}>{row.ok ? '✓' : '✕'}</span>
                    <span style={{ color: row.ok ? 'var(--color-text)' : 'var(--color-text-faint)' }}>{row.txt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Shipper column */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 'var(--radius-lg)', padding: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: '1.5rem' }}>📦</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-accent)' }}>Shipper Account</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>What you can and cannot see</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { ok: true,  txt: 'Available drivers near you' },
                  { ok: true,  txt: 'Driver truck type & capacity' },
                  { ok: true,  txt: 'Your own posted shipments' },
                  { ok: false, txt: 'Other shippers\' cargo' },
                  { ok: false, txt: 'Other customers\' budgets' },
                  { ok: false, txt: 'Driver-only cargo feed' },
                ].map((row) => (
                  <li key={row.txt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: row.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${row.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem',
                    }}>{row.ok ? '✓' : '✕'}</span>
                    <span style={{ color: row.ok ? 'var(--color-text)' : 'var(--color-text-faint)' }}>{row.txt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 24px', borderTop: '1px solid var(--color-border)' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)' }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                background: 'var(--color-surface)',
                border: `1px solid ${openFaq === i ? 'rgba(249,115,22,0.35)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                transition: 'border-color var(--transition-fast)',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '18px 22px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text)', fontSize: '0.9375rem', fontWeight: 600,
                    gap: 16,
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{
                    fontSize: '1.1rem', flexShrink: 0,
                    transform: openFaq === i ? 'rotate(45deg)' : 'none',
                    transition: 'transform var(--transition-fast)',
                    color: 'var(--color-primary)',
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{
                    padding: '0 22px 18px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.9rem',
                    lineHeight: 1.75,
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 14,
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        marginTop: 'auto',
      }}>
        {/* Footer top */}
        <div className="container" style={{ padding: '56px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="logo-icon" style={{ width: 36, height: 36, fontSize: '1.1rem' }}>🚛</div>
              <span className="logo-text" style={{ fontSize: '1.1rem' }}>RoadLifter</span>
            </div>
            <p style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: 200 }}>
              Real-time freight matching for drivers and shippers. Move cargo smarter.
            </p>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              {['𝕏', 'in', 'f'].map((s) => (
                <div key={s} style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  color: 'var(--color-text-muted)', cursor: 'pointer',
                }}>{s}</div>
              ))}
            </div>
          </div>

          {/* Platform links */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: 16, letterSpacing: '0.05em' }}>Platform</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '🚛 Driver Dashboard', href: '/dashboard' },
                { label: '📦 Shipper Dashboard', href: '/shipper/dashboard' },
                { label: '🔐 Sign In', href: '/login' },
                { label: '📝 Create Account', href: '/register' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem', textDecoration: 'none', transition: 'color var(--transition-fast)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: 16, letterSpacing: '0.05em' }}>Company</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'About Us', href: '/' },
                { label: 'Careers', href: '/' },
                { label: 'Blog', href: '/' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms of Service', href: '/' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem', textDecoration: 'none' }}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: 16, letterSpacing: '0.05em' }}>Direct Coordination</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0 }}>↗</span>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Matched parties exchange contact details and arrange communication and payment outside RoadLifter.
                </p>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ color: 'var(--color-text-faint)', fontSize: '0.8125rem' }}>
            © {new Date().getFullYear()} RoadLifter Inc. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'Privacy', href: '/privacy-policy' },
              { label: 'Terms', href: '/' },
              { label: 'Cookies', href: '/' },
            ].map((l) => (
              <Link key={l.label} href={l.href} style={{ color: 'var(--color-text-faint)', fontSize: '0.8125rem', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
