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
import { KeyRound } from 'lucide-react'
import { useJoinRoom } from '@/hooks/useRooms'

const schema = z.object({
  inviteCode: z.string().min(1, 'Ingresa el código'),
})
type FormData = z.infer<typeof schema>

export function JoinRoomDialog() {
  const [open, setOpen] = useState(false)
  const { mutateAsync, isPending } = useJoinRoom()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    await mutateAsync(data.inviteCode)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-primary/50 text-primary">
            <KeyRound className="mr-2 h-4 w-4" />
            Unirse con código
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unirse a una sala</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="code">Código de invitación</Label>
            <Input
              id="code"
              placeholder="AB3X9K"
              className="uppercase tracking-widest"
              {...register('inviteCode')}
            />
            {errors.inviteCode && (
              <p className="text-xs text-destructive">{errors.inviteCode.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full font-bold text-black" disabled={isPending}>
            {isPending ? 'Uniéndose...' : 'Unirse'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
