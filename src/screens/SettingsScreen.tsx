import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, ErrorState, SelectField, Spinner, TextField } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { titleCase } from '../lib/labels';
import type { Goal, Sex, Units } from '../types';

const GOALS: Goal[] = ['cut', 'maintain', 'bulk', 'recomp', 'general'];
const SEXES: Sex[] = ['male', 'female', 'other', 'unspecified'];

export function SettingsScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const state = useAsync(async () => {
    const [settings, user] = await Promise.all([
      repository.getSettings(),
      repository.getCurrentUser(),
    ]);
    return { settings, user };
  }, []);

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;

  return (
    <>
      <ScreenHeader
        title="Settings"
        action={
          <Button variant="ghost" onClick={() => navigate('/more')}>
            Done
          </Button>
        }
      />
      <SettingsForm
        initialSettings={state.data.settings}
        initialName={state.data.user.name}
        saved={saved}
        onSaved={() => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
          state.reload();
        }}
      />
    </>
  );
}

function SettingsForm({
  initialSettings,
  initialName,
  saved,
  onSaved,
}: {
  initialSettings: import('../types').Settings;
  initialName: string;
  saved: boolean;
  onSaved: () => void;
}) {
  const repository = useRepository();
  const [name, setName] = useState(initialName);
  const [units, setUnits] = useState<Units>(initialSettings.units);
  const [goal, setGoal] = useState<Goal>(initialSettings.goal);
  const [sex, setSex] = useState<Sex>(initialSettings.sex);
  const [rest, setRest] = useState(String(initialSettings.default_rest_seconds));
  const [loadAlwaysGreen, setLoadAlwaysGreen] = useState(initialSettings.load_always_green);
  const [beatEnabled, setBeatEnabled] = useState(initialSettings.beat_comparison_enabled);
  const [beatLookback, setBeatLookback] = useState(String(initialSettings.beat_lookback_weeks));
  const [calories, setCalories] = useState(str(initialSettings.calorie_target));
  const [protein, setProtein] = useState(str(initialSettings.protein_target));
  const [carbs, setCarbs] = useState(str(initialSettings.carb_target));
  const [fat, setFat] = useState(str(initialSettings.fat_target));
  const [fiber, setFiber] = useState(str(initialSettings.fiber_target));
  const [height, setHeight] = useState(str(initialSettings.height));
  const [age, setAge] = useState(str(initialSettings.age));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await repository.updateUser({ name: name.trim() || 'Me' });
      await repository.updateSettings({
        units,
        theme: 'dark',
        goal,
        sex,
        default_rest_seconds: numOr(rest, 120),
        load_always_green: loadAlwaysGreen,
        beat_comparison_enabled: beatEnabled,
        beat_lookback_weeks: Math.min(52, Math.max(1, numOr(beatLookback, 3))),
        calorie_target: numOrNull(calories),
        protein_target: numOrNull(protein),
        carb_target: numOrNull(carbs),
        fat_target: numOrNull(fat),
        fiber_target: numOrNull(fiber),
        height: numOrNull(height),
        age: numOrNull(age),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <Section title="Profile">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          <TextField label="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <SelectField label="Sex" value={sex} onChange={(v) => setSex(v as Sex)}>
          {SEXES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </SelectField>
      </Section>

      <Section title="Units & goal">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Units" value={units} onChange={(v) => setUnits(v as Units)}>
            <option value="lbs">Pounds (lbs)</option>
            <option value="kg">Kilograms (kg)</option>
          </SelectField>
          <SelectField label="Goal" value={goal} onChange={(v) => setGoal(v as Goal)}>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {titleCase(g)}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section title="Daily macro targets">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
          <TextField label="Protein (g)" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
          <TextField label="Carbs (g)" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          <TextField label="Fat (g)" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
          <TextField label="Fiber (g)" type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} />
        </div>
      </Section>

      <Section title="Training">
        <TextField
          label="Default rest timer (seconds)"
          type="number"
          value={rest}
          onChange={(e) => setRest(e.target.value)}
        />
        <label className="flex items-center justify-between gap-3  border border-slate-800 bg-slate-900/50 p-3">
          <span className="text-sm">
            <span className="font-medium">Load always green</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Heavier weight always reads green (with honest e1RM in detail).
            </span>
          </span>
          <input
            type="checkbox"
            checked={loadAlwaysGreen}
            onChange={(e) => setLoadAlwaysGreen(e.target.checked)}
            className="h-5 w-5 accent-beat"
          />
        </label>

        <label className="flex items-center justify-between gap-3  border border-slate-800 bg-slate-900/50 p-3">
          <span className="text-sm">
            <span className="font-medium">Beat Last Time badge</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Show Beat / Matched / Down while logging. Turn off to just log.
            </span>
          </span>
          <input
            type="checkbox"
            checked={beatEnabled}
            onChange={(e) => setBeatEnabled(e.target.checked)}
            className="h-5 w-5 accent-beat"
          />
        </label>

        {beatEnabled && (
          <TextField
            label="Compare against your best of the last (weeks)"
            type="number"
            inputMode="numeric"
            min={1}
            max={52}
            value={beatLookback}
            onChange={(e) => setBeatLookback(e.target.value)}
          />
        )}
      </Section>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && <span className="text-sm text-beat">Saved ✓</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function str(n: number | null): string {
  return n === null ? '' : String(n);
}
function numOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}
function numOr(s: string, fallback: number): number {
  const n = numOrNull(s);
  return n === null ? fallback : n;
}
