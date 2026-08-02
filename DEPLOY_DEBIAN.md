# Запуск на Debian через PM2

В production один Node.js-процесс отдаёт собранную игру и API на одном порту. Запросы `/api/*` больше не зависят от dev-proxy Vite.

## 1. Один раз: пакеты и PostgreSQL

Нужен Node.js 20 или 22, npm, Git и PostgreSQL. После их установки:

```bash
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE USER mygame WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres createdb -O mygame mygame
sudo npm install -g pm2
```

`CHANGE_ME` должен быть длинным случайным паролем. Если пользователь/БД уже созданы, эти две SQL-команды повторять не нужно.

## 2. Первый запуск

```bash
git clone <URL_РЕПОЗИТОРИЯ> mygame
cd mygame
cp .env.production.example .env
nano .env
npm ci
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
```

В `.env` обязательно задать тот же пароль PostgreSQL. Для адреса `http://23.26.124.34:8080/` оставить `PORT=8080` и `HOST=0.0.0.0`.

После `pm2 save` выполнить выведенную PM2 команду `sudo env ... pm2 startup ...`, затем ещё раз `pm2 save`. Это вернёт игру после перезагрузки Debian.

## 3. Обновление из Git

```bash
cd ~/mygame
git pull --ff-only
npm ci
npm run deploy:pm2
pm2 save
```

## Проверка

```bash
curl -f http://127.0.0.1:8080/api/health
pm2 status
pm2 logs mygame --lines 100
```

Health-check должен вернуть `{"ok":true}`. Если нет, первым делом проверить `pm2 logs mygame` и строку `DATABASE_URL`.

## Firewall

Если UFW включён и порт закрыт:

```bash
sudo ufw allow 8080/tcp
```

Не коммитить `.env`: он уже игнорируется Git. Ключ DeepSeek, опубликованный в чате или Git, нужно отозвать и заменить.
