/**
 * Утилита для очистки устаревших данных из localStorage
 * Эти данные теперь хранятся в БД
 */
export const cleanupLegacyLocalStorage = () => {
  const legacyKeys = [
    'gameSettings',
    'ygg_pinned_resources_v1',
    'user', // Старый способ хранения пользователя (до токенов)
    /*
     * Финансы (банк, кредиты, портфель, кредитный рейтинг) лежат в серверном сейве СЛОТА
     * (см. serializeFinance/hydrateFinance). Этот глобальный ключ дублировал их на аккаунт
     * целиком и восстанавливался при монтировании независимо от слота — из-за него кредиты,
     * взятые на одной карте, показывались на всех остальных.
     */
    'finance-storage',
    /*
     * Фильтры панели строительства (bigplan.md, пункт 30.2). Ключ был один на браузер,
     * то есть настройки одной партии применялись ко всем остальным, а на другом
     * устройстве не применялись вовсе. Теперь это секция uiPrefs в сейве слота.
     */
    'buildPanelFilters',
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
