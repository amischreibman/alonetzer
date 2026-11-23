import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Pencil, Printer, Trash2, Trophy, Users } from "lucide-react";
import {
  GROUP_COLORS,
  SEED_GAMES,
  STATUS_LABELS,
  buildBoard,
  emptyGroups,
  printGame,
  validateGame,
} from "./gameUtils";

// Admin tab of the "מה הקשר" game: creating puzzles, printing them and
// following the players. Render it as a dedicated tab inside the
// "מועדון לחבר" admin area. Non-admin users get nothing.
export default function ConnectionsAdmin() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [firstSolvers, setFirstSolvers] = useState({});

  // Editor state
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [groups, setGroups] = useState(emptyGroups());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Players panel state
  const [playersGame, setPlayersGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (me.role !== "admin") return;
      const [allGames, solved] = await Promise.all([
        base44.entities.ConnectionsGame.list("-created_date"),
        base44.entities.ConnectionsProgress.filter({ status: "solved" }, "solved_at", 1000),
      ]);
      setGames(allGames);
      // The records arrive sorted by solving time, so the first one per game wins.
      const first = {};
      solved.forEach((record) => {
        if (!first[record.game_id]) first[record.game_id] = record;
      });
      setFirstSolvers(first);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setGroups(emptyGroups());
    setError("");
  }

  function updateGroup(index, patch) {
    setGroups((current) => current.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  }

  function updateWord(groupIndex, wordIndex, value) {
    setGroups((current) =>
      current.map((group, i) =>
        i === groupIndex
          ? { ...group, words: group.words.map((word, j) => (j === wordIndex ? value : word)) }
          : group
      )
    );
  }

  // Creates the puzzle (or saves the edited one) and scatters the terms over the board.
  async function saveGame() {
    const validationError = validateGame(title, groups);
    if (validationError) {
      setError(validationError);
      return;
    }
    const cleanGroups = groups.map((group) => ({
      title: group.title.trim(),
      explanation: group.explanation.trim(),
      words: group.words.map((word) => word.trim()),
    }));
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const existing = games.find((game) => game.id === editingId);
        const newWords = cleanGroups.flatMap((group) => group.words);
        // Keep the current layout when the terms themselves did not change.
        const sameWords =
          existing &&
          existing.board.length === newWords.length &&
          newWords.every((word) => existing.board.includes(word));
        await base44.entities.ConnectionsGame.update(editingId, {
          title: title.trim(),
          groups: cleanGroups,
          board: sameWords ? existing.board : buildBoard(cleanGroups),
        });
      } else {
        await base44.entities.ConnectionsGame.create({
          title: title.trim(),
          groups: cleanGroups,
          board: buildBoard(cleanGroups),
          is_published: true,
        });
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  async function loadSeedGames() {
    setSaving(true);
    try {
      for (const seed of SEED_GAMES) {
        await base44.entities.ConnectionsGame.create({
          ...seed,
          board: buildBoard(seed.groups),
          is_published: true,
        });
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(game) {
    setEditingId(game.id);
    setTitle(game.title);
    setGroups(
      game.groups.map((group) => ({
        title: group.title,
        explanation: group.explanation || "",
        words: [...group.words],
      }))
    );
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reshuffle(game) {
    await base44.entities.ConnectionsGame.update(game.id, { board: buildBoard(game.groups) });
    await load();
  }

  async function togglePublished(game) {
    await base44.entities.ConnectionsGame.update(game.id, { is_published: !game.is_published });
    await load();
  }

  async function deleteGame(game) {
    if (!window.confirm(`למחוק את "${game.title}"? הפעולה אינה הפיכה.`)) return;
    await base44.entities.ConnectionsGame.delete(game.id);
    if (playersGame?.id === game.id) setPlayersGame(null);
    await load();
  }

  async function showPlayers(game) {
    setPlayersGame(game);
    setPlayersLoading(true);
    try {
      const records = await base44.entities.ConnectionsProgress.filter(
        { game_id: game.id },
        "-updated_date",
        1000
      );
      setPlayers(records);
    } finally {
      setPlayersLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // The tab is available to admins only.
  if (!user || user.role !== "admin") return null;

  const formatDate = (value) => (value ? new Date(value).toLocaleString("he-IL") : "");

  return (
    <div dir="rtl" className="space-y-8">
      {/* Editor */}
      <section className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 text-lg font-bold">{editingId ? "עריכת חידה" : "חידה חדשה"}</h3>
        <div className="mb-4">
          <Label htmlFor="connections-title">שם החידה</Label>
          <Input
            id="connections-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="לדוגמה: חידה מספר 3"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="rounded-lg border p-3">
              <div className={`mb-3 rounded px-2 py-1 text-sm font-bold ${GROUP_COLORS[groupIndex]}`}>
                קבוצה {groupIndex + 1}
              </div>
              <Label>כותרת הקבוצה (המכנה המשותף)</Label>
              <Input
                className="mb-2"
                value={group.title}
                onChange={(event) => updateGroup(groupIndex, { title: event.target.value })}
              />
              <Label>ארבע ההגדרות</Label>
              <div className="mb-2 grid grid-cols-2 gap-2">
                {group.words.map((word, wordIndex) => (
                  <Input
                    key={wordIndex}
                    value={word}
                    onChange={(event) => updateWord(groupIndex, wordIndex, event.target.value)}
                    placeholder={`הגדרה ${wordIndex + 1}`}
                  />
                ))}
              </div>
              <Label>הסבר להקשר (יוצג למי שחשף את הקבוצה)</Label>
              <Textarea
                rows={2}
                value={group.explanation}
                onChange={(event) => updateGroup(groupIndex, { explanation: event.target.value })}
              />
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveGame} disabled={saving}>
            {saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            {editingId ? "שמירת השינויים" : "יצירת המשחק ופיזור ההגדרות על הלוח"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm} disabled={saving}>
              ביטול
            </Button>
          )}
        </div>
      </section>

      {/* Existing puzzles */}
      <section>
        <h3 className="mb-3 text-lg font-bold">חידות קיימות</h3>
        {games.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="mb-3 text-gray-600">עדיין לא נוצרו חידות.</p>
            <Button variant="outline" onClick={loadSeedGames} disabled={saving}>
              טעינת שתי חידות הפתיחה
            </Button>
          </div>
        )}
        <div className="space-y-3">
          {games.map((game) => {
            const firstSolver = firstSolvers[game.id];
            return (
              <div key={game.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">{game.title}</span>
                    <span
                      className={`mr-2 rounded px-2 py-0.5 text-xs ${
                        game.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {game.is_published ? "מפורסמת" : "מוסתרת"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={() => printGame(game)}>
                      <Printer className="ml-1 h-4 w-4" />
                      גרסת הדפסה
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => printGame(game, { withSolution: true })}>
                      <Printer className="ml-1 h-4 w-4" />
                      הדפסה עם פתרון
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => showPlayers(game)}>
                      <Users className="ml-1 h-4 w-4" />
                      משתתפים
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(game)}>
                      <Pencil className="ml-1 h-4 w-4" />
                      עריכה
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => togglePublished(game)}>
                      {game.is_published ? <EyeOff className="ml-1 h-4 w-4" /> : <Eye className="ml-1 h-4 w-4" />}
                      {game.is_published ? "הסתרה" : "פרסום"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteGame(game)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1 text-sm text-gray-700">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  {firstSolver ? (
                    <span>
                      הפותר/ת הראשון/ה: <strong>{firstSolver.user_name || firstSolver.user_email}</strong> (
                      {formatDate(firstSolver.solved_at)})
                    </span>
                  ) : (
                    <span>עדיין אף אחד לא פתר את החידה.</span>
                  )}
                </div>

                {/* Board preview */}
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {game.board.map((word) => {
                    const groupIndex = game.groups.findIndex((group) => group.words.includes(word));
                    return (
                      <div
                        key={word}
                        className={`rounded px-1 py-2 text-center text-xs font-medium ${GROUP_COLORS[groupIndex] || "bg-gray-100"}`}
                      >
                        {word}
                      </div>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => reshuffle(game)}>
                  פיזור מחדש של הלוח
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Players of the chosen puzzle */}
      {playersGame && (
        <section className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">משתתפים – {playersGame.title}</h3>
            <Button variant="ghost" size="sm" onClick={() => setPlayersGame(null)}>
              סגירה
            </Button>
          </div>
          {playersLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : players.length === 0 ? (
            <p className="text-gray-600">אף משתמש עוד לא התחיל את החידה.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="p-2">משתמש</th>
                    <th className="p-2">שלב</th>
                    <th className="p-2">קבוצות שנחשפו</th>
                    <th className="p-2">טעויות</th>
                    <th className="p-2">עדכון אחרון</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((record) => {
                    const solved = record.solved_groups || [];
                    const isFirst = firstSolvers[playersGame.id]?.id === record.id;
                    return (
                      <tr key={record.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">
                          {record.user_name || record.user_email || record.created_by}
                          {isFirst && <Trophy className="mr-1 inline h-4 w-4 text-yellow-500" />}
                        </td>
                        <td className="p-2">{STATUS_LABELS[record.status] || record.status}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <span>
                              {solved.length} מתוך {playersGame.groups.length}
                            </span>
                            {solved.map((groupIndex) => (
                              <span
                                key={groupIndex}
                                title={playersGame.groups[groupIndex]?.title}
                                className={`h-3 w-3 rounded-full ${GROUP_COLORS[groupIndex]}`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="p-2">{record.mistakes || 0}</td>
                        <td className="p-2">{formatDate(record.updated_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
