import type { Transaction } from 'dexie';
import type { EquipmentGroup, Exercise, LoadType, Program, Template, TemplateItem, TemplateSet } from './types';
import { DEFAULT_PROGRAM_ID } from './constants';

export const DEFAULT_EQUIPMENT: EquipmentGroup[] = [
  {
    id: 'smith',
    name: 'Smith machine',
    question: 'Quale Smith machine hai usato?',
    variants: [
      { id: 'smith-1', name: 'Smith 1', equiv: 50 },
      { id: 'smith-2', name: 'Smith 2', equiv: 45 },
    ],
  },
  {
    id: 'cable',
    name: 'Cavi',
    question: 'Quale cavo hai usato?',
    variants: [
      { id: 'cable-1', name: 'Cavo 1', equiv: 9 },
      { id: 'cable-2', name: 'Cavo 2', equiv: 4.5 },
    ],
  },
];

type SeedExercise = [id: string, name: string, loadType: LoadType, equipmentId?: string, notes?: string];

const EXERCISES: SeedExercise[] = [
  // Upper 1
  ['alzate-laterali-seduto', 'Alzate laterali da seduto', 'dumbbell'],
  ['spinte-smith-45', 'Spinte Smith machine panca 45°', 'standard', 'smith'],
  ['t-bar', 'T-bar machine', 'standard'],
  ['pec-fly', 'Pec fly', 'standard'],
  ['trazioni', 'Trazioni', 'bodyweight'],
  ['curl-manubri-45', 'Curl manubri panca 45°', 'dumbbell'],
  ['french-manubri-45', 'French press manubri panca 45°', 'dumbbell'],
  ['hammer-curl', 'Hammer curl manubri in piedi', 'dumbbell'],
  ['pushdown-triangolo', 'Push down triangolo', 'standard', 'cable'],
  // Lower
  ['rdl-manubri', 'RDL manubri', 'dumbbell'],
  ['squat-smith', 'Squat Smith machine', 'standard', 'smith'],
  ['pressa-45-singola', 'Pressa 45° gamba singola', 'standard', undefined, 'Ripetizioni per gamba'],
  ['leg-extension', 'Leg extension', 'standard'],
  ['adductor', 'Adductor machine', 'standard'],
  ['leg-curl-sdraiato', 'Leg curl sdraiato', 'standard'],
  ['polpacci-perfect-squat', 'Polpacci al perfect squat', 'standard'],
  // Upper 2
  ['alzate-laterali-cavo', 'Alzate laterali al cavo singolo', 'standard', 'cable'],
  ['spinte-manubri-30', 'Spinte manubri panca 30°', 'dumbbell'],
  ['lat-machine-trazy', 'Lat machine con Trazy bar', 'standard'],
  ['dip', 'Dip', 'bodyweight'],
  ['pulley-singolo', 'Pulley braccio singolo', 'standard', undefined, 'Ripetizioni per braccio'],
  ['shoulder-press-deadstop', 'Shoulder press con deadstop', 'standard'],
  ['curl-ez', 'Curl bilanciere EZ', 'standard'],
  ['french-vulken', 'French press vulken', 'standard'],
];

const work = (count: number, reps: string, note?: string): TemplateSet[] =>
  Array.from({ length: count }, () => ({ type: 'work' as const, reps, ...(note ? { note } : {}) }));
const drop = (reps: string): TemplateSet => ({ type: 'drop', reps });
const myo = (count: number, reps: string): TemplateSet[] =>
  Array.from({ length: count }, () => ({ type: 'myo' as const, reps }));

let itemCounter = 0;
const item = (exerciseId: string, sets: TemplateSet[], extra: Partial<TemplateItem> = {}): TemplateItem => ({
  id: `seed-item-${++itemCounter}`,
  exerciseId,
  sets,
  ...extra,
});

function seedTemplates(now: number): Template[] {
  return [
    {
      id: 'upper-1',
      programId: DEFAULT_PROGRAM_ID,
      name: 'Upper 1',
      order: 1,
      createdAt: now,
      updatedAt: now,
      items: [
        item('alzate-laterali-seduto', work(3, '8-10')),
        item('spinte-smith-45', [...work(2, '5-7'), ...work(1, '8-10', 'back-off')]),
        item('t-bar', [...work(2, '6-8'), ...work(1, '10-12', 'back-off')]),
        item('pec-fly', work(2, '10-12')),
        item('trazioni', work(3, 'max')),
        item('curl-manubri-45', work(2, '6-8'), { superset: 'A' }),
        item('french-manubri-45', work(2, '6-8'), { superset: 'A' }),
        item('hammer-curl', work(2, '6-8'), { superset: 'B' }),
        item('pushdown-triangolo', work(2, '6-8'), { superset: 'B' }),
      ],
    },
    {
      id: 'lower',
      programId: DEFAULT_PROGRAM_ID,
      name: 'Lower',
      order: 2,
      createdAt: now,
      updatedAt: now,
      items: [
        item('rdl-manubri', work(2, '6-8')),
        item('squat-smith', [...work(2, '5-7'), ...work(1, '10-12', 'back-off')]),
        item('pressa-45-singola', work(2, '8-10')),
        item('leg-extension', [...work(1, '10'), ...myo(4, '3-5')], {
          notes: 'Myo reps: serie di attivazione + 4 mini-serie',
        }),
        item('adductor', work(2, '6-8')),
        item('leg-curl-sdraiato', work(2, '6-8')),
        item('polpacci-perfect-squat', work(3, '8-10')),
      ],
    },
    {
      id: 'upper-2',
      programId: DEFAULT_PROGRAM_ID,
      name: 'Upper 2',
      order: 3,
      createdAt: now,
      updatedAt: now,
      items: [
        item('alzate-laterali-cavo', work(2, '8-10')),
        item('spinte-manubri-30', work(2, '6-8')),
        item('lat-machine-trazy', work(3, '7-9')),
        item('dip', work(3, 'max')),
        item('pulley-singolo', [...work(1, '8'), drop('8'), ...work(1, '8'), drop('8')], { notes: 'Dropset' }),
        item('shoulder-press-deadstop', work(2, '6-8')),
        item('curl-ez', work(2, '6-8')),
        item('french-vulken', work(2, '6-8')),
      ],
    },
  ];
}

export async function seedDatabase(tx: Transaction): Promise<void> {
  const now = Date.now();
  const exercises: Exercise[] = EXERCISES.map(([id, name, loadType, equipmentId, notes]) => ({
    id,
    name,
    loadType,
    createdAt: now,
    ...(equipmentId ? { equipmentId } : {}),
    ...(notes ? { notes } : {}),
  }));
  await tx.table('settings').put({ id: 'settings', equipment: DEFAULT_EQUIPMENT });
  await tx.table('exercises').bulkAdd(exercises);
  const program: Program = { id: DEFAULT_PROGRAM_ID, name: 'La mia scheda', order: 1, createdAt: now, updatedAt: now };
  await tx.table('programs').add(program);
  await tx.table('templates').bulkAdd(seedTemplates(now));
}
