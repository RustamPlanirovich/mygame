#!/bin/bash

# Тест системы настроек

API_URL="http://127.0.0.1:5174"

echo "=== Тест системы настроек ==="
echo ""

# 1. Регистрация тестового пользователя
echo "1. Регистрация тестового пользователя..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_settings@example.com",
    "password": "test123"
  }')

echo "Ответ регистрации: $REGISTER_RESPONSE"

USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$USER_ID" ]; then
  echo "❌ Ошибка: не удалось получить ID пользователя"
  exit 1
fi

echo "✅ Пользователь зарегистрирован с ID: $USER_ID"
echo ""

# 2. Получение настроек (должны быть пустыми)
echo "2. Получение настроек (должны быть пустыми)..."
GET_SETTINGS_RESPONSE=$(curl -s -X GET "$API_URL/api/settings" \
  -H "x-user-id: $USER_ID")

echo "Ответ: $GET_SETTINGS_RESPONSE"
echo ""

# 3. Сохранение настроек
echo "3. Сохранение настроек..."
SAVE_SETTINGS_RESPONSE=$(curl -s -X PUT "$API_URL/api/settings" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{
    "settings": {
      "graphics": {
        "showGrid": true,
        "targetFPS": 60,
        "quality": "high"
      },
      "gameplay": {
        "gameSpeed": 2,
        "autosaveEnabled": true
      }
    }
  }')

echo "Ответ: $SAVE_SETTINGS_RESPONSE"

if echo "$SAVE_SETTINGS_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Настройки успешно сохранены"
else
  echo "❌ Ошибка сохранения настроек"
fi
echo ""

# 4. Проверка сохраненных настроек
echo "4. Проверка сохраненных настроек..."
GET_SETTINGS_RESPONSE2=$(curl -s -X GET "$API_URL/api/settings" \
  -H "x-user-id: $USER_ID")

echo "Ответ: $GET_SETTINGS_RESPONSE2"

if echo "$GET_SETTINGS_RESPONSE2" | grep -q '"gameSpeed":2'; then
  echo "✅ Настройки загружены корректно"
else
  echo "❌ Ошибка: настройки не совпадают"
fi
echo ""

# 5. Обновление настроек
echo "5. Обновление настроек..."
UPDATE_SETTINGS_RESPONSE=$(curl -s -X PUT "$API_URL/api/settings" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{
    "settings": {
      "graphics": {
        "showGrid": false,
        "targetFPS": 30,
        "quality": "low"
      },
      "gameplay": {
        "gameSpeed": 0.5,
        "autosaveEnabled": false
      }
    }
  }')

echo "Ответ: $UPDATE_SETTINGS_RESPONSE"

if echo "$UPDATE_SETTINGS_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Настройки успешно обновлены"
else
  echo "❌ Ошибка обновления настроек"
fi
echo ""

# 6. Проверка обновленных настроек
echo "6. Проверка обновленных настроек..."
GET_SETTINGS_RESPONSE3=$(curl -s -X GET "$API_URL/api/settings" \
  -H "x-user-id: $USER_ID")

echo "Ответ: $GET_SETTINGS_RESPONSE3"

if echo "$GET_SETTINGS_RESPONSE3" | grep -q '"gameSpeed":0.5'; then
  echo "✅ Обновленные настройки загружены корректно"
else
  echo "❌ Ошибка: обновленные настройки не совпадают"
fi
echo ""

echo "=== Тест завершен ==="
