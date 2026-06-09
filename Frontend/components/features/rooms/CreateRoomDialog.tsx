'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { useCreateRoom } from '@/hooks/useRooms'

const schema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(60, 'Máximo 60 caracteres'),
})
type FormData = z.infer<typeof schema>

export function CreateRoomDialog() {
  const [open, setOpen] = useState(false)
  const { mutateAsync, isPending } = useCreateRoom()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    await mutateAsync(data.name)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="font-bold text-black">
            <Plus className="mr-2 h-4 w-4" />
            Crear sala
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nueva sala</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="room-name">Nombre de la sala</Label>
            <Input id="room-name" placeholder="Amigos 2026" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full font-bold text-black" disabled={isPending}>
            {isPending ? 'Creando...' : 'Crear'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
