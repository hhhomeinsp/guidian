export default function PrivacyPage() {
  return (
    <main
      className="container max-w-3xl py-12 space-y-10"
      style={{ fontFamily: "Georgia, serif" }}
    >
      <div className="pb-4 border-b-2 border-amber">
        <h1
          className="font-display text-4xl font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          Privacy Policy
        </h1>
        <p className="mt-2 font-body" style={{ color: "var(--color-steel)" }}>
          Effective date: January 1, 2025 · Last updated: April 2026
        </p>
      </div>

      <Section title="What we collect">
        <p>
          We collect information you provide directly, including your name,
          email address, professional license number, and learning activity
          data. This includes:
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-1">
          <li>Account registration details (name, email, password hash)</li>
          <li>Learning progress (lessons completed, time spent, quiz scores)</li>
          <li>
            Identity verification data (license number, last four SSN digits —
            required for CE certificate issuance only)
          </li>
          <li>
            Compliance audit records (enrollment events, certificate requests)
          </li>
          <li>
            xAPI learning statements (activity verbs, object identifiers,
            results)
          </li>
          <li>
            Cookies and localStorage tokens for authentication and session
            persistence
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>We use your data to:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1">
          <li>Deliver and personalize your learning experience</li>
          <li>
            Issue CE certificates and report completion to accrediting bodies
          </li>
          <li>Maintain tamper-evident compliance audit logs</li>
          <li>Improve course content and platform performance</li>
          <li>
            Comply with continuing education regulatory requirements in your
            jurisdiction
          </li>
        </ul>
        <p className="mt-3">
          We do not sell your personal data to third parties. Identity
          verification data is stored encrypted and accessed only for
          certificate issuance.
        </p>
      </Section>

      <Section title="Your rights (GDPR)">
        <p>
          If you are located in the European Economic Area, you have the
          following rights under the General Data Protection Regulation (GDPR):
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-2">
          <li>
            <strong>Right to access</strong> — Request a copy of all personal
            data we hold about you. Use the{" "}
            <a
              href="/settings"
              className="underline"
              style={{ color: "var(--color-navy)" }}
            >
              Settings → Download my data
            </a>{" "}
            feature for an instant export.
          </li>
          <li>
            <strong>Right to erasure</strong> — Request deletion of your
            account and associated personal data. Use Settings → Delete my
            account or contact us.
          </li>
          <li>
            <strong>Right to data portability</strong> — Receive your data in a
            machine-readable JSON format via the data export feature.
          </li>
          <li>
            <strong>Right to rectification</strong> — Correct inaccurate
            personal data via your account settings or by contacting us.
          </li>
          <li>
            <strong>Right to restrict processing</strong> — Request that we
            limit how we use your data while a dispute is resolved.
          </li>
          <li>
            <strong>Right to object</strong> — Object to processing based on
            legitimate interests.
          </li>
        </ul>
      </Section>

      <Section title="Your rights (CCPA)">
        <p>
          If you are a California resident, the California Consumer Privacy Act
          (CCPA) grants you the following rights:
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-2">
          <li>
            <strong>Right to know</strong> — Know what personal information we
            collect, use, disclose, or sell.
          </li>
          <li>
            <strong>Right to delete</strong> — Request deletion of personal
            information we have collected, subject to certain exceptions.
          </li>
          <li>
            <strong>Right to opt-out of sale</strong> — We do not sell personal
            information. You may still submit an opt-out request at{" "}
            <a
              href="mailto:privacy@guidian.io"
              className="underline"
              style={{ color: "var(--color-navy)" }}
            >
              privacy@guidian.io
            </a>
            .
          </li>
          <li>
            <strong>Right to non-discrimination</strong> — We will not
            discriminate against you for exercising your CCPA rights.
          </li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          We retain compliance audit logs for seven years to satisfy regulatory
          requirements for continuing education records. Account data is deleted
          within 30 days of a verified deletion request, except where retention
          is required by law.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use localStorage tokens for authentication and session persistence.
          Declining cookies in the consent banner prevents analytics tracking
          but does not affect core learning functionality or certificate
          issuance.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          To exercise any of these rights or for questions about this policy,
          contact our privacy team:
        </p>
        <div
          className="mt-3 rounded-lg border p-4 space-y-1 font-body text-sm"
          style={{
            borderColor: "var(--color-cloud)",
            backgroundColor: "var(--color-fog)",
          }}
        >
          <p>
            <strong>Email:</strong>{" "}
            <a
              href="mailto:privacy@guidian.io"
              style={{ color: "var(--color-navy)" }}
              className="underline"
            >
              privacy@guidian.io
            </a>
          </p>
          <p>
            <strong>Response time:</strong> Within 30 days of receipt
          </p>
        </div>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className="font-display text-2xl font-bold"
        style={{ color: "var(--color-navy)" }}
      >
        {title}
      </h2>
      <div
        className="font-body leading-relaxed"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </div>
    </section>
  );
}
