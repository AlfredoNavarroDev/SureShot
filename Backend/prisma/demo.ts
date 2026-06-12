/**
 * Demo script — all 5 scoring rules + 3 match states for recording.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/demo.ts
 *
 * Requires seed.ts first.
 *
 * Sets existing matches to:
 *   FINISHED  — Argentina 2-1 Perú, Francia 3-0 Suiza, Alemania 2-0 Portugal, Italia 1-1 Ucrania
 *   IN_PROGRESS — México vs Ecuador (no score yet, shows live state)
 *   SCHEDULED — everything else (68 matches, free to predict)
 *
 * Creates:
 *   3 users: alice@demo.com, bob@demo.com, carlos@demo.com (password: Demo1234!)
 *   1 room:  "Demo SureShot" (invite: DEMO2026)
 *
 * Expected leaderboard:
 *   1. Alice   — 15 pts (5+3+5 base + 2 racha)
 *   2. Carlos  — 12 pts (5+5 base + 2 early bonus)
 *   3. Bob     — 11 pts (3+3+3+0 base + 2 racha)
 *
 * For recording: register diana@demo.com live to show join-room flow.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, MatchStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const FINISHED_PAIRS = [
  { homeTeam: 'Argentina', awayTeam: 'Perú' },
  { homeTeam: 'Francia',   awayTeam: 'Suiza' },
  { homeTeam: 'Alemania',  awayTeam: 'Portugal' },
  { homeTeam: 'Italia',    awayTeam: 'Ucrania' },
];

const INPROGRESS_PAIRS = [
  { homeTeam: 'México', awayTeam: 'Ecuador' },
];

async function getMatch(homeTeam: string, awayTeam: string) {
  const m = await prisma.match.findFirst({ where: { homeTeam, awayTeam } });
  if (!m) throw new Error(`Partido no encontrado: ${homeTeam} vs ${awayTeam}. Ejecuta seed primero.`);
  return m;
}

async function main() {
  console.log('\n🎯 SureShot — Demo setup\n');

  // ─── Limpiar datos demo anteriores ───────────────────────────────────────
  await prisma.prediction.deleteMany({ where: { user: { email: { endsWith: '@demo.com' } } } });
  await prisma.roomMember.deleteMany({ where: { user: { email: { endsWith: '@demo.com' } } } });
  await prisma.room.deleteMany({ where: { inviteCode: 'DEMO2026' } });

  // Reset all demo-modified matches back to SCHEDULED
  for (const { homeTeam, awayTeam } of [...FINISHED_PAIRS, ...INPROGRESS_PAIRS]) {
    await prisma.match.updateMany({
      where: { homeTeam, awayTeam },
      data: { status: MatchStatus.SCHEDULED, homeScore: null, awayScore: null },
    });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: '@demo.com' } } });

  // ─── Usuarios ─────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Demo1234!', 12);
  const [alice, bob, carlos] = await Promise.all([
    prisma.user.create({ data: { email: 'alice@demo.com',  name: 'Alice',  password: hash } }),
    prisma.user.create({ data: { email: 'bob@demo.com',   name: 'Bob',    password: hash } }),
    prisma.user.create({ data: { email: 'carlos@demo.com',name: 'Carlos', password: hash } }),
  ]);
  console.log('✓ Usuarios: alice@demo.com, bob@demo.com, carlos@demo.com  (Demo1234!)');

  // ─── Sala ─────────────────────────────────────────────────────────────────
  const room = await prisma.room.create({
    data: {
      name: 'Demo SureShot',
      inviteCode: 'DEMO2026',
      ownerId: alice.id,
      members: { create: [{ userId: alice.id }, { userId: bob.id }, { userId: carlos.id }] },
    },
  });
  console.log(`✓ Sala: "${room.name}" (invite: ${room.inviteCode})`);

  // ─── Partidos FINISHED ────────────────────────────────────────────────────
  const past = (daysAgo: number) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); return d;
  };

  const [m1Raw, m2Raw, m3Raw, m4Raw] = await Promise.all(
    FINISHED_PAIRS.map(({ homeTeam, awayTeam }) => getMatch(homeTeam, awayTeam))
  );

  const [m1, m2, m3, m4] = await Promise.all([
    prisma.match.update({ where: { id: m1Raw.id }, data: { matchDatetime: past(5), homeScore: 2, awayScore: 1, status: MatchStatus.FINISHED } }),
    prisma.match.update({ where: { id: m2Raw.id }, data: { matchDatetime: past(4), homeScore: 3, awayScore: 0, status: MatchStatus.FINISHED } }),
    prisma.match.update({ where: { id: m3Raw.id }, data: { matchDatetime: past(3), homeScore: 2, awayScore: 0, status: MatchStatus.FINISHED } }),
    prisma.match.update({ where: { id: m4Raw.id }, data: { matchDatetime: past(2), homeScore: 1, awayScore: 1, status: MatchStatus.FINISHED } }),
  ]);
  console.log('✓ Partidos FINISHED: Argentina 2-1 Perú · Francia 3-0 Suiza · Alemania 2-0 Portugal · Italia 1-1 Ucrania');

  // ─── Partido IN_PROGRESS ──────────────────────────────────────────────────
  const m5Raw = await getMatch('México', 'Ecuador');
  const m5 = await prisma.match.update({
    where: { id: m5Raw.id },
    data: { matchDatetime: past(0), status: MatchStatus.IN_PROGRESS },
  });
  console.log('✓ Partido IN_PROGRESS: México vs Ecuador');

  // ─── Predicciones ─────────────────────────────────────────────────────────
  await prisma.prediction.createMany({
    data: [
      // ALICE — reglas 1, 2, 3 + racha
      { userId: alice.id, roomId: room.id, matchId: m1.id, homeScore: 2, awayScore: 1, isEarlyBonus: false }, // R1: exacto → 5pts
      { userId: alice.id, roomId: room.id, matchId: m2.id, homeScore: 2, awayScore: 1, isEarlyBonus: false }, // R2: ganador → 3pts
      { userId: alice.id, roomId: room.id, matchId: m3.id, homeScore: 3, awayScore: 1, isEarlyBonus: false }, // R3: diff=2 → 5pts
      // 3 consecutivas → racha → +2pts. Total: 5+3+5+2 = 15 pts
      { userId: alice.id, roomId: room.id, matchId: m5.id, homeScore: 2, awayScore: 0, isEarlyBonus: true  }, // partido en vivo (predicción previa)

      // BOB — regla 4 (racha) + fallo
      { userId: bob.id, roomId: room.id, matchId: m1.id, homeScore: 2, awayScore: 0, isEarlyBonus: false }, // R2 → 3pts
      { userId: bob.id, roomId: room.id, matchId: m2.id, homeScore: 2, awayScore: 0, isEarlyBonus: false }, // R2 → 3pts
      { userId: bob.id, roomId: room.id, matchId: m3.id, homeScore: 1, awayScore: 0, isEarlyBonus: false }, // R2 → 3pts
      { userId: bob.id, roomId: room.id, matchId: m4.id, homeScore: 0, awayScore: 1, isEarlyBonus: false }, // error → 0pts
      // 3 consecutivas → racha → +2pts. Total: 3+3+3+0+2 = 11 pts

      // CARLOS — regla 5 (early bonus)
      { userId: carlos.id, roomId: room.id, matchId: m1.id, homeScore: 2, awayScore: 1, isEarlyBonus: true }, // R1+R5 → 6pts
      { userId: carlos.id, roomId: room.id, matchId: m4.id, homeScore: 1, awayScore: 1, isEarlyBonus: true }, // R1+R5 → 6pts
      // Total: 10+2 = 12 pts
    ],
  });
  console.log('✓ Predicciones creadas');

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LEADERBOARD ESPERADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Alice   — 15 pts  (base:13 + racha:+2)');
  console.log('   • M1: predice 2-1 | resultado 2-1  → EXACTO     → 5 pts  [Regla 1]');
  console.log('   • M2: predice 2-1 | resultado 3-0  → GANADOR    → 3 pts  [Regla 2]');
  console.log('   • M3: predice 3-1 | resultado 2-0  → DIFF=2=2   → 5 pts  [Regla 3]');
  console.log('   • 3 consecutivas correctas                       → +2 pts [Regla 4]');
  console.log('   • M5: predice 2-0 | EN JUEGO       → pendiente');
  console.log('');
  console.log('2. Carlos  — 12 pts  (base:10 + early:+2)');
  console.log('   • M1: predice 2-1 | resultado 2-1  → EXACTO     → 5 pts  [Regla 1]');
  console.log('   • M4: predice 1-1 | resultado 1-1  → EXACTO     → 5 pts  [Regla 1]');
  console.log('   • Ambas registradas >24h antes                   → +2 pts [Regla 5]');
  console.log('');
  console.log('3. Bob     — 11 pts  (base:9 + racha:+2)');
  console.log('   • M1: predice 2-0 | resultado 2-1  → GANADOR    → 3 pts  [Regla 2]');
  console.log('   • M2: predice 2-0 | resultado 3-0  → GANADOR    → 3 pts  [Regla 2]');
  console.log('   • M3: predice 1-0 | resultado 2-0  → GANADOR    → 3 pts  [Regla 2]');
  console.log('   • 3 consecutivas correctas                       → +2 pts [Regla 4]');
  console.log('   • M4: predice 0-1 | resultado 1-1  → ERROR      → 0 pts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 GUIÓN DE GRABACIÓN:');
  console.log('   1. REGISTRO  → localhost:3001/register → diana@demo.com / Demo1234!');
  console.log('   2. DASHBOARD → sala vacía, sin predicciones');
  console.log('   3. UNIRSE    → código DEMO2026 → entra a "Demo SureShot"');
  console.log('   4. LEADERBOARD → Alice 15, Carlos 12, Bob 11');
  console.log('   5. PREDICCIONES → ver partidos finalizados + México EN JUEGO (bloqueado)');
  console.log('   6. HACER PREDICCIÓN → elegir partido SCHEDULED (España vs Dinamarca, etc.)');
  console.log('   7. [Nueva tab] login alice@demo.com → dashboard con stats');
  console.log('   8. [Nueva tab] login admin@sureshot.com → admin/matches');
  console.log(`\n🔗 GET /api/v1/rooms/${room.id}/leaderboard\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
