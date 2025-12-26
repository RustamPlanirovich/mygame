/**
 * Утилита для очистки устаревших данных из localStorage
 * Эти данные теперь хранятся в БД
 */
export const cleanupLegacyLocalStorage = () => {
  const legacyKeys = [
    'gameSettings',
    'ygg_pinned_resources_v1',
    'user', // Старый способ хранения пользователя (до токенов)
  ];

  let cleaned = 0;
  legacyKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      cleaned++;
      console.log(`[Cleanup] Удален устаревший ключ из localStorage: ${key}`);
    }
  });

  if (cleaned > 0) {
    console.log(`[Cleanup] Очищено ${cleaned} устаревших ключей из localStorage`);
  }
};
