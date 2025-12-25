import React from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { TUTORIAL_STEPS } from '../../core/constants/tutorial';
import type { TutorialStepId } from '../../core/gameTypes.tutorial';

interface TutorialModalProps {
  currentStep: TutorialStepId;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  currentStep,
  onNext,
  onSkip,
  onClose,
}) => {
  const step = TUTORIAL_STEPS[currentStep];
  
  if (!step) return null;

  const getPositionClasses = () => {
    switch (step.position) {
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'top':
        return 'top-24 left-1/2 -translate-x-1/2';
      case 'bottom':
        return 'bottom-24 left-1/2 -translate-x-1/2';
      case 'left':
        return 'top-1/2 left-24 -translate-y-1/2';
      case 'right':
        return 'top-1/2 right-24 -translate-y-1/2';
      default:
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fade-in" />
      
      {/* Tutorial card */}
      <div
        className={`fixed z-[101] max-w-lg w-full animate-scale-in ${getPositionClasses()}`}
      >
        <div className="bg-cyber-dark border-2 border-cyber-green rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyber-green/20 to-cyber-blue/20 px-6 py-4 border-b border-cyber-green/50">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-cyber-green">
                {step.title}
              </h2>
              {step.canSkip && (
                <button
                  onClick={onClose}
                  className="text-cyber-text-dim hover:text-cyber-red transition-colors"
                  title="Закрыть обучение"
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

          {/* Footer */}
          <div className="px-6 py-4 bg-cyber-darker border-t border-cyber-gray flex items-center justify-between">
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

            <button
              onClick={onNext}
              className="cyber-button px-4 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span>{step.nextStep === 'complete' ? 'Завершить' : 'Далее'}</span>
                <ChevronRight size={14} />
              </div>
            </button>
          </div>
        </div>

        {/* Arrow indicator for position */}
        {step.position !== 'center' && (
          <div className={`absolute ${
            step.position === 'top' ? 'bottom-full mb-2' :
            step.position === 'bottom' ? 'top-full mt-2' :
            step.position === 'left' ? 'right-full mr-2' :
            'left-full ml-2'
          } text-cyber-green animate-pulse`}>
            {step.position === 'top' && '↓'}
            {step.position === 'bottom' && '↑'}
            {step.position === 'left' && '→'}
            {step.position === 'right' && '←'}
          </div>
        )}
      </div>
    </>
  );
};
