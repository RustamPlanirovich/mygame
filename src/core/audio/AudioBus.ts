/**
 * ЗВУКОВАЯ ШИНА (bigplan.md, пункты 15, 16, 35)
 *
 * Аудио в проекте отсутствовало полностью: ни одного файла в public/, ни `Audio`, ни
 * `AudioContext` в коде. В типах настроек лежал осиротевший `settings.audio` с четырьмя
 * полями, который никто не читал, а ползунок «Музыка» в профиле ни на что не влиял.
 *
 * ПОЧЕМУ ОДНА ШИНА, А НЕ `new Audio()` ПО МЕСТУ
 * Иначе громкость, mute и «не играть в неактивной вкладке» пришлось бы реализовывать в каждом
 * вызывающем месте, а частые звуки (клик по клетке) создавали бы по объекту на каждое нажатие.
 * Здесь всё это в одном месте: два подмикса (музыка и эффекты) под общим master.
 *
 * ПОЧЕМУ ИНИЦИАЛИЗАЦИЯ ПО ЖЕСТУ ПОЛЬЗОВАТЕЛЯ
 * Браузеры блокируют автоплей: `AudioContext`, созданный до первого взаимодействия, остаётся
 * в состоянии 'suspended' и молчит. Поэтому контекст создаётся лениво — при первом же клике или
 * нажатии клавиши, — и это НЕ баг, а требование платформы.
 *
 * ПРО ФАЙЛЫ
 * Шина умеет и файлы (`playFile`), но сейчас звук синтезируется: ассетов в проекте нет, а
 * «спокойная музыка без слов» синтезом получается без слов по построению, без лицензий и без
 * мегабайтов в бандле. Если позже появятся настоящие треки, менять придётся только источник —
 * вызывающий код и настройки останутся теми же.
 */

export type AudioChannel = 'music' | 'sfx';

export interface AudioLevels {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muteAll: boolean;
}

const DEFAULT_LEVELS: AudioLevels = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muteAll: false,
};

/** Плавность изменения громкости: мгновенный скачок даёт слышимый щелчок. */
const RAMP_SECONDS = 0.08;

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Record<AudioChannel, GainNode | null> = { music: null, sfx: null };
  private levels: AudioLevels = { ...DEFAULT_LEVELS };
  private unlockBound = false;
  /** Буферы файлов по url — чтобы не декодировать один и тот же звук дважды. */
  private buffers = new Map<string, AudioBuffer>();

  /** Готова ли шина играть (контекст создан и разблокирован). */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Узел, к которому подключаются источники канала. */
  destinationFor(channel: AudioChannel): GainNode | null {
    return this.channels[channel];
  }

  /**
   * Повесить разблокировку на первый жест пользователя.
   *
   * Вызывать можно многократно (идемпотентно): хук настроек не обязан знать, вешали уже или нет.
   */
  bindUnlock(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;

    const unlock = () => {
      void this.resume();
      // Слушатели одноразовые: после первого жеста контекст уже создан.
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  /** Создать контекст (если ещё нет) и вывести его из suspended. */
  async resume(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;

      try {
        this.ctx = new Ctor();
      } catch {
        // Контекст может не создаться (политика браузера, отсутствие устройства вывода).
        return false;
      }

      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);

      for (const channel of ['music', 'sfx'] as AudioChannel[]) {
        const gain = this.ctx.createGain();
        gain.connect(this.master);
        this.channels[channel] = gain;
      }

      this.applyLevels(0); // без рампы: начальные значения
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }

    return this.ctx.state === 'running';
  }

  /** Приостановить всё (неактивная вкладка). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  /** Обновить громкости из настроек. */
  setLevels(levels: Partial<AudioLevels>): void {
    this.levels = { ...this.levels, ...levels };
    this.applyLevels(RAMP_SECONDS);
  }

  getLevels(): AudioLevels {
    return { ...this.levels };
  }

  private applyLevels(ramp: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;

    const set = (node: GainNode | null, value: number) => {
      if (!node) return;
      const target = clamp01(value);
      if (ramp <= 0) {
        node.gain.setValueAtTime(target, now);
      } else {
        // setTargetAtTime, а не linearRamp: не требует знать длительность и не «дёргает»
        // при частых изменениях (игрок тянет ползунок).
        node.gain.setTargetAtTime(target, now, ramp);
      }
    };

    set(this.master, this.levels.muteAll ? 0 : this.levels.masterVolume);
    set(this.channels.music, this.levels.musicVolume);
    set(this.channels.sfx, this.levels.sfxVolume);
  }

  /**
   * Проиграть готовый файл. Сейчас не используется (ассетов нет), но именно эта точка
   * позволит добавить настоящие треки, не меняя ни настройки, ни вызывающий код.
   */
  async playFile(url: string, channel: AudioChannel = 'sfx', loop = false): Promise<AudioBufferSourceNode | null> {
    if (!(await this.resume())) return null;
    const ctx = this.ctx!;
    const destination = this.channels[channel];
    if (!destination) return null;

    let buffer = this.buffers.get(url);
    if (!buffer) {
      try {
        const response = await fetch(url);
        buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(url, buffer);
      } catch (e) {
        console.warn('[audio] не удалось загрузить', url, e);
        return null;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(destination);
    source.start();
    return source;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Единственная шина на приложение. */
export const audioBus = new AudioBus();
