'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { REMEMBER_ME_COOKIE_NAME, REMEMBER_ME_MAX_AGE } from '@/lib/supabase/constants'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CircleNotch,
  WarningCircle,
  ShieldCheck,
} from '@phosphor-icons/react'

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam ? 'Authentication failed. Please try again.' : null
  )

  async function handleGoogleSignIn() {
    setLoading(true)
    setErrorMessage(null)

    try {
      // Store remember-me preference in cookie before redirecting
      document.cookie = `${REMEMBER_ME_COOKIE_NAME}=${rememberMe ? 'true' : 'false'}; path=/; max-age=${rememberMe ? REMEMBER_ME_MAX_AGE : 86400}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?remember=${rememberMe ? 'true' : 'false'}`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to Google')
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[400px]"
    >
      <Card className="relative overflow-hidden border-border bg-card shadow-lg">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />

        <CardContent className="p-7 sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center border border-primary/25 bg-primary/10 p-3">
              <Image
                src="/logo.png"
                alt="Pir Studio Logo"
                width={48}
                height={48}
                className="size-full object-contain"
                priority
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Pir Studio
              </h1>
              <p className="text-xs leading-relaxed text-muted-foreground max-w-xs mx-auto">
                Central workspace for game projects, task kanban, and asset tracking.
              </p>
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive" className="mt-5 py-2.5">
              <WarningCircle className="size-4" />
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 flex flex-col gap-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="h-11 w-full gap-3 border-border bg-background hover:border-primary/50 hover:bg-accent text-sm font-medium"
            >
              {loading ? (
                <>
                  <CircleNotch className="size-4 animate-spin text-primary" />
                  <span className="text-xs">Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="font-semibold tracking-tight">Continue with Google</span>
                </>
              )}
            </Button>

            <div className="flex items-center justify-between px-0.5 py-0.5">
              <label
                htmlFor="remember-me"
                className="flex items-center gap-2.5 cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground transition-colors"
              >
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <span>Remember me</span>
              </label>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 border border-border">
                <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                90 days
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true" className="select-none opacity-40">·</span>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-35 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_45%,black_60%,transparent_100%)]"
      />

      <Suspense
        fallback={
          <Card className="flex h-80 w-full max-w-[400px] items-center justify-center border-border bg-card p-8">
            <CircleNotch className="size-5 animate-spin text-primary" />
          </Card>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  )
}
