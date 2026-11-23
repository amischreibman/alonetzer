import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Shuffle } from "lucide-react";
import {
  GROUP_COLORS,
  MAX_MISTAKES,
  WORDS_PER_GROUP,
  findGroupIndex,
  isOneAway,
  shuffle,
} from "./gameUtils";

// The playable board of a single puzzle. Progress is saved after every guess,
// so a player can leave and continue later, and the admin can follow the stage.
export default function ConnectionsBoard({ game, user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [solvedGroups, setSolvedGroups] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState("in_progress");
  const [selected, setSelected] = useState([]);
  const [order, setOrder] = useState(game.board);
  const [message, setMessage] = useState("");
  const [shaking, setShaking] = useState(false);
  const progressId = useRef(null);
  const triedGuesses = useRef(new Set());

  // Load the saved progress of the current user for this puzzle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const records = await base44.entities.ConnectionsProgress.filter({
          game_id: game.id,
          created_by: user.email,
        });
        if (cancelled) return;
        const record = records[0];
        if (record) {
          progressId.current = record.id;
          setSolvedGroups(record.solved_groups || []);
          setMistakes(record.mistakes || 0);
          setStatus(record.status || "in_progress");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game.id, user.email]);

  const finished = status !== "in_progress";

  // Words that are still on the board, in the current display order.
  const remainingWords = useMemo(() => {
    const solvedWords = new Set(solvedGroups.flatMap((index) => game.groups[index].words));
    return order.filter((word) => !solvedWords.has(word));
  }, [order, solvedGroups, game.groups]);

  // Revealed groups: the solved ones first, then the rest once the game is over.
  const revealedGroups = useMemo(() => {
    if (!finished) return solvedGroups;
    const rest = game.groups.map((_, index) => index).filter((index) => !solvedGroups.includes(index));
    return [...solvedGroups, ...rest];
  }, [finished, solvedGroups, game.groups]);

  async function saveProgress(next) {
    const data = {
      game_id: game.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      solved_groups: next.solvedGroups,
      mistakes: next.mistakes,
      status: next.status,
    };
    if (next.status === "solved") data.solved_at = new Date().toISOString();
    if (progressId.current) {
      await base44.entities.ConnectionsProgress.update(progressId.current, data);
    } else {
      const created = await base44.entities.ConnectionsProgress.create(data);
      progressId.current = created.id;
    }
  }

  function toggleWord(word) {
    if (finished || saving) return;
    setMessage("");
    setSelected((current) => {
      if (current.includes(word)) return current.filter((item) => item !== word);
      if (current.length >= WORDS_PER_GROUP) return current;
      return [...current, word];
    });
  }

  async function submitGuess() {
    if (selected.length !== WORDS_PER_GROUP || finished || saving) return;
    const key = [...selected].sort().join("|");
    if (triedGuesses.current.has(key)) {
      setMessage("את הצירוף הזה כבר ניסית.");
      return;
    }
    triedGuesses.current.add(key);

    const groupIndex = findGroupIndex(game.groups, selected);
    const next = { solvedGroups, mistakes, status };
    if (groupIndex >= 0) {
      next.solvedGroups = [...solvedGroups, groupIndex];
      if (next.solvedGroups.length === game.groups.length) next.status = "solved";
      setMessage("");
    } else {
      next.mistakes = mistakes + 1;
      if (next.mistakes >= MAX_MISTAKES) next.status = "failed";
      setMessage(isOneAway(game.groups, selected) ? "כמעט! הגדרה אחת לא שייכת." : "לא נכון, נסו שוב.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }

    setSolvedGroups(next.solvedGroups);
    setMistakes(next.mistakes);
    setStatus(next.status);
    if (groupIndex >= 0 || next.status === "failed") setSelected([]);

    setSaving(true);
    try {
      await saveProgress(next);
    } catch (error) {
      setMessage("שמירת ההתקדמות נכשלה. בדקו את החיבור לרשת.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-xl">
      <style>{`
        @keyframes connections-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .connections-shake { animation: connections-shake 0.25s linear 2; }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{game.title}</h2>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowRight className="ml-1 h-4 w-4" />
            לכל החידות
          </Button>
        )}
      </div>

      {!finished && (
        <p className="mb-4 text-center text-sm text-gray-600">
          בחרו ארבע הגדרות שיש ביניהן קשר ולחצו על "בדיקה".
        </p>
      )}

      {/* Revealed groups */}
      <div className="space-y-2">
        {revealedGroups.map((index) => {
          const group = game.groups[index];
          return (
            <div key={index} className={`rounded-lg p-3 text-center ${GROUP_COLORS[index]}`}>
              <div className="text-lg font-bold">{group.title}</div>
              <div className="font-medium">{group.words.join(" · ")}</div>
              {group.explanation && <div className="mt-1 text-sm">{group.explanation}</div>}
            </div>
          );
        })}
      </div>

      {/* Remaining tiles */}
      {!finished && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {remainingWords.map((word) => {
            const isSelected = selected.includes(word);
            return (
              <button
                key={word}
                type="button"
                onClick={() => toggleWord(word)}
                className={`flex h-16 items-center justify-center break-words rounded-lg px-1 text-center text-sm font-bold leading-tight transition-colors sm:h-20 sm:text-lg ${
                  isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                } ${isSelected && shaking ? "connections-shake" : ""}`}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 min-h-6 text-center text-sm font-medium text-gray-700" aria-live="polite">
        {message}
      </div>

      {!finished && (
        <>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600">
            <span>טעויות שנותרו:</span>
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < MAX_MISTAKES - mistakes ? "bg-gray-700" : "bg-gray-200"}`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setOrder(shuffle(order))} disabled={saving}>
              <Shuffle className="ml-1 h-4 w-4" />
              ערבוב
            </Button>
            <Button variant="outline" onClick={() => setSelected([])} disabled={!selected.length || saving}>
              ניקוי בחירה
            </Button>
            <Button onClick={submitGuess} disabled={selected.length !== WORDS_PER_GROUP || saving}>
              {saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              בדיקה
            </Button>
          </div>
        </>
      )}

      {status === "solved" && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-center font-bold text-green-800">
          כל הכבוד! פתרת את החידה{mistakes ? ` עם ${mistakes} טעויות` : " ללא טעויות"}.
        </div>
      )}
      {status === "failed" && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-center font-bold text-red-800">
          נגמרו הניסיונות. הפתרון המלא מוצג למעלה.
        </div>
      )}
    </div>
  );
}
