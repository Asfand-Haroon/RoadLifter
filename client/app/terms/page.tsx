import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | RoadLifter',
  description: 'RoadLifter Terms of Service — rules and responsibilities for drivers and shippers using the freight marketplace.',
};

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating a RoadLifter account or using the platform in any way, you agree to be bound by these Terms of Service. If you do not agree, do not create an account or use the platform. RoadLifter reserves the right to update these terms at any time; continued use after a change constitutes acceptance.',
  },
  {
    title: '2. Platform Scope — Marketplace Only',
    body: 'RoadLifter is a freight-matching marketplace that connects truck drivers and shippers. RoadLifter does not provide transportation services, act as a freight broker, process payments, offer escrow, provide in-app chat, or guarantee delivery outcomes. All logistics coordination, pricing negotiation, and payment arrangements occur directly between the matched driver and shipper, outside the RoadLifter platform.',
  },
  {
    title: '3. Eligibility',
    body: 'You must be at least 18 years old and legally permitted to operate as a driver or shipper in your jurisdiction to use RoadLifter. By registering, you represent and warrant that you meet these requirements. Driver accounts are subject to profile review and approval before load access is granted.',
  },
  {
    title: '4. Account Responsibilities',
    body: 'You are responsible for maintaining the security of your Google account used to sign in. You must provide accurate, current, and complete information during registration. You may not share your account with others, impersonate any person, or create multiple accounts to circumvent restrictions. Notify us immediately if you suspect unauthorized access.',
  },
  {
    title: '5. Driver Obligations',
    body: 'Drivers must hold valid licences, permits, and insurance required by applicable law. Information submitted for profile verification must be truthful and accurate. Drivers must honour accepted loads in good faith and update shipment status honestly. Providing false verification information may result in immediate account suspension and referral to relevant authorities.',
  },
  {
    title: '6. Shipper Obligations',
    body: 'Shippers must accurately describe their cargo, weight, pickup location, delivery location, and offered budget. You may not post shipments for prohibited items (see Section 7). Once a driver accepts a shipment, you are expected to honour the arrangement in good faith, including making payment as agreed outside the platform.',
  },
  {
    title: '7. Prohibited Uses',
    body: 'You may not use RoadLifter to transport illegal goods, hazardous materials without proper certification, contraband, or anything prohibited by applicable law. You may not use the platform for spam, fraud, harassment, or to collect other users\u2019 contact details for purposes unrelated to the matched shipment. Violation of this section may result in immediate termination and legal referral.',
  },
  {
    title: '8. Location Data',
    body: 'By enabling location access, you consent to RoadLifter sharing your real-time location with relevant matched parties (drivers see nearby shipments; shippers see nearby drivers). Location data is not used for advertising and is not shared with unrelated third parties. You may withdraw location permission at any time through your device settings.',
  },
  {
    title: '9. Ratings and Reviews',
    body: 'After a shipment is completed, matched parties may rate each other. Ratings must be honest and based on actual experience. Submitting false, malicious, or retaliatory ratings is prohibited and may result in account action. RoadLifter reserves the right to moderate or remove ratings that violate these terms.',
  },
  {
    title: '10. Account Suspension and Termination',
    body: 'RoadLifter may suspend or terminate any account at any time for breach of these terms, providing false information, accumulating low ratings, being blacklisted for conduct issues, or for any reason at our sole discretion. Suspended users may not create new accounts to circumvent the suspension.',
  },
  {
    title: '11. Disclaimer of Warranties',
    body: 'RoadLifter is provided "as is" without warranties of any kind, express or implied. We do not guarantee continuous availability, freedom from errors, or that any driver or shipper will fulfil their obligations. Your use of the platform is at your sole risk.',
  },
  {
    title: '12. Limitation of Liability',
    body: 'To the maximum extent permitted by law, RoadLifter and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform, including disputes between drivers and shippers, failed deliveries, cargo loss or damage, or payment disagreements.',
  },
  {
    title: '13. Governing Law',
    body: 'These Terms of Service are governed by the laws of the jurisdiction in which RoadLifter operates, without regard to conflict-of-law principles. Any disputes shall be resolved through binding arbitration or in the competent courts of that jurisdiction.',
  },
  {
    title: '14. Changes to These Terms',
    body: 'We may update these Terms of Service at any time. We will make reasonable efforts to notify you of material changes through the app or the website. Continued use after the effective date of changes constitutes acceptance of the revised terms.',
  },
];

export default function TermsOfServicePage() {
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

          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 12 }}>Terms of Service</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Last updated: {new Date().getFullYear()}
          </p>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
            These Terms of Service govern your use of the RoadLifter freight marketplace. Please read them carefully.
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
              If you have questions about these Terms of Service, contact the RoadLifter operator through the support contact listed on the website.
            </p>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8, marginTop: 12 }}>
              Also see our{' '}
              <Link href="/privacy-policy" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
