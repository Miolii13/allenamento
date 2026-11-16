import type { Exercise, MuscleGroup } from '../db/types';

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  petto: 'Petto',
  schiena: 'Schiena',
  spalle: 'Spalle',
  bicipiti: 'Bicipiti',
  tricipiti: 'Tricipiti',
  quadricipiti: 'Quadricipiti',
  femorali: 'Femorali',
  glutei: 'Glutei',
  adduttori: 'Adduttori',
  polpacci: 'Polpacci',
  addome: 'Addome',
  altro: 'Altro',
};

/** Muscolo principale degli esercizi iniziali: vale finché non ne scegli uno nella pagina dell'esercizio. */
const DEFAULT_MUSCLE: Record<string, MuscleGroup> = {
  'alzate-laterali-seduto': 'spalle',
  'spinte-smith-45': 'petto',
  't-bar': 'schiena',
  'pec-fly': 'petto',
  trazioni: 'schiena',
  'curl-manubri-45': 'bicipiti',
  'french-manubri-45': 'tricipiti',
  'hammer-curl': 'bicipiti',
  'pushdown-triangolo': 'tricipiti',
  'rdl-manubri': 'femorali',
  'squat-smith': 'quadricipiti',
  'pressa-45-singola': 'quadricipiti',
  'leg-extension': 'quadricipiti',
  adductor: 'adduttori',
  'leg-curl-sdraiato': 'femorali',
  'polpacci-perfect-squat': 'polpacci',
  'alzate-laterali-cavo': 'spalle',
  'spinte-manubri-30': 'petto',
  'lat-machine-trazy': 'schiena',
  dip: 'petto',
  'pulley-singolo': 'schiena',
  'shoulder-press-deadstop': 'spalle',
  'curl-ez': 'bicipiti',
  'french-vulken': 'tricipiti',
};

export function muscleOf(exercise: Exercise | undefined): MuscleGroup {
  if (!exercise) return 'altro';
  return exercise.muscle ?? DEFAULT_MUSCLE[exercise.id] ?? 'altro';
}
