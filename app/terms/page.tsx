import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default function TermsOfServicePage() {
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

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Pir Studio (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of
              Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please do not use the Service. Pir
              Studio is an internal project management tool intended for authorized users of our game development team.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p className="mb-3">
              Pir Studio provides a centralized workspace for game development project management, including:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Project creation and management</li>
              <li>Task tracking with a Kanban board</li>
              <li>Milestone and timeline planning</li>
              <li>Asset and credit management</li>
              <li>Artifact link storage</li>
              <li>Optional Google Drive file synchronization</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. User Accounts &amp; Authentication</h2>
            <p>
              Access to Pir Studio requires authentication via a valid Google account. You are responsible for
              maintaining the security of your Google account credentials. You agree to use the Service only for its
              intended purpose and only with an authorized account. Unauthorized access attempts are strictly prohibited.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. Google Drive Integration</h2>
            <p>
              Pir Studio may request access to your Google Drive using the{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">drive.file</code> OAuth scope. This
              permission grants the Service the ability to create, read, update, and delete only the files and folders
              that Pir Studio creates in your Drive. The Service does not access files or folders that were created by
              other applications or users. You may revoke this permission at any time through your Google Account
              settings.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
              <li>Upload, store, or share content that is illegal, harmful, or infringes third-party rights.</li>
              <li>Attempt to reverse-engineer, decompile, or otherwise misuse the Service.</li>
              <li>Share your account credentials with unauthorized individuals.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">6. Data &amp; Content Ownership</h2>
            <p>
              You retain full ownership of any content, project data, assets, and information you create or upload
              within Pir Studio. By using the Service, you grant us a limited, non-exclusive license to store and
              process your content solely for the purpose of providing the Service to you. We do not claim ownership of
              your intellectual property.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">7. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access to the Service. The
              Service may be temporarily unavailable due to scheduled maintenance, unexpected technical issues, or
              third-party service outages (including Supabase, Google, or Vercel). We are not liable for any data loss
              or business disruption caused by service downtime.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Pir Studio and its operators shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising from your use of or
              inability to use the Service. This includes, but is not limited to, loss of data, loss of revenue, or
              business interruption.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">9. Privacy</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link
                href="/privacy"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. Please review the Privacy Policy to understand our
              practices regarding the collection and use of your information.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">10. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective upon posting the updated
              Terms to the Service. Your continued use of the Service after changes are posted constitutes your
              acceptance of the modified Terms. We will update the &ldquo;Last updated&rdquo; date at the top of this
              page when changes are made.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at our discretion, without notice,
              for conduct that we determine violates these Terms or is otherwise harmful to other users, us, or third
              parties. You may stop using the Service at any time by revoking OAuth access through your Google Account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising
              from these Terms or your use of the Service shall be resolved through good-faith negotiation between the
              parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">13. Contact</h2>
            <p>
              If you have questions about these Terms of Service, please reach out via your team&apos;s designated
              internal channel.
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
