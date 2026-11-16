import type { Exercise } from '../db/types';
import { useSettings } from '../db/repo';

export function ExerciseTags({ exercise }: { exercise: Exercise }) {
  const settings = useSettings();
  const group = exercise.equipmentId ? settings?.equipment.find((g) => g.id === exercise.equipmentId) : undefined;
  return (
    <span className="tags">
      {group && <span className="tag accent">{group.name}</span>}
      {exercise.loadType === 'dumbbell' && <span className="tag">Manubri</span>}
      {exercise.loadType === 'bodyweight' && <span className="tag">Corpo libero</span>}
    </span>
  );
}
