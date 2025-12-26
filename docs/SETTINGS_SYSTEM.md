# Система сохранения настроек и preferences в БД

## Обзор

Реализована полная система хранения пользовательских настроек и preferences в базе данных PostgreSQL вместо localStorage. Это обеспечивает:

1. **Синхронизацию между устройствами** - пользователь видит свои настройки на любом устройстве
2. **Надежность** - настройки не теряются при очистке кэша браузера
3. **Изоляцию пользователей** - каждый пользователь имеет свои настройки
4. **Централизованное управление** - все данные пользователя в одном месте

## Что хранится в БД

### 1. Игровые настройки (settings)
- Графика (FPS, качество, эффекты)
- Геймплей (скорость игры, автосохранение)
- UI (подсказки, компактный режим)
- Горячие клавиши
- Аудио (громкость)

### 2. Закрепленные ресурсы (pinned_resources)
- Список ресурсов, закрепленных в UI
- По умолчанию: energy, ore, ice, carbon, steel, dark_matter

### 3. Текущее сохранение (current_save_id)
- ID активного сохранения игры
- Используется для автосохранения

## Структура БД

### Таблица `users`

Добавлены новые поля:
```sql
settings JSONB DEFAULT '{}'
current_save_id INTEGER REFERENCES game_save(id) ON DELETE SET NULL
pinned_resources JSONB DEFAULT '["energy", "ore", "ice", "carbon", "steel", "dark_matter"]'
```

## API Endpoints

### Settings API

#### GET `/api/settings`

Получить настройки текущего пользователя.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)

**Response:**
```json
{
  "ok": true,
  "settings": {
    "graphics": { ... },
    "gameplay": { ... },
    "ui": { ... },
    "hotkeys": { ... },
    "audio": { ... }
  }
}
```

#### PUT `/api/settings`

Сохранить настройки пользователя.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)
- `Content-Type: application/json`

**Body:**
```json
{
  "settings": {
    "graphics": { ... },
    "gameplay": { ... },
    "ui": { ... },
    "hotkeys": { ... },
    "audio": { ... }
  }
}
```

**Response:**
```json
{
  "ok": true,
  "settings": { ... }
}
```

### User Preferences API

#### GET `/api/preferences/pinned-resources`

Получить закрепленные ресурсы пользователя.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)

**Response:**
```json
{
  "ok": true,
  "pinnedResources": ["energy", "ore", "ice", "carbon", "steel", "dark_matter"]
}
```

#### PUT `/api/preferences/pinned-resources`

Обновить закрепленные ресурсы.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)
- `Content-Type: application/json`

**Body:**
```json
{
  "pinnedResources": ["energy", "ore", "steel"]
}
```

**Response:**
```json
{
  "ok": true,
  "pinnedResources": ["energy", "ore", "steel"]
}
```

#### GET `/api/preferences/current-save`

Получить ID текущего сохранения.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)

**Response:**
```json
{
  "ok": true,
  "currentSaveId": 123
}
```

#### PUT `/api/preferences/current-save`

Обновить ID текущего сохранения.

**Headers:**
- `x-user-id` - ID пользователя (обязательно)
- `Content-Type: application/json`

**Body:**
```json
{
  "currentSaveId": 123
}
```

**Response:**
```json
{
  "ok": true,
  "currentSaveId": 123
}
```

## Клиентская часть

### Утилиты для работы с настройками

Создан файл [`src/utils/settingsApi.ts`](../src/utils/settingsApi.ts) с функциями:

#### Настройки игры

**`loadSettingsFromServer(): Promise<GameSettings>`**

Загружает настройки пользователя с сервера. Если пользователь не авторизован, загружает из localStorage (обратная совместимость).

**`saveSettingsToServer(settings: GameSettings): Promise<{ok: boolean, error?: string}>`**

Сохраняет настройки на сервер. Если пользователь не авторизован, сохраняет в localStorage.

#### Pinned Resources

**`loadPinnedResourcesFromServer(): Promise<ResourceType[]>`**

Загружает закрепленные ресурсы с сервера.

**`savePinnedResourcesToServer(pinnedResources: ResourceType[]): Promise<{ok: boolean, error?: string}>`**

Сохраняет закрепленные ресурсы на сервер.

#### Current Save ID

**`loadCurrentSaveIdFromServer(): Promise<number | null>`**

Загружает ID текущего сохранения с сервера.

**`saveCurrentSaveIdToServer(currentSaveId: number | null): Promise<{ok: boolean, error?: string}>`**

Сохраняет ID текущего сохранения на сервер.

#### Общие

**`getUserId(): string | null`**

Получает ID текущего пользователя из localStorage.

### Компоненты

#### `SettingsPanel`

Обновлен для работы с API:
- При монтировании автоматически загружает настройки с сервера
- Кнопка "Сохранить" отправляет настройки на сервер
- Кнопка "Сбросить" устанавливает дефолтные настройки и сохраняет их на сервер
- Отображает статус сохранения (успех/ошибка)
- Поддерживает обратную совместимость с localStorage для неавторизованных пользователей

#### `AuthForm`

Обновлен для автозагрузки всех preferences:
- При успешном входе (`mode === 'login'`) автоматически загружает:
  - Настройки игры (settings)
  - Закрепленные ресурсы (pinned_resources)
- Сохраняет загруженные данные в localStorage для быстрого доступа
- При регистрации использует дефолтные значения

#### `usePinnedResources` hook

Обновлен для работы с API:
- При монтировании загружает pinned resources с сервера
- При изменении автоматически сохраняет на сервер
- Поддерживает обратную совместимость с localStorage

#### `gameStore`

Обновлен для работы с currentSaveId через API:
- `saveGame()` - загружает currentSaveId с сервера для автосохранения
- `saveGameManual()` - сохраняет ID нового сохранения на сервер
- `loadSaveById()` - обновляет currentSaveId при загрузке сохранения
- `loadGame()` - загружает последнее сохранение и обновляет currentSaveId

## Миграции

Созданы файлы миграций:

### [`server/migration_settings.sql`](../server/migration_settings.sql)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
COMMENT ON COLUMN users.settings IS 'Персональные настройки пользователя';
```

### [`server/migration_user_preferences.sql`](../server/migration_user_preferences.sql)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_save_id INTEGER REFERENCES game_save(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_resources JSONB DEFAULT '["energy", "ore", "ice", "carbon", "steel", "dark_matter"]';

COMMENT ON COLUMN users.current_save_id IS 'ID текущего активного сохранения пользователя';
COMMENT ON COLUMN users.pinned_resources IS 'Закрепленные ресурсы в UI (массив ResourceType)';

CREATE INDEX IF NOT EXISTS idx_users_current_save ON users(current_save_id);
```

Обе миграции уже применены к БД.

## Типы настроек

Все типы настроек определены в [`src/core/gameTypes.settings.ts`](../src/core/gameTypes.settings.ts):

```typescript
interface GameSettings {
  graphics: {
    showGrid: boolean;
    showProximityHints: boolean;
    showEnergyGrid: boolean;
    showLogisticsGrid: boolean;
    showAnimations: boolean;
    particleEffects: boolean;
    targetFPS: number;
    quality: 'low' | 'medium' | 'high';
  };
  gameplay: {
    gameSpeed: number;
    autosaveInterval: number;
    autosaveEnabled: boolean;
    pauseOnBlur: boolean;
    confirmBuilding: boolean;
    confirmDestruction: boolean;
  };
  ui: {
    showTooltips: boolean;
    showMinimap: boolean;
    showDashboard: boolean;
    compactMode: boolean;
    tooltipDelay: number;
    notificationsEnabled: boolean;
  };
  hotkeys: {
    togglePause: string;
    quickSave: string;
    quickLoad: string;
    // ... и другие
  };
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muteAll: boolean;
  };
}
```

## Обратная совместимость

Система полностью совместима с предыдущей версией:
- Если пользователь не авторизован, настройки сохраняются в localStorage
- При первом входе, если в БД нет настроек, используются дефолтные
- Настройки из localStorage не теряются при переходе на новую систему

## Тестирование

Для тестирования:

1. Запустите API сервер: `npm run dev:api`
2. Авторизуйтесь в игре
3. Откройте панель настроек
4. Измените любые настройки
5. Нажмите "Сохранить"
6. Выйдите и войдите снова - настройки должны загрузиться автоматически
7. Откройте игру с другого браузера/устройства - настройки будут синхронизированы

## Примеры использования

### Загрузка настроек при входе

```typescript
import { loadSettingsFromServer, loadPinnedResourcesFromServer } from '../../utils/settingsApi';

// Настройки игры
const settings = await loadSettingsFromServer();
localStorage.setItem('gameSettings', JSON.stringify(settings));

// Закрепленные ресурсы
const pinnedResources = await loadPinnedResourcesFromServer();
localStorage.setItem('ygg_pinned_resources_v1', JSON.stringify(pinnedResources));
```

### Сохранение настроек

```typescript
import { saveSettingsToServer } from '../../utils/settingsApi';

const result = await saveSettingsToServer(newSettings);
if (result.ok) {
  console.log('Настройки сохранены!');
} else {
  console.error('Ошибка:', result.error);
}
```

### Работа с pinned resources

```typescript
import { savePinnedResourcesToServer } from '../../utils/settingsApi';

const result = await savePinnedResourcesToServer(['energy', 'ore', 'steel']);
if (result.ok) {
  console.log('Pinned resources обновлены!');
}
```

### Работа с current save ID

```typescript
import { loadCurrentSaveIdFromServer, saveCurrentSaveIdToServer } from '../../utils/settingsApi';

// Загрузка
const currentSaveId = await loadCurrentSaveIdFromServer();

// Сохранение
await saveCurrentSaveIdToServer(123);
```

## Безопасность

- Все запросы к API настроек и preferences требуют авторизацию через заголовок `x-user-id`
- Пользователь может изменять только свои данные
- Данные хранятся в формате JSONB, что обеспечивает валидацию на уровне БД
- При получении данных они мерджатся с дефолтными для обеспечения полноты структуры
- `current_save_id` проверяется на принадлежность пользователю перед сохранением

## Обратная совместимость

Система полностью совместима с предыдущей версией:
- Если пользователь не авторизован, все данные сохраняются в localStorage
- При первом входе, если в БД нет данных, используются дефолтные значения
- Данные из localStorage не теряются при переходе на новую систему
- Поддерживается автоматическая миграция при входе

## Тестирование

Для тестирования:

1. Запустите API сервер: `npm run dev:api`
2. Авторизуйтесь в игре
3. **Настройки:**
   - Откройте панель настроек
   - Измените любые настройки
   - Нажмите "Сохранить"
4. **Pinned Resources:**
   - Закрепите/открепите ресурсы в UI
   - Они автоматически сохранятся на сервер
5. **Current Save:**
   - Создайте сохранение
   - Загрузите другое сохранение
   - ID активного сохранения автоматически обновится
6. Выйдите и войдите снова - все данные должны загрузиться автоматически
7. Откройте игру с другого браузера/устройства - данные будут синхронизированы
