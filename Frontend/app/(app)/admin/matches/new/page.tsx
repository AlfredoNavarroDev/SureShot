'use client'
import { useRouter } from 'next/navigation'
import { useCreateMatch } from '@/hooks/useMatches'
import { AdminMatchForm, type MatchFormData } from '@/components/features/matches/AdminMatchForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewMatchPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreateMatch()

  const onSubmit = async (data: MatchFormData) => {
    await mutateAsync({
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      matchDatetime: new Date(data.matchDatetime).toISOString(),
      stage: data.stage,
      group: data.group ?? undefined,
    })
    router.push('/admin/matches')
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <Button variant="ghost" size="icon" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-bold">Nuevo partido</h1>
      <AdminMatchForm onSubmit={onSubmit} isPending={isPending} />
    </div>
  )
}
