import type { Exercise } from '../db/types';
import { useSettings } from '../db/repo';

export function ExerciseTags({ exercise }: { exercise: Exercise }) {
  const settings = useSettings();
  const group = exercise.equipmentId ? settings?.equipment.find((g) => g.id === exercise.equipmentId) : undefined;
  if (!group && exercise.loadType === 'standard') return null;
  return (
    <span className="chips">
      {group && <span className="chip warning">{group.name}</span>}
      {exercise.loadType === 'dumbbell' && <span className="chip">Manubri</span>}
      {exercise.loadType === 'bodyweight' && <span className="chip">Corpo libero</span>}
    </span>
  );
}
