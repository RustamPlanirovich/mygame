-- Миграция существующих сохранений
-- Если у вас есть старые сохранения с id='local', их нужно будет вручную привязать к пользователю

-- Пример: обновление существующего сохранения для конкретного пользователя
-- UPDATE game_save SET user_id = 1 WHERE id = 'local';
-- UPDATE game_save SET id = 'user_1' WHERE id = 'local';

-- Или удалить старые локальные сохранения:
-- DELETE FROM game_save WHERE user_id IS NULL;
