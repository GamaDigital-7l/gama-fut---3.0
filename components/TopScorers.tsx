import React, { useMemo } from 'react';
import { MatchEvent, Player, Team } from '../types';
import { Medal } from 'lucide-react';

interface TopScorersProps {
  events: MatchEvent[];
  players: Player[];
  teams: Team[];
}

const TopScorers: React.FC<TopScorersProps> = ({ events, players, teams }) => {
  const scorers = useMemo(() => {
    const counts: Record<string, number> = {};
    
    events.forEach(e => {
        if (e.type === 'gol' && e.player_id) {
            counts[e.player_id] = (counts[e.player_id] || 0) + 1;
        }
    });

    return Object.entries(counts)
        .map(([playerId, goals]) => {
            const player = players.find(p => p.id === playerId);
            const team = teams.find(t => t.id === player?.team_id);
            return { playerId, name: player?.name || 'Desconhecido', teamName: team?.short_name, goals };
        })
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 5);
  }, [events, players, teams]);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg h-full">
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2">
            <Medal className="text-yellow-500" size={20} />
            <h2 className="font-bold text-white">Artilharia</h2>
        </div>
        <div className="divide-y divide-slate-700">
            {scorers.map((s, idx) => (
                <div key={s.playerId} className="p-3 flex items-center justify-between hover:bg-slate-700/30">
                    <div className="flex items-center gap-3">
                        <span className={`font-bold w-6 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}`}>{idx + 1}</span>
                        <div>
                            <div className="text-white font-medium text-sm">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.teamName}</div>
                        </div>
                    </div>
                    <div className="bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded text-xs font-bold">
                        {s.goals} Gols
                    </div>
                </div>
            ))}
            {scorers.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">Nenhum gol registrado.</div>}
        </div>
    </div>
  );
};

export default TopScorers;