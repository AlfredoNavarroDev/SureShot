'use client'
import { useParams, useRouter } from 'next/navigation'
import { useMatch, useUpdateMatch } from '@/hooks/useMatches'
import { AdminMatchForm, type MatchFormData } from '@/components/features/matches/AdminMatchForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

export default function EditMatchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: match, isLoading } = useMatch(id)
  const { mutateAsync, isPending } = useUpdateMatch()

  const onSubmit = async (data: MatchFormData) => {
    await mutateAsync({
      id,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      matchDatetime: new Date(data.matchDatetime).toISOString(),
      stage: data.stage,
      group: data.group,
      status: data.status,
      homeScore: data.homeScore ?? null,
      awayScore: data.awayScore ?? null,
    })
    router.push('/admin/matches')
  }

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>
  if (!match) return <p className="p-6 text-muted-foreground">Partido no encontrado</p>

  const localDatetime = new Date(match.matchDatetime).toISOString().slice(0, 16)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <Button variant="ghost" size="icon" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-bold">Editar partido</h1>
      <AdminMatchForm
        defaultValues={{
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchDatetime: localDatetime,
          stage: match.stage,
          group: match.group,
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        }}
        onSubmit={onSubmit}
        isPending={isPending}
        isEdit
      />
    </div>
  )
}
