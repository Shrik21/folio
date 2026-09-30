import { MarketingNav, Footer } from "@/components/folio-ui";

export function PrivacyPage() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="legal-page">
        <h1>Privacy</h1>
        <p>
          Folio stores the account details your sign-in provider shares (name, and a verified email when one exists), plus the portfolio content you save. Resume files you select in this version are not parsed on the server; only a filename, type, and size are sent so the next step can continue.
        </p>
        <h2>What is public</h2>
        <p>
          Only portfolios you publish are visible at your public link. Drafts are not returned by the public API. You can unpublish at any time. View counts include repeat visits and your own visits.
        </p>
        <h2>Sessions</h2>
        <p>
          Sign-in uses an HttpOnly session cookie. Folio does not store Google or GitHub access tokens. There is no advertising pixel or invented analytics product in this version.
        </p>
        <h2>Contact</h2>
        <p>
          This project does not yet offer a dedicated privacy request portal. If you run your own deployment, you control the database and can delete stored accounts and portfolios there.
        </p>
      </main>
      <Footer />
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="legal-page">
        <h1>Current product terms</h1>
        <p>
          Folio is an early portfolio builder. The free plan includes one portfolio, the Clean Professional template, a shareable <code>/p/your-slug</code> link, and editing tools. You must sign in before publishing.
        </p>
        <h2>What is not included yet</h2>
        <ul>
          <li>Payments and the billed Studio plan (listed as coming later at $12/month).</li>
          <li>Publishing premium templates.</li>
          <li>Custom domains, AI resume extraction, and detailed analytics.</li>
        </ul>
        <h2>Your content</h2>
        <p>
          You are responsible for the accuracy of the work, employers, and qualifications you publish. Folio does not invent testimonials, employment history, or visitor statistics.
        </p>
      </main>
      <Footer />
    </>
  );
}
