/**
 * Seed do banco de dados — Espaço Cativar Pilates
 *
 *  - Cria (se não existir) o administrador padrão:
 *      usuário: adm   |  e-mail: adm@espacocativar.com.br  |  senha: pilates2026  |  perfil: ADMIN
 *  - Popula a biblioteca de exercícios por aparelho.
 *  - Se SEED_DEMO !== "false" e não houver pacientes, cria dados de demonstração.
 *
 * Idempotente: pode ser executado várias vezes sem duplicar dados nem sobrescrever
 * a senha do administrador caso ela já tenha sido alterada.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, startOfWeek, studioDate, todayStr, toDateStr } from '../src/lib/dates';
import { generateSessions } from '../src/lib/scheduling';
import { dueDateFor } from '../src/lib/payments';

const prisma = new PrismaClient();

const ADMIN = {
  username: 'adm',
  email: 'adm@espacocativar.com.br',
  password: 'pilates2026',
  name: 'Administrador',
};

const EXERCISES: Record<string, string[]> = {
  REFORMER: ['Footwork', 'Hundred', 'Short Box Series', 'Long Stretch', 'Elephant', 'Knee Stretches', 'Rowing', 'Feet in Straps'],
  CADILLAC: ['Roll Down Bar', 'Leg Springs', 'Arm Springs', 'Tower', 'Breathing', 'Monkey'],
  CHAIR: ['Footwork na Chair', 'Pumping', 'Mountain Climb', 'Swan na Chair', 'Tendon Stretch'],
  BARREL: ['Swan no Barrel', 'Side Sit-ups', 'Horseback', 'Short Box no Barrel'],
  MAT: ['Roll Up', 'Single Leg Stretch', 'Spine Stretch Forward', 'Saw', 'Swimming', 'Side Kick Series', 'Ponte (Bridge)', 'Cat Stretch'],
  BALL: ['Ponte na bola', 'Roll out na bola', 'Abdominal na bola', 'Extensão de tronco na bola'],
  ACCESSORIES: ['Magic Circle — adução', 'Theraband — rotação externa', 'Foam roller — mobilidade torácica'],
  PHYSIO: ['Alongamento de cadeia posterior', 'Fortalecimento de glúteo médio', 'Estabilização escapular', 'Mobilização lombar'],
};

async function main() {
  // ---------- Administrador ----------
  const admin = await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { role: 'ADMIN', username: ADMIN.username },
    create: {
      name: ADMIN.name,
      email: ADMIN.email,
      username: ADMIN.username,
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN.password, 12),
    },
  });
  console.log(`✔ Administrador: ${admin.username} / ${admin.email}`);

  // ---------- Biblioteca de exercícios ----------
  for (const [apparatus, names] of Object.entries(EXERCISES)) {
    for (const name of names) {
      await prisma.exercise.upsert({
        where: { name_apparatus: { name, apparatus } },
        update: {},
        create: { name, apparatus },
      });
    }
  }
  console.log('✔ Biblioteca de exercícios');

  if (process.env.SEED_DEMO === 'false') return;
  if ((await prisma.patient.count()) > 0) {
    console.log('• Pacientes já existem — dados de demonstração ignorados.');
    return;
  }

  // ---------- Dados de demonstração ----------
  const today = todayStr();
  const [y, m] = today.split('-').map(Number) as [number, number];

  const maria = await prisma.patient.create({
    data: {
      fullName: 'Maria Fernanda Souza',
      email: 'maria@exemplo.com',
      phone: '(11) 98888-1111',
      birthDate: studioDate('1988-04-12', '12:00'),
      profession: 'Arquiteta',
      medicalHistory: 'Lombalgia crônica. Hérnia discal L4-L5 (2022).',
      goals: 'Reduzir dor lombar e melhorar postura no trabalho.',
      plan: 'Pilates 2x/semana',
      monthlyFee: 380,
      dueDay: 10,
      user: {
        create: {
          name: 'Maria Fernanda Souza',
          email: 'maria@exemplo.com',
          role: 'PATIENT',
          passwordHash: await bcrypt.hash('paciente123', 12),
        },
      },
    },
  });
  const joao = await prisma.patient.create({
    data: {
      fullName: 'João Pedro Almeida', phone: '(11) 97777-2222', plan: 'Pilates 2x/semana', monthlyFee: 380, dueDay: 5,
      medicalHistory: 'Pós-operatório de LCA joelho direito (8 meses).', goals: 'Fortalecimento e retorno à corrida.',
    },
  });
  const ana = await prisma.patient.create({
    data: {
      fullName: 'Ana Beatriz Lima', phone: '(11) 96666-3333', plan: 'Pilates 3x/semana', monthlyFee: 480, dueDay: 15,
      goals: 'Condicionamento e flexibilidade.',
    },
  });
  const carlos = await prisma.patient.create({
    data: { fullName: 'Carlos Eduardo Ramos', phone: '(11) 95555-4444', plan: 'Fisioterapia 1x/semana', monthlyFee: 320, dueDay: 20 },
  });

  const monday = startOfWeek(today);
  const morning = await prisma.classGroup.create({
    data: {
      name: 'Pilates Aparelho — Manhã', modality: 'PILATES_APARELHO', weekdays: '1,3', startTime: '08:00',
      durationMin: 50, capacity: 3, instructor: 'Dra. Fisioterapeuta', startDate: studioDate(monday),
      enrollments: { create: [{ patientId: maria.id }, { patientId: joao.id }] },
    },
  });
  const evening = await prisma.classGroup.create({
    data: {
      name: 'Pilates Aparelho — Noite', modality: 'PILATES_APARELHO', weekdays: '2,4,5', startTime: '18:30',
      durationMin: 50, capacity: 4, instructor: 'Dra. Fisioterapeuta', startDate: studioDate(monday),
      enrollments: { create: [{ patientId: ana.id }, { patientId: maria.id }] },
    },
  });
  const physio = await prisma.classGroup.create({
    data: {
      name: 'Fisioterapia individual', modality: 'FISIOTERAPIA', weekdays: '2', startTime: '10:00',
      durationMin: 60, capacity: 1, startDate: studioDate(monday),
      enrollments: { create: [{ patientId: carlos.id }] },
    },
  });
  // Semana atual (inclui dias passados, para histórico) + 4 semanas.
  for (const g of [morning, evening, physio]) await generateSessions(prisma, g.id, addDays(monday, -7), 6);

  // Aulas passadas: presença validada (com algumas faltas).
  const past = await prisma.booking.findMany({ where: { session: { endsAt: { lt: new Date() } } }, orderBy: { id: 'asc' } });
  for (const [i, b] of past.entries()) {
    await prisma.booking.update({
      where: { id: b.id },
      data: i % 5 === 3 ? { status: 'ABSENT', validatedAt: new Date() } : { status: 'ATTENDED', validatedAt: new Date() },
    });
  }

  // Mensalidades
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  for (const p of [maria, joao, ana, carlos]) {
    await prisma.payment.create({
      data: {
        patientId: p.id, year: prev.y, month: prev.m, amount: p.monthlyFee, dueDate: dueDateFor(prev.y, prev.m, p.dueDay),
        status: p.id === carlos.id ? 'LATE' : 'PAID', paidAt: p.id === carlos.id ? null : dueDateFor(prev.y, prev.m, p.dueDay), method: 'PIX',
      },
    });
  }
  await prisma.payment.create({
    data: { patientId: maria.id, year: y, month: m, amount: 380, dueDate: dueDateFor(y, m, 10), status: 'PAID', paidAt: new Date(), method: 'PIX' },
  });

  // Prontuário
  await prisma.evolutionRecord.createMany({
    data: [
      {
        patientId: maria.id, authorId: admin.id, date: studioDate(addDays(today, -7), '12:00'), painLevel: 6, painLocation: 'Lombar',
        evolutionNotes: 'Avaliação inicial. Dor lombar ao permanecer sentada por longos períodos.',
        posturalAssessment: 'Hiperlordose lombar, anteriorização de cabeça, ombros protusos.',
        observations: 'Evitar flexão de tronco com carga nas primeiras semanas.',
        patientGuidance: 'Faça pausas a cada 1h no trabalho e o alongamento de gato (Cat Stretch) 2x ao dia.',
      },
      {
        patientId: maria.id, authorId: admin.id, date: studioDate(addDays(today, -2), '12:00'), painLevel: 4, painLocation: 'Lombar',
        evolutionNotes: 'Boa execução do Footwork e Bridge. Melhora da consciência de centro (powerhouse).',
        patientGuidance: 'Continue com a respiração lateral antes de dormir. Ótima evolução!',
      },
    ],
  });
  await prisma.prescription.create({
    data: {
      patientId: maria.id, title: 'Estabilização lombar — fase 1', frequency: '2x por semana no estúdio + casa 3x',
      homeGuidance: 'Em casa: ponte, cat stretch e respiração diafragmática. Pare se a dor passar de 5/10.',
      items: {
        create: [
          { apparatus: 'REFORMER', exerciseName: 'Footwork', sets: 2, reps: '10', load: '3 molas vermelhas', order: 0 },
          { apparatus: 'REFORMER', exerciseName: 'Feet in Straps', sets: 1, reps: '8', load: '2 molas', order: 1 },
          { apparatus: 'CADILLAC', exerciseName: 'Roll Down Bar', sets: 1, reps: '6', load: 'mola amarela', order: 2 },
          { apparatus: 'MAT', exerciseName: 'Ponte (Bridge)', sets: 3, reps: '12', notes: 'Manter pelve neutra', order: 3 },
          { apparatus: 'MAT', exerciseName: 'Cat Stretch', sets: 2, reps: '8', order: 4 },
          { apparatus: 'BALL', exerciseName: 'Ponte na bola', sets: 2, reps: '10', order: 5 },
        ],
      },
    },
  });

  console.log(`✔ Dados de demonstração (paciente demo: maria@exemplo.com / paciente123) — ${toDateStr(new Date())}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
