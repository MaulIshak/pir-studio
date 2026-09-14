import { Skeleton } from '@/components/ui/skeleton'

export default function ArtifactsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-full mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
