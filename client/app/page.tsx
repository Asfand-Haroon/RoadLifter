import Link from 'next/link';

const features = [
  {
    icon: '🗺️',
    title: 'Live Map for Drivers',
    desc: 'See every open shipment near you in real-time on an interactive map. Filter by distance, cargo type, and budget.',
  },
  {
    icon: '🚛',
    title: 'Live Map for Senders',
    desc: 'Watch available truck drivers move around you in real-time. Post a shipment and get it accepted in minutes.',
  },
  {
    icon: '⚡',
    title: 'Instant Matching',
    desc: 'Drivers get notified the second a new shipment is posted near them. No delays, no middlemen.',
  },
  {
    icon: '📦',
    title: 'All Cargo Types',
    desc: 'General freight, electronics, perishables, construction materials, furniture, auto parts — we handle it all.',
  },
  {
    icon: '🔒',
    title: 'Driver Review',
    desc: 'Driver location sharing and load access are enabled only after profile approval.',
  },
  {
    icon: '📊',
    title: 'Full Shipment Tracking',
    desc: 'Track every load from posting through pickup, transit, and delivery with live status updates.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon">🚛</div>
          <span className="logo-text">RoadLifter</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero" style={{ paddingTop: '120px' }}>
        <div className="hero-badge">
          <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
          A freight marketplace for drivers and shippers
        </div>

        <h1 className="hero-title">
          Move Freight<br />
          <span className="highlight">Smarter & Faster</span>
        </h1>

        <p className="hero-subtitle">
          RoadLifter connects truck drivers with shippers on a real-time live map.
          Find loads nearby, post shipments instantly, watch trucks move — all in one place.
        </p>

        <div className="hero-cta">
          <Link href="/register?role=DRIVER" className="btn btn-primary btn-xl">
            🚛 I&apos;m a Driver — Find Loads
          </Link>
          <Link href="/register?role=SENDER" className="btn btn-secondary btn-xl">
            📦 I Need a Truck
          </Link>
        </div>

      </section>

      {/* Features */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', marginBottom: '16px' }}>
              Everything You Need to Move Freight
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.0625rem', maxWidth: 560, margin: '0 auto' }}>
              A complete platform for drivers and shippers — built for the real world of freight logistics.
            </p>
          </div>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--color-surface)', padding: '80px 0', borderTop: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', marginBottom: '16px' }}>How It Works</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px' }}>
            {[
              { step: '01', title: 'Sign in with Google', desc: 'Choose a driver or shipper role and complete your profile', icon: '👤' },
              { step: '02', title: 'Open the Live Map', desc: 'See real-time shipments or trucks near your location', icon: '🗺️' },
              { step: '03', title: 'Connect & Move', desc: 'Accept a load or post a shipment — done in seconds', icon: '🤝' },
              { step: '04', title: 'Track Everything', desc: 'Monitor status from pickup through delivery', icon: '📊' },
            ].map((item) => (
              <div key={item.step} style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{item.icon}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', marginBottom: '8px' }}>STEP {item.step}</div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '12px' }}>{item.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--color-bg)', padding: '80px 24px', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', marginBottom: '20px' }}>
            Ready to Hit the Road?
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.0625rem', marginBottom: '40px' }}>
            Join thousands of drivers and shippers already using RoadLifter to move freight across the country.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?role=DRIVER" className="btn btn-primary btn-lg">Start as Driver</Link>
            <Link href="/register?role=SENDER" className="btn btn-secondary btn-lg">Post a Shipment</Link>
          </div>
          <p style={{ marginTop: '24px', fontSize: '0.875rem', color: 'var(--color-text-faint)' }}>
            Already have an account?{' '}
            <Link href="/login" className="auth-link">Sign in here</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '24px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span>🚛</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>RoadLifter</span>
        </div>
        <p>© {new Date().getFullYear()} RoadLifter. Moving freight, smarter.</p>
      </footer>
    </>
  );
}
