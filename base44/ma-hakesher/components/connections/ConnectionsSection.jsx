import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import ConnectionsBoard from "./ConnectionsBoard";
import { STATUS_LABELS } from "./gameUtils";

// Member-facing part of the game: the list of published puzzles and the board
// of the chosen one. Place it inside the "מועדון לחבר" page.
export default function ConnectionsSection() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [progressByGame, setProgressByGame] = useState({});
  const [activeGame, setActiveGame] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const [published, progress] = await Promise.all([
        base44.entities.ConnectionsGame.filter({ is_published: true }, "-created_date"),
        base44.entities.ConnectionsProgress.filter({ created_by: me.email }),
      ]);
      setUser(me);
      setGames(published);
      setProgressByGame(Object.fromEntries(progress.map((record) => [record.game_id, record])));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return <p dir="rtl" className="py-8 text-center text-gray-600">יש להתחבר כדי לשחק.</p>;
  }

  if (activeGame) {
    return (
      <ConnectionsBoard
        game={activeGame}
        user={user}
        onBack={() => {
          setActiveGame(null);
          load();
        }}
      />
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-xl">
      <h2 className="mb-1 text-2xl font-bold">מה הקשר?</h2>
      <p className="mb-4 text-sm text-gray-600">
        חלקו את 16 ההגדרות לארבע קבוצות של ארבע, לפי הקשר שביניהן.
      </p>
      {games.length === 0 && <p className="py-8 text-center text-gray-500">עדיין אין חידות. בקרוב!</p>}
      <div className="space-y-2">
        {games.map((game) => {
          const progress = progressByGame[game.id];
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game)}
              className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-right hover:bg-gray-50"
            >
              <span className="font-bold">{game.title}</span>
              <span className="text-sm text-gray-500">
                {progress ? STATUS_LABELS[progress.status] || "" : "חדש"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
