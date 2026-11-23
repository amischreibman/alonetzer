// Shared helpers for the "מה הקשר" (connections) game.

// Number of wrong guesses a player may make before the puzzle is lost.
export const MAX_MISTAKES = 4;

export const GROUP_COUNT = 4;
export const WORDS_PER_GROUP = 4;

// Tailwind classes per group index (easiest to hardest).
export const GROUP_COLORS = [
  "bg-yellow-300 text-yellow-950",
  "bg-green-400 text-green-950",
  "bg-sky-400 text-sky-950",
  "bg-purple-400 text-purple-950",
];

// Plain colors for the print view, which is rendered outside of Tailwind.
const PRINT_COLORS = ["#fde047", "#4ade80", "#38bdf8", "#c084fc"];

export const STATUS_LABELS = {
  in_progress: "באמצע המשחק",
  solved: "פתר/ה",
  failed: "נכשל/ה",
};

// Fisher-Yates shuffle that returns a new array.
export function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Scatters the sixteen terms of the four groups over the board.
export function buildBoard(groups) {
  return shuffle(groups.flatMap((group) => group.words.map((word) => word.trim())));
}

// An empty form model for the admin editor.
export function emptyGroups() {
  return Array.from({ length: GROUP_COUNT }, () => ({
    title: "",
    explanation: "",
    words: Array.from({ length: WORDS_PER_GROUP }, () => ""),
  }));
}

// Returns a Hebrew error message, or null when the puzzle is valid.
export function validateGame(title, groups) {
  if (!title.trim()) return "יש להזין שם לחידה.";
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    if (!group.title.trim()) return `יש להזין כותרת לקבוצה ${i + 1}.`;
    if (group.words.some((word) => !word.trim())) {
      return `יש להזין ארבע הגדרות בקבוצה ${i + 1}.`;
    }
  }
  const all = groups.flatMap((group) => group.words.map((word) => word.trim()));
  if (new Set(all).size !== all.length) return "אותה הגדרה מופיעה יותר מפעם אחת.";
  return null;
}

// Index of the group a set of four words belongs to, or -1 when it is not a group.
export function findGroupIndex(groups, words) {
  return groups.findIndex((group) => words.every((word) => group.words.includes(word)));
}

// True when exactly three of the chosen words share a group.
export function isOneAway(groups, words) {
  return groups.some(
    (group) => words.filter((word) => group.words.includes(word)).length === WORDS_PER_GROUP - 1
  );
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Opens a print-friendly version of the puzzle in a new window.
export function printGame(game, { withSolution = false } = {}) {
  const cells = game.board.map((word) => `<div class="cell">${escapeHtml(word)}</div>`).join("");
  const answerLines = game.groups
    .map(
      (_, i) =>
        `<div class="answer"><span class="num">${i + 1}.</span> הקשר: <span class="line"></span> מילים: <span class="line long"></span></div>`
    )
    .join("");
  const solution = withSolution
    ? `<section class="solution">
        <h2>פתרון</h2>
        ${game.groups
          .map(
            (group, i) => `<div class="group" style="background:${PRINT_COLORS[i]}">
              <strong>${escapeHtml(group.title)}</strong>
              <div>${group.words.map(escapeHtml).join(" · ")}</div>
              ${group.explanation ? `<div class="explanation">${escapeHtml(group.explanation)}</div>` : ""}
            </div>`
          )
          .join("")}
      </section>`
    : "";

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(game.title)} – מה הקשר</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Noto Sans Hebrew", sans-serif; color: #111; margin: 0; }
  h1 { font-size: 26pt; margin: 0 0 2mm; text-align: center; }
  .subtitle { text-align: center; font-size: 14pt; margin-bottom: 6mm; }
  .instructions { font-size: 12pt; text-align: center; margin-bottom: 8mm; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
  .cell { border: 0.6mm solid #111; border-radius: 3mm; height: 26mm; display: flex;
          align-items: center; justify-content: center; text-align: center;
          font-size: 16pt; font-weight: bold; padding: 2mm; }
  .answers { margin-top: 10mm; font-size: 12pt; }
  .answer { display: flex; align-items: flex-end; gap: 2mm; margin-bottom: 7mm; }
  .num { font-weight: bold; }
  .line { flex: 1; border-bottom: 0.3mm solid #111; height: 5mm; }
  .line.long { flex: 2; }
  .solution { page-break-before: always; }
  .solution h2 { font-size: 20pt; text-align: center; }
  .group { border-radius: 3mm; padding: 4mm; margin-bottom: 4mm; text-align: center; font-size: 13pt;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .explanation { font-size: 11pt; margin-top: 1mm; }
</style>
</head>
<body>
  <h1>מה הקשר?</h1>
  <div class="subtitle">${escapeHtml(game.title)}</div>
  <div class="instructions">חלקו את 16 ההגדרות לארבע קבוצות של ארבע, ומצאו מה הקשר בין ההגדרות בכל קבוצה.</div>
  <div class="grid">${cells}</div>
  <div class="answers">${answerLines}</div>
  ${solution}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("הדפדפן חסם את חלון ההדפסה. יש לאפשר חלונות קופצים לאתר.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// The two opening puzzles, loaded from the admin tab with a single click.
export const SEED_GAMES = [
  {
    title: "חידה מספר 1",
    groups: [
      {
        title: "חלקים לריתום בטרקטור",
        explanation: "כל הארבעה הם חלקים שבעזרתם רותמים כלים לטרקטור.",
        words: ["יצול", "זרועות", "בוכנה", "פין"],
      },
      {
        title: "זוגות איברים בגוף",
        explanation: "איברים שיש לכל אחד מאיתנו שניים מהם.",
        words: ["ירך", "אוזן", "שוק", "עין"],
      },
      {
        title: "ארבע אותיות בא\"ב",
        explanation: "שמותיהן של ארבע אותיות באלף-בית העברי.",
        words: ["כף", "זין", "תו", "דלת"],
      },
      {
        title: "שכונות בקיבוץ בלשון יחיד",
        explanation: "שמות של שכונות בנצר-סרני, בלשון יחיד.",
        words: ["קרוילה", "פיג'מה", "ותיק", "מיליונר"],
      },
    ],
  },
  {
    title: "חידה מספר 2",
    groups: [
      {
        title: "גני ילדים בקיבוץ",
        explanation: "שמותיהם של גני הילדים בנצר-סרני.",
        words: ["תאנה", "תות", "שקד", "רימון"],
      },
      {
        title: "עצים נפוצים בקיבוץ",
        explanation: "עצים שפוגשים כמעט בכל פינה בקיבוץ.",
        words: ["ברוש", "אקליפטוס", "דקל", "זית"],
      },
      {
        title: "עצי הדר שגודלו בעבר בקיבוץ",
        explanation: "זני ההדרים שגדלו בעבר בפרדסי הקיבוץ.",
        words: ["מינאולה", "טופז", "טמפל", "אשכולית"],
      },
      {
        title: "עצים המשמשים לתעשיית הרהיטים",
        explanation: "סוגי עץ שמהם מייצרים רהיטים.",
        words: ["אורן", "בוק", "אלון", "אגוז"],
      },
    ],
  },
];
