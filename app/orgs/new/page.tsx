import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateOrgForm } from '@/components/organizations/create-org-form'

export const dynamic = 'force-dynamic'

export default async function NewOrganizationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Create Organization</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Set up a new workspace for your game studio, team, or jam group.
        </p>
      </div>

      <CreateOrgForm />
    </div>
  )
}
