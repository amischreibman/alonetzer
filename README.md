# עלון נצר-סרני – אפליקציה עצמאית לטלפון

אפליקציית אנדרואיד (APK להתקנה עצמית) + שרת עצמאי, שמחליפים את האתר שנבנה ב-Base44.
אין תלות ב-Base44: המשתמשים, התוכן, הקבצים וההתראות נמצאים בשרת שלכם.

```
alonetzer/
├── app/      האפליקציה (React + Capacitor) – ממשק הקוראים וממשק הניהול, Android
├── server/   השרת (Node + Fastify + SQLite) – משתמשים, תוכן, העלאות, פושים
├── shared/   מודל התוכן המשותף לאפליקציה ולשרת (מדורים, שדות, הרשאות)
└── .github/  בניית APK אוטומטית ופרסום תמונת Docker לשרת
```

## מה יש באפליקציה

**קוראים**
- מסך ראשי: מבזקים, כתבות נעוצות, אירועים קרובים, כתבות אחרונות, ורודים, הגיליון האחרון.
- מדורים: הנהלה, קהילה, במה, ורודים. חיפוש בכל התכנים.
- מבזקים, לוח אירועים (קרובים / שהיו), ורודים (ברכות), ארכיון גיליונות ומוספים (PDF).
- התוכן נטען מחדש בכל פתיחה של האפליקציה ובמשיכה למטה, ונשמר לקריאה ללא רשת.
- הרשמה, התחברות, איפוס סיסמה, פרופיל.
- תוכן לפי סיווג: פתוח לכולם / חברים ותושבים / חברי קיבוץ בלבד (כמו באתר).
- התראות פוש עם העדפות לכל נושא (מבזקים, הנהלה, קהילה, במה, ורודים, אירועים, גיליונות)
  והודעות מיוחדות מהעורכים. לחיצה על התראה פותחת את הפריט.

**ניהול (עורכים ומנהלים) – בתוך האפליקציה**
- יצירה, עריכה, פרסום/הסתרה ומחיקה של כתבות, מבזקים, אירועים, ברכות וגיליונות, כולל העלאת תמונות ו-PDF.
- התראה נשלחת אוטומטית למנויים בפרסום הראשון של כל פריט (לפי העדפותיהם וסיווגם).
- ניהול משתמשים: אישור נרשמים, סיווג (חבר/תושב/אורח), תפקיד (קורא/עורך/מנהל), חסימה, איפוס סיסמה.
- שליחת הודעה ידנית לכל המנויים או לפי נושא, והיסטוריית התראות.
- לוח מצב: משתמשים, ממתינים לאישור, מכשירים, צפיות.

השרת מגיש גם גרסת דפדפן של אותה אפליקציה בכתובת הבסיס שלו, כך שהעלון נגיש גם ממחשב.

## התקנה מהירה

דרישות: Node 22+. ל-APK: Java 21 + Android SDK (או פשוט GitHub Actions, ראו למטה).

```bash
npm install
npm test                      # בדיקות השרת + typecheck של האפליקציה
```

### הרצת השרת

```bash
cp server/.env.example server/.env   # ערכו: PUBLIC_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run build -w app                 # גרסת הדפדפן שהשרת מגיש
npm run dev -w server                # http://localhost:8080
```

בהפעלה הראשונה נוצר משתמש המנהל מ-`ADMIN_EMAIL`/`ADMIN_PASSWORD`. אפשר גם:
`npm run create-admin -w server -- email password "שם"`.

הפעלה בייצור עם Docker:

```bash
cd server && cp .env.example .env && docker compose up -d --build
```

הנתונים (SQLite + קבצים) נשמרים ב-volume בשם `alon-data`. מומלץ להציב מאחורי reverse proxy עם HTTPS
(Caddy/nginx) ולהגדיר את `PUBLIC_URL` לכתובת הציבורית.

### בניית ה-APK

**דרך GitHub Actions (מומלץ, בלי להתקין כלום):**
1. ב-Settings → Secrets and variables → Actions הגדירו את המשתנה `ALON_SERVER_URL` (כתובת השרת, למשל `https://alon.netzer.org.il`).
2. הריצו את ה-workflow "Android APK" (Actions → Run workflow) או דחפו ל-`main`. ה-APK מצורף כ-artifact בשם `alon-netzer-apk`.
3. תיוג `v1.0.0` יוצר Release עם ה-APK להורדה ישירה מהטלפון.

**מקומית:**

```bash
echo "VITE_SERVER_URL=https://alon.example.com" > app/.env.production
npm run apk:debug          # app/android/app/build/outputs/apk/debug/app-debug.apk
```

את כתובת השרת אפשר לשנות גם בתוך האפליקציה (הגדרות → שרת), למשל לבדיקה מול שרת מקומי.

חתימת release: הגדירו את הסודות `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. בלעדיהם ה-APK נחתם במפתח debug (מספיק להתקנה עצמית; לעדכון עתידי יש לחתום תמיד באותו מפתח).

### התראות פוש (Firebase Cloud Messaging)

1. צרו פרויקט ב-[Firebase Console](https://console.firebase.google.com), הוסיפו אפליקציית Android עם package `il.org.netzer.alon`.
2. הורידו `google-services.json` ושימו ב-`app/android/app/` (ב-CI: הסוד `GOOGLE_SERVICES_JSON` בקידוד base64).
3. Project settings → Service accounts → Generate new private key; שמרו כ-`server/firebase-service-account.json`
   (או הגדירו `FIREBASE_SERVICE_ACCOUNT` לנתיב אחר).
4. הפעילו את השרת מחדש. ב-`/api/health` יופיע `"push":"firebase"`.

בלי Firebase הכול עובד, וההתראות רק נרשמות ביומן (מצב `dry`).

### ייבוא התוכן הקיים מ-Base44 (חד-פעמי)

```bash
BASE44_APP_ID=... BASE44_API_KEY=... npm run import:base44 -- --dry-run   # תצוגה מקדימה
BASE44_APP_ID=... BASE44_API_KEY=... npm run import:base44
```

הסקריפט מושך את הישויות לפי `BASE44_ENTITY_MAP` (ברירת מחדל: Article, Flash, Event, Greeting, Issue → כתבה, מבזק,
אירוע, ברכה, גיליון), ממפה שדות בשמות דומים, מוריד תמונות ו-PDF לשרת ומייבא גם את המשתמשים (ללא סיסמה – הם
מאפסים סיסמה מהאפליקציה או מקבלים אחת מהמנהל). הרצה חוזרת מעדכנת במקום לשכפל. אם שמות הישויות/השדות באתר
שונים, עדכנו את `BASE44_ENTITY_MAP` ואת `ALIASES` ב-`server/src/cli/import-base44.ts`.

## מודל התוכן

מוגדר פעם אחת ב-`shared/src/entities.ts`: לכל סוג תוכן רשימת שדות (טקסט, בחירה, תאריך, תמונה, קובץ, בוליאני).
טופסי הניהול, האימות בשרת, החיפוש וההתראות נגזרים ממנו – כדי להוסיף שדה או מדור מספיק לערוך קובץ זה.

## API (תמצית)

| נתיב | תיאור |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout`, `/forgot`, `/reset`; `GET/PUT /api/auth/me` | חשבון משתמש |
| `GET /api/home` | חבילת המסך הראשי |
| `GET /api/content/:type?section=&q=&upcoming=1&past=1&all=1` | רשימות (`article`, `flash`, `event`, `greeting`, `issue`) |
| `GET /api/content/:type/:id`, `POST .../view` | פריט בודד וספירת צפיות |
| `POST/PUT/DELETE /api/content/:type[/:id]` | עריכה (עורכים); `notify:false` מבטל התראה |
| `POST /api/uploads` | העלאת תמונה/PDF (עורכים) |
| `POST /api/devices`, `PUT /api/devices/:token/prefs`, `DELETE` | רישום מכשיר והעדפות התראות |
| `GET /api/admin/stats`, `GET/POST/PUT/DELETE /api/admin/users[/:id]`, `POST /api/admin/notify`, `GET /api/admin/notifications` | ניהול |
| `GET /api/search?q=` | חיפוש |
| `GET /api/health` | בריאות השרת ומצב הפושים |

הרשאות: `user` (קורא), `editor` (עורך תוכן ושולח הודעות), `admin` (גם ניהול משתמשים). סטטוס: `pending` (ממתין
לאישור – רואה תוכן פתוח בלבד), `active`, `blocked`. סיווג: `member`, `resident`, `guest`.
