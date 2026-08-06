/**
 * ESLint (bigplan.md, замечание к итерации 1: «npm run lint не работает»).
 *
 * ЧТО БЫЛО СЛОМАНО. Конфиг был написан под flat-config ESLint 9 и пакет `typescript-eslint`,
 * а в зависимостях стоял ESLint 8.57 без него — то есть `npm run lint` падал на импорте и
 * не проверял НИЧЕГО. Отдельно `reactHooks.configs.flat` — путь, которого у плагина нет ни
 * в одной версии. Теперь версии и конфиг сходятся, и линтер действительно запускается.
 *
 * ПОЧЕМУ ЧАСТЬ ПРАВИЛ — WARN, А НЕ ERROR. На момент починки линтер нашёл 258 `any`,
 * накопленных за всё время. Оставить их ошибками значит получить команду, которая не может
 * пройти никогда, — а такая команда просто перестаёт запускаться, ровно так этот конфиг и
 * дошёл до полной неработоспособности. Поэтому долг помечен предупреждениями: он виден,
 * его можно считать и сокращать, но он не блокирует проверку того, что ломается СЕЙЧАС —
 * неиспользуемых переменных, объявлений в case без блока и нарушений правил хуков.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'sourcemaps', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Накопленный долг: видно, считается, не блокирует.
      '@typescript-eslint/no-explicit-any': 'warn',
      /*
       * Подчёркивание — принятый в проекте способ сказать «параметр нужен по сигнатуре,
       * но не используется». Без этого правило ругается на осознанный код.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      /*
       * Правило про экспорт не-компонентов из файла компонента ломает только Fast Refresh
       * в dev-режиме. Это неудобство, а не дефект.
       */
      'react-refresh/only-export-components': 'warn',
    },
  },
])
