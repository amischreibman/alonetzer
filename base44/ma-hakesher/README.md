# משחק "מה הקשר" – קבצים להטמעה באתר Base44

הקבצים בתיקייה זו נכתבו ללא גישה לקוד האתר ב-Base44 ולא הורצו מולו. יש להעתיק אותם לאתר באותם נתיבים.

## קבצים

| קובץ | יעד ב-Base44 |
|---|---|
| `entities/ConnectionsGame.json` | ישות חדשה `ConnectionsGame` (החידות) |
| `entities/ConnectionsProgress.json` | ישות חדשה `ConnectionsProgress` (התקדמות המשתמשים) |
| `components/connections/gameUtils.js` | `components/connections/gameUtils.js` |
| `components/connections/ConnectionsBoard.jsx` | `components/connections/ConnectionsBoard.jsx` |
| `components/connections/ConnectionsSection.jsx` | `components/connections/ConnectionsSection.jsx` |
| `components/connections/ConnectionsAdmin.jsx` | `components/connections/ConnectionsAdmin.jsx` |

## חיבור לאתר

1. **מדור "מועדון לחבר" (משתמשים):** במקום שבו מוצגות התפזורות יש להוסיף:

   ```jsx
   import ConnectionsSection from "@/components/connections/ConnectionsSection";

   <ConnectionsSection />
   ```

2. **ממשק הניהול, לשונית "מועדון לחבר":** יש להוסיף טאב "מה הקשר" שמציג:

   ```jsx
   import ConnectionsAdmin from "@/components/connections/ConnectionsAdmin";

   <ConnectionsAdmin />
   ```

   הרכיב מציג תוכן רק למשתמש שתפקידו `admin`, וגם הרשאות הישויות (RLS) מגבילות יצירה, עריכה ומחיקה של חידות לאדמין.

3. **חידות הפתיחה:** בכניסה הראשונה לטאב הניהול, כשאין עדיין חידות, מופיע הכפתור "טעינת שתי חידות הפתיחה".

## הגדרות

- מספר הטעויות המותר: `MAX_MISTAKES` ב-`gameUtils.js` (ברירת מחדל 4).
- ההסברים של חידות הפתיחה נוסחו על ידי כותב הקוד וניתנים לעריכה בטאב הניהול.
