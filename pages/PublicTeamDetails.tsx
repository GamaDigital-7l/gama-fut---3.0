
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Team, Player, Match, Championship, MatchEvent } from '../types';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, ArrowLeft, Shirt, Medal } from 'lucide-react';

const PublicTeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [scorers, setScorers] = useState<{name: string, goals: number}[]>([]);

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (teamId: string) => {
      // 1. Fetch Team
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
      setTeam(teamData);

      if (teamData) {
          // 2. Fetch Championship
          if (teamData.championship_id) {
              const { data: champData } = await supabase.from('championships').select('*').eq('id', teamData.championship_id).single();
              setChampionship(champData);
          }

          // 3. Fetch Players
          const { data: playersData } = await supabase.from('players').select('*').eq('team_id', teamId).order('number', { ascending: true });
          setPlayers(playersData || []);

          // 4. Fetch Matches (Home or Away)
          const { data: matchesData } = await supabase
            .from('matches')
            .select('*, home_team:teams!home_team_id(name, logo_url, short_name), away_team:teams!away_team_id(name, logo_url, short_name)')
            .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
            .order('start_time', { ascending: true });
          setMatches(matchesData as any[] || []);

          // 5. Calculate Top Scorers for THIS Team
          const { data: eventsData } = await supabase.from('match_events').select('player_id, type').eq('team_id', teamId).eq('type', 'gol');
          
          if (eventsData && playersData) {
              const counts: Record<string, number> = {};
              eventsData.forEach((e: any) => {
                  if (e.player_id) counts[e.player_id] = (counts[e.player_id] || 0) + 1;
              });
              
              const sortedScorers = Object.entries(counts).map(([pid, goals]) => {
                  const p = playersData.find((pl: Player) => pl.id === pid);
                  return { name: p?.name || 'Desconhecido', goals };
              }).sort((a,b) => b.goals - a.goals);
              
              setScorers(sortedScorers);
          }
      }
      setLoading(false);
  };

  if (loading) return <div className="text-white p-10 animate-pulse text-center">Carregando perfil do time...</div>;
  if (!team) return <div className="text-white p-10 text-center">Time não encontrado.</div>;

  const nextMatch = matches.find(m => m.status !== 'finished');
  const pastMatches = matches.filter(m => m.status === 'finished').reverse(); // Most recent first

  return (
    <div className="pb-20 space-y-8 animate-in fade-in max-w-6xl mx-auto">
        {/* Header */}
        <div className="relative bg-[#1e293b] rounded-b-3xl -mt-6 border-b border-slate-700 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-[#1e293b]"></div>
            <div className="relative z-10 p-8 flex flex-col md:flex-row items-center md:items-end gap-6 max-w-6xl mx-auto">
                <button onClick={() => navigate(-1)} className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full backdrop-blur-sm"><ArrowLeft size={24}/></button>
                
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center border-4 border-slate-700 shadow-2xl p-1">
                    {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-full"/> : <Trophy size={48} className="text-slate-800"/>}
                </div>
                
                <div className="text-center md:text-left flex-1 pb-2">
                    <h1 className="text-4xl font-black text-white tracking-tight">{team.name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-sm font-bold uppercase text-slate-400">
                        {championship && (
                            <Link to={`/championship/${championship.id}`} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                                <Trophy size={14} className="text-emerald-500"/> {championship.name}
                            </Link>
                        )}
                        {team.category && <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-600">{team.category}</span>}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 md:px-0">
            {/* Left Column: Matches */}
            <div className="space-y-6 lg:col-span-2">
                
                {/* Next Match Card */}
                {nextMatch && (
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Próximo Jogo</div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><Calendar size={14}/> Agenda</h3>
                        
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col items-center gap-2 w-1/3">
                                <img src={(nextMatch.home_team as any)?.logo_url} className="w-12 h-12 md:w-16 md:h-16 object-contain"/>
                                <span className="text-xs md:text-sm font-bold text-white text-center">{(nextMatch.home_team as any)?.short_name}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-2xl md:text-4xl font-black text-slate-600">VS</span>
                                <div className="text-[10px] md:text-xs font-bold bg-slate-900 text-slate-300 px-3 py-1 rounded-full mt-2 border border-slate-700">
                                    {nextMatch.start_time ? new Date(nextMatch.start_time).toLocaleString() : 'A definir'}
                                </div>
                                <span className="text-[10px] text-slate-500 mt-1 uppercase">{nextMatch.location || 'Local a definir'}</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 w-1/3">
                                <img src={(nextMatch.away_team as any)?.logo_url} className="w-12 h-12 md:w-16 md:h-16 object-contain"/>
                                <span className="text-xs md:text-sm font-bold text-white text-center">{(nextMatch.away_team as any)?.short_name}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Match History */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-4 bg-slate-900 border-b border-slate-700">
                        <h3 className="font-bold text-white flex items-center gap-2"><Calendar size={18} className="text-emerald-500"/> Últimos Jogos</h3>
                    </div>
                    <div className="divide-y divide-slate-700">
                        {pastMatches.map(m => {
                            const isHome = m.home_team_id === team.id;
                            const opponent = isHome ? m.away_team : m.home_team;
                            const win = isHome ? m.home_score > m.away_score : m.away_score > m.home_score;
                            const draw = m.home_score === m.away_score;
                            const resultColor = win ? 'text-emerald-400' : draw ? 'text-slate-300' : 'text-red-400';
                            const resultChar = win ? 'V' : draw ? 'E' : 'D';

                            return (
                                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-700/20">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black ${win ? 'bg-emerald-900/50 text-emerald-400' : draw ? 'bg-slate-700 text-slate-300' : 'bg-red-900/50 text-red-400'}`}>
                                            {resultChar}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                                <span className={resultColor}>{isHome ? m.home_score : m.away_score}</span>
                                                <span className="text-slate-600">-</span>
                                                <span>{isHome ? m.away_score : m.home_score}</span>
                                                <span className="text-slate-400 font-normal text-xs ml-1">vs {(opponent as any)?.short_name}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 uppercase">{m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage}</div>
                                        </div>
                                    </div>
                                    {m.is_wo && <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">W.O.</span>}
                                </div>
                            );
                        })}
                        {pastMatches.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">Nenhum jogo disputado ainda.</div>}
                    </div>
                </div>
            </div>

            {/* Right Column: Squad & Stats */}
            <div className="space-y-6">
                
                {/* Top Scorers Widget */}
                {scorers.length > 0 && (
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-4 bg-slate-900 border-b border-slate-700">
                            <h3 className="font-bold text-white flex items-center gap-2"><Medal size={18} className="text-yellow-500"/> Artilheiros do Time</h3>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {scorers.slice(0, 5).map((s, idx) => (
                                <div key={idx} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-black w-4 ${idx === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{idx+1}</span>
                                        <span className="text-sm font-bold text-white">{s.name}</span>
                                    </div>
                                    <span className="text-xs font-bold bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded">{s.goals} gols</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Squad List */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-4 bg-slate-900 border-b border-slate-700">
                        <h3 className="font-bold text-white flex items-center gap-2"><Shirt size={18} className="text-blue-500"/> Elenco ({players.length})</h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-700">
                        {players.map(p => (
                            <div key={p.id} className="p-3 flex items-center gap-4 hover:bg-slate-700/20">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white border border-slate-600">
                                    {p.number}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white">{p.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">{p.position}</div>
                                </div>
                            </div>
                        ))}
                        {players.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">Elenco não informado.</div>}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default PublicTeamDetails;
