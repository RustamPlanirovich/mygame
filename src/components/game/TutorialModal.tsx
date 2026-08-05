import React from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { Modal } from '../ui';
import { TUTORIAL_STEPS } from '../../core/constants/tutorial';
import type { TutorialStepId } from '../../core/gameTypes.tutorial';

interface TutorialModalProps {
  currentStep: TutorialStepId;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}

const noop = () => {};

export const TutorialModal: React.FC<TutorialModalProps> = ({
  currentStep,
  onNext,
  onSkip,
  onClose,
}) => {
  const step = TUTORIAL_STEPS[currentStep];

  if (!step) return null;

  // Шаг без canSkip закрыть нельзя — ни крестиком, ни Escape, ни кликом по фону.
  // Раньше это обеспечивалось отсутствием кнопки и отсутствием обработчиков;
  // теперь Escape ловит Modal, поэтому на непропускаемом шаге ему отдаётся
  // пустой обработчик, а свою шапку с условным крестиком окно рисует само.
  const dismiss = step.canSkip ? onClose : noop;

  return (
    <Modal
      open
      onClose={dismiss}
      dismissOnBackdrop={false}
      size="md"
      footer={
        <div className="flex items-center justify-between">
          {step.canSkip ? (
            <button
              onClick={onSkip}
              className="cyber-button px-4 py-2 text-xs bg-transparent hover:bg-cyber-red/20 border-cyber-red text-cyber-red"
            >
              <div className="flex items-center gap-2">
                <SkipForward size={14} />
                <span>Пропустить обучение</span>
              </div>
            </button>
          ) : (
            <div />
          )}

          <button onClick={onNext} data-autofocus className="cyber-button px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span>{step.nextStep === 'complete' ? 'Завершить' : 'Далее'}</span>
              <ChevronRight size={14} />
            </div>
          </button>
        </div>
      }
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-cyber-green/20 to-cyber-blue/20 px-6 py-4 border-b border-cyber-green/50">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-cyber-green">
            {step.title}
          </h2>
          {step.canSkip && (
            <button
              onClick={onClose}
              className="icon-btn"
              title="Закрыть обучение"
              aria-label="Закрыть обучение"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        <div className="text-cyber-text whitespace-pre-line leading-relaxed">
          {step.description}
        </div>

        {/* Action hint */}
        {step.action && (
          <div className="mt-4 p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
            <div className="flex items-center gap-2">
              <span className="text-cyber-green text-sm font-bold">
                Действие:
              </span>
              <span className="text-cyber-text text-sm">
                {step.action.type === 'build' && 'Постройте здание'}
                {step.action.type === 'research' && 'Исследуйте технологию'}
                {step.action.type === 'click' && 'Нажмите на элемент'}
                {step.action.type === 'open_panel' && 'Откройте панель'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
