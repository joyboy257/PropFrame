import Link from 'next/link';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <LandingNavbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service (Singapore)</h1>
        <div className="prose prose-invert prose-slate prose-sm max-w-none space-y-6">

          <p className="text-slate-400 text-sm">
            Last updated: March 2026 · These terms govern your use of the PropFrame service. By using PropFrame, you agree to these terms.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. The Service</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame provides AI-powered video generation from property photographs. You upload photos, select motion styles, and receive video clips. Credits are deducted per operation according to our published pricing. Service availability may vary and we do not guarantee uninterrupted access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Account Eligibility</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              You must be at least 18 years old to use PropFrame. You are responsible for maintaining the security of your account credentials. You agree to notify us immediately of any unauthorized access. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Credits and Billing</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Credits are purchased in advance and deducted per operation. All credit purchases are final. Unused credits expire according to the package terms. We reserve the right to modify pricing at any time — changes apply to new purchases only, not existing credit balances. Refunds are at our sole discretion.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              For Singapore customers, payments are processed in Singapore Dollars (SGD) via Stripe. PayNow is available as a payment method for qualifying transactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Acceptable Use</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              You agree <strong className="text-slate-300">not</strong> to use PropFrame to generate content that: is illegal, defamatory, or harmful; infringes intellectual property rights; depicts real people without consent; or promotes misinformation. We may remove content and terminate accounts that violate this policy.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              <strong className="text-slate-300">Real estate professionals:</strong> You are responsible for ensuring that any AI-generated video content complies with applicable advertising regulations, including the Estate Agents Act (Cap. 95A) and the Council for Estate Agencies (CEA) guidelines for property advertisements in Singapore.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Intellectual Property</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              You retain all rights to the photographs and content you upload. You grant PropFrame a limited license to process your content for the purpose of providing the service. Generated video clips are owned by you for commercial use. PropFrame retains no rights to your input content.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              You are responsible for ensuring you have the necessary rights to any content you upload. If you do not own the photographs you submit, you must have explicit permission from the property owner or their authorized representative.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. CEA Compliance (Singapore)</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Estate agents and real estate agencies using PropFrame in Singapore are responsible for ensuring their use of AI-generated content complies with the Estate Agents Act (Cap. 95A) and CEA advertising guidelines. This includes, but is not limited to: accurate representation of property features, disclosure of AI-generated content where required, and adherence to the CEA's Code of Ethics and Professional Client Care.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              PropFrame provides a CEA registration number field in the video overlay. Users who are estate agents are encouraged to include their CEA registration number to comply with advertising requirements. PropFrame does not verify CEA registration status.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Disclaimer of Warranties</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame is provided "as is" and "as available." We make no warranties — express or implied — including merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that AI-generated outputs will be error-free, suitable for a specific purpose, or free from intellectual property claims.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Limitation of Liability</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              To the maximum extent permitted by law, PropFrame shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, business, or goodwill — arising from your use of the service, even if we have been advised of the possibility of such damages.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mt-2">
              Our total liability for any claim arising from these terms shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Indemnification</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              You agree to indemnify and hold harmless PropFrame, its officers, and employees from any claims, damages, or expenses arising from: your violation of these terms; your misuse of the service; or your generation or distribution of content that infringes third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">10. Modifications to Service</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We may modify, suspend, or discontinue any part of the service at any time. We will provide reasonable notice where practicable. We may also update these terms periodically — continued use of the service constitutes acceptance of revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">11. Governing Law</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              These terms are governed by the laws of the Republic of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">12. Contact</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              PropFrame · Singapore Business Federation<br />
              160 Robinson Rd, #14-04 Singapore Business Federation Center, Singapore 068914<br />
              Phone: 8825 4082<br />
              Email: <span className="text-blue-400">legal@propframe.io</span>
            </p>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
