'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/lib/auth-store'
import {
  Home, Calendar, User, Moon, Sun, Shield,
  ChevronRight, ChevronLeft, Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const userLinks = [
  { href: '/', icon: Home, label: 'Inicio', exact: true },
  { href: '/matches', icon: Calendar, label: 'Partidos', exact: false },
  { href: '/profile', icon: User, label: 'Perfil', exact: false },
]

const adminLinks = [
  { href: '/admin/matches', icon: Shield, label: 'Admin', exact: false },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar-expanded')
    if (saved === 'true') setExpanded(true)
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem('sidebar-expanded', String(expanded))
  }, [expanded, mounted])

  const links = [
    ...userLinks,
    ...(user?.role === 'ADMIN' ? adminLinks : []),
  ]

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background transition-all duration-200 ease-in-out',
        expanded ? 'w-[220px]' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-lime-700">
          <Trophy className="h-4 w-4 text-white" />
        </div>
        {expanded && (
          <span className="ml-2 truncate font-bold text-sm">SureShot</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-hidden p-2">
        {links.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                !expanded && 'justify-center'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col gap-1 border-t p-2">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              !expanded && 'justify-center'
            )}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )}
            {expanded && (
              <span>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
            )}
          </button>
        )}
        <button
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            !expanded && 'justify-center'
          )}
        >
          {expanded ? (
            <ChevronLeft className="h-5 w-5 shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0" />
          )}
          {expanded && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  )
}
