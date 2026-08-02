import { useState } from 'react';
import { setAuthToken, loadSettingsFromServer, loadPinnedResourcesFromServer, clearAllUserData } from '../../utils/settingsApi';

interface AuthFormProps {
  onSuccess: (user: { id: number; email: string }) => void;
}

export const AuthForm = ({ onSuccess }: AuthFormProps) => {
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
    } catch (err) {
      setError('Ошибка подключения к серверу');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">
          {mode === 'login' ? 'Вход' : 'Регистрация'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="w-full text-cyan-400 hover:text-cyan-300 text-sm"
          >
            {mode === 'login' ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </form>
      </div>
    </div>
  );
};
