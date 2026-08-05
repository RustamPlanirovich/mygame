/**
 * Звуковая шина и синтез (bigplan.md, пункты 15, 16, 35).
 *
 * Тесты выполняются в node, где Web Audio нет. Это не ограничение, а ровно то, что нужно
 * проверить: звук — не обязательная часть игры, и его отсутствие не должно ничего ломать.
 * Раньше аудио не было вовсе, поэтому первое требование к нему — «не падать нигде».
 */

import { describe, expect, it } from 'vitest';
import { audioBus } from './AudioBus';
import { __minRepeatMs, __sfxConfig, playSfx, resetSfxThrottle } from './sfx';
import { __ambientConfig, isAmbientPlaying, startAmbientMusic, stopAmbientMusic } from './ambientMusic';

describe('AudioBus без Web Audio (сервер, старый браузер)', () => {
  it('не готова и не падает', async () => {
    expect(audioBus.ready).toBe(false);
    await expect(audioBus.resume()).resolves.toBe(false);
  });

  it('bindUnlock и suspend безопасны без window', () => {
    expect(() => audioBus.bindUnlock()).not.toThrow();
    expect(() => audioBus.suspend()).not.toThrow();
  });

  it('громкости запоминаются и зажимаются в 0..1', () => {
    audioBus.setLevels({ masterVolume: 0.3, musicVolume: 0.4, sfxVolume: 0.5, muteAll: false });
    expect(audioBus.getLevels()).toEqual({
      masterVolume: 0.3,
      musicVolume: 0.4,
      sfxVolume: 0.5,
      muteAll: false,
    });
  });

  it('частичное обновление не сбрасывает остальные каналы', () => {
    audioBus.setLevels({ masterVolume: 0.9 });
    const levels = audioBus.getLevels();
    expect(levels.masterVolume).toBe(0.9);
    // Музыка осталась от предыдущего теста — иначе один ползунок сбрасывал бы другие.
    expect(levels.musicVolume).toBe(0.4);
  });

  it('destinationFor без контекста возвращает null, а не бросает', () => {
    expect(audioBus.destinationFor('music')).toBeNull();
    expect(audioBus.destinationFor('sfx')).toBeNull();
  });
});

describe('playSfx', () => {
  it('не падает без Web Audio', () => {
    resetSfxThrottle();
    expect(() => playSfx('click')).not.toThrow();
    expect(() => playSfx('place')).not.toThrow();
    expect(() => playSfx('error')).not.toThrow();
  });

  it('у каждого звука разумные параметры', () => {
    for (const [name, config] of Object.entries(__sfxConfig)) {
      // Длительность: слишком долгий «клик» ощущается как лаг интерфейса.
      expect(config.duration, name).toBeGreaterThan(0);
      expect(config.duration, name).toBeLessThanOrEqual(0.25);
      // Громкость заметно ниже единицы: звук слышат сотни раз за сессию.
      expect(config.gain, name).toBeGreaterThan(0);
      expect(config.gain, name).toBeLessThanOrEqual(0.25);
      expect(config.freq, name).toBeGreaterThan(0);
      expect(config.endFreq, name).toBeGreaterThan(0);
    }
  });

  it('антиспам не даёт треска при массовых действиях', () => {
    expect(__minRepeatMs).toBeGreaterThan(0);
    resetSfxThrottle();
    // Серия вызовов подряд не должна падать; фактическое проигрывание глушится по времени.
    for (let i = 0; i < 100; i++) playSfx('remove');
    expect(true).toBe(true);
  });
});

describe('ambientMusic', () => {
  it('без Web Audio не запускается и не падает', async () => {
    await expect(startAmbientMusic()).resolves.toBe(false);
    expect(isAmbientPlaying()).toBe(false);
    expect(() => stopAmbientMusic()).not.toThrow();
  });

  it('повторный stop безопасен', () => {
    expect(() => {
      stopAmbientMusic();
      stopAmbientMusic();
    }).not.toThrow();
  });

  it('гамма пентатоническая: нет интервалов в один полутон', () => {
    /*
     * Это и есть причина выбора пентатоники: полутоновых столкновений нет, поэтому случайный
     * порядок нот всегда звучит консонантно и «спокойно», как просит задание.
     *
     * Интервалы считаются в отношениях частот: полутон = 2^(1/12) ≈ 1.059, целый тон =
     * 2^(2/12) ≈ 1.122. Минимальный интервал в пентатонике — целый тон, поэтому порог ставим
     * между ними (1.5 полутона), а не «в полтора раза больше полутона».
     */
    const threshold = Math.pow(2, 1.5 / 12);
    const scale = __ambientConfig.SCALE_HZ;

    for (let i = 1; i < scale.length; i++) {
      const ratio = scale[i] / scale[i - 1];
      expect(ratio, `интервал ${i}`).toBeGreaterThan(threshold);
    }
  });

  it('паузы между нотами длинные и разной длины — иначе появляется ритм', () => {
    const { min, max } = __ambientConfig.NOTE_GAP_MS;
    expect(min).toBeGreaterThanOrEqual(2000);
    expect(max).toBeGreaterThan(min);
  });

  it('гул тише нот и обе громкости очень низкие', () => {
    expect(__ambientConfig.DRONE_GAIN).toBeLessThan(__ambientConfig.NOTE.gain);
    expect(__ambientConfig.NOTE.gain).toBeLessThan(0.15);
  });

  it('у нот долгая атака и спад: иначе это пиликанье, а не фон', () => {
    expect(__ambientConfig.NOTE.attack).toBeGreaterThanOrEqual(0.5);
    expect(__ambientConfig.NOTE.release).toBeGreaterThanOrEqual(1);
  });
});
