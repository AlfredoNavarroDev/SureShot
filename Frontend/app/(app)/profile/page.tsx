'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMe, useUpdateMe } from '@/hooks/useMe'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'

const schema = z.object({
  name: z.string().min(2).max(50),
  avatar: z.string().url('URL inválida').optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export default function ProfilePage() {
  const { data: me, isLoading } = useMe()
  const { mutateAsync, isPending } = useUpdateMe()
  const { clear } = useAuthStore()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (me) reset({ name: me.name, avatar: me.avatar ?? '' })
  }, [me, reset])

  const avatarValue = watch('avatar')

  const onSubmit = async (data: FormData) => {
    await mutateAsync({ name: data.name, avatar: data.avatar || undefined })
  }

  const handleLogout = async () => {
    try {
      await api.delete('/auth/logout')
    } finally {
      clear()
      window.location.href = '/login'
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-md mx-auto">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Mi perfil</h1>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={avatarValue || me?.avatar} />
          <AvatarFallback className="text-xl">{me?.name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{me?.name}</p>
          <p className="text-sm text-muted-foreground">{me?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Editar perfil</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>URL de avatar (opcional)</Label>
              <Input placeholder="https://..." {...register('avatar')} />
              {errors.avatar && <p className="text-xs text-destructive">{errors.avatar.message}</p>}
            </div>
            <Button type="submit" className="w-full font-bold text-black" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        Cerrar sesión
      </Button>
    </div>
  )
}
