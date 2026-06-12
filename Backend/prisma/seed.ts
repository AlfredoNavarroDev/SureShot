import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GROUPS: Record<string, [string, string, string, string]> = {
  A: ['México', 'Ecuador', 'Canadá', 'Jamaica'],
  B: ['Estados Unidos', 'Uruguay', 'Bolivia', 'Camerún'],
  C: ['Brasil', 'Colombia', 'Honduras', 'Marruecos'],
  D: ['Argentina', 'Perú', 'Australia', 'Arabia Saudita'],
  E: ['Francia', 'Suiza', 'Japón', 'Guinea'],
  F: ['España', 'Dinamarca', 'Serbia', 'Corea del Sur'],
  G: ['Alemania', 'Portugal', 'Costa Rica', 'Ghana'],
  H: ['Inglaterra', 'Senegal', 'Paraguay', 'Nueva Zelanda'],
  I: ['Países Bajos', 'Turquía', 'Panamá', 'Costa de Marfil'],
  J: ['Bélgica', 'Croacia', 'Argelia', 'Kenia'],
  K: ['Italia', 'Ucrania', 'Irán', 'Venezuela'],
  L: ['Polonia', 'Chequia', 'Chile', 'DR Congo'],
};

// Round-robin pairs for 4 teams: (0,1)(2,3)(0,2)(1,3)(0,3)(1,2)
const PAIRS: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

// Group stage: Jun 12–27 2026, ~4 matches/day spread across 18 days
function groupMatchDate(groupIndex: number, matchIndex: number): Date {
  const slot = groupIndex * 6 + matchIndex;
  const dayOffset = Math.floor(slot / 4);
  const hourOffset = (slot % 4) * 3;
  const d = new Date('2026-06-12T15:00:00Z');
  d.setDate(d.getDate() + dayOffset);
  d.setHours(d.getHours() + hourOffset);
  return d;
}

async function main() {
  console.log('Seeding database...');

  // Admin user
  const hashedPassword = await bcrypt.hash('Admin1234!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@sureshot.com' },
    update: {},
    create: {
      email: 'admin@sureshot.com',
      name: 'Administrador',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('✓ Admin: admin@sureshot.com / Admin1234!');

  // Group stage matches (72 total: 12 groups × 6 matches)
  const groupEntries = Object.entries(GROUPS);
  let count = 0;

  for (let gi = 0; gi < groupEntries.length; gi++) {
    const [groupLetter, teams] = groupEntries[gi];
    for (let pi = 0; pi < PAIRS.length; pi++) {
      const [a, b] = PAIRS[pi];
      await prisma.match.create({
        data: {
          homeTeam: teams[a],
          awayTeam: teams[b],
          matchDatetime: groupMatchDate(gi, pi),
          stage: 'GROUP',
          group: groupLetter,
          status: 'SCHEDULED',
        },
      });
      count++;
    }
  }

  console.log(`✓ ${count} partidos de fase de grupos creados`);
  console.log('Seed completo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
