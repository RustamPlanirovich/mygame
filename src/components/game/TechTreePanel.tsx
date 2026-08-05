import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import { Lightbulb } from 'lucide-react';
import {
  TECHNOLOGIES,
  ERA_NAMES,
  getTechnologiesByEra,
  canResearchTechnology,
} from '../../core/constants/technologies';
import { GameIcon, IconText } from '../ui/icons';

export function TechTreePanel() {
  const research = useGameStore((s) => s.research);
  const currency = useGameStore((s) => s.currency);
  const researchTechnology = useGameStore((s) => s.researchTechnology);

  return (
    <div className="border border-cyber-blue/30 rounded-md overflow-hidden">
      <div className="bg-cyber-blue/10 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-cyber-blue" />
          <span className="text-sm font-bold text-cyber-blue uppercase">Дерево технологий</span>
        </div>
        <div className="text-xs text-cyber-text-dim">
          RP: <span className="text-cyber-blue font-bold">{formatNumber(currency.researchPoints)}</span>
        </div>
      </div>
      
      <div className="p-3 max-h-[500px] overflow-y-auto space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map((era) => {
          const eraTechs = getTechnologiesByEra(era);
          const anyUnlocked = eraTechs.some(tech => research.technologies[tech.id]);
          const anyAvailable = eraTechs.some(tech => 
            !research.technologies[tech.id] && 
            canResearchTechnology(tech.id, research.technologies, currency.researchPoints.toNumber())
          );
          
          // Show era if: has unlocked tech, has available tech, or is era 1
          if (!anyUnlocked && !anyAvailable && era > 1) {
            // Check if previous era is complete to show this as "next"
            const prevEraTechs = getTechnologiesByEra(era - 1);
            const prevEraComplete = prevEraTechs.every(tech => research.technologies[tech.id]);
            if (!prevEraComplete) {
              return null; // Hide locked eras
            }
          }
          
          return (
            <div key={era} className="space-y-2">
              <div className="text-xs font-bold text-cyber-green uppercase tracking-wider flex items-center gap-2">
                <span>{ERA_NAMES[era]}</span>
                {anyUnlocked && (
                  <span className="text-cyber-green text-[10px]">
                    ({eraTechs.filter(t => research.technologies[t.id]).length}/{eraTechs.length})
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-1">
                {eraTechs.map((tech) => {
                  const unlocked = research.technologies[tech.id];
                  const canResearch = !unlocked && canResearchTechnology(
                    tech.id, 
                    research.technologies, 
                    currency.researchPoints.toNumber()
                  );
                  const missingPrereqs = tech.prerequisites.filter(prereq => !research.technologies[prereq]);
                  const hasRP = currency.researchPoints.gte(tech.cost);
                  
                  return (
                    <div 
                      key={tech.id} 
                      className={`cyber-panel text-xs p-2 transition-all ${
                        unlocked ? 'bg-cyber-green/10 border-cyber-green/30' : 
                        canResearch ? 'hover:border-cyber-blue cursor-pointer' : 
                        'opacity-40'
                      }`}
                      onClick={() => canResearch && researchTechnology(tech.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold ${unlocked ? 'text-cyber-green' : 'text-cyber-blue'}`}>
                              <IconText>{unlocked && '✓ '}</IconText>{tech.name}
                            </span>
                            <span className="text-cyber-text-dim text-[10px]">
                              {tech.cost > 0 ? `${formatNumber(tech.cost)} RP` : 'Базовая'}
                            </span>
                          </div>
                          <div className="text-cyber-text-dim mt-1 text-[11px]"><IconText>{tech.description}</IconText></div>
                          
                          {tech.unlocks.buildings && tech.unlocks.buildings.length > 0 && (
                            <div className="text-cyber-blue text-[10px] mt-1">
                              <GameIcon icon="🏗️" /> Открывает: {tech.unlocks.buildings.length} зданий
                            </div>
                          )}
                          
                          {!unlocked && missingPrereqs.length > 0 && (
                            <div className="text-cyber-red text-[10px] mt-1">
                              <GameIcon icon="🔒" /> Требуется: {missingPrereqs.map(id => TECHNOLOGIES[id].name).join(', ')}
                            </div>
                          )}
                          
                          {!unlocked && missingPrereqs.length === 0 && !hasRP && (
                            <div className="text-cyber-orange text-[10px] mt-1">
                              <GameIcon icon="⚠️" /> Недостаточно RP (нужно {formatNumber(tech.cost)})
                            </div>
                          )}
                        </div>
                        
                        {!unlocked && canResearch && (
                          <button
                            className="cyber-button text-[10px] py-1 px-3 whitespace-nowrap shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              researchTechnology(tech.id);
                            }}
                          >
                            Изучить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="px-3 py-2 bg-cyber-gray-dark/50 text-[10px] text-cyber-text-dim border-t border-cyber-gray">
        Технологии разблокируют новые здания и ресурсы. Изучайте технологии за очки исследований (RP).
      </div>
    </div>
  );
}
