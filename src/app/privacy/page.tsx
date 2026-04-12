import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MonoLabel from '@/components/ui/MonoLabel'

export default function PrivacyPage() {
  return (
    <PageShell back={{ href: '/login', label: 'back' }}>
      <PageHeader kicker="legal" title="Privacy" />
      <article className="px-5 pb-12 space-y-6" style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', lineHeight: 1.6 }}>

        <section>
          <MonoLabel className="block mb-2">what we collect</MonoLabel>
          <p>When you sign in with Google, we store your email address and a unique account ID. We use this to identify you across trips and show your name to other trip participants.</p>
          <p className="mt-2">When you use the app, we store: trip details (destinations, dates, bookings), your swipe votes, notes and constraints you add, and any booking data parsed from text you submit or that agents post on your behalf.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">ai services</MonoLabel>
          <p>Bunnyhop uses third-party AI services to power its features:</p>
          <ul className="mt-2 space-y-1 detail-mono" style={{ paddingLeft: '16px', listStyleType: 'disc' }}>
            <li><strong>Anthropic (Claude)</strong> — parses free-text booking details into structured data and generates trip recommendation cards. Your trip context (destination, dates, constraints, booking text) is sent to Claude for processing.</li>
            <li><strong>Google Gemini</strong> — generates editorial-style cover images for trips from the destination name.</li>
            <li><strong>Google Places</strong> — fetches photos, ratings, and review counts for recommendation cards. The query sent includes the card title and the trip destination (e.g., &quot;Monkeypod Kitchen Hawaii&quot;).</li>
          </ul>
          <p className="mt-2">These services process your data to provide functionality. We do not send data to these services for advertising, training, or any purpose beyond the features you use.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">gmail access</MonoLabel>
          <p>The site admin may use a Gmail integration (via developer tooling, not an in-app feature) to search for booking confirmations on your behalf and extract booking details for your trip timeline. This access is triggered manually by the admin, not automated. We do not store your email content, read emails beyond what is explicitly requested, or share email data with anyone. End users do not have direct Gmail access within the app.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">where data is stored</MonoLabel>
          <p>All app data (trips, bookings, votes, images) is stored in Supabase, a cloud database service hosted on AWS. Trip cover images are stored in Supabase Storage. Authentication is handled by Supabase Auth using Google OAuth.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">cookies</MonoLabel>
          <p>We use a single session cookie managed by Supabase Auth to keep you signed in. We do not use tracking cookies, analytics cookies, or advertising cookies.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">data sharing</MonoLabel>
          <p>We do not sell your data, show you ads, or share your information with third parties for marketing. Your trip data is visible only to participants of that trip (enforced by row-level security in the database). The invite-code agent endpoints share trip data with anyone who has the invite code — share codes only with people and agents you trust.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">data deletion</MonoLabel>
          <p>You can delete individual bookings and trip context entries from the app. To delete your account and all associated data, contact the site admin. We will remove your data from all tables within a reasonable timeframe.</p>
        </section>

        <section>
          <MonoLabel className="block mb-2">changes</MonoLabel>
          <p>This policy may be updated as features change. The app is a personal project, not a commercial product — we aim to be transparent and straightforward about how your data is used.</p>
        </section>

        <p className="detail-mono" style={{ opacity: 0.5 }}>Last updated: April 2026</p>
      </article>
    </PageShell>
  )
}
