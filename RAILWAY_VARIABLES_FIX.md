# 🔧 Исправление: Переменные в Shared Variables вместо Service Variables

## ❌ Проблема

Вы добавили переменные в **"Shared Variables"** (общие переменные проекта), но они должны быть в **Variables вашего сервиса**.

## ✅ Решение

### Шаг 1: Найдите Variables вашего сервиса

1. В Railway Dashboard выберите ваш **проект**
2. Выберите ваш **сервис** (service) - тот, который запускает приложение (например, "team-schedule")
3. Перейдите в **Variables** (вкладка сверху) - это НЕ "Shared Variables"!
4. Это должны быть переменные конкретно для этого сервиса

### Шаг 2: Исправьте CALLBACK_URL

В вашей переменной `CALLBACK_URL` два значения склеены:
```
❌ Неправильно: https://team-schedule-production.up.railway.app/auth/google/callback PORT=3000
✅ Правильно: https://team-schedule-production.up.railway.app/auth/google/callback
```

**PORT=3000** - это отдельная переменная, не должна быть в CALLBACK_URL!

### Шаг 3: Добавьте переменные в Service Variables

1. В разделе Variables вашего сервиса (НЕ Shared Variables)
2. Нажмите **"+ New Variable"** или **"Raw Editor"**
3. Добавьте все переменные:

```
GOOGLE_CLIENT_ID=38980083861-k5l54833tja2dq9ssj340rrjrpq6hq9j.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
SESSION_SECRET=ваш-session-secret-из-shared-variables
ALLOWED_USERS=al.rudenko@playson.com
CALLBACK_URL=https://team-schedule-production.up.railway.app/auth/google/callback
PORT=3000
NODE_ENV=production
```

**Важно:**
- CALLBACK_URL должен быть БЕЗ `PORT=3000` в конце
- Используйте домен из вашего Railway (скопируйте из Settings → Domains)

### Шаг 4: Проверьте домен

1. В Railway Dashboard → ваш сервис → **Settings** → **Domains**
2. Скопируйте точный домен
3. Используйте его в CALLBACK_URL:
   ```
   https://точный-домен.railway.app/auth/google/callback
   ```

### Шаг 5: Обновите Google Cloud Console

1. Откройте Google Cloud Console
2. Перейдите в OAuth 2.0 Client ID
3. В **Authorized redirect URIs** убедитесь, что указан правильный URL:
   ```
   https://team-schedule-production.up.railway.app/auth/google/callback
   ```
4. Сохраните изменения

## 📋 Итоговый список переменных для Service Variables

```
GOOGLE_CLIENT_ID=38980083861-k5l54833tja2dq9ssj340rrjrpq6hq9j.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
SESSION_SECRET=скопируйте-из-shared-variables
ALLOWED_USERS=al.rudenko@playson.com
CALLBACK_URL=https://team-schedule-production.up.railway.app/auth/google/callback
PORT=3000
NODE_ENV=production
```

## ⚠️ Важно

- **Shared Variables** - для переменных, которые используются несколькими сервисами
- **Service Variables** - для переменных конкретного сервиса (это то, что нужно!)
- Приложение ищет переменные в Service Variables, а не в Shared Variables
