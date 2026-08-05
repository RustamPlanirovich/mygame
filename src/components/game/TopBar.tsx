import { useMemo, useRef, useState, type ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import { useGameStore } from '../../features/gameStore';
import { useUiStore } from '../../features/uiStore';
import { D, formatNumber } from '../../core/math/format';
import { RESOURCE_LABEL, RESOURCE_SHORT } from '../../core/constants/labels';
import { TECHNOLOGIES } from '../../core/constants/technologies';
import { ACHIEVEMENTS } from '../../core/constants/achievements';
import { GALAXIES } from '../../core/constants/galaxies';
import { getMapDefinition } from '../../core/constants/maps';
import {
  baseInfluencePerSecond,
  baseResearchPointsPerSecond,
} from '../../core/production/currencyRates';
import { usePinnedResources } from '../../hooks/usePinnedResources';
import { WarehousePopover } from './WarehousePopover';
import { GameIcon, hasGlyph } from '../ui/icons';
import type { ResourceType } from '../../core/gameTypes';
import { LayoutGrid, Map as MapIcon, Shield, UserCircle } from 'lucide-react';

/*
 * Единая строка ресурсов — «пульс» игры (как в Industry Idle).
 *
 * До переписывания шапка занимала четыре яруса: карточки статистики (Dashboard),
 * строка валют, строка ресурсов и панели энергии/экологии — около 260px по высоте,
 * то есть треть экрана уходила на числа, которые меняются раз в секунду. Теперь это
 * одна строка 34px: значение + скорость изменения, а разборы (энергобаланс, экология,
 * склад, аналитика) открываются по клику.
 */

const tone = (d: Decimal | number | null | undefined) => {
  if (d === null || d === undefined) return 'text-content-faint';
  const dec = D(d);
  if (dec.gt(0)) return 'text-accent';
  if (dec.lt(0)) return 'text-danger';
  return 'text-content-faint';
};

/** `+1,05K` / `-197,50` / `+0.00` — знак всегда виден, иначе запас и скорость сливаются. */
const signed = (d: Decimal | number) => {
  const dec = D(d);
  return `${dec.lt(0) ? '' : '+'}${formatNumber(dec)}`;
};

function Chip({
  icon,
  iconTone = 'text-content-muted',
  value,
  delta,
  deltaTone,
  title,
  onClick,
  children,
}: {
  icon: string;
  iconTone?: string;
  value: string;
  delta?: string;
  deltaTone?: string;
  title: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`flex h-full shrink-0 items-center gap-1.5 px-2 text-left ${
        onClick ? 'transition-colors hover:bg-white/[0.06]' : ''
      }`}
    >
      {/*
       * У части ресурсов «иконка» — это текстовое сокращение (РУД, ЛЁД, СТ), для которого
       * в наборе нет глифа. Без обёртки такой текст наследовал 15px из шапки и был крупнее
       * самого значения; глифам же нужен размер в em, поэтому ветки разные.
       */}
      {hasGlyph(icon) ? (
        <GameIcon icon={icon} size={14} className={iconTone} />
      ) : (
        <span className={`text-2xs font-bold uppercase tracking-wide ${iconTone}`}>{icon}</span>
      )}
      <span className="font-mono text-xs font-semibold tabular-nums text-content-primary">
        {value}
      </span>
      {delta !== undefined && (
        <span className={`font-mono text-3xs tabular-nums ${deltaTone ?? 'text-content-faint'}`}>
          {delta}
        </span>
      )}
      {children}
    </Tag>
  );
}

function formatPlaytime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
}

interface TopBarProps {
  onOpenProfile: () => void;
  onOpenMaps: () => void;
  onOpenAdmin?: () => void;
  compact?: boolean;
}

export function TopBar({ onOpenProfile, onOpenMaps, onOpenAdmin, compact = false }: TopBarProps) {
  const openPanel = useUiStore((s) => s.open);
  const togglePanel = useUiStore((s) => s.toggle);

  const currency = useGameStore((s) => s.currency);
  const energyProduction = useGameStore((s) => s.energyProduction);
  const energyConsumption = useGameStore((s) => s.energyConsumption);
  const energyEfficiency = useGameStore((s) => s.energyEfficiency);
  const pollution = useGameStore((s) => s.pollution);

  // Ресурсы активной платформы, если игрок на ней; иначе — база.
  const resources = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find((p) => p.id === platformId);
      return platform?.resources ?? s.resources;
    }
    return s.resources;
  });

  // Скорости RP/влияния считаются из размещённых клеток, а не из каталога зданий.
  const tiles = useGameStore((s) => s.grid.tiles);
  const rpRate = useMemo(
    () => baseResearchPointsPerSecond(tiles).mul(energyEfficiency),
    [tiles, energyEfficiency],
  );
  const influenceRate = useMemo(
    () => baseInfluencePerSecond(tiles).mul(energyEfficiency),
    [tiles, energyEfficiency],
  );

  const buildings = useGameStore((s) => s.buildings);
  const research = useGameStore((s) => s.research);
  const fleet = useGameStore((s) => s.fleet);
  const galaxies = useGameStore((s) => s.galaxies);
  const combat = useGameStore((s) => s.combat);
  const achievements = useGameStore((s) => s.achievements);
  const stats = useGameStore((s) => s.stats);
  const maps = useGameStore((s) => s.maps);

  const { pins, isPinned, togglePin } = usePinnedResources();
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const warehouseButtonRef = useRef<HTMLButtonElement | null>(null);

  const pinned = useMemo(
    () => pins.filter((k) => Boolean(resources[k])).map((k) => k as ResourceType),
    [pins, resources],
  );

  const hasFullStorage = useMemo(
    () => Object.values(resources).some((r) => r.max.gt(0) && r.amount.gte(r.max.mul(0.95))),
    [resources],
  );

  const energyBalance = energyProduction.sub(energyConsumption);
  const powerDeficit = energyEfficiency < 1;

  const totalBuildings = Object.keys(tiles).length;
  const unlockedTech = Object.values(research.technologies).filter(Boolean).length;
  const totalTech = Object.keys(TECHNOLOGIES).length;
  const unlockedAchievements = Object.keys(achievements.unlocked).length;
  const unlockedGalaxies = galaxies.unlockedGalaxies?.length ?? 0;

  const activeEnemies = combat.enemies.length;
  const waveActive = combat.waveEndsAt > Date.now();
  const threat = combat.baseHp.lte(0)
    ? { label: 'ОФФЛАЙН', cls: 'badge badge-danger' }
    : activeEnemies > 0
      ? { label: `АТАКА ×${activeEnemies}`, cls: 'badge badge-danger animate-pulse' }
      : waveActive
        ? { label: 'ВОЛНА', cls: 'badge badge-warning' }
        : null;

  const playtimeSeconds =
    (stats?.totalPlayTime ?? 0) +
    (stats?.currentSessionStart ? Math.floor((Date.now() - stats.currentSessionStart) / 1000) : 0);
  const currentMap = maps?.currentMapId ? getMapDefinition(maps.currentMapId) : null;

  return (
    /*
     * z-40 — выше правой панели (z-30): всплывающий склад живёт внутри шапки, а значит
     * внутри её контекста наложения. При z-20 его собственный z-50 ничего не решал и
     * панель перекрывала половину склада.
     */
    <header
      className="relative z-40 flex h-[34px] shrink-0 items-stretch border-b text-content-secondary"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--edge)' }}
    >
      {/*
       * Валюты и ресурсы лежат в ОДНОЙ прокручиваемой полосе. Раньше валюты были жёстко
       * прибиты слева, и на телефоне (390px) пять фиксированных чипов выдавливали правый
       * блок за край экрана — вместе с кнопкой «Меню», единственным способом открыть панель,
       * пока быстрой панели слева нет.
       */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {/* ——— валюты: всегда первыми, чтобы взгляд знал куда падать ——— */}
        <Chip
          icon="credits"
          iconTone="text-warning"
          value={formatNumber(currency.credits)}
          title="Кредиты — основная валюта строительства. Клик: финансы"
          onClick={() => openPanel('finance')}
        />
        <Chip
          icon="bolt"
          iconTone={powerDeficit ? 'text-danger' : 'text-accent'}
          value={`${signed(energyBalance)}/с`}
          delta={`${Math.round(energyEfficiency * 100)}%`}
          deltaTone={powerDeficit ? 'text-danger' : 'text-content-faint'}
          title={`Энергобаланс\nПроизводство: +${formatNumber(energyProduction)}/с\nПотребление: −${formatNumber(
            energyConsumption,
          )}/с\nЭффективность: ${(energyEfficiency * 100).toFixed(0)}%\nКлик: энергия и экология`}
          onClick={() => openPanel('power')}
        />
        <Chip
          icon="waste"
          iconTone={pollution.efficiencyMultiplier < 0.9 ? 'text-warning' : 'text-content-muted'}
          value={formatNumber(pollution.wasteAmount)}
          delta={`${(pollution.efficiencyMultiplier * 100).toFixed(0)}%`}
          deltaTone={pollution.efficiencyMultiplier < 0.9 ? 'text-warning' : 'text-content-faint'}
          title={`Мусор: ${formatNumber(pollution.wasteAmount)}\nЭкологическая эффективность: ${(
            pollution.efficiencyMultiplier * 100
          ).toFixed(1)}%\nКлик: энергия и экология`}
          onClick={() => openPanel('power')}
        />
        <Chip
          icon="research"
          iconTone="text-info"
          value={formatNumber(currency.researchPoints)}
          delta={signed(rpRate)}
          deltaTone={tone(rpRate)}
          title={`Очки исследований\n+${formatNumber(rpRate)}/с\nКлик: исследования`}
          onClick={() => openPanel('research')}
        />
        <Chip
          icon="crown"
          iconTone="text-violet-400"
          value={formatNumber(currency.influence)}
          delta={signed(influenceRate)}
          deltaTone={tone(influenceRate)}
          title={`Влияние\n+${formatNumber(influenceRate)}/с\nКлик: политика`}
          onClick={() => openPanel('politics')}
        />

        <div className="my-1.5 w-px shrink-0" style={{ background: 'var(--edge)' }} />

        {/* ——— закреплённые ресурсы: значение + скорость ——— */}
        {pinned.map((key) => {
          const r = resources[key];
          if (!r?.amount || !r.max) return null;
          const rate = r.production ?? D(0);
          const full = r.max.gt(0) && r.amount.gte(r.max);
          return (
            <Chip
              key={key}
              icon={RESOURCE_SHORT[key]}
              iconTone={full ? 'text-danger' : 'text-content-muted'}
              value={formatNumber(r.amount)}
              delta={full ? 'ПОЛНО' : signed(rate)}
              deltaTone={full ? 'text-danger' : tone(rate)}
              title={`${RESOURCE_LABEL[key]}\n${formatNumber(r.amount)} / ${formatNumber(
                r.max,
              )}\n${signed(rate)}/с\nКлик: склад`}
              onClick={() => setWarehouseOpen(true)}
            />
          );
        })}

        {threat && (
          <div className="flex h-full items-center px-2">
            <span className={threat.cls} title="Идёт атака — откройте раздел «Бой»">
              {threat.label}
            </span>
          </div>
        )}
        {hasFullStorage && (
          <div className="flex h-full items-center px-1">
            <span className="badge badge-danger" title="Часть складов заполнена — производство простаивает">
              СКЛАД ПОЛОН
            </span>
          </div>
        )}
      </div>

      {/* ——— справа: склад, сводка, служебные кнопки ——— */}
      <div className="flex shrink-0 items-stretch border-l" style={{ borderColor: 'var(--edge)' }}>
        <button
          ref={warehouseButtonRef}
          type="button"
          onClick={() => setWarehouseOpen((v) => !v)}
          title="Склад: все ресурсы и закрепление в этой строке"
          className="flex h-full items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors hover:bg-white/[0.06]"
        >
          <GameIcon icon="crate" size={14} className="text-accent" />
          <span className="hidden sm:inline">Склад</span>
        </button>

        {!compact && (
          <div className="hidden items-stretch border-l xl:flex" style={{ borderColor: 'var(--edge)' }}>
            <Chip
              icon="factory"
              value={String(totalBuildings)}
              title={`Зданий на карте: ${totalBuildings}\nКлик: строительство`}
              onClick={() => openPanel('build')}
            />
            <Chip
              icon="node"
              value={`${unlockedTech}/${totalTech}`}
              title="Изучено технологий. Клик: исследования"
              onClick={() => openPanel('research')}
            />
            <Chip
              icon="rocket"
              value={String(fleet.ships.length)}
              title="Корабли флота. Клик: флот"
              onClick={() => openPanel('fleet')}
            />
            <Chip
              icon="trophy"
              value={`${unlockedAchievements}/${ACHIEVEMENTS.length}`}
              title="Достижения. Клик: список"
              onClick={() => openPanel('achievements')}
            />
            <Chip
              icon="galaxy"
              value={`${unlockedGalaxies}/${Object.keys(GALAXIES).length}`}
              title="Открытые галактики. Клик: карта галактик"
              onClick={() => openPanel('galaxies')}
            />
          </div>
        )}

        <div className="flex items-stretch border-l" style={{ borderColor: 'var(--edge)' }}>
          <div
            className="hidden h-full items-center gap-1.5 px-2 lg:flex"
            title={`Время в игре: ${formatPlaytime(playtimeSeconds)}`}
          >
            <GameIcon icon="clock" size={13} className="text-content-faint" />
            <span className="font-mono text-3xs tabular-nums text-content-muted">
              {formatPlaytime(playtimeSeconds)}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenMaps}
            title={currentMap ? `Карта: ${currentMap.name}` : 'Выбор карты'}
            className="flex h-full items-center gap-1.5 px-2 text-xs transition-colors hover:bg-white/[0.06]"
          >
            <MapIcon size={14} className="text-info" />
            <span className="hidden truncate text-3xs text-content-muted xl:inline">
              {currentMap?.name ?? 'Карты'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => togglePanel('menu')}
            title="Все разделы игры"
            className="flex h-full items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors hover:bg-white/[0.06]"
          >
            <LayoutGrid size={14} className="text-accent" />
            <span className="hidden sm:inline">Меню</span>
          </button>
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Админ-панель"
              className="flex h-full items-center px-2 transition-colors hover:bg-white/[0.06]"
            >
              <Shield size={14} className="text-warning" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenProfile}
            title="Профиль, сохранения, настройки"
            className="flex h-full items-center px-2 transition-colors hover:bg-white/[0.06]"
          >
            <UserCircle size={15} className="text-info" />
          </button>
        </div>
      </div>

      <WarehousePopover
        open={warehouseOpen}
        onClose={() => setWarehouseOpen(false)}
        anchorRef={warehouseButtonRef}
        resources={resources}
        buildings={buildings}
        isPinned={isPinned}
        togglePin={togglePin}
      />
    </header>
  );
}
