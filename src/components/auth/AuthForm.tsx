import { useState } from 'react';
import { setAuthToken, loadSettingsFromServer, loadPinnedResourcesFromServer, clearAllUserData } from '../../utils/settingsApi';

// Пропа onSuccess здесь нет намеренно: после успешного входа форма делает
// window.location.reload() ради чистой инициализации сторов, так что колбэк в
// родителя всё равно не успел бы ничего изменить.
export const AuthForm = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.ok) {
        const errorMessages: Record<string, string> = {
          EMAIL_AND_PASSWORD_REQUIRED: 'Email и пароль обязательны',
          USER_EXISTS: 'Пользователь уже существует',
          INVALID_CREDENTIALS: 'Неверный email или пароль',
        };
        setError(errorMessages[data.error] || data.error);
        setLoading(false);
        return;
      }

      // Очищаем все данные предыдущего пользователя перед входом/регистрацией нового
      // Это критично для предотвращения утечки данных между пользователями
      clearAllUserData();
      
      // Сохраняем токен авторизации
      setAuthToken(data.token);
      console.log('Токен сохранен, истекает:', data.expiresAt);
      
      // Загружаем настройки и preferences пользователя с сервера
      if (mode === 'login') {
        try {
          // Загружаем настройки (они будут автоматически использоваться из БД)
          const settings = await loadSettingsFromServer();
          console.log('Настройки пользователя загружены из БД:', settings);
          
          // Загружаем pinned resources (они будут автоматически использоваться из БД)
          const pinnedResources = await loadPinnedResourcesFromServer();
          console.log('Pinned resources загружены из БД:', pinnedResources);
          
          // currentSaveId загружается автоматически при загрузке игры
        } catch (err) {
          console.warn('Не удалось загрузить настройки пользователя:', err);
        }
      }
      
      // Перезагружаем страницу для чистой инициализации всех сторов
      // Это гарантирует, что Zustand сторы загрузятся из чистого состояния
      window.location.reload();
    } catch {
      setError('Ошибка подключения к серверу');
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop z-50 flex items-center justify-center">
      <div className="panel z-50 mx-4 w-full max-w-sm p-6">
        <h2 className="mb-5 text-center text-lg font-semibold">
          {mode === 'login' ? 'Вход' : 'Регистрация'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="stat-label mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm"
              required
            />
          </label>

          <label className="block">
            <span className="stat-label mb-1 block">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm"
              required
            />
          </label>

          {error && (
            <div className="rounded border border-danger/20 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-block mt-1">
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="w-full text-xs text-content-muted transition-colors hover:text-content-primary"
          >
            {mode === 'login' ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </form>
      </div>
    </div>
  );
};
