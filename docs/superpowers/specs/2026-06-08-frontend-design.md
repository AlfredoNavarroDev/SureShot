# SureShot Frontend — Design Spec

**Date:** 2026-06-08
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Magic UI · React Query · Zustand
**Scope:** Frontend completo — flujo USER + panel ADMIN

---

## 1. Context

World Cup prediction app. Frontend consume la REST API del backend NestJS. Dos roles:
- **USER:** se une a salas privadas, predice resultados, ve leaderboard
- **ADMIN:** gestiona partidos y carga resultados

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| Componentes | shadcn/ui + Magic UI (`npx @magicuidesign/cli@latest install`) |
| Estado global | Zustand (auth store) |
| Data fetching | TanStack React Query v5 |
| Forms | react-hook-form + zod |
| HTTP | Axios + interceptor de refresh |
| Temas | next-themes (dark / light toggle) |
| Notificaciones | Sonner (shadcn toast) |
| Icons | Lucide React (solid fill vía SVG directo) |

---

## 3. Diseño Visual

### Tema dark (default)
- Fondo: `#0f1117`
- Cards: `rgba(255,255,255,0.05)` con `backdrop-filter: blur(10px)` (glassmorphism)
- Borde cards: `rgba(255,255,255,0.10)`
- Acento primario: `#a3e635` (lime-400)
- Texto principal: `#f1f5f9`
- Texto secundario: `#475569`

### Tema light
- Fondo: `#f8fafc`
- Cards: `#ffffff` con `border: 2px solid #d1d5db`
- Cards destacadas: `#f0fdf4` con `border: 2px solid #4ade80`
- Acento primario: `#65a30d` (lime-700)
- Texto principal: `#111827`
- Texto secundario: `#9ca3af`

### Botones primarios
- Background: acento primario
- Texto: `#000000` (negro, no blanco)
- Border: 2px sólido tono más oscuro del acento

### Toggle de tema
- Ícono luna/sol en la parte inferior del sidebar
- Persistido en `localStorage` vía `next-themes`

---

## 4. Navegación — Sidebar colapsable

- **Collapsed:** 64px, solo íconos Lucide sólidos
- **Expanded:** 220px, íconos + texto, animación CSS `transition-width`
- Toggle: persistido en `localStorage`
- Links USER: **Inicio · Partidos · Perfil**
- Links ADMIN: sección adicional **Panel Admin** visible solo si `user.role === 'ADMIN'`
- Ícono tema (luna/sol) anclado al fondo del sidebar

---

## 5. Rutas

### Grupo público — `(auth)/` (sin sidebar)
```
/login
/register
```

### Grupo autenticado — `(app)/` (con sidebar, requiere JWT)
```
/                              → Home: stats globales + lista de salas
/rooms/[id]                   → Sala: tabs Predicciones / Leaderboard / Miembros
/rooms/[id]/predict/[matchId] → Formulario de predicción
/matches                      → Lista de partidos con filtros
/profile                      → Perfil de usuario (editar nombre/avatar)
```

### Grupo admin — `admin/` (guard de rol ADMIN)
```
/admin/matches                → Tabla CRUD de partidos
/admin/matches/new            → Crear partido
/admin/matches/[id]/edit      → Editar partido / cargar resultado
```

---

## 6. Pantallas clave

### Home (`/`)
- **Stats bar:** pts totales (verde) · predicciones · racha (naranja)
- **Lista de salas:** card por sala con nombre, posición actual y pts en esa sala
  - Sala activa/destacada: fondo verde suave + borde verde
- **Botones separados:** "Crear sala" (primario, texto negro) · "Unirse con código" (outline verde)

### Sala (`/rooms/[id]`)
Tres tabs:
1. **Predicciones:** lista de partidos del torneo con estado de predicción del usuario
   - Badge "✓ Predicho" (verde) · "⚡ Sin predecir" (amarillo) · "🔒 Cerrado" (gris)
   - Muestra el score predicho si ya predijo
2. **Leaderboard:** ranking con `totalPoints`, desglose `base + early + racha`
3. **Miembros:** lista de integrantes, botón kick (solo owner)

### Formulario de predicción (`/rooms/[id]/predict/[matchId]`)
- Score inputs grandes (número entero, mínimo 0)
- Badge "Early bonus disponible" si faltan más de 24h
- Botón deshabilitado si partido bloqueado (< 10 min)
- Validación client-side con zod antes de POST

### Partidos (`/matches`)
- Filtros pill: Todos · Programados · En juego · Finalizados · Fase de Grupos · Octavos · … · Final
- Card por partido: home vs away, score si hay, status badge, stage badge

### Admin — partidos (`/admin/matches`)
- Tabla: Partido · Fecha · Estado · Acciones
- Acción "Cargar resultado" en partidos `IN_PROGRESS`
- Acción "Editar" en cualquier estado

---

## 7. Auth Flow

**Email/password:**
1. `POST /auth/register` → recibe `{ accessToken, user }` → `setAuth()` → redirect `/`
2. `POST /auth/login` → igual

**Google OAuth:**
1. Frontend redirige a `GET /api/v1/auth/google` (manejado íntegramente por el backend)
2. Backend completa el OAuth y redirige al frontend a `/auth/callback?token=<accessToken>`
3. Página `/auth/callback` en el frontend: lee `token` del query param → `setAuth()` → redirect `/`

**Refresh:**
- Interceptor Axios: 401 → `POST /auth/refresh` (cookie HttpOnly automática) → retry
- Si refresh falla → `clear()` + redirect `/login`

**Guard:**
- `(app)/layout.tsx`: verifica `accessToken` en store; si no hay → redirect `/login`
- `admin/layout.tsx`: verifica además `user.role === 'ADMIN'`; si no → redirect `/`

---

## 8. Zustand Auth Store

```ts
interface AuthStore {
  accessToken: string | null
  user: { id: string; name: string; email: string; avatar?: string; role: 'USER' | 'ADMIN' } | null
  setAuth: (token: string, user: User) => void
  clear: () => void
}
```

Estado en memoria (no `localStorage`). Al recargar página → `POST /auth/refresh` en el layout raíz para rehidratar.

---

## 9. React Query — Hooks

| Hook | Endpoint | staleTime |
|---|---|---|
| `useRooms()` | `GET /rooms` | 30s |
| `useRoom(id)` | `GET /rooms/:id` | 30s |
| `useMatches(filters)` | `GET /matches?status&stage` | 60s |
| `usePredictions(roomId)` | `GET /rooms/:id/predictions` | 15s |
| `useLeaderboard(roomId)` | `GET /rooms/:id/leaderboard` | 30s, refetchOnWindowFocus |
| `useMe()` | `GET /users/me` | 5min |

**Mutations:** `createRoom`, `joinRoom`, `createPrediction`, `updatePrediction`, `createMatch`, `updateMatch` — invalidan queries relacionadas on success.

---

## 10. Error Handling

- Errores API: `error.response.data.error.code` → mensaje en español
- Códigos clave: `PREDICTION_LOCKED`, `MATCH_ALREADY_FINISHED`, `ROOM_NOT_FOUND`, `INVALID_INVITE_CODE`
- Toast global con Sonner para errores de mutations
- Validación client-side con `react-hook-form` + `zod` antes de cada POST/PATCH

---

## 11. Testing

- **Unit:** hooks con `renderHook` + MSW para mock de endpoints
- **e2e:** Playwright — flujo crítico: register → join sala → predict → ver leaderboard

---

## 12. Out of Scope

- Real-time WebSockets (leaderboard via polling)
- Notificaciones push
- Internacionalización (i18n)
- Mobile nativo (solo web responsive)
