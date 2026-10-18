import Link from 'next/link';

const sections = [
  {
    title: '1. Overview',
    body: 'RoadLifter connects drivers and shippers so they can find nearby opportunities and review profile information, shipment details, and contact details needed to coordinate logistics. We do not provide in-app chat, payment processing, or escrow services. Communication, negotiation, and payment arrangements happen outside the RoadLifter platform.',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect account details such as name, email address, phone number, and role (driver or shipper). Authentication is handled exclusively through Google Sign-In via Firebase; we never store passwords or password hashes. Driver accounts may include verification details such as legal name, ID number, vehicle number, license details, and license expiry. We also collect live location data when a user permits access to geolocation, shipment information, ratings, and moderation data such as blacklist status or review outcomes.',
  },
  {
    title: '3. How We Use Data',
    body: 'We use personal data to create and maintain accounts, match drivers with nearby shipments, show trusted contact details after a match, verify driver profiles, process ratings and reviews, and maintain security and operational integrity. We do not use user data for payment collection, transaction processing, or in-app messaging.',
  },
  {
    title: '4. Contact Data and Matching',
    body: 'RoadLifter may reveal contact information such as phone number and email address only to the matched parties after a shipment is accepted. Unrelated users do not see each other\'s full contact information. Any communication about pricing, scheduling, payment, or delivery arrangements occurs outside the RoadLifter platform.',
  },
  {
    title: '5. Location Data',
    body: 'RoadLifter uses browser geolocation to show nearby drivers or loads and to keep the live map current. Location is shared only with relevant nearby parties and is not used for payment processing or advertising. If location permission is denied, the app falls back to a default location and displays a prompt asking the user to allow access.',
  },
  {
    title: '6. Ratings and Verification',
    body: 'We collect ratings, review comments, and account verification records to help build trust. Driver verification and profile review are handled by authorized operators and may include identity-related information required to review driver eligibility.',
  },
  {
    title: '7. Data Security',
    body: 'We use reasonable administrative, technical, and physical safeguards to protect account data, verification records, and location information. However, no system can be guaranteed completely secure, and users should protect their passwords and access credentials carefully.',
  },
  {
    title: '8. Data Retention',
    body: 'We retain account, shipment, rating, and moderation data only as long as necessary to support the marketplace, security, legal obligations, and dispute resolution. Driver verification records are retained only as needed for review and compliance purposes.',
  },
  {
    title: '9. Your Rights',
    body: 'Users may request access to their own account information, ask for corrections, or request removal of certain personal data subject to legal and operational requirements. Because RoadLifter is a logistics coordination platform, some records may need to remain available for operational, safety, and compliance reasons.',
  },
  {
    title: '10. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time to reflect product changes, legal obligations, or operational needs. Any material changes will be communicated through the app or the website before they take effect.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '120px 24px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to home
        </Link>

        <div style={{ marginTop: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div className="logo-icon" style={{ width: 38, height: 38, fontSize: '1.1rem' }}>🚛</div>
            <span className="logo-text" style={{ fontSize: '1.1rem' }}>RoadLifter</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 12 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
            This Privacy Policy explains what data RoadLifter collects, how it is used, and what happens when a driver and shipper are matched.
          </p>

          {sections.map((section) => (
            <section key={section.title} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.125rem', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>{section.body}</p>
            </section>
          ))}

          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 32, paddingTop: 24 }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: 10 }}>Contact</h2>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              If you have questions about this policy or your personal data, contact the RoadLifter operator through the support contact listed on the website. RoadLifter does not provide in-app chat or payment processing.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
