// Tutorial system types

export type TutorialStepId = 
  | 'welcome'
  | 'first_building'
  | 'energy_system'
  | 'resources'
  | 'research'
  | 'proximity'
  | 'market'
  | 'policies'
  | 'galaxies'
  | 'fleet'
  | 'complete';

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  description: string;
  highlight?: string; // CSS selector to highlight element
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  action?: {
    type: 'click' | 'build' | 'research' | 'open_panel';
    target?: string;
  };
  canSkip?: boolean;
  nextStep?: TutorialStepId;
  condition?: () => boolean; // Function to check if step should be shown
}

export interface TutorialState {
  isActive: boolean;
  isCompleted: boolean;
  currentStep: TutorialStepId | null;
  completedSteps: TutorialStepId[];
  skippedSteps: TutorialStepId[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'build' | 'research' | 'produce' | 'explore' | 'combat';
  target: string;
  targetAmount?: number;
  currentAmount?: number;
  reward: {
    credits?: number;
    researchPoints?: number;
    influence?: number;
    resources?: Record<string, number>;
  };
  isCompleted: boolean;
  isActive: boolean;
}

export interface QuestState {
  activeQuests: Quest[];
  completedQuests: string[];
}
