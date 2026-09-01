# ЭкоБиоМониторинг

Статический фронтенд и Vercel Functions для Supabase.

## Регистрация без почтового кода

Регистрация выполняется по e-mail и паролю. Серверная функция создаёт подтверждённого пользователя через Supabase Admin API, поэтому SMTP для первого входа не требуется. Секретный ключ используется только внутри Vercel Functions.

Перед деплоем добавьте в Vercel переменные из `.env.example`:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEY` или `SUPABASE_ANON_KEY`;
- `SUPABASE_SECRET_KEY` или `SUPABASE_SERVICE_ROLE_KEY`;
- `SESSION_SECRET`, случайная строка длиной не менее 32 символов;
- `APP_URL`, адрес опубликованного сайта.

В Supabase SQL Editor один раз выполните `supabase/001_users.sql`.

Серверный secret/service-role ключ нельзя добавлять в HTML, клиентский JavaScript или переменные с префиксом `PUBLIC`.

## Проверка

```bash
npm install
npm run check
npm test
```
