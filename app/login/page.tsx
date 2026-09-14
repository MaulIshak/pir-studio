'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CircleNotch,
  WarningCircle,
} from '@phosphor-icons/react'

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam ? 'Authentication failed. Please try again.' : null
  )

  async function handleGoogleSignIn() {
    setLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          scopes: 'https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
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
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[420px]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-7 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-9">
        {/* Subtle accent border line at top */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

        <div className="flex flex-col items-center gap-4 text-center">
          {/* Logo with sleek ambient ring */}
          <div className="group relative flex size-20 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent p-3.5 shadow-md shadow-primary/10 transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="Pir Studio Logo"
              width={64}
              height={64}
              className="size-full object-contain drop-shadow-sm"
              priority
            />
          </div>

          {/* Title & Tagline */}
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Pir Studio
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Central hub for game projects, team task kanban, and Google Drive auto-sync.
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <Alert variant="destructive" className="mt-5 py-2.5">
            <WarningCircle className="size-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Google Sign-in Button */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border/90 bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-accent hover:shadow-md active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <CircleNotch className="size-4 animate-spin text-primary" />
                <span className="text-xs">Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Multi-Color Google G SVG */}
                <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
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
          </button>
        </div>



      </div>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      {/* Background Architectural Grid Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,#000_70%,transparent_100%)]" />

      {/* Ambient Brand Indigo Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[420px] rounded-full bg-primary/10 blur-[100px]" />

      <Suspense
        fallback={
          <div className="flex h-80 w-full max-w-[420px] items-center justify-center rounded-2xl border border-border/80 bg-card p-8">
            <CircleNotch className="size-6 animate-spin text-primary" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  )
}
