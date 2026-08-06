/**
 * Выбор здания или ресурса для пункта списка (bigplan.md, пункт 37).
 *
 * Каталог зданий и набор ресурсов читаются ОДИН РАЗ через getState() в useMemo, а не подпиской:
 * id, названия и рецепты за партию не меняются, меняется только `count` — а его тут никто не
 * показывает. Подписка означала бы пересборку списка 20 раз в секунду вместе с тиком.
 *
 * Поиск идёт и по названию, и по подписям производимых ресурсов: игрок ищет «процессор», а
 * здание называется «Завод интегральных микросхем» — без этого он его не найдёт.
 */

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { resourceLabel } from '../../../core/i18n/label';
import { GameIcon } from '../../ui/icons';

interface RefOption {
  id: string;
  label: string;
  /** Подсказка второй строкой: что здание делает / из чего. */
  hint: string;
  /** Слова для поиска, уже в нижнем регистре. */
  haystack: string;
}

/** Сколько вариантов показываем: панель узкая, длинный список в ней бесполезен. */
const MAX_OPTIONS = 8;

/** Каталог зданий как варианты выбора. Считается один раз на монтирование. */
function useBuildingOptions(): RefOption[] {
  return useMemo(() => {
    const buildings = useGameStore.getState().buildings;
    return buildings.map((b) => {
      const produces = Object.keys(b.production ?? {}).map((r) => resourceLabel(r));
      const consumes = Object.keys(b.consumption ?? {}).map((r) => resourceLabel(r));
      const hint =
        produces.length > 0
          ? `даёт: ${produces.join(', ')}${consumes.length > 0 ? ` · из: ${consumes.join(', ')}` : ''}`
          : (b.description ?? '');
      return {
        id: b.id,
        label: b.name,
        hint,
        haystack: [b.id, b.name, ...produces, ...consumes].join(' ').toLowerCase(),
      };
    });
  }, []);
}

/** Ресурсы как варианты выбора. */
function useResourceOptions(): RefOption[] {
  return useMemo(() => {
    const resources = useGameStore.getState().resources;
    return Object.keys(resources).map((id) => ({
      id,
      label: resourceLabel(id),
      hint: '',
      haystack: `${id} ${resourceLabel(id)}`.toLowerCase(),
    }));
  }, []);
}

interface RefPickerProps {
  kind: 'building' | 'resource';
  value: string | null;
  /**
   * Подпись отдаём вторым аргументом: вызывающему она почти всегда нужна (заголовок списка
   * «Сделать пластик»), а искать её заново по id — значит второй раз собирать тот же каталог.
   */
  onChange: (id: string | null, label: string | null) => void;
  placeholder?: string;
}

export function RefPicker({ kind, value, onChange, placeholder }: RefPickerProps) {
  const buildingOptions = useBuildingOptions();
  const resourceOptions = useResourceOptions();
  const options = kind === 'building' ? buildingOptions : resourceOptions;

  const [query, setQuery] = useState('');
  const selected = value ? options.find((o) => o.id === value) : null;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return options.slice(0, MAX_OPTIONS);
    return options.filter((o) => o.haystack.includes(needle)).slice(0, MAX_OPTIONS);
  }, [options, query]);

  // Выбрано — показываем выбранное с крестиком, а не список: так видно, что именно уйдёт в пункт.
  if (selected) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md border px-2 py-1.5"
        style={{ borderColor: 'var(--edge)', background: 'var(--surface-3)' }}
      >
        <GameIcon icon={kind === 'building' ? 'crane' : 'crate'} size={13} className="shrink-0 text-info" mono />
        <span className="min-w-0 flex-1 truncate text-xs text-content-primary">{selected.label}</span>
        <button
          type="button"
          onClick={() => {
            onChange(null, null);
            setQuery('');
          }}
          className="icon-btn h-5 w-5"
          title="Выбрать другое"
          aria-label="Выбрать другое"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search
          size={12}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-faint"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? (kind === 'building' ? 'Найти здание…' : 'Найти ресурс…')}
          className="w-full rounded-md py-1.5 pl-7 pr-2 text-xs"
        />
      </div>

      {matches.length === 0 ? (
        <p className="px-1 text-3xs text-content-faint">Ничего не нашлось</p>
      ) : (
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {matches.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id, option.label)}
              className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/[0.06]"
            >
              <GameIcon
                icon={kind === 'building' ? 'crane' : 'crate'}
                size={12}
                className="shrink-0 translate-y-0.5 text-info"
                mono
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-content-secondary">{option.label}</span>
                {option.hint && (
                  <span className="block truncate text-3xs text-content-faint">{option.hint}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
