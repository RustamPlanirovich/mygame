/**
 * Добавление пункта в список (bigplan.md, пункт 37).
 *
 * Три вида пунктов в одной форме: здание, ресурс и свободная заметка. Заметка здесь
 * равноправна, а не «дополнение»: игрок просил возможность просто написать себе строчку —
 * и это должно занимать один клик и одно поле, а не отдельный экран.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { PlanItemDraft, PlanItemKind } from '../../../utils/plansApi';
import { RefPicker } from './RefPicker';

const KINDS: Array<{ id: PlanItemKind; label: string; icon: string }> = [
  { id: 'building', label: 'Здание', icon: 'crane' },
  { id: 'resource', label: 'Ресурс', icon: 'crate' },
  { id: 'note', label: 'Заметка', icon: 'clipboard' },
];

interface AddItemFormProps {
  onAdd: (draft: PlanItemDraft) => Promise<boolean>;
}

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [kind, setKind] = useState<PlanItemKind>('building');
  const [refId, setRefId] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = kind === 'note' ? text.trim().length > 0 : refId !== null;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    const parsedCount = Number.parseInt(targetCount, 10);
    const ok = await onAdd({
      kind,
      refId: kind === 'note' ? null : refId,
      text: text.trim().length > 0 ? text.trim() : null,
      targetCount: Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null,
    });
    setBusy(false);
    if (!ok) return;
    // Вид пункта оставляем: подряд добавляют однотипное (три здания, потом три заметки).
    setRefId(null);
    setTargetCount('');
    setText('');
  };

  return (
    <div
      className="space-y-1.5 rounded-md border p-2"
      style={{ borderColor: 'var(--edge)', background: 'var(--surface-2)' }}
    >
      <div className="flex gap-1">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setKind(option.id);
              setRefId(null);
            }}
            className="flex-1 rounded border px-1.5 py-1 text-3xs font-semibold transition-colors"
            style={{
              borderColor: kind === option.id ? 'var(--info)' : 'var(--edge)',
              background: kind === option.id ? 'rgb(94 216 242 / 0.14)' : 'var(--surface-3)',
              color: kind === option.id ? 'var(--info)' : 'var(--text-muted)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === 'note' ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Например: не забыть поставить склад рядом с плавильней"
          className="w-full resize-y rounded-md px-2 py-1.5 text-xs"
        />
      ) : (
        <>
          <RefPicker kind={kind} value={refId} onChange={setRefId} />
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              placeholder={kind === 'building' ? 'сколько построить' : 'сколько накопить'}
              className="w-32 rounded-md px-2 py-1.5 text-xs"
            />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="комментарий"
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs"
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || busy}
        className="btn btn-info btn-xs btn-block"
      >
        <Plus size={12} />
        {busy ? 'Добавляю…' : 'Добавить пункт'}
      </button>
    </div>
  );
}
