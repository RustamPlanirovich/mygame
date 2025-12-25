import React, { useState } from 'react';
import { Book, Search, ChevronRight, X, Scroll, Cog, Building2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpTopic {
  id: string;
  title: string;
  category: string;
  content: string;
}

const LORE_CONTENT = `# История Человечества: От Пепла к Звёздам

## Великая Катастрофа (2087 год)

Всё изменилось в один день. Серия землетрясений невиданной силы прокатилась по всей планете, уничтожив большую часть цивилизации. Учёные до сих пор спорят о причинах - одни винят сверхмассивный выброс на Солнце, другие говорят об искусственном происхождении катаклизма.

**Последствия:**
- 95% населения Земли погибло
- Инфраструктура полностью разрушена
- Большая часть знаний утеряна
- Выжившие разбросаны по небольшим анклавам

## Эпоха Восстановления (2087-2150)

Выжившие человечество объединилось под эгидой **Глобального Совета Восстановления**. Начались отчаянные попытки собрать остатки технологий и знаний прошлого.

**Ключевые достижения:**
- Восстановление базовых производств
- Создание первых постапокалиптических генераторов энергии
- Открытие архивов довоенных технологий
- Формирование новой научной элиты

Вы - один из **Архитекторов Восстановления**, лидер индустриального комплекса, которому поручена грандиозная задача: не просто восстановить человечество, но и вывести его к звёздам.

## Новая Индустриализация (2150-2200)

С восстановлением энергетики и производства начался новый виток развития. Человечество вспомнило о нефти, газе, атомной энергии. Но этого было недостаточно.

**Прорывы:**
- Восстановление ядерной энергетики
- Разработка эффективных солнечных панелей нового поколения
- Создание первых автоматизированных заводов
- Возрождение компьютерных технологий

## Космическая Эра (2200-2250)

Прорыв случился, когда в руинах старого космодрома были найдены чертежи двигателя Васимира - революционной плазменной технологии. Человечество снова взглянуло в небо.

**Достижения:**
- Первые орбитальные станции
- Колонизация Луны
- Разработка межпланетных кораблей
- Открытие аномальных зон в космосе

## Галактическая Экспансия (2250-2300)

В 2251 году произошло Великое Открытие: древние руины на Марсе содержали **Врата Прыжка** - технологию мгновенного перемещения между звёздными системами. Это изменило всё.

**Семь Галактик:**

1. **Туманность Начала** - наша родная система, восстановленная Земля
2. **Газовые Гиганты** - богатые энергоресурсами миры
3. **Кристальные Пояса** - источник редких минералов для электроники
4. **Урановые Недра** - опасные, но богатые радиоактивными элементами
5. **Металлические Астероиды** - титан, вольфрам, хром
6. **Туманность Энергии** - живые энергокристаллы
7. **Древние Руины** - останки цивилизации Предтеч

## Угроза из Тьмы (настоящее время)

Но мы были не одни. С началом экспансии появились **Они** - враждебные сущности из глубин космоса. Роботизированные флоты, биомеханические монстры, аномалии, искажающие пространство.

**Текущая ситуация:**
- Человечество ведёт войну на нескольких фронтах
- Необходима постройка мегаструктур для защиты
- Изучение технологий Предтеч даёт надежду
- Время на исходе - враг усиливается

## Ваша Миссия

Вы не просто строите фабрики. Вы **спасаете человечество**.

**Ваши цели:**
1. Восстановить промышленность до довоенного уровня
2. Освоить все семь галактик
3. Построить флот для защиты колоний
4. Возвести мегаструктуры, которые обеспечат выживание
5. Раскрыть тайну Предтеч и понять, кто такие враги

Каждое здание, которое вы строите - это шаг к спасению. Каждая технология - это надежда. Каждый корабль - это защитник человечества.

**Вопрос только один: успеете ли вы?**

---

## Фракции и Силы

### Глобальный Совет Восстановления
Правительственная организация, координирующая восстановление. Предоставляет вам ресурсы, контракты и политическую поддержку.

### Гильдия Исследователей
Независимая научная организация, изучающая технологии Предтеч. Продают уникальные чертежи за влияние.

### Торговая Корпорация
Межгалактические торговцы. Управляют рынками и биржами. Иногда предлагают выгодные сделки.

### Военная Коалиция
Обороняет человечество от внешних угроз. Заказывает корабли и оружие.

### Предтечи (?)
Древняя цивилизация, исчезнувшая миллионы лет назад. Их руины содержат невероятные технологии. Что с ними случилось?

### Враги из Тьмы (?)
Неизвестная враждебная сила. Атакуют ваши платформы, уничтожают караваны. Их цель непонятна. Возможно, они связаны с исчезновением Предтеч?

---

## Концовки

В зависимости от ваших действий, игра может завершиться несколькими путями:

**🏆 Триумф Человечества**
- Построены все мегаструктуры
- Враги побеждены
- Человечество процветает во всех галактиках

**⚔️ Военная Победа**
- Построен огромный флот
- Враг уничтожен силой
- Человечество - новая доминирующая сила галактики

**🔬 Научное Вознесение**
- Изучены все технологии Предтеч
- Открыт секрет бессмертия
- Человечество трансцендирует

**💰 Экономическое Господство**
- Контроль над всеми рынками
- Монополия на редкие ресурсы
- Человечество - торговая империя

**❓ Тайный Путь**
- Раскрыта тайна Предтеч
- Найден альтернативный способ спасения
- ???

**☠️ Поражение**
- Ресурсы исчерпаны
- Враг уничтожил все платформы
- Человечество отброшено обратно на Землю
`;

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'buildings',
    title: 'Здания и производство',
    category: 'Основы',
    content: `Здания - основа вашей империи.

Типы зданий:
• Генераторы - производят энергию
• Шахты - добывают ресурсы
• Заводы - перерабатывают материалы
• Исследовательские - дают очки исследований

Уровни зданий:
Каждое здание можно прокачать до 500 уровня. Каждый уровень увеличивает производство и потребление пропорционально.

Стоимость апгрейда растет экспоненциально (x1.15 за уровень).`,
  },
  {
    id: 'energy',
    title: 'Энергетическая система',
    category: 'Основы',
    content: `Энергия необходима для работы всех зданий.

Производство энергии:
• Генератор Mk1/Mk2/Mk3
• Солнечные панели
• Газовые электростанции
• Атомные станции

Потребление:
Каждое здание потребляет энергию. При дефиците производство снижается пропорционально.

Энергосеть:
Электростанции имеют радиус действия. Используйте подстанции для расширения сети.`,
  },
  {
    id: 'proximity',
    title: 'Синергия зданий',
    category: 'Продвинутое',
    content: `Размещение зданий влияет на эффективность!

Правила:
• Шахты + Переработчики = +15% производство
• Электростанции + Хранилища = +25% емкость
• Заводы одного типа = промышленный район (+25%)
• Исследовательские здания = научный кампус (+40%)

Предупреждения:
Игра покажет:
🟢 Зеленый = оптимальное размещение
🟡 Желтый = приемлемо
🔴 Красный = плохое размещение

Некоторые здания требуют соседей для работы!`,
  },
  {
    id: 'research',
    title: 'Дерево технологий',
    category: 'Основы',
    content: `Исследования открывают новые возможности.

7 Эр технологий:
1. Восстановление - базовые технологии
2. Индустриализация - нефть, газ
3. Электроника - компьютеры, микросхемы
4. Военная - оружие, защита
5. Космическая - ракеты, спутники
6. Галактическая - колонии, флот
7. Доминация - мегаструктуры

Каждая технология требует определенное количество RP и может иметь зависимости от других технологий.`,
  },
  {
    id: 'market',
    title: 'Рынок и торговля',
    category: 'Экономика',
    content: `Превращайте ресурсы в кредиты!

Функции рынка:
• Продажа ресурсов по текущим ценам
• Динамическое ценообразование
• Контракты - заказы с фиксированными наградами
• Биржа - автоматическая торговля

Советы:
• Цены меняются в зависимости от предложения
• Выполняйте контракты для бонусов
• Используйте лимитные ордера на бирже
• Политика "Экспортная экономика" дает +30% к продажам`,
  },
  {
    id: 'policies',
    title: 'Политики',
    category: 'Продвинутое',
    content: `Политики дают мощные бонусы!

Как использовать:
1. Постройте Политический центр
2. Он производит Влияние
3. Тратьте влияние на активацию (стоимость варьируется)
4. Лимит: до 3 активных политик

Категории:
• Производственные (10 политик)
• Энергетические (6 политик)
• Экономические (7 политик)
• Научные (4 политики)
• Военные (4 политики)
• Космические (4 политики)
• Специальные (6 политик)

Выбирайте политики в зависимости от текущих целей!`,
  },
  {
    id: 'galaxies',
    title: 'Галактики',
    category: 'Космос',
    content: `7 уникальных галактик для исследования:

1. Туманность Начала - стартовая, базовые ресурсы
2. Газовые Гиганты - газ, нефть, химикаты
3. Кристальные Пояса - кремний, алмазы, +20% к электронике
4. Урановые Недра - уран, плутоний, радиация!
5. Металлические Астероиды - хром, титан, вольфрам
6. Туманность Энергии - энергокристаллы, плазма
7. Древние Руины - артефакты, боссы

Каждая галактика требует исследования технологии для разблокировки.`,
  },
  {
    id: 'platforms',
    title: 'Космические платформы',
    category: 'Космос',
    content: `Платформы - форпосты в далеких галактиках.

Функции:
• Автономная добыча ресурсов
• Бонусные ресурсы галактики
• Хранилище для ресурсов
• Автоматическая отправка на базу

Защита:
Платформы атакуют враги! Защищайте их:
• Оборонительные турели
• Щитовые генераторы
• Бронепластины
• Назначенные корабли флота

Улучшения:
• Добыча - увеличивает производство
• Защита - больше HP и щитов
• Хранилище - больше вместимость`,
  },
  {
    id: 'fleet',
    title: 'Космический флот',
    category: 'Космос',
    content: `Постройте флот для защиты и экспансии!

Типы кораблей:
• Истребители (100💰) - быстрые, слабые
• Корветы (500💰) - универсальные
• Крейсеры (2000💰) - мощные
• Дредноуты (10000💰) - флагманы
• Флагманы (50000💰) - уникальные

Функции:
• Защита платформ (+50% защита на платформе)
• Охрана караванов
• Атака боссов
• Исследование галактик

Улучшения кораблей:
• Оружие - больше урона
• Броня - больше HP
• Двигатели - выше скорость`,
  },
  {
    id: 'achievements',
    title: 'Достижения',
    category: 'Прогресс',
    content: `50+ достижений за различные действия!

Категории:
• Строительство - построить X зданий
• Производство - произвести X ресурсов
• Исследования - открыть технологии
• Экономика - заработать кредиты
• Космос - открыть галактики, платформы
• Флот - построить корабли, победить врагов
• Специальные - уникальные условия

Награды:
• Кредиты
• Очки исследований
• Влияние

Некоторые достижения скрыты до разблокировки!`,
  },
  {
    id: 'prestige',
    title: 'Система престижа',
    category: 'Эндгейм',
    content: `Престиж - перезапуск игры с бонусами!

Как работает:
1. Достигните определенного прогресса
2. Активируйте престиж
3. Получите Quantum Points (QP)
4. Потратьте QP на постоянные улучшения
5. Начните новую игру с бонусами

Улучшения престижа:
• +% производство всех ресурсов
• +% скорость исследований
• -% энергопотребление
• -% стоимость зданий
• Авто-разблокировка технологий
• Турбо-режим (x2 скорость игры)

QP рассчитываются по формуле с уменьшающейся доходностью.`,
  },
  {
    id: 'megastructures',
    title: 'Мегаструктуры',
    category: 'Эндгейм',
    content: `Величайшие сооружения галактики!

Доступные мегаструктуры:
• Сфера Дайсона - бесконечная энергия
• Кольцо мира - невероятное производство
• Врата между измерениями - мгновенная логистика
• Квантовый суперкомпьютер - x10 к исследованиям

Постройка:
Требует огромных ресурсов и времени. Строятся поэтапно с прогресс-баром.

Бонусы:
Каждая мегаструктура дает уникальные постоянные бонусы.

Необходимы для некоторых концовок игры!`,
  },
];

type TabType = 'lore' | 'mechanics' | 'buildings';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('lore');
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Закрытие по Escape
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(HELP_TOPICS.map(t => t.category)));

  const filteredTopics = HELP_TOPICS.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-16 z-50 bg-cyber-darker border-2 border-cyber-green rounded-lg shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-cyber-gray bg-cyber-dark flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cyber-green flex items-center gap-3">
            <Book size={28} />
            <span>Справка и История</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cyber-gray/30 rounded transition-colors"
            aria-label="Закрыть"
          >
            <X size={24} className="text-cyber-text" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-cyber-gray bg-cyber-dark/50">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => {
                setActiveTab('lore');
                setSelectedTopic(null);
              }}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
                activeTab === 'lore'
                  ? 'bg-cyber-green text-cyber-black font-bold'
                  : 'bg-cyber-darker text-cyber-text hover:bg-cyber-gray'
              }`}
            >
              <Scroll size={18} />
              <span>История и Лор</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('mechanics');
                setSelectedTopic(null);
              }}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
                activeTab === 'mechanics'
                  ? 'bg-cyber-green text-cyber-black font-bold'
                  : 'bg-cyber-darker text-cyber-text hover:bg-cyber-gray'
              }`}
            >
              <Cog size={18} />
              <span>Механики</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('buildings');
                setSelectedTopic(null);
              }}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
                activeTab === 'buildings'
                  ? 'bg-cyber-green text-cyber-black font-bold'
                  : 'bg-cyber-darker text-cyber-text hover:bg-cyber-gray'
              }`}
            >
              <Building2 size={18} />
              <span>Здания и Ресурсы</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'lore' ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto prose prose-invert">
                <div
                  className="text-cyber-text leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: LORE_CONTENT
                      .replace(/^# (.*)/gm, '<h1 class="text-3xl font-bold text-cyber-green mb-4 mt-8">$1</h1>')
                      .replace(/^## (.*)/gm, '<h2 class="text-2xl font-bold text-cyber-blue mb-3 mt-6">$2</h2>')
                      .replace(/^### (.*)/gm, '<h3 class="text-xl font-bold text-cyan-400 mb-2 mt-4">$3</h3>')
                      .replace(/^\*\*(.*)\*\*/gm, '<strong class="text-cyber-green">$1</strong>')
                      .replace(/^- (.*)/gm, '<li class="ml-4">• $1</li>')
                      .replace(/^\d+\. (.*)/gm, '<li class="ml-4">$1</li>')
                      .replace(/\n\n/g, '<br/><br/>'),
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Sidebar */}
              <div className="w-72 shrink-0 border-r border-cyber-gray flex flex-col bg-cyber-dark/30">
                {/* Search */}
                <div className="shrink-0 p-3 border-b border-cyber-gray">
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-text-dim"
                    />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-cyber-black border border-cyber-gray rounded pl-10 pr-3 py-2 text-sm text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-green"
                    />
                  </div>
                </div>

                {/* Topics list */}
                <div className="flex-1 overflow-y-auto">
                  {categories.map((category) => {
                    const topicsInCategory = filteredTopics.filter(
                      t => t.category === category &&
                        (activeTab === 'mechanics' && ['Основы', 'Продвинутое', 'Экономика', 'Прогресс', 'Эндгейм'].includes(category) ||
                         activeTab === 'buildings' && ['Космос'].includes(category))
                    );
                    if (topicsInCategory.length === 0) return null;

                    return (
                      <div key={category} className="mb-4">
                        <div className="px-4 py-2 text-xs font-bold text-cyber-blue uppercase">
                          {category}
                        </div>
                        {topicsInCategory.map((topic) => (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group ${
                              selectedTopic?.id === topic.id
                                ? 'bg-cyber-green/20 text-cyber-green border-l-2 border-cyber-green'
                                : 'text-cyber-text hover:bg-cyber-dark'
                            }`}
                          >
                            <span>{topic.title}</span>
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${
                                selectedTopic?.id === topic.id ? 'text-cyber-green' : 'text-cyber-text-dim'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {selectedTopic ? (
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-cyber-green mb-2">
                      {selectedTopic.title}
                    </h3>
                    <div className="inline-block px-2 py-1 bg-cyber-blue/20 text-cyber-blue text-xs rounded mb-4">
                      {selectedTopic.category}
                    </div>
                    <div className="text-cyber-text whitespace-pre-line leading-relaxed">
                      {selectedTopic.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <Book size={64} className="text-cyber-text-dim mb-4" />
                    <p className="text-cyber-text-dim text-lg">
                      Выберите тему из списка слева
                    </p>
                    <p className="text-cyber-text-dim text-sm mt-2">
                      или используйте поиск
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Старый компонент для совместимости - теперь просто кнопка открытия модального окна
export const HelpPanel: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="h-full flex items-center justify-center bg-cyber-darker p-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="cyber-button px-8 py-4 text-lg"
        >
          <div className="flex items-center gap-3">
            <Book size={24} />
            <span>Открыть справку и историю</span>
          </div>
        </button>
      </div>
      <HelpModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
