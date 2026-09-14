import Link from 'next/link'
import { ProjectForm } from '@/components/projects/project-form'
import { Button } from '@/components/ui/button'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/projects" />}>
          <CaretLeft className="size-3.5" />
          Projects
        </Button>
      </div>
      <ProjectForm />
    </div>
  )
}
