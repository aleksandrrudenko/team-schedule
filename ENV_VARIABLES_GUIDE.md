# Полная инструкция: Где взять все переменные окружения

## 📋 Список всех переменных

Вам нужно получить/создать эти переменные для Railway:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
ALLOWED_USERS=...
CALLBACK_URL=...
PORT=3000
NODE_ENV=production
```

---

## 1️⃣ GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET

### Шаг 1: Откройте Google Cloud Console
1. Перейдите на https://console.cloud.google.com/
2. Войдите в свой Google аккаунт

### Шаг 2: Создайте проект (если нет)
1. Нажмите на выпадающий список проектов вверху
2. Нажмите **"New Project"**
3. Введите название (например, "Team Schedule App")
4. Нажмите **"Create"**

### Шаг 3: Включите Google+ API
1. В меню слева: **APIs & Services** → **Library**
2. Найдите **"Google+ API"** или **"Google Identity"**
3. Нажмите **"Enable"**

### Шаг 4: Создайте OAuth 2.0 Credentials
1. В меню: **APIs & Services** → **Credentials**
2. Нажмите **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Если первый раз - настройте OAuth consent screen:
   - User Type: **External** (для личного использования)
   - App name: **Team Schedule** (любое название)
   - User support email: ваш email
   - Developer contact: ваш email
   - Нажмите **"Save and Continue"** → **"Save and Continue"** → **"Back to Dashboard"**

4. Создайте OAuth Client ID:
   - Application type: **Web application**
   - Name: **Team Schedule Web** (любое название)
   - Authorized redirect URIs: 
     - Пока добавьте: `http://localhost:3000/auth/google/callback`
     - Позже добавите Railway URL (см. шаг 5 ниже)
   - Нажмите **"Create"**

5. **Скопируйте значения:**
   - **Client ID** → это ваш `GOOGLE_CLIENT_ID`
   - **Client secret** → это ваш `GOOGLE_CLIENT_SECRET` (нажмите "Show" чтобы увидеть)

---

## 2️⃣ SESSION_SECRET

Это случайная строка для шифрования сессий. Сгенерируйте её:

### Вариант 1: Через терминал (Mac/Linux)
```bash
openssl rand -base64 32
```

### Вариант 2: Через терминал (Windows PowerShell)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Вариант 3: Онлайн генератор
1. Перейдите на https://randomkeygen.com/
2. Скопируйте любой **CodeIgniter Encryption Keys** (64 символа)

### Вариант 4: Просто придумайте
Любая случайная строка минимум 32 символа, например:
```
my-super-secret-key-12345-abcdef-xyz-railway-2024
```

---

## 3️⃣ ALLOWED_USERS

Это список email адресов, которым разрешен доступ к приложению.

**Формат:** через запятую, без пробелов (или с пробелами, код их уберет)

**Примеры:**
```
ALLOWED_USERS=your-email@gmail.com
```
или несколько пользователей:
```
ALLOWED_USERS=user1@gmail.com,user2@gmail.com,admin@company.com
```

**Важно:** Используйте тот же email, который вы используете для входа в Google!

---

## 4️⃣ CALLBACK_URL

Это URL вашего приложения в Railway + путь `/auth/google/callback`.

### Шаг 1: Найдите ваш Railway домен
1. Откройте Railway Dashboard: https://railway.app/
2. Выберите ваш проект
3. Выберите ваш сервис
4. Перейдите в **Settings** → **Domains**
5. Там будет домен вида: `your-app-name.railway.app`

### Шаг 2: Сформируйте CALLBACK_URL
```
https://your-app-name.railway.app/auth/google/callback
```

**Важно:** 
- Используйте **HTTPS** (не HTTP)
- Домен должен быть точным (скопируйте из Railway)
- Путь должен быть точно `/auth/google/callback`

### Шаг 3: Обновите Google OAuth
1. Вернитесь в Google Cloud Console → **Credentials**
2. Нажмите на ваш OAuth Client ID
3. В **Authorized redirect URIs** добавьте:
   ```
   https://your-app-name.railway.app/auth/google/callback
   ```
4. Нажмите **"Save"**

---

## 5️⃣ PORT и NODE_ENV

Эти переменные стандартные, просто скопируйте:

```
PORT=3000
NODE_ENV=production
```

---

## ✅ Итоговый пример

После того как вы получили все значения, в Railway Variables должно быть:

```
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
SESSION_SECRET=AbCdEf1234567890GhIjKlMnOpQrStUvWxYz1234567890
ALLOWED_USERS=your-email@gmail.com
CALLBACK_URL=https://team-schedule-production.railway.app/auth/google/callback
PORT=3000
NODE_ENV=production
```

---

## 🔧 Как добавить в Railway

1. Откройте Railway Dashboard
2. Выберите ваш проект → ваш сервис
3. Перейдите в **Variables** (вкладка)
4. Нажмите **"+ New Variable"**
5. Добавьте каждую переменную по одной:
   - **Name:** `GOOGLE_CLIENT_ID`
   - **Value:** вставьте ваш Client ID
   - Нажмите **"Add"**
6. Повторите для всех переменных

**Или добавьте все сразу:**
- Нажмите **"Raw Editor"** в Railway Variables
- Вставьте все переменные в формате:
  ```
  GOOGLE_CLIENT_ID=ваше-значение
  GOOGLE_CLIENT_SECRET=ваше-значение
  SESSION_SECRET=ваше-значение
  ...
  ```

---

## ⚠️ Важные моменты

1. **CALLBACK_URL должен совпадать** в Railway и Google Cloud Console
2. **ALLOWED_USERS** - это email для входа в Google (не просто любой email)
3. После добавления переменных Railway автоматически перезапустит приложение
4. Проверьте логи в Railway, если что-то не работает

---

## 🆘 Проблемы?

**"OAuth2Strategy requires a clientID option"**
- ✅ Проверьте, что `GOOGLE_CLIENT_ID` добавлен в Railway Variables
- ✅ Проверьте, что нет опечаток в названии переменной

**"Access denied" при входе**
- ✅ Проверьте, что ваш email в `ALLOWED_USERS`
- ✅ Email должен точно совпадать (регистр важен)

**"Redirect URI mismatch"**
- ✅ Проверьте, что `CALLBACK_URL` в Railway точно совпадает с URI в Google Cloud Console
- ✅ Используйте HTTPS (не HTTP)
