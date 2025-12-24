# PROTOCOL: YGGDRASIL (Phase 1 - Refactored)

## Технический Стек
- **Core:** TypeScript + Vite
- **UI:** React 18 + Tailwind CSS
- **State:** Zustand
- **Math:** break_eternity.js
- **Icons:** Lucide React

## Запуск
1. Установите зависимости:
   ```bash
   npm install
   ```
2. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
3. Откройте ссылку в браузере (обычно http://localhost:5173).

## Структура
- `src/core`: Игровая логика, типы, математика.
- `src/features`: Zustand сторы (состояние игры).
- `src/components`: React компоненты UI.
- `src/hooks`: Игровой цикл и другие хуки.

## Текущий статус
Реализован MVP на новом стеке:
- [x] Ресурсная система (Энергия, Руда) с поддержкой больших чисел.
- [x] Покупка зданий с динамической ценой.
- [x] Игровой цикл (Tick system).
- [x] Сохранение/Загрузка (LocalStorage).
- [x] Киберпанк UI.
