import { useState } from 'react';
import type { DuplicateReport } from '../../services/system/DuplicateService';
export function DuplicateReview({ report, onRecycle }: { report: DuplicateReport; onRecycle: (paths: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const invalid = !selected.length || report.groups.some(group => group.files.every(file => selected.includes(file.path))) || report.expires < Date.now();
  return <section aria-label="Duplicate document comparison" className="space-y-3">
    <p>{report.scanned} documents inspected · {report.groups.length} duplicate groups. Select copies to remove; leave at least one keeper per group.</p>
    {report.groups.map((group, index) => <fieldset key={index} className="border border-white/20 rounded-lg p-3 space-y-2">
      <legend className="px-1 font-semibold">Group {index + 1} · {group.basis === 'identical-file' ? 'Identical files' : 'Matching document text'}</legend>
      {group.basis === 'matching-text' && <p className="text-amber-200">Formatting and non-text content may differ. Inspect these documents before selecting copies.</p>}
      {group.files.map(file => <div key={file.path}>
        <label className="flex items-start gap-2 break-all"><input type="checkbox" checked={selected.includes(file.path)} onChange={event => setSelected(rows => event.target.checked ? [...rows, file.path] : rows.filter(row => row !== file.path))} /><span>{file.path}</span></label>
        {file.warnings.map(warning => <p key={warning} className="ml-6 text-amber-200">{warning}</p>)}
      </div>)}
    </fieldset>)}
    {report.skipped.length > 0 && <details><summary>{report.skipped.length} items skipped</summary>{report.skipped.map((row, i) => <p key={i} className="break-all">{row.path}: {row.reason}</p>)}</details>}
    <button className="agent-button" disabled={invalid || busy} onClick={async () => { setBusy(true); try { await onRecycle(selected); } finally { setBusy(false); } }}>Review {selected.length} selected copies for Recycle Bin</button>
  </section>;
}
