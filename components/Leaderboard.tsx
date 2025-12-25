
import React, { useMemo } from 'react';
import { Match, Team } from '../types';
import { Link } from 'react-router-dom';

interface LeaderboardProps {
  matches: Match[];
  teams: Team[];
  promotionZone?: number;
  relegationZone?: number;
  goldZone?: number;
  silverZone?: number;
  bronzeZone?: number;
  groupName?: string;
}

interface TeamStats {
  teamId: string;
  name: string;
  logo_url: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number; // Goals For
  ga: number; // Goals Against
  gd: number; // Goal Difference
  efficiency: number; // %
}

const Leaderboard: React.FC<LeaderboardProps> = ({ 
    matches, 
    teams, 
    promotionZone = 4, 
    relegationZone = 1, 
    goldZone = 0,
    silverZone = 0,
    bronzeZone = 0,
    groupName 
}) => {
  const standings = useMemo(() => {
    const stats: Record<string, TeamStats> = {};

    // Initialize stats for the specific teams passed in props
    teams.forEach(team => {
      stats[team.id] = {
        teamId: team.id,
        name: team.name,
        logo_url: team.logo_url,
        points: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        efficiency: 0
      };
    });

    // Calculate stats from finished matches
    matches.forEach(match => {
      if (match.status === 'finished' && stats[match.home_team_id!] && stats[match.away_team_id!]) {
        const home = stats[match.home_team_id!];
        const away = stats[match.away_team_id!];

        home.played += 1;
        away.played += 1;
        home.gf += match.home_score;
        away.gf += match.away_score;
        home.ga += match.away_score;
        away.ga += match.home_score;
        home.gd = home.gf - home.ga;
        away.gd = away.gf - away.ga;

        if (match.home_score > match.away_score) {
          home.won += 1;
          home.points += 3;
          away.lost += 1;
        } else if (match.home_score < match.away_score) {
          away.won += 1;
          away.points += 3;
          home.lost += 1;
        } else {
          home.drawn += 1;
          home.points += 1;
          away.drawn += 1;
          away.points += 1;
        }
      }
    });

    // Calculate Efficiency
    Object.values(stats).forEach(team => {
        if (team.played > 0) {
            team.efficiency = Math.round((team.points / (team.played * 3)) * 100);
        }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return b.gd - a.gd;
    });
  }, [matches, teams]);

  // Logic for Zone Colors based on Index
  const getZoneInfo = (index: number, totalTeams: number) => {
      // 1. Promotion (Green) - Highest Priority
      if (index < promotionZone) return { color: 'border-emerald-500', badge: 'bg-emerald-500' };
      
      // 2. Gold Series (Yellow)
      const goldStart = promotionZone;
      const goldEnd = goldStart + goldZone;
      if (index >= goldStart && index < goldEnd) return { color: 'border-yellow-500', badge: 'bg-yellow-500' };

      // 3. Silver Series (Slate/Silver)
      const silverStart = goldEnd;
      const silverEnd = silverStart + silverZone;
      if (index >= silverStart && index < silverEnd) return { color: 'border-slate-400', badge: 'bg-slate-400' };

      // 4. Bronze Series (Amber/Bronze)
      const bronzeStart = silverEnd;
      const bronzeEnd = bronzeStart + bronzeZone;
      if (index >= bronzeStart && index < bronzeEnd) return { color: 'border-amber-700', badge: 'bg-amber-700' };

      // 5. Relegation (Red) - Priority from bottom
      if (index >= totalTeams - relegationZone) return { color: 'border-red-500', badge: 'bg-red-500' };

      // Neutral
      return { color: 'border-slate-700', badge: 'bg-slate-700' };
  };

  return (
    <div className="space-y-4">
        {groupName && <h3 className="text-xl font-bold text-white mb-2">{groupName}</h3>}

        {/* --- MOBILE VIEW (Compact Cards) - INTACTO --- */}
        <div className="md:hidden space-y-3">
             {standings.map((team, index) => {
                 const zone = getZoneInfo(index, standings.length);
                 return (
                     <Link to={`/team/${team.teamId}`} key={team.teamId} className={`block bg-[#0f172a] rounded-xl p-3 relative overflow-hidden border-l-[4px] shadow-lg ${zone.color}`}>
                         {/* Header: Rank + Team + Points */}
                         <div className="flex items-center justify-between mb-3">
                             <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                 <div className="flex flex-col items-center justify-center w-6 shrink-0">
                                     <span className="text-base font-black text-slate-400 leading-none">{index + 1}</span>
                                     <div className={`w-1.5 h-1.5 rounded-full mt-1 ${zone.badge}`}></div>
                                 </div>
                                 
                                 <div className="flex items-center gap-2 flex-1 min-w-0">
                                     <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700 p-0.5">
                                         {team.logo_url && <img src={team.logo_url} className="w-full h-full object-cover rounded-full"/>}
                                     </div>
                                     <span className="font-bold text-white uppercase text-sm leading-tight truncate w-full" title={team.name}>{team.name}</span>
                                 </div>
                             </div>
                             <div className="bg-emerald-600 text-white px-3 py-1 rounded font-black text-sm shadow-md shrink-0">
                                 {team.points} <span className="text-[10px] font-normal opacity-80">PTS</span>
                             </div>
                         </div>

                         {/* Stats Row - Compact */}
                         <div className="grid grid-cols-6 gap-1 bg-slate-800/50 p-2 rounded-lg text-center">
                             <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">J</span>
                                 <span className="text-white font-bold text-xs">{team.played}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">V</span>
                                 <span className="text-slate-300 font-bold text-xs">{team.won}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">E</span>
                                 <span className="text-slate-300 font-bold text-xs">{team.drawn}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">D</span>
                                 <span className="text-slate-300 font-bold text-xs">{team.lost}</span>
                             </div>
                             <div className="flex flex-col col-span-2 border-l border-slate-700 pl-1">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">Saldo</span>
                                 <span className={`font-black text-xs ${team.gd > 0 ? 'text-emerald-400' : team.gd < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                     {team.gd > 0 ? `+${team.gd}` : team.gd}
                                 </span>
                             </div>
                         </div>
                     </Link>
                 );
             })}
        </div>

        {/* --- DESKTOP VIEW (Table) - AJUSTADO PARA NÃO CORTAR TEXTO --- */}
        <div className="hidden md:block bg-[#111827] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
             <table className="w-full text-left border-collapse table-auto">
                 <thead className="bg-[#1f2937] text-xs font-black text-slate-400 uppercase tracking-widest">
                     <tr>
                         <th className="px-4 py-4 w-16 text-center">Pos</th>
                         <th className="px-4 py-4 w-auto min-w-[200px]">Equipe</th>
                         <th className="px-4 py-4 text-center text-emerald-500 bg-slate-800/50 w-20">PTS</th>
                         <th className="px-2 py-4 text-center w-12">J</th>
                         <th className="px-2 py-4 text-center w-12">V</th>
                         <th className="px-2 py-4 text-center w-12">E</th>
                         <th className="px-2 py-4 text-center w-12">D</th>
                         <th className="px-2 py-4 text-center w-16">SG</th>
                         <th className="px-2 py-4 text-center w-14">GP</th>
                         <th className="px-2 py-4 text-center w-14">GC</th>
                         <th className="px-4 py-4 text-center w-20">%</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                     {standings.map((team, index) => {
                         const zone = getZoneInfo(index, standings.length);
                         return (
                             <tr key={team.teamId} className="group hover:bg-slate-800/50 transition-colors">
                                 <td className="px-4 py-4 text-center relative">
                                     <span className="text-base font-black text-slate-400">{index + 1}º</span>
                                     {/* Zone Bar */}
                                     <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${zone.badge}`}></div>
                                 </td>
                                 <td className="px-4 py-4">
                                     <Link to={`/team/${team.teamId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                         <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700 relative p-0.5">
                                             {team.logo_url && <img src={team.logo_url} className="w-full h-full object-cover rounded-full"/>}
                                             <div className={`absolute top-0 right-0 w-2.5 h-2.5 border-2 border-[#111827] rounded-full ${zone.badge}`}></div>
                                         </div>
                                         <span className="text-sm font-bold text-white uppercase tracking-wide truncate max-w-[250px]" title={team.name}>{team.name}</span>
                                     </Link>
                                 </td>
                                 <td className="px-4 py-4 text-center bg-slate-800/30 group-hover:bg-slate-800/60">
                                     <span className="text-lg font-black text-emerald-500">{team.points}</span>
                                 </td>
                                 <td className="px-2 py-4 text-center font-bold text-white text-sm">{team.played}</td>
                                 <td className="px-2 py-4 text-center font-bold text-slate-400 text-sm">{team.won}</td>
                                 <td className="px-2 py-4 text-center font-bold text-slate-400 text-sm">{team.drawn}</td>
                                 <td className="px-2 py-4 text-center font-bold text-slate-400 text-sm">{team.lost}</td>
                                 <td className={`px-2 py-4 text-center font-black text-sm ${team.gd > 0 ? 'text-emerald-500' : team.gd < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                     {team.gd > 0 ? `+${team.gd}` : team.gd}
                                 </td>
                                 <td className="px-2 py-4 text-center font-bold text-slate-400 text-sm">{team.gf}</td>
                                 <td className="px-2 py-4 text-center font-bold text-slate-400 text-sm">{team.ga}</td>
                                 <td className="px-4 py-4 text-center">
                                     <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs font-bold border border-slate-700">
                                         {team.efficiency}%
                                     </span>
                                 </td>
                             </tr>
                         );
                     })}
                     {standings.length === 0 && (
                         <tr><td colSpan={11} className="text-center py-10 text-slate-500 font-medium">Nenhum dado disponível.</td></tr>
                     )}
                 </tbody>
             </table>
        </div>
    </div>
  );
};

export default Leaderboard;
