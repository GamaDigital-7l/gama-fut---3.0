
import React, { useMemo } from 'react';
import { Match, Player, Team } from '../types';
import { Shield } from 'lucide-react';

interface TopGoalkeepersProps {
  matches: Match[];
  players: Player[];
  teams: Team[];
}

const TopGoalkeepers: React.FC<TopGoalkeepersProps> = ({ matches, players, teams }) => {
  const goalkeepers = useMemo(() => {
    // 1. Calculate Goals Conceded per Team
    const teamConceded: Record<string, { goals: number, games: number }> = {};
    
    // Initialize
    teams.forEach(t => {
        teamConceded[t.id] = { goals: 0, games: 0 };
    });

    matches.forEach(m => {
        if (m.status === 'finished' && m.home_team_id && m.away_team_id) {
            // Home Team Conceded = Away Score
            if (teamConceded[m.home_team_id]) {
                teamConceded[m.home_team_id].goals += m.away_score;
                teamConceded[m.home_team_id].games += 1;
            }
            // Away Team Conceded = Home Score
            if (teamConceded[m.away_team_id]) {
                teamConceded[m.away_team_id].goals += m.home_score;
                teamConceded[m.away_team_id].games += 1;
            }
        }
    });

    // 2. Filter Players by Position 'Goleiro' and Map to Stats
    const keepers = players
        .filter(p => p.position === 'Goleiro' || p.position === 'Gol' || p.position === 'GOLEIRO')
        .map(p => {
            const team = teams.find(t => t.id === p.team_id);
            const stats = team && teamConceded[team.id] ? teamConceded[team.id] : { goals: 0, games: 0 };
            
            return {
                playerId: p.id,
                name: p.name,
                teamName: team?.short_name || 'Sem Time',
                goalsConceded: stats.goals,
                gamesPlayed: stats.games,
                average: stats.games > 0 ? (stats.goals / stats.games).toFixed(2) : '0.00'
            };
        });

    // 3. Sort: Fewest goals first. Tiebreaker: Most games played (harder to keep clean sheet).
    return keepers
        .filter(k => k.gamesPlayed > 0) // Only show if team played
        .sort((a, b) => {
            if (a.goalsConceded !== b.goalsConceded) return a.goalsConceded - b.goalsConceded;
            return b.gamesPlayed - a.gamesPlayed;
        })
        .slice(0, 5); // Top 5

  }, [matches, players, teams]);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg h-full">
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2">
            <Shield className="text-blue-500" size={20} />
            <h2 className="font-bold text-white">Goleiros Menos Vazados</h2>
        </div>
        <div className="divide-y divide-slate-700">
            {goalkeepers.map((k, idx) => (
                <div key={k.playerId} className="p-3 flex items-center justify-between hover:bg-slate-700/30">
                    <div className="flex items-center gap-3">
                        <span className={`font-bold w-6 text-center ${idx === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{idx + 1}</span>
                        <div>
                            <div className="text-white font-medium text-sm">{k.name}</div>
                            <div className="text-xs text-slate-500">{k.teamName} • {k.gamesPlayed} jogos</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded text-xs font-bold inline-block">
                            {k.goalsConceded} Gols
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Média {k.average}</div>
                    </div>
                </div>
            ))}
            {goalkeepers.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">Nenhum dado disponível.</div>}
        </div>
    </div>
  );
};

export default TopGoalkeepers;
