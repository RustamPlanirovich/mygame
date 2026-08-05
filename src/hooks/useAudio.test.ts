/**
 * Условие «музыка должна играть» (bigplan.md, пункты 15, 35).
 *
 * Условий три, и каждое само по себе означает тишину: общий mute, нулевой общий уровень и
 * нулевая громкость музыки. Ошибка в любом из них даёт либо музыку при выключенном звуке,
 * либо тишину при включённом — оба случая игрок считает поломкой, поэтому проверяются все.
 */

import { describe, expect, it } from 'vitest';
import { shouldPlayMusic } from './useAudio';
import type { GameSettings } from '../core/gameTypes.settings';

const audio = (patch: Partial<GameSettings['audio']> = {}): GameSettings['audio'] => ({
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muteAll: false,
  ...patch,
});

describe('shouldPlayMusic', () => {
  it('играет при нормальных настройках', () => {
    expect(shouldPlayMusic(audio())).toBe(true);
  });

  it('молчит при общем mute, даже если громкости не нулевые', () => {
    expect(shouldPlayMusic(audio({ muteAll: true }))).toBe(false);
  });

  it('молчит при нулевом общем уровне', () => {
    expect(shouldPlayMusic(audio({ masterVolume: 0 }))).toBe(false);
  });

  it('молчит при нулевой громкости музыки', () => {
    expect(shouldPlayMusic(audio({ musicVolume: 0 }))).toBe(false);
  });

  it('громкость эффектов на музыку не влияет', () => {
    // Пункт 16 просит клики независимо от музыки, поэтому каналы не должны быть связаны.
    expect(shouldPlayMusic(audio({ sfxVolume: 0 }))).toBe(true);
    expect(shouldPlayMusic(audio({ sfxVolume: 1, musicVolume: 0 }))).toBe(false);
  });

  it('играет на минимально слышимой громкости', () => {
    expect(shouldPlayMusic(audio({ musicVolume: 0.01 }))).toBe(true);
  });
});
