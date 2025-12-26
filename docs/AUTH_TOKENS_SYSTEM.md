# Система авторизации с токенами сессий

## Обзор

Реализована полноценная система авторизации на основе токенов сессий вместо хранения данных пользователя в localStorage. Это обеспечивает:

1. **Безопасность** - токены не могут быть подделаны, проверяются на сервере
2. **Управление сессиями** - возможность выхода из конкретной сессии или всех сессий
3. **Срок действия** - токены автоматически истекают через 30 дней
4. **Контроль доступа** - централизованная проверка прав доступа на сервере

## Преимущества

### Было (localStorage с user.id):
❌ Небезопасно - можно подделать user.id в DevTools  
❌ Нет управления сессиями - нельзя разлогинить пользователя удаленно  
❌ Нет срока действия - авторизация вечная  
❌ Данные пользователя хранятся локально  

### Стало (токены сессий):
✅ Безопасно - токены проверяются на сервере  
✅ Управление сессиями - можно выйти из конкретной сессии или всех  
✅ Срок действия - токены истекают через 30 дней  
✅ Логирование - отслеживание IP и User-Agent  
✅ Автоочистка - истекшие сессии удаляются автоматически  

## Структура БД

### Таблица `sessions`

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);
```

**Поля:**
- `token` - уникальный токен сессии (64 символа hex)
- `expires_at` - время истечения сессии (30 дней с момента создания)
- `last_activity_at` - обновляется при каждом API запросе
- `user_agent`, `ip_address` - для безопасности и аналитики

**Индексы:**
- `idx_sessions_token` - быстрый поиск по токену
- `idx_sessions_user_id` - все сессии пользователя
- `idx_sessions_expires_at` - для очистки истекших

## API Endpoints

### Регистрация

**POST `/api/auth/register`**

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "settings": {},
    "current_save_id": null,
    "pinned_resources": ["energy", "ore", "ice", "carbon", "steel", "dark_matter"]
  },
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2026-01-25T12:00:00.000Z"
}
```

### Вход

**POST `/api/auth/login`**

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:** (аналогично регистрации)

### Выход

**POST `/api/auth/logout`**

**Headers:** `Authorization: Bearer <token>`

Удаляет текущую сессию.

### Выход из всех сессий

**POST `/api/auth/logout-all`**

**Headers:** `Authorization: Bearer <token>`

Удаляет все сессии пользователя (на всех устройствах).

### Информация о сессии

**GET `/api/auth/session`**

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "settings": {},
    "current_save_id": 123,
    "pinned_resources": [...],
    "created_at": "2025-12-26T12:00:00.000Z",
    "last_activity_at": "2025-12-26T12:30:00.000Z",
    "expires_at": "2026-01-25T12:00:00.000Z"
  }
}
```

## Middleware авторизации

Все защищенные эндпоинты используют `authMiddleware`:

```javascript
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'NOT_AUTHENTICATED' });
  }
  
  const token = authHeader.substring(7);
  
  // Проверяем токен в БД
  const result = await pool.query(
    'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  
  if (result.rowCount === 0) {
    return res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
  }
  
  req.userId = result.rows[0].user_id;
  req.token = token;
  
  // Обновляем время последней активности
  await pool.query(
    'UPDATE sessions SET last_activity_at = NOW() WHERE token = $1',
    [token]
  );
  
  next();
};
```

## Клиентская часть

### Утилиты ([src/utils/settingsApi.ts](../src/utils/settingsApi.ts))

#### Управление токенами

```typescript
// Получить токен
getAuthToken(): string | null

// Сохранить токен
setAuthToken(token: string): void

// Удалить токен
removeAuthToken(): void

// Проверить авторизацию
isAuthenticated(): boolean

// Получить заголовки для API
getAuthHeaders(): Record<string, string>
```

#### Работа с сессиями

```typescript
// Получить информацию о текущей сессии
getCurrentSession(): Promise<{ ok: boolean; user?: any; error?: string }>

// Выход
logout(): Promise<{ ok: boolean; error?: string }>
```

### Использование

#### При входе/регистрации

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const data = await response.json();

if (data.ok) {
  // Сохраняем токен
  setAuthToken(data.token);
  
  // Загружаем данные пользователя
  const settings = await loadSettingsFromServer();
  // ...
}
```

#### При API запросах

```typescript
const response = await fetch('/api/settings', {
  headers: getAuthHeaders(), // Автоматически добавит Authorization: Bearer <token>
});

if (response.status === 401) {
  // Токен недействителен, удаляем и перенаправляем на вход
  removeAuthToken();
  // redirect to login
}
```

## Автоочистка истекших сессий

Сервер автоматически удаляет истекшие сессии каждый час:

```javascript
setInterval(async () => {
  const result = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  if (result.rowCount > 0) {
    console.log(`[cleanup] Removed ${result.rowCount} expired sessions`);
  }
}, 60 * 60 * 1000); // 1 час
```

## Миграция

Создан файл миграции [server/migration_sessions.sql](../server/migration_sessions.sql).

Миграция уже применена к БД.

## Обновленные компоненты

### AuthForm

- Сохраняет токен вместо объекта user
- Автоматически загружает настройки после успешного входа

### gameStore

- Использует `getAuthHeaders()` вместо `x-user-id`
- Проверяет авторизацию через `isAuthenticated()`
- Автоматически удаляет токен при ошибке 401

### All API functions

Все функции в `settingsApi.ts` обновлены:
- `loadSettingsFromServer()`
- `saveSettingsToServer()`
- `loadPinnedResourcesFromServer()`
- `savePinnedResourcesToServer()`
- `loadCurrentSaveIdFromServer()`
- `saveCurrentSaveIdToServer()`

## Безопасность

1. **CORS** настроен на разрешение только `Authorization` заголовка
2. **Токены** генерируются криптографически безопасным способом (32 байта)
3. **Проверка на каждый запрос** - токен проверяется в БД
4. **Автоматическое истечение** - сессии живут 30 дней
5. **Последняя активность** - отслеживается для аналитики
6. **IP и User-Agent** - логируются для безопасности

## Тестирование

1. Запустите API сервер: `npm run dev:api`
2. Зарегистрируйтесь или войдите
3. Проверьте, что токен сохранен в localStorage (ключ `authToken`)
4. Попробуйте выполнить API запросы - они должны работать
5. Удалите токен вручную - должна быть ошибка 401
6. Выйдите через `/api/auth/logout` - токен должен быть удален

## Обратная совместимость

- Старый код с `localStorage.getItem('user')` больше не используется
- Функция `getUserId()` помечена как `@deprecated`
- Для неавторизованных пользователей сохраняется fallback на localStorage

## Будущие улучшения

1. **Refresh tokens** - автоматическое обновление токенов
2. **Rate limiting** - защита от брутфорса
3. **Email verification** - подтверждение email при регистрации
4. **Password reset** - восстановление пароля
5. **OAuth** - вход через Google/GitHub
6. **2FA** - двухфакторная аутентификация
