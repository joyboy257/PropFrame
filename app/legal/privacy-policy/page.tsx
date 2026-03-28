import Link from 'next/link';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy (Singapore)</h1>
        <div className="prose prose-invert prose-slate prose-sm max-w-none space-y-6">

          <p className="text-slate-400 text-sm">
            Last updated: March 2026 · PropFrame operates in compliance with Singapore's Personal Data Protection Act (PDPA).
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Information We Collect</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We collect information you provide directly: name, email address, and any content you upload (including property photographs). We also collect usage data such as projects created, clips generated, and account activity — all solely for service improvement and billing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. How We Use Your Information</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your information is used to: provide and maintain the PropFrame service; process credit purchases and deduct usage; send transactional communications (account notifications, billing receipts); detect and prevent fraud or misuse; and comply with legal obligations under Singapore law.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              We <strong className="text-slate-300">do not sell</strong> your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Data Protection (PDPA Compliance)</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame complies with the Personal Data Protection Act 2012 (PDPA) of Singapore. We implement reasonable security measures to protect your personal data against unauthorized access, disclosure, or destruction.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              Data is stored on servers located in Singapore and the United States, managed under commercially reasonable security standards including encryption in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Cookies and Tracking</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We use essential cookies to maintain your session and authentication. Analytics cookies help us understand how visitors use our site. You may disable cookies in your browser settings — note that some features may not function properly without them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Your Rights Under PDPA</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Under the PDPA, you have the right to: request access to your personal data; request correction of inaccurate personal data; withdraw consent (subject to contractual obligations); and complain to the Personal Data Protection Commission (PDPC) if you believe your data rights have been violated.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              To exercise any of these rights, email <span className="text-blue-400">privacy@propframe.io</span>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Data Retention</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to provide services. Account data is retained for 7 years after account closure for legal and accounting purposes. You may request deletion of your data at any time — subject to our legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Third-Party Services</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We use third-party services for: payment processing (Stripe); video generation (Runway AI); cloud storage (Cloudflare R2); and email delivery. These providers are contractually bound to protect your data and use it only for the services they perform on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Children's Privacy</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame is not intended for users under 18 years of age. We do not knowingly collect personal data from minors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Changes to This Policy</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We may update this privacy policy periodically. Significant changes will be communicated via email or a notice on our platform. The "Last updated" date at the top of this page reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Contact Us</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame · Singapore Business Federation<br />
              160 Robinson Rd, #14-04 Singapore Business Federation Center, Singapore 068914<br />
              Phone: 8825 4082<br />
              Email: <span className="text-blue-400">privacy@propframe.io</span><br />
              Data Protection Officer: <span className="text-blue-400">dpo@propframe.io</span>
            </p>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
