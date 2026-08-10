import type { DayOfWeek, Equipment, MovementType } from '../types';

export const EQUIPMENT_OPTIONS: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];

export const MOVEMENT_OPTIONS: MovementType[] = [
  'push',
  'pull',
  'squat',
  'hinge',
  'carry',
  'core',
  'isolation',
];

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabel(day: DayOfWeek): string {
  if (day === null || day === undefined) return 'Any day';
  return DAY_NAMES[day] ?? 'Any day';
}
