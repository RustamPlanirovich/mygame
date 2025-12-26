# Скрипт для применения миграции множественных сохранений

echo "⚠️  ВНИМАНИЕ: Эта миграция удалит все существующие сохранения!"
echo "Нажмите Ctrl+C для отмены или Enter для продолжения..."
read

echo "Применяю миграцию..."
psql $DATABASE_URL -f server/migration_multiple_saves.sql

echo "✅ Миграция завершена!"
echo "Перезапустите API сервер: npm run dev:api"
