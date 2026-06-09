// Frontend/types/api.ts

export type Role = 'USER' | 'ADMIN'
export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED'
export type MatchStage =
  | 'GROUP'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'FINAL'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  googleId?: string
  role: Role
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: string
  name: string
  inviteCode: string
  ownerId: string
  createdAt: string
}

export interface RoomMember {
  id: string
  roomId: string
  userId: string
  joinedAt: string
  user: { id: string; name: string; avatar?: string }
}

export interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  matchDatetime: string
  homeScore: number | null
  awayScore: number | null
  status: MatchStatus
  stage: MatchStage
  group?: string
}

export interface Prediction {
  id: string
  userId: string
  matchId: string
  roomId: string
  homeScore: number
  awayScore: number
  isEarlyBonus: boolean
  submittedAt: string
}

export interface LeaderboardEntry {
  user: { id: string; name: string; avatar?: string }
  totalPoints: number
  basePoints: number
  earlyBonuses: number
  streakBonus: number
  predictionsCount: number
}

export interface ApiError {
  error: { code: string; message: string; details: unknown[] }
}

// Respuestas de auth
export interface AuthResponse {
  accessToken: string
  user: User
}
