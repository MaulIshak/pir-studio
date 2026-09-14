import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // Lightweight ping to prevent Supabase inactivity pausing
    const { error, count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })

    if (error) {
      console.error('Ping Supabase check failed:', error)
      return NextResponse.json(
        {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      projectCount: count ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    console.error('Ping unexpected error:', err)
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
