/**
 * ОРИЕНТИР «ЧТО ДЕЛАТЬ ДАЛЬШЕ» (bigplan.md, пункты 20, 29)
 *
 * Задание просило не обучение, а помощь в прохождении: «чтобы обучить его как играть и где что
 * находится». Поэтому здесь не модальное окно, которое закрывают и забывают, а компактная
 * полоса, которая живёт всю игру и всегда отвечает на три вопроса: что сделать, зачем это нужно
 * и где это находится. Кнопка «Показать» открывает нужную панель — это и есть ответ на «где».
 *
 * Панель не мешает: её можно свернуть до одной строки или закрыть совсем (вернуть — в настройках
 * сценария внизу подсказки).
 */

import { ChevronDown, ChevronUp, Target, X } from 'lucide-react';
import { useGameStore } from '../../features/gameStore';
import { useUiStore } from '../../features/uiStore';
import { SCENARIO } from '../../core/constants/scenario';
import { formatNumber } from '../../core/math/format';
import { D } from '../../core/math/format';

export function ScenarioGuide() {
  const scenario = useGameStore((s) => s.scenario);
  const setCollapsed = useGameStore((s) => s.setScenarioCollapsed);
  const dismiss = useGameStore((s) => s.dismissScenario);
  const openSection = useUiStore((s) => s.open);

  if (scenario.dismissed) return null;

  const done = scenario.currentIndex >= SCENARIO.length;
  const step = done ? null : SCENARIO[scenario.currentIndex];

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 w-[min(22rem,calc(100vw-1.5rem))]">
      <div className="rounded border border-cyber-green/40 bg-cyber-black/95 shadow-lg">
        {/* Заголовок: виден всегда, в том числе в свёрнутом виде */}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
          onClick={() => setCollapsed(!scenario.collapsed)}
          title={scenario.collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <Target size={13} className="shrink-0 text-cyber-green" />
          <span className="min-w-0 flex-1 truncate text-xs text-cyber-green">
            {done ? 'Все цели пройдены' : step!.title}
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-cyber-text-dim">
            {Math.min(scenario.currentIndex, SCENARIO.length)}/{SCENARIO.length}
          </span>
          {scenario.collapsed ? (
            <ChevronDown size={13} className="shrink-0 text-cyber-text-dim" />
          ) : (
            <ChevronUp size={13} className="shrink-0 text-cyber-text-dim" />
          )}
        </button>

        {!scenario.collapsed && (
          <div className="border-t border-cyber-green/20 px-2.5 py-2">
            {done ? (
              <p className="text-[11px] leading-snug text-cyber-text-dim">
                Игра бесконечная: дальше растут престиж, вознесение, повторяемые исследования и
                процедурные галактики. Когда рост встанет — почти всегда мешает одно узкое место,
                его видно во вкладке «Цепочки».
              </p>
            ) : (
              <>
                {/* Зачем: собственно обучение механике */}
                <p className="text-[11px] leading-snug text-cyber-text">{step!.why}</p>

                {/* Где: ровно то, что просили в задании */}
                {step!.where && (
                  <p className="mt-1.5 text-[11px] leading-snug text-cyber-text-dim">
                    <span className="text-cyber-blue">Где: </span>
                    {step!.where}
                  </p>
                )}

                {step!.reward && (
                  <p className="mt-1.5 font-mono text-[10px] tabular-nums text-cyber-text-dim">
                    Награда:{' '}
                    {[
                      step!.reward.credits && `${formatNumber(D(step!.reward.credits))} ₡`,
                      step!.reward.researchPoints &&
                        `${formatNumber(D(step!.reward.researchPoints))} иссл.`,
                      step!.reward.influence && `${formatNumber(D(step!.reward.influence))} вл.`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  {step!.section && (
                    <button
                      type="button"
                      className="btn-primary btn-xs"
                      onClick={() => openSection(step!.section!)}
                    >
                      Показать где
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-xs flex items-center gap-1"
                    onClick={dismiss}
                    title="Скрыть подсказки сценария (вернуть можно в настройках)"
                  >
                    <X size={11} /> Не нужно
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
