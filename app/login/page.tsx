'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GoogleLogo, WarningCircle, CircleNotch } from '@phosphor-icons/react'

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
    <Card className="w-full max-w-sm border-border/80 bg-card/90 shadow-xl backdrop-blur-md sm:max-w-md">
      <CardHeader className="flex flex-col items-center gap-3 text-center pb-4">
        <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 p-2 shadow-inner">
          <Image
            src="/logo.png"
            alt="Pir Studio"
            width={60}
            height={60}
            className="size-14 object-contain"
            priority
          />
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-2xl font-bold tracking-tight">
            Pir Studio
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Game development projects and Google Drive workspace
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-2">
        {errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <WarningCircle className="size-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          size="lg"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full gap-2.5 py-5 text-sm font-medium shadow-sm transition-all duration-200"
        >
          {loading ? (
            <>
              <CircleNotch className="size-4 animate-spin" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <GoogleLogo className="size-4" weight="bold" />
              <span>Sign in with Google</span>
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          Sign in with your team Google account to access projects, tasks, and assets.
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-4">
      {/* Subtle decorative background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Suspense fallback={
        <Card className="w-full max-w-sm p-8 sm:max-w-md">
          <div className="flex h-48 items-center justify-center">
            <CircleNotch className="size-6 animate-spin text-primary" />
          </div>
        </Card>
      }>
        <LoginContent />
      </Suspense>
    </div>
  )
}
