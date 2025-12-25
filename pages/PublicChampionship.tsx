
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Championship, Match, Team, MatchEvent, Player, Group, GlobalSponsor } from '../types';
import { Calendar, MapPin, List, BarChart3, Play, Trophy, ChevronLeft, ChevronRight, FileText, TrendingUp, Goal, BookOpen, AlertTriangle, ExternalLink, Filter, Shield, Zap, XCircle } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import Leaderboard from '../components/Leaderboard';
import TopScorers from '../components/TopScorers';
import TopGoalkeepers from '../components/TopGoalkeepers'; // Novo Componente

type Tab = 'classificacao' | 'jogos' | 'simulador' | 'times' | 'estatisticas' | 'regulamento';

const PublicChampionship: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('classificacao');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [champSponsors, setChampSponsors] = useState<GlobalSponsor[]>([]);

  // Simulator State
  const [simulatedScores, setSimulatedScores] = useState<Record<string, { home: number | string, away: number | string }>>({});
  const [simulatorSelectedRound, setSimulatorSelectedRound] = useState<string>('');

  // Round Navigation (Games Tab)
  const [selectedRound, setSelectedRound] = useState<string>('');
  
  // New: Team Filter for Games
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (champId: string) => {
      try {
          // Track View
          supabase.rpc('increment_page_view', { champ_id: champId });

          const [champRes, matchRes, teamRes, groupRes, eventRes, playerRes, sponsorRes] = await Promise.all([
              supabase.from('championships').select('*').eq('id', champId).single(),
              supabase.from('matches').select(`*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), group:groups(name)`).eq('championship_id', champId).order('start_time', { ascending: true }),
              supabase.from('teams').select('*').eq('championship_id', champId).order('name'),
              supabase.from('groups').select('*').eq('championship_id', champId).order('name'),
              supabase.from('match_events').select('*'), // Fetch ALL events for stats
              supabase.from('players').select('*'),
              supabase.from('global_sponsors').select('*').eq('active', true).order('display_order')
          ]);

          setChampionship(champRes.data);
          setMatches(matchRes.data || []);
          setTeams(teamRes.data || []);
          setGroups(groupRes.data || []);
          setEvents(eventRes.data as any[] || []);
          setPlayers(playerRes.data as Player[] || []);
          if (sponsorRes.data) {
              setChampSponsors(sponsorRes.data.filter(s => s.display_locations?.includes('champ_page')));
          }

          // Set Default Round for Games Tab
          const allMatches = matchRes.data || [];
          if (allMatches.length > 0) {
            const now = new Date();
            const upcoming = allMatches.find((m: Match) => new Date(m.start_time || '') >= now && m.status !== 'finished');
            const defaultM = upcoming || allMatches[allMatches.length - 1];
            if (defaultM) {
                const rName = defaultM.stage === 'group_stage' ? `Rodada ${defaultM.round_number}` : defaultM.stage || '';
                setSelectedRound(rName);
                setSimulatorSelectedRound(rName); // Also set for simulator default
            }
          }

      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  // --- Derived State ---

  const rounds = useMemo(() => {
    const r = new Set<string>();
    matches.forEach(m => {
        const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
        if (name) r.add(name);
    });
    return Array.from(r).sort((a, b) => {
        if (a.startsWith('Rodada') && b.startsWith('Rodada')) {
            return parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]);
        }
        if (a.startsWith('Rodada')) return -1;
        if (b.startsWith('Rodada')) return 1;
        return a.localeCompare(b);
    });
  }, [matches]);

  const currentRoundMatches = useMemo(() => {
    if (selectedTeamFilter) {
        return matches.filter(m => m.home_team_id === selectedTeamFilter || m.away_team_id === selectedTeamFilter);
    }
    if (!selectedRound) return [];
    return matches.filter(m => {
        const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
        return name === selectedRound;
    });
  }, [selectedRound, matches, selectedTeamFilter]);

  const matchesForSimulator = useMemo(() => {
      // Merge actual matches with simulated scores for the Leaderboard
      return matches.map(m => {
          const sim = simulatedScores[m.id];
          if (m.status !== 'finished' && sim && sim.home !== '' && sim.away !== '') {
              return { 
                  ...m, 
                  status: 'finished', 
                  home_score: Number(sim.home), 
                  away_score: Number(sim.away) 
              } as Match;
          }
          return m;
      });
  }, [matches, simulatedScores]);

  // Simulator: Filter matches by selected round for the Input List
  const simulatorFilteredMatches = useMemo(() => {
      if (!simulatorSelectedRound) return [];
      return matches.filter(m => {
          const rName = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
          return rName === simulatorSelectedRound && m.status !== 'finished' && m.home_team_id && m.away_team_id;
      });
  }, [matches, simulatorSelectedRound]);

  // Simulator: Available rounds
  const simulatorAvailableRounds = useMemo(() => {
      const r = new Set<string>();
      matches.filter(m => m.status !== 'finished' && m.home_team_id && m.away_team_id).forEach(m => {
          const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
          if (name) r.add(name);
      });
      return Array.from(r).sort((a, b) => {
          if (a.startsWith('Rodada') && b.startsWith('Rodada')) {
              return parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]);
          }
          if (a.startsWith('Rodada')) return -1;
          if (b.startsWith('Rodada')) return 1;
          return a.localeCompare(b);
      });
  }, [matches]);


  // Statistics Calculation
  const generalStats = useMemo(() => {
      const finishedMatches = matches.filter(m => m.status === 'finished');
      const totalGames = finishedMatches.length;
      const totalGoals = finishedMatches.reduce((acc, m) => acc + (m.home_score || 0) + (m.away_score || 0), 0);
      const avgGoals = totalGames > 0 ? (totalGoals / totalGames).toFixed(2) : '0';
      return { totalGames, totalGoals, avgGoals };
  }, [matches]);

  const roundStats = useMemo(() => {
      const relevantMatches = selectedTeamFilter ? currentRoundMatches : matches.filter(m => {
          const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
          return name === selectedRound;
      });

      const finishedMatches = relevantMatches.filter(m => m.status === 'finished');
      const totalGames = finishedMatches.length;
      const totalGoals = finishedMatches.reduce((acc, m) => acc + (m.home_score || 0) + (m.away_score || 0), 0);
      const avgGoals = totalGames > 0 ? (totalGoals / totalGames).toFixed(2) : '0';
      return { totalGames, totalGoals, avgGoals };
  }, [currentRoundMatches, selectedRound, selectedTeamFilter]);

  // --- ADVANCED STATISTICS CALCULATION ---
  const advancedStats = useMemo(() => {
      const teamStats: Record<string, any> = {};
      const playerStats: Record<string, any> = {};

      teams.forEach(t => teamStats[t.id] = { id: t.id, name: t.name, logo: t.logo_url, goalsFor: 0, goalsAgainst: 0, won: 0, drawn: 0, lost: 0, points: 0, games: 0, cards: 0 });

      // Match based stats
      matches.filter(m => m.status === 'finished').forEach(m => {
          if (!teamStats[m.home_team_id!] || !teamStats[m.away_team_id!]) return;
          const h = teamStats[m.home_team_id!];
          const a = teamStats[m.away_team_id!];

          h.games++; a.games++;
          h.goalsFor += m.home_score; h.goalsAgainst += m.away_score;
          a.goalsFor += m.away_score; a.goalsAgainst += m.home_score;

          if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
          else if (m.away_score > m.home_score) { a.won++; a.points += 3; h.lost++; }
          else { h.drawn++; h.points++; a.drawn++; a.points++; }
      });

      // Event based stats (Cards)
      events.forEach(e => {
          if ((e.type === 'cartao_amarelo' || e.type === 'cartao_vermelho') && e.team_id && teamStats[e.team_id]) {
              teamStats[e.team_id].cards++;
              if (e.player_id) {
                  if (!playerStats[e.player_id]) playerStats[e.player_id] = { id: e.player_id, cards: 0 };
                  playerStats[e.player_id].cards++;
              }
          }
      });

      const statsArray = Object.values(teamStats);
      
      const bestAttack = [...statsArray].sort((a,b) => b.goalsFor - a.goalsFor)[0];
      const bestDefense = [...statsArray].filter(t => t.games > 0).sort((a,b) => (a.goalsAgainst/a.games) - (b.goalsAgainst/b.games))[0]; // Avg per game
      const bestEfficiency = [...statsArray].filter(t => t.games > 0).sort((a,b) => (b.points/(b.games*3)) - (a.points/(a.games*3)))[0];
      const mostWins = [...statsArray].sort((a,b) => b.won - a.won)[0];
      const mostDraws = [...statsArray].sort((a,b) => b.drawn - a.drawn)[0];
      const fairPlay = [...statsArray].sort((a,b) => a.cards - b.cards)[0]; // Least cards
      const badBoys = [...statsArray].sort((a,b) => b.cards - a.cards)[0]; // Most cards

      // Player Most Cards
      const mostCardsPlayerId = Object.entries(playerStats).sort((a:any, b:any) => b[1].cards - a[1].cards)[0]?.[0];
      const mostCardsPlayer = players.find(p => p.id === mostCardsPlayerId);

      return { bestAttack, bestDefense, bestEfficiency, mostWins, mostDraws, fairPlay, badBoys, mostCardsPlayer, mostCardsCount: playerStats[mostCardsPlayerId || '']?.cards || 0 };
  }, [matches, teams, events, players]);


  if (loading || !championship) return <div className="text-white p-10 animate-pulse text-center">Carregando campeonato...</div>;

  return (
    <div className="space-y-6 pb-20 overflow-x-hidden">
        {/* HEADER */}
        <div className="bg-[#1e293b] border-b border-slate-700 relative overflow-hidden -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 md:py-10">
             {championship.banner_url && (
                 <div className="absolute inset-0">
                     <img src={championship.banner_url} className="w-full h-full object-cover opacity-20 blur-sm" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#1e293b] via-[#1e293b]/80 to-transparent"></div>
                 </div>
             )}
             
             <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6">
                 <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-2xl shrink-0">
                    {championship.logo_url ? <img src={championship.logo_url} className="w-full h-full object-contain"/> : <Trophy className="text-slate-800" size={36}/>}
                 </div>
                 <div className="text-center md:text-left flex-1 min-w-0">
                     <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight break-words">{championship.name}</h1>
                     <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-xs md:text-sm font-bold text-slate-400 uppercase">
                         <span className="flex items-center gap-1"><MapPin size={12} className="md:w-4 md:h-4"/> {championship.city}/{championship.state}</span>
                         <span className="bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">{championship.category || 'Geral'}</span>
                         <span>{teams.length} Times</span>
                     </div>
                 </div>
             </div>
        </div>

        {/* STATISTICS WIDGET (GENERAL) */}
        <div className="max-w-7xl mx-auto px-2 md:px-0">
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-2">
                <div className="bg-slate-800 p-3 md:p-4 rounded-xl border border-slate-700 flex flex-col items-center">
                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold mb-1">Jogos</span>
                    <div className="text-xl md:text-2xl font-black text-white flex items-center gap-1 md:gap-2"><Calendar className="text-emerald-500 w-4 h-4 md:w-5 md:h-5"/> {generalStats.totalGames}</div>
                </div>
                <div className="bg-slate-800 p-3 md:p-4 rounded-xl border border-slate-700 flex flex-col items-center">
                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold mb-1">Gols</span>
                    <div className="text-xl md:text-2xl font-black text-white flex items-center gap-1 md:gap-2"><Goal className="text-emerald-500 w-4 h-4 md:w-5 md:h-5"/> {generalStats.totalGoals}</div>
                </div>
                <div className="bg-slate-800 p-3 md:p-4 rounded-xl border border-slate-700 flex flex-col items-center">
                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold mb-1">Média</span>
                    <div className="text-xl md:text-2xl font-black text-white flex items-center gap-1 md:gap-2"><TrendingUp className="text-emerald-500 w-4 h-4 md:w-5 md:h-5"/> {generalStats.avgGoals}</div>
                </div>
            </div>
        </div>

        {/* NAV TABS */}
        <div className="sticky top-16 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 shadow-lg">
            <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                <div className="flex flex-nowrap gap-2 py-3 min-w-max px-2 md:px-0">
                    {[
                        {id: 'classificacao', icon: List, label: 'Classificação'},
                        {id: 'jogos', icon: Calendar, label: 'Jogos'},
                        {id: 'simulador', icon: Play, label: 'Simulador'},
                        {id: 'times', icon: Trophy, label: 'Times'},
                        {id: 'estatisticas', icon: BarChart3, label: 'Estatísticas'},
                        {id: 'regulamento', icon: FileText, label: 'Regulamento'},
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold uppercase tracking-wide transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto min-h-[50vh] px-2 md:px-0">
            
            {/* CLASSIFICAÇÃO */}
            {activeTab === 'classificacao' && (
                <div className="space-y-8 animate-in fade-in">
                    {groups.length > 0 ? (
                        groups.map(group => (
                            <Leaderboard 
                                key={group.id}
                                matches={matches} 
                                teams={teams.filter(t => t.group_id === group.id)} 
                                groupName={group.name}
                                promotionZone={championship.zone_config.promotion}
                                relegationZone={championship.zone_config.relegation}
                                goldZone={championship.zone_config.gold}
                                silverZone={championship.zone_config.silver}
                                bronzeZone={championship.zone_config.bronze}
                            />
                        ))
                    ) : (
                        <Leaderboard 
                            matches={matches} 
                            teams={teams} 
                            groupName="Tabela Geral"
                            promotionZone={championship.zone_config.promotion}
                            relegationZone={championship.zone_config.relegation}
                            goldZone={championship.zone_config.gold}
                            silverZone={championship.zone_config.silver}
                            bronzeZone={championship.zone_config.bronze}
                        />
                    )}
                </div>
            )}

            {/* JOGOS */}
            {activeTab === 'jogos' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Team Filter */}
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center gap-3">
                        <div className="flex items-center gap-2 w-full md:w-auto text-slate-400 font-bold text-sm uppercase">
                            <Filter size={16}/> Filtrar Jogos
                        </div>
                        <select 
                            value={selectedTeamFilter} 
                            onChange={(e) => setSelectedTeamFilter(e.target.value)}
                            className="flex-1 w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                        >
                            <option value="">Todas as Equipes (Por Rodada)</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {/* Round Navigation */}
                    {!selectedTeamFilter && (
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <button onClick={() => {
                                const idx = rounds.indexOf(selectedRound);
                                if(idx > 0) setSelectedRound(rounds[idx-1]);
                            }} disabled={rounds.indexOf(selectedRound) <= 0} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30"><ChevronLeft/></button>
                            <div className="text-center">
                                <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Rodada Atual</span>
                                <span className="text-xl font-black text-white">{selectedRound || 'Sem Jogos'}</span>
                            </div>
                            <button onClick={() => {
                                const idx = rounds.indexOf(selectedRound);
                                if(idx < rounds.length - 1) setSelectedRound(rounds[idx+1]);
                            }} disabled={rounds.indexOf(selectedRound) >= rounds.length - 1} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30"><ChevronRight/></button>
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        {currentRoundMatches.map(match => (
                            <div key={match.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all relative">
                                {/* Header: Group Tag & Date */}
                                <div className="bg-slate-750 border-b border-slate-700 px-4 py-2 flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
                                    <div className="flex gap-2">
                                        <span className="bg-slate-700 text-white px-2 py-0.5 rounded">{match.group?.name || 'Jogo'}</span>
                                        {selectedTeamFilter && <span className="bg-slate-700 text-white px-2 py-0.5 rounded">{match.stage === 'group_stage' ? `Rodada ${match.round_number}` : match.stage}</span>}
                                    </div>
                                    <span>{match.start_time ? new Date(match.start_time).toLocaleDateString() + ' ' + new Date(match.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'A definir'}</span>
                                </div>

                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex flex-col items-center w-[35%] gap-2 px-1">
                                        <div className="w-12 h-12 rounded-full bg-slate-700 p-0.5 border border-slate-600 overflow-hidden">
                                            {match.home_team?.logo_url ? <img src={match.home_team.logo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-600"></div>}
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-white text-center leading-tight truncate w-full px-1" title={match.home_team?.name}>{match.home_team?.name}</span>
                                    </div>
                                    <div className="flex flex-col items-center w-[30%]">
                                        {match.status === 'finished' ? (
                                            <>
                                                <span className="text-2xl md:text-3xl font-black text-emerald-400 tracking-widest whitespace-nowrap">{match.home_score} - {match.away_score}</span>
                                                {match.is_wo && <span className="bg-red-600 text-white text-[9px] px-1.5 rounded font-bold uppercase mt-1">W.O.</span>}
                                                {match.penalty_home_score !== null && match.penalty_home_score !== undefined && (
                                                    <div className="text-[10px] text-slate-400 font-bold mt-1">({match.penalty_home_score} - {match.penalty_away_score}) Pên.</div>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-xl font-black text-slate-500">VS</span>
                                        )}
                                        {match.status === 'live' && <span className="text-[9px] text-red-500 font-black animate-pulse mt-1">● AO VIVO</span>}
                                    </div>
                                    <div className="flex flex-col items-center w-[35%] gap-2 px-1">
                                        <div className="w-12 h-12 rounded-full bg-slate-700 p-0.5 border border-slate-600 overflow-hidden">
                                            {match.away_team?.logo_url ? <img src={match.away_team.logo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-600"></div>}
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-white text-center leading-tight truncate w-full px-1" title={match.away_team?.name}>{match.away_team?.name}</span>
                                    </div>
                                </div>
                                
                                {match.location && (
                                    <div className="bg-slate-900/50 px-4 py-1.5 border-t border-slate-700 text-[9px] text-slate-500 font-bold uppercase flex justify-center items-center">
                                        <span className="flex items-center gap-1 truncate"><MapPin size={10}/> {match.location}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {currentRoundMatches.length === 0 && <div className="col-span-full py-10 text-center text-slate-500">Nenhum jogo encontrado.</div>}
                    </div>
                </div>
            )}

            {/* TIMES */}
            {activeTab === 'times' && (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 animate-in fade-in">
                    {teams.map(t => (
                        <Link to={`/team/${t.id}`} key={t.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center hover:bg-slate-750 transition-colors cursor-pointer group hover:border-emerald-500/50">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center border-2 border-slate-600 mb-3 group-hover:scale-105 transition-transform overflow-hidden">
                                {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" /> : <Trophy className="text-slate-400"/>}
                            </div>
                            <h3 className="font-bold text-white text-xs md:text-sm line-clamp-2 leading-tight">{t.name}</h3>
                        </Link>
                    ))}
                </div>
            )}

            {/* ESTATÍSTICAS (UPDATED) */}
            {activeTab === 'estatisticas' && (
                <div className="space-y-8 animate-in fade-in">
                    
                    {/* Top Stats Grid (Scorers + Keepers) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TopScorers events={events} players={players} teams={teams} />
                        <TopGoalkeepers matches={matches} players={players} teams={teams} />
                    </div>
                    
                    {/* Advanced Stats Cards (Curiosities) */}
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 border-t border-slate-800 pt-8"><Zap size={20} className="text-yellow-500"/> Curiosidades da Liga</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* Best Attack */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Melhor Ataque</span>
                            {advancedStats.bestAttack ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.bestAttack.logo && <img src={advancedStats.bestAttack.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.bestAttack.name}</div>
                                    <div className="text-xs text-emerald-400 font-bold mt-1">{advancedStats.bestAttack.goalsFor} Gols</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Best Defense */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Melhor Defesa</span>
                            {advancedStats.bestDefense ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.bestDefense.logo && <img src={advancedStats.bestDefense.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.bestDefense.name}</div>
                                    <div className="text-xs text-blue-400 font-bold mt-1">{(advancedStats.bestDefense.goalsAgainst / advancedStats.bestDefense.games).toFixed(1)} gols/jogo</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Most Wins */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Mais Vitórias</span>
                            {advancedStats.mostWins ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.mostWins.logo && <img src={advancedStats.mostWins.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.mostWins.name}</div>
                                    <div className="text-xs text-emerald-400 font-bold mt-1">{advancedStats.mostWins.won} Vitórias</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Efficiency */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Melhor Aproveitamento</span>
                            {advancedStats.bestEfficiency ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.bestEfficiency.logo && <img src={advancedStats.bestEfficiency.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.bestEfficiency.name}</div>
                                    <div className="text-xs text-yellow-400 font-bold mt-1">{Math.round((advancedStats.bestEfficiency.points / (advancedStats.bestEfficiency.games * 3)) * 100)}%</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Fair Play */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Fair Play (Menos Cartões)</span>
                            {advancedStats.fairPlay ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.fairPlay.logo && <img src={advancedStats.fairPlay.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.fairPlay.name}</div>
                                    <div className="text-xs text-emerald-400 font-bold mt-1">{advancedStats.fairPlay.cards} Cartões</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Bad Boys (Team) */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Mais Indisciplinado</span>
                            {advancedStats.badBoys ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 overflow-hidden">{advancedStats.badBoys.logo && <img src={advancedStats.badBoys.logo} className="w-full h-full object-cover"/>}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.badBoys.name}</div>
                                    <div className="text-xs text-red-400 font-bold mt-1">{advancedStats.badBoys.cards} Cartões</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>

                        {/* Bad Boy (Player) */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center col-span-2 md:col-span-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Jogador com Mais Cartões</span>
                            {advancedStats.mostCardsPlayer ? (
                                <>
                                    <div className="w-10 h-10 bg-slate-700 rounded-full mb-2 flex items-center justify-center font-bold text-white border border-slate-600">{advancedStats.mostCardsPlayer.number}</div>
                                    <div className="font-bold text-white text-sm leading-tight">{advancedStats.mostCardsPlayer.name}</div>
                                    <div className="text-xs text-red-400 font-bold mt-1">{advancedStats.mostCardsCount} Cartões</div>
                                </>
                            ) : <span className="text-xs text-slate-500">-</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* SIMULADOR (Responsive) */}
            {activeTab === 'simulador' && (
                <div className="animate-in fade-in w-[98%] mx-auto md:w-full">
                    {/* Header / Reset */}
                    <div className="bg-emerald-900/20 border-l-4 border-emerald-500 p-4 md:p-6 rounded-r-lg mb-6 md:mb-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-white text-base md:text-lg">Simulador de Resultados</h3>
                                <p className="text-xs md:text-sm text-emerald-100 mt-1">Simule placares para ver como a tabela muda.</p>
                            </div>
                            <button onClick={() => setSimulatedScores({})} className="text-xs bg-emerald-900/50 hover:bg-emerald-900 text-emerald-400 px-3 py-1.5 rounded border border-emerald-500/30 transition-colors font-bold">
                                Limpar
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-start">
                        
                        {/* 1. SELECTION & MATCHES (Left/Top) */}
                        <div className="w-full lg:w-1/2 space-y-6">
                            
                            {/* Round Selector */}
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                                    <Filter size={14}/> Filtrar por Rodada/Fase
                                </label>
                                <select 
                                    value={simulatorSelectedRound}
                                    onChange={(e) => setSimulatorSelectedRound(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none text-sm font-bold"
                                >
                                    <option value="">Selecione uma rodada...</option>
                                    {simulatorAvailableRounds.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Match List */}
                            <div className="space-y-4">
                                {simulatorFilteredMatches.length > 0 ? (
                                    simulatorFilteredMatches.map(m => (
                                        <div key={m.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                                            {/* Header */}
                                            <div className="bg-slate-900/50 px-3 py-2 border-b border-slate-700/50 flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[50%]">{m.group?.name || 'Grupo'}</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{m.start_time ? new Date(m.start_time).toLocaleDateString() : 'Data N/D'}</span>
                                            </div>
                                            
                                            <div className="p-3">
                                                {/* MOBILE VIEW (Stacked Rows: Team ... Input) */}
                                                <div className="md:hidden flex flex-col gap-3">
                                                    {/* Home Team Row */}
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600 p-0.5">
                                                                {m.home_team?.logo_url && <img src={m.home_team.logo_url} className="w-full h-full object-cover"/>}
                                                            </div>
                                                            <span className="text-sm font-bold text-white truncate">{m.home_team?.name}</span>
                                                        </div>
                                                        <input 
                                                            type="number" 
                                                            className="w-12 h-10 bg-slate-900 border border-slate-600 rounded text-center text-white font-bold focus:border-emerald-500 outline-none text-lg" 
                                                            value={simulatedScores[m.id]?.home ?? ''}
                                                            placeholder="-"
                                                            onChange={(e) => setSimulatedScores({...simulatedScores, [m.id]: { ...simulatedScores[m.id], home: e.target.value }})}
                                                        />
                                                    </div>
                                                    
                                                    {/* Away Team Row */}
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600 p-0.5">
                                                                {m.away_team?.logo_url && <img src={m.away_team.logo_url} className="w-full h-full object-cover"/>}
                                                            </div>
                                                            <span className="text-sm font-bold text-white truncate">{m.away_team?.name}</span>
                                                        </div>
                                                        <input 
                                                            type="number" 
                                                            className="w-12 h-10 bg-slate-900 border border-slate-600 rounded text-center text-white font-bold focus:border-emerald-500 outline-none text-lg" 
                                                            value={simulatedScores[m.id]?.away ?? ''}
                                                            placeholder="-"
                                                            onChange={(e) => setSimulatedScores({...simulatedScores, [m.id]: { ...simulatedScores[m.id], away: e.target.value }})}
                                                        />
                                                    </div>
                                                </div>

                                                {/* DESKTOP VIEW (Side by Side) */}
                                                <div className="hidden md:flex items-center justify-between">
                                                    {/* Home Team */}
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600 p-0.5">
                                                            {m.home_team?.logo_url && <img src={m.home_team.logo_url} className="w-full h-full object-cover"/>}
                                                        </div>
                                                        <span className="text-sm font-bold text-white truncate leading-tight" title={m.home_team?.name}>
                                                            {m.home_team?.name}
                                                        </span>
                                                    </div>

                                                    {/* Inputs */}
                                                    <div className="flex items-center gap-2 mx-3 shrink-0">
                                                        <input 
                                                            type="number" 
                                                            className="w-10 h-10 bg-slate-900 border border-slate-600 rounded-lg text-center text-white font-bold focus:border-emerald-500 outline-none transition-colors text-lg" 
                                                            placeholder="-"
                                                            value={simulatedScores[m.id]?.home ?? ''}
                                                            onChange={(e) => setSimulatedScores({...simulatedScores, [m.id]: { ...simulatedScores[m.id], home: e.target.value }})}
                                                        />
                                                        <span className="text-slate-600 font-bold text-xs">X</span>
                                                        <input 
                                                            type="number" 
                                                            className="w-10 h-10 bg-slate-900 border border-slate-600 rounded-lg text-center text-white font-bold focus:border-emerald-500 outline-none transition-colors text-lg" 
                                                            placeholder="-"
                                                            value={simulatedScores[m.id]?.away ?? ''}
                                                            onChange={(e) => setSimulatedScores({...simulatedScores, [m.id]: { ...simulatedScores[m.id], away: e.target.value }})}
                                                        />
                                                    </div>

                                                    {/* Away Team */}
                                                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                                        <span className="text-sm font-bold text-white truncate leading-tight text-right" title={m.away_team?.name}>
                                                            {m.away_team?.name}
                                                        </span>
                                                        <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600 p-0.5">
                                                            {m.away_team?.logo_url && <img src={m.away_team.logo_url} className="w-full h-full object-cover"/>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                                        <p className="text-slate-500 font-medium text-sm">
                                            {simulatorSelectedRound ? 'Nenhum jogo pendente nesta rodada.' : 'Selecione uma rodada para começar.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. PROJECTED STANDINGS (Right/Bottom) */}
                        <div className="w-full lg:w-1/2 space-y-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <TrendingUp className="text-emerald-500"/> Classificação Projetada
                            </h3>
                            {groups.length > 0 ? (
                                groups.map(group => (
                                    <Leaderboard 
                                        key={group.id}
                                        matches={matchesForSimulator} 
                                        teams={teams.filter(t => t.group_id === group.id)} 
                                        groupName={group.name}
                                        promotionZone={championship.zone_config.promotion}
                                        relegationZone={championship.zone_config.relegation}
                                        goldZone={championship.zone_config.gold}
                                        silverZone={championship.zone_config.silver}
                                        bronzeZone={championship.zone_config.bronze}
                                    />
                                ))
                            ) : (
                                <Leaderboard 
                                    matches={matchesForSimulator} 
                                    teams={teams} 
                                    promotionZone={championship.zone_config.promotion}
                                    relegationZone={championship.zone_config.relegation}
                                    goldZone={championship.zone_config.gold}
                                    silverZone={championship.zone_config.silver}
                                    bronzeZone={championship.zone_config.bronze}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REGULAMENTO */}
            {activeTab === 'regulamento' && (
                <div className="animate-in fade-in space-y-6">
                    <div className="bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="bg-emerald-900/30 p-4 rounded-full border border-emerald-500/30">
                                <BookOpen size={48} className="text-emerald-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-white mb-2">Regulamento Oficial</h3>
                                <p className="text-slate-400 text-sm max-w-2xl">
                                    Consulte as regras oficiais da competição para entender critérios de classificação, punições e diretrizes gerais.
                                </p>
                            </div>
                            {championship.regulations_url ? (
                                <a 
                                    href={championship.regulations_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
                                >
                                    <FileText size={20}/> Abrir Regulamento
                                    <ExternalLink size={16} className="opacity-70"/>
                                </a>
                            ) : (
                                <div className="text-slate-500 text-sm bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                                    Documento não disponível
                                </div>
                            )}
                        </div>
                    </div>

                    {championship.regulations_text && (
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
                                <AlertTriangle size={18} className="text-yellow-500"/> Pontos Importantes
                            </h3>
                            <div className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                                {championship.regulations_text}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PARTNERS FOOTER */}
            {champSponsors.length > 0 && (
                <div className="mt-16 pt-8 border-t border-slate-800">
                    <h3 className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Parceiros Oficiais</h3>
                    <div className="flex flex-wrap justify-center items-center gap-8">
                        {champSponsors.map(sponsor => (
                            <a 
                                key={sponsor.id} 
                                href={sponsor.link_url || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="group opacity-70 hover:opacity-100 transition-opacity"
                            >
                                <img src={sponsor.logo_url} alt={sponsor.name} className="h-10 md:h-12 w-auto object-contain grayscale group-hover:grayscale-0 transition-all"/>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default PublicChampionship;
