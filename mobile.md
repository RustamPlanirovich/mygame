# Мобильная адаптация

## Обзор

Фаза 10.5 добавляет полноценную поддержку мобильных устройств и планшетов с адаптивным дизайном, touch-управлением и оптимизацией производительности.

## Основные компоненты

### 1. Device Detection Hook (useDevice.ts)

**Файл:** `/src/hooks/useDevice.ts`

**Определяет:**
- Тип устройства: mobile (< 768px), tablet (768-1023px), desktop (≥ 1024px)
- Touch-поддержка
- Ориентация экрана (portrait/landscape)
- Размеры экрана

**Использование:**
```typescript
const device = useDevice();

if (device.isMobile) {
  // Mobile-specific logic
}

if (device.isTouchDevice) {
  // Touch-specific behavior
}

if (device.orientation === 'landscape') {
  // Landscape layout
}
```

**Специализированные хуки:**
```typescript
const isMobile = useIsMobile();
const isTouchDevice = useIsTouchDevice();
const recommended = useRecommendedSettings();
// recommended = { targetFPS: 30, quality: 'low', ... }
```

### 2. Touch Gestures Hook (useTouchGestures.ts)

**Файл:** `/src/hooks/useTouchGestures.ts`

**Поддерживаемые жесты:**
- **Tap**: Одиночное касание
- **Double Tap**: Двойное касание (< 300ms между касаниями)
- **Long Press**: Долгое нажатие (500ms)
- **Swipe**: Свайп в 4 направлениях (up/down/left/right)
- **Pinch**: Жест щипка для зума (2 пальца)
- **Pan**: Перетаскивание (1 палец)

**Использование:**
```typescript
const elementRef = useRef<HTMLDivElement>(null);

useTouchGestures(elementRef, {
  onTap: (x, y) => {
    console.log('Tapped at', x, y);
  },
  onDoubleTap: (x, y) => {
    console.log('Double tapped at', x, y);
  },
  onLongPress: (x, y) => {
    console.log('Long pressed at', x, y);
  },
  onSwipe: (direction, deltaX, deltaY) => {
    console.log('Swiped', direction);
  },
  onPinch: (scale) => {
    console.log('Pinched, scale:', scale);
  },
  onPan: (deltaX, deltaY) => {
    console.log('Panning', deltaX, deltaY);
  },
});
```

**Простые хуки:**
```typescript
// Только tap
useTap(elementRef, (x, y) => {
  console.log('Tapped!');
});

// Pinch-to-zoom
usePinchZoom(elementRef, (scale) => {
  setZoom(scale);
});
```

### 3. Адаптивные стили (index.css)

**Файл:** `/src/index.css`

**Медиа-запросы:**

#### Mobile (< 768px)
- Уменьшенные шрифты (14px)
- Компактные кнопки и padding
- Минимальный размер touch-элементов (44x44px)
- Полноэкранные модальные окна
- Скрытие декоративных элементов (.hide-on-mobile)

#### Tablet (768-1023px)
- Средние размеры (15px)
- Частичное скрытие элементов (.hide-on-tablet)

#### Touch Devices (@media hover: none)
- Убраны hover-эффекты
- Увеличенные touch-таргеты (48x48px)
- Отключены анимации для производительности

#### Landscape на мобильных
- Уменьшенные вертикальные отступы
- Горизонтальная компоновка

#### Reduced Motion
- Минимальные анимации (0.01s)
- Для пользователей с prefers-reduced-motion

## Мобильная версия интерфейса

### Изменения в App.tsx

**Desktop (≥ 1024px):**
- Фиксированный sidebar справа (420px)
- Dashboard всегда виден
- Minimap в правом нижнем углу
- Все панели видимы

**Tablet (768-1023px):**
- Фиксированный sidebar (420px)
- Частично скрыты некоторые элементы
- Dashboard виден

**Mobile (< 768px):**
- Slide-in sidebar (85vw, max 400px)
- Кнопка меню (гамбургер) в правом верхнем углу
- Dashboard скрыт для экономии места
- Minimap скрыт
- Pollution Panel скрыт
- Компактные панели с минимальными отступами
- Уменьшенная высота ClickerZone (180px вместо 280px)

**Мобильное меню:**
```tsx
{device.isMobile ? (
  <>
    {/* Backdrop */}
    {showMobileMenu && (
      <div className="fixed inset-0 bg-black/70 z-40" />
    )}
    
    {/* Slide-in sidebar */}
    <aside className={`fixed top-0 right-0 bottom-0 w-[85vw] 
      transition-transform ${showMobileMenu ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Content */}
    </aside>
  </>
) : (
  <aside className="w-[420px]">
    {/* Content */}
  </aside>
)}
```

## Рекомендуемые настройки по устройствам

### Mobile
```typescript
{
  targetFPS: 30,
  quality: 'low',
  showAnimations: false,
  particleEffects: false,
  showGrid: false,
  compactMode: true,
}
```

### Tablet
```typescript
{
  targetFPS: 60,
  quality: 'medium',
  showAnimations: true,
  particleEffects: false,
  showGrid: true,
  compactMode: true,
}
```

### Desktop
```typescript
{
  targetFPS: 60,
  quality: 'high',
  showAnimations: true,
  particleEffects: true,
  showGrid: true,
  compactMode: false,
}
```

## Оптимизация для мобильных

### 1. Автоматическая настройка FPS
При первой загрузке на мобильном устройстве автоматически применяется targetFPS: 30 для экономии батареи.

### 2. Отключение тяжелых эффектов
- Particle effects отключены
- Анимации минимизированы
- Сложные тени убраны

### 3. Компактный режим
- Уменьшенные отступы и padding
- Меньшие размеры шрифтов
- Скрытие необязательных элементов

### 4. Touch-оптимизация
- Минимальный размер кликабельных элементов: 44-48px
- Увеличенные отступы между кнопками
- Отключены hover-эффекты на touch-устройствах

### 5. Lazy loading
- Используется IntersectionObserver для отложенной загрузки
- Рендерится только видимая часть больших списков

## Touch-управление в игре

### FactoryGrid
Можно добавить touch-жесты для управления сеткой:

```typescript
const gridRef = useRef<HTMLDivElement>(null);

useTouchGestures(gridRef, {
  onTap: (x, y) => {
    // Клик по ячейке
    const cell = pixelToGrid(x, y);
    selectTile(cell.x, cell.y);
  },
  onDoubleTap: (x, y) => {
    // Двойной клик - размещение здания
    const cell = pixelToGrid(x, y);
    placeBuilding(cell.x, cell.y);
  },
  onPan: (deltaX, deltaY) => {
    // Перетаскивание сетки
    panCamera(deltaX, deltaY);
  },
  onPinch: (scale) => {
    // Зум сетки
    zoomCamera(scale);
  },
  onSwipe: (direction) => {
    // Быстрая навигация
    if (direction === 'left') showNextPanel();
    if (direction === 'right') showPrevPanel();
  },
});
```

### Модальные окна
Свайп вниз для закрытия:

```typescript
useTouchGestures(modalRef, {
  onSwipe: (direction) => {
    if (direction === 'down') {
      closeModal();
    }
  },
});
```

### Списки
Pull-to-refresh:

```typescript
useTouchGestures(listRef, {
  onSwipe: (direction, deltaX, deltaY) => {
    if (direction === 'down' && deltaY > 100) {
      refreshList();
    }
  },
});
```

## Тестирование на мобильных

### Chrome DevTools
1. Открыть DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Выбрать устройство (iPhone, iPad, etc.)
4. Тестировать разные размеры экрана

### Responsive Design Mode в Firefox
1. Ctrl+Shift+M
2. Выбрать preset или кастомный размер
3. Тестировать touch events

### Реальные устройства
- Тестировать на реальных мобильных устройствах
- Проверять производительность
- Тестировать touch-жесты
- Проверять battery drain

## Известные ограничения

### iOS Safari
- 100vh включает адресную строку (используем 100dvh)
- Touch events могут иметь задержку (используем passive: false)
- Некоторые Web Workers могут работать медленнее

### Android Chrome
- Может агрессивно throttle background tabs
- GPU acceleration может быть ограничена на слабых устройствах

### Общие
- Мобильные браузеры имеют меньше памяти
- Touch events имеют другую точность, чем mouse
- Ориентация экрана может меняться во время игры

## Будущие улучшения

1. **Progressive Web App (PWA)**
   - Service Worker для offline-режима
   - Установка на home screen
   - Push notifications

2. **Haptic Feedback**
   - Вибрация при касаниях
   - Тактильный отклик при событиях

3. **Adaptive Streaming**
   - Динамическая загрузка ассетов
   - Разные качества текстур

4. **Virtual Joystick**
   - Для управления камерой
   - Альтернатива pan-жестам

5. **Voice Control**
   - Голосовые команды для действий
   - Accessibility feature

## Рекомендации для пользователей

### Для лучшей производительности на мобильных:
1. Закройте другие приложения
2. Включите режим производительности
3. Подключите зарядку при долгой игре
4. Используйте Wi-Fi вместо мобильных данных
5. Уменьшите яркость экрана
6. Отключите фоновые процессы

### Лучшие настройки для мобильных:
- Target FPS: 30
- Quality: Low
- Отключить: Animations, Particle Effects, Grid
- Включить: Compact Mode, Autosave

### Landscape vs Portrait:
- **Landscape**: Рекомендуется для игры, больше места для сетки
- **Portrait**: Удобнее для меню и управления зданиями
