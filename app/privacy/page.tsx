import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'September 15, 2026'

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-3.5"
            >
              <path
                fillRule="evenodd"
                d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"
                clipRule="evenodd"
              />
            </svg>
            Back to sign in
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Overview</h2>
            <p>
              Pir Studio (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an internal project management
              tool designed for small game development teams. This Privacy Policy describes how we collect, use, and
              protect information when you access and use Pir Studio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mb-3">We collect the following information when you authenticate with Google:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Account information:</strong> Your name, email address, and profile
                picture provided by Google OAuth.
              </li>
              <li>
                <strong className="text-foreground">Google Drive access:</strong> We request access to your Google Drive
                with the <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">drive.file</code> scope. This
                allows us to create and manage only the files in your Google Drive that were created by Pir Studio. We
                cannot access any other files in your Drive.
              </li>
              <li>
                <strong className="text-foreground">Project data:</strong> Content you create within the app —
                including project names, tasks, milestones, assets, and credits — is stored in our secure database.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="mb-3">We use collected information exclusively to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Authenticate your identity and maintain your session.</li>
              <li>Display your profile information within the application.</li>
              <li>
                Store and sync project data, files, and assets to your Google Drive on your behalf — only when you
                explicitly trigger a Drive sync action.
              </li>
              <li>Provide the core features of the game development project management tool.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> sell, rent, or share your personal information with
              third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. Google API Services</h2>
            <p>
              Pir Studio uses Google Sign-In for authentication and the Google Drive API for file storage. Our use and
              transfer of information received from Google APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. Data Storage &amp; Security</h2>
            <p>
              Your data is stored on Supabase (hosted on AWS infrastructure) with row-level security policies ensuring
              each user can only access their own data. All data transmitted between your browser and our servers is
              encrypted via HTTPS/TLS. OAuth tokens are stored securely and are only used to perform Drive operations
              you explicitly request.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>
              Your account data and project content are retained for as long as you actively use the application. You
              may request deletion of your data at any time by contacting us. Upon account deletion, your personal
              information will be removed from our systems within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>
                Revoke Google OAuth access at any time via your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Google Account permissions
                </a>{' '}
                page.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">8. Cookies &amp; Local Storage</h2>
            <p>
              We use browser cookies and local storage solely to maintain your authentication session. We do not use
              tracking cookies or third-party analytics services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will update the
              &ldquo;Last updated&rdquo; date at the top of this page. Continued use of Pir Studio after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">10. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or your data, please reach out via your team&apos;s
              designated internal channel.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 flex items-center justify-between border-t pt-8 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Pir Studio. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
