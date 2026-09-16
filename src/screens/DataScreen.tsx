import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Panel } from '../components/primitives';
import { Button, Modal } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { STORE_NAMES } from '../db/database';
import { BackupValidationError, countRows, parseBackup, type BackupFile } from '../lib/backup';
import { todayDateString } from '../lib/id';

export function DataScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const backup = await repository.exportData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onemorerep-backup-${todayDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${countRows(backup)} records.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMessage(null);
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      const text = await file.text();
      const backup = parseBackup(text, STORE_NAMES);
      setPending(backup);
    } catch (err) {
      setError(err instanceof BackupValidationError ? err.message : 'Could not read that file.');
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await repository.importData(pending);
      // Fully reload so every screen re-reads the restored database.
      window.location.assign('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <>
      <ScreenHeader
        title="Export / Import"
        subtitle="Back up and restore your data"
        action={
          <Button variant="ghost" onClick={() => navigate('/more')}>
            Done
          </Button>
        }
      />

      <PageBody className="space-y-4">
        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Export</h2>
          <p className="mt-1 text-sm text-ink2">
            Download your entire database as a JSON file. This is your only backup on a local-first
            app — do it before anything risky, or to move to another device.
          </p>
          <Button variant="primary" className="mt-3" onClick={handleExport} disabled={busy}>
            Download backup
          </Button>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Import</h2>
          <p className="mt-1 text-sm text-ink2">
            Restore from a backup file. This <span className="font-semibold text-ink">replaces
            all current data</span> with the file's contents.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            Choose backup file…
          </Button>
        </Panel>

        {message && (
          <p className="rounded-tile border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-tile border border-fatigued/30 bg-fatigued/5 px-4 py-3 text-sm text-fatigued">
            {error}
          </p>
        )}
      </PageBody>

      {pending && (
        <Modal
          title="Replace all data?"
          onClose={() => setPending(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmImport} disabled={busy}>
                {busy ? 'Importing…' : 'Import & replace'}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink2">
            This backup contains <span className="font-semibold text-ink">{countRows(pending)}</span> records
            {pending.exported_at ? `, exported ${new Date(pending.exported_at).toLocaleString()}` : ''}.
            Importing will permanently replace everything currently in the app.
          </p>
        </Modal>
      )}
    </>
  );
}
