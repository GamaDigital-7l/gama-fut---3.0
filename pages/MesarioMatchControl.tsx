import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Match, Player, MatchEventType, Team, AuditLog } from '../types';
import { 
  Play, Square, Goal, AlertCircle, FileText, X, User, AlertTriangle, 
  ArrowLeft, Users, Plus, Save, Trash2, Edit, ClipboardList, CheckCircle2, Clock, Filter, Settings2, RotateCcw 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const POSITIONS = [
    'Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'
];

interface RosterEntry {
    id?: string;
    name: string;
    number: string;
    position: string;
    letter: string;
}

const MesarioMatchControl: React.FC<{ orgId: string }> = ({ orgId }) => {
  // Navigation & View State
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'matches' | 'rosters'>('matches');
  const [loading, setLoading] = useState(false);

  // Match List Filter State
  const [matchViewScope, setMatchViewScope] = useState<'today' | 'round'>('today');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('');

  // Data State
  const [matches, setMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Match Control State
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Event Selection Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [pendingEventType, setPendingEventType] = useState<MatchEventType | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);

  // Quick Roster Modal State
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterTeamId, setRosterTeamId] = useState<string | null>(null);
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>([]);
  const [rosterTeamName, setRosterTeamName] = useState('');

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [matchHistory, setMatchHistory] = useState<AuditLog[]>([]);

  // W.O. Modal
  const [showWOModal, setShowWOModal] = useState(false);
  const [woData, setWoData] = useState({ winnerId: '', useDefaultScore: true, homeScore: 3, awayScore: 0 });

  // Manual Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({ home: 0, away: 0, status: '' as any });

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    fetchInitialData();
  }, [orgId]);

  const fetchInitialData = async () => {
      setLoading(true);
      // 1. Fetch Matches - REMOVED FILTER FOR FINISHED GAMES to allow editing
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!home_team_id(*),
          away_team:teams!away_team_id(*),
          group:groups(name)
        `)
        .eq('organization_id', orgId)
        .order('start_time', { ascending: true });
      
      if (matchData) setMatches(matchData as Match[]);

      // 2. Fetch Teams (for Roster View)
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      
      if (teamData) setAllTeams(teamData as Team[]);

      // 3. Fetch Players (Global cache for counts)
      const { data: playerData } = await supabase.from('players').select('*');
      if (playerData) setPlayers(playerData as Player[]);
      
      setLoading(false);
  };

  // --- MATCH LIST LOGIC ---
  const rounds = useMemo(() => {
      const r = new Set<string>();
      matches.forEach(m => {
          const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
          if(name) r.add(name);
      });
      return Array.from(r).sort((a,b) => {
          if(a.startsWith('Rodada') && b.startsWith('Rodada')) return parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]);
          return a.localeCompare(b);
      });
  }, [matches]);

  const filteredMatches = useMemo(() => {
      if (matchViewScope === 'today') {
          const today = new Date().toISOString().split('T')[0];
          return matches.filter(m => m.start_time && m.start_time.startsWith(today));
      } else {
          if (!selectedRoundFilter) return [];
          return matches.filter(m => {
              const name = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage;
              return name === selectedRoundFilter;
          });
      }
  }, [matches, matchViewScope, selectedRoundFilter]);

  // --- MATCH SPECIFIC LOGIC ---
  useEffect(() => {
    if (selectedMatch) {
      // When entering a match, refresh players specifically for the teams involved
      fetchPlayersForMatch();
    }
  }, [selectedMatch]);

  const fetchPlayersForMatch = async () => {
      if(!selectedMatch) return;
      const { data } = await supabase
          .from('players')
          .select('*')
          .in('team_id', [selectedMatch.home_team_id, selectedMatch.away_team_id])
          .order('number', { ascending: true });
      if (data) setPlayers(data as Player[]);
  };

  // --- ACTIONS ---

  const logAction = async (actionType: string, description: string) => {
      if (!selectedMatch) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('audit_logs').insert({
          match_id: selectedMatch.id,
          user_id: user.id,
          action_type: actionType,
          description: description
      });
  };

  const updateMatchStatus = async (status: 'live' | 'finished') => {
    if (!selectedMatch) return;
    setLoading(true);
    
    // Optimistic Update
    const updatedMatch = { ...selectedMatch, status };
    setSelectedMatch(updatedMatch);
    setMatches(matches.map(m => m.id === selectedMatch.id ? updatedMatch : m));

    await supabase.from('matches').update({ status }).eq('id', selectedMatch.id);
    await logAction('STATUS_UPDATE', `Status alterado para ${status}`);
    setLoading(false);
  };

  const handleEventClick = (type: MatchEventType, teamId: string) => {
    setPendingEventType(type);
    setPendingTeamId(teamId);
    setShowEventModal(true);
  };

  const confirmEvent = async (playerId: string | null) => {
    if (!selectedMatch || !pendingEventType || !pendingTeamId) return;

    const now = new Date();
    const start = new Date(selectedMatch.start_time || now); // Fallback to now if null
    let minute = 0;
    
    if (selectedMatch.status === 'live') {
        const diffMs = now.getTime() - start.getTime();
        minute = Math.max(0, Math.floor(diffMs / 60000) + 1); 
    }

    const { error: eventError } = await supabase.from('match_events').insert({
      match_id: selectedMatch.id,
      team_id: pendingTeamId,
      player_id: playerId, 
      type: pendingEventType,
      minute: minute, 
      extra_info: minute > 45 ? '2º Tempo' : '1º Tempo'
    });

    if (eventError) {
        console.error(eventError);
        alert("Erro ao registrar evento");
    } else {
        // Update Score if Goal
        if (pendingEventType === 'gol') {
            const isHome = pendingTeamId === selectedMatch.home_team_id;
            const update = isHome 
                ? { home_score: (selectedMatch.home_score || 0) + 1 }
                : { away_score: (selectedMatch.away_score || 0) + 1 };
            
            await supabase.from('matches').update(update).eq('id', selectedMatch.id);
            setSelectedMatch({ ...selectedMatch, ...update });
            
            // Log Goal
            await logAction('GOAL', `Gol registrado para ${getTeamName(pendingTeamId)}. Placar: ${isHome ? update.home_score : selectedMatch.home_score}x${isHome ? selectedMatch.away_score : update.away_score}`);
        } else {
            // Log Event
            await logAction('EVENT', `Evento registrado: ${pendingEventType} para ${getTeamName(pendingTeamId)}`);
        }
    }
    
    setShowEventModal(false);
    setPendingEventType(null);
    setPendingTeamId(null);
  };

  const openHistory = async () => {
    if(!selectedMatch) return;
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select(`*, user_profile:user_profiles(full_name)`).eq('match_id', selectedMatch.id).order('created_at', { ascending: false });
    setMatchHistory(data as AuditLog[] || []);
    setShowHistoryModal(true);
    setLoading(false);
  };

  // --- W.O. LOGIC ---
  const handleConfirmWO = async () => {
      if(!selectedMatch || !woData.winnerId) return;
      setLoading(true);

      const updates = {
          status: 'finished',
          is_wo: true,
          wo_winner_team_id: woData.winnerId,
          home_score: woData.winnerId === selectedMatch.home_team_id ? woData.homeScore : 0,
          away_score: woData.winnerId === selectedMatch.away_team_id ? woData.awayScore : 0
      };

      await supabase.from('matches').update(updates).eq('id', selectedMatch.id);
      await logAction('WO_DECLARED', `W.O. declarado. Vencedor: ${getTeamName(woData.winnerId)}`);
      
      // Update local & close
      setSelectedMatch({ ...selectedMatch, ...updates } as Match);
      setShowWOModal(false);
      setLoading(false);
  };

  // --- MANUAL CORRECTION LOGIC ---
  const openCorrectionModal = () => {
      if(!selectedMatch) return;
      setCorrectionData({
          home: selectedMatch.home_score || 0,
          away: selectedMatch.away_score || 0,
          status: selectedMatch.status
      });
      setShowCorrectionModal(true);
  };

  const handleSaveCorrection = async () => {
      if(!selectedMatch) return;
      setLoading(true);

      const updates = {
          home_score: correctionData.home,
          away_score: correctionData.away,
          status: correctionData.status
      };

      const { error } = await supabase.from('matches').update(updates).eq('id', selectedMatch.id);

      if (error) {
          alert('Erro ao salvar correção: ' + error.message);
      } else {
          await logAction('MANUAL_CORRECTION', `Correção Manual. Status: ${correctionData.status}, Placar: ${correctionData.home}x${correctionData.away}`);
          setSelectedMatch({ ...selectedMatch, ...updates } as Match);
          setMatches(matches.map(m => m.id === selectedMatch.id ? { ...m, ...updates } as Match : m));
          setShowCorrectionModal(false);
      }
      setLoading(false);
  };

  // --- ROSTER MODAL LOGIC (The Spreadsheet) ---

  const openRosterModal = async (teamId: string, teamName: string) => {
      setRosterTeamId(teamId);
      setRosterTeamName(teamName);
      
      // Fetch fresh players for this team
      const { data: teamPlayers } = await supabase.from('players').select('*').eq('team_id', teamId).order('number');
      const currentPlayers = teamPlayers || [];

      // Explicitly type existing as RosterEntry[] so TypeScript knows id is optional
      const existing: RosterEntry[] = currentPlayers.map((p: any) => ({
          id: p.id,
          name: p.name,
          number: p.number.toString(),
          position: p.position || 'Atacante',
          letter: p.letter || ''
      }));

      // Add minimum blank rows if needed
      if (existing.length < 5) {
          const blanksNeeded = 5 - existing.length;
          for(let i=0; i < blanksNeeded; i++) {
              existing.push({ name: '', number: '', position: 'Atacante', letter: '' });
          }
      }

      setRosterEntries(existing);
      setShowRosterModal(true);
  };

  const addRosterRow = () => {
      setRosterEntries([...rosterEntries, { name: '', number: '', position: 'Atacante', letter: '' }]);
  };

  const updateRosterRow = (index: number, field: keyof RosterEntry, value: string) => {
      const updated = [...rosterEntries];
      updated[index] = { ...updated[index], [field]: value };
      setRosterEntries(updated);
  };

  const removeRosterRow = async (index: number) => {
      const entry = rosterEntries[index];
      if (entry.id) {
          if(!confirm("Remover este jogador do banco de dados?")) return;
          await supabase.from('players').delete().eq('id', entry.id);
      }
      
      const updated = [...rosterEntries];
      updated.splice(index, 1);
      setRosterEntries(updated);
  };

  const saveRoster = async () => {
      if (!rosterTeamId) return;
      setLoading(true);

      const validEntries = rosterEntries.filter(e => e.name.trim() !== '' && e.number.trim() !== '');
      
      if (validEntries.length === 0) {
          alert("Preencha pelo menos um jogador com Nome e Número.");
          setLoading(false);
          return;
      }

      const upsertData = validEntries.map(e => ({
          id: e.id, // Supabase ignores undefined IDs for insert, uses them for update
          team_id: rosterTeamId,
          name: e.name,
          number: parseInt(e.number),
          position: e.position,
          letter: e.letter ? e.letter.toUpperCase() : null
      }));

      const { error } = await supabase.from('players').upsert(upsertData);

      if (error) {
          alert("Erro ao salvar: " + error.message);
      } else {
          // Refresh Data
          if (selectedMatch) {
              await fetchPlayersForMatch();
          } else {
              // Refresh global cache
              const { data } = await supabase.from('players').select('*');
              if (data) setPlayers(data as Player[]);
          }
          setShowRosterModal(false);
      }
      setLoading(false);
  };

  // --- HELPERS ---

  const getFilteredPlayers = () => {
      if (!pendingTeamId) return [];
      return players.filter(p => p.team_id === pendingTeamId);
  };

  const getTeamName = (teamId: string | null) => {
      if (!selectedMatch || !teamId) return '';
      return teamId === selectedMatch.home_team_id ? selectedMatch.home_team?.name : selectedMatch.away_team?.name;
  };

  const hasPlayers = (teamId?: string) => {
      if (!teamId) return false;
      return players.some(p => p.team_id === teamId);
  };

  const getPlayerCount = (teamId: string) => {
      return players.filter(p => p.team_id === teamId).length;
  };

  // --- RENDER: MATCH CONTROLLER (INSIDE GAME) ---
  if (selectedMatch) {
    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
          {/* Header */}
          <div className="bg-slate-800 p-4 rounded-t-xl border-b border-slate-700 flex justify-between items-center shrink-0">
             <button onClick={() => setSelectedMatch(null)} className="text-slate-400 text-sm hover:text-white transition-colors flex items-center gap-1 font-bold">
                 <ArrowLeft size={16}/> Voltar
             </button>
             <div className="flex items-center gap-2">
                {/* Correction Button */}
                <button onClick={openCorrectionModal} className="p-2 bg-slate-700 rounded-lg text-yellow-500 hover:text-yellow-400 border border-slate-600" title="Corrigir Placar/Status">
                    <Settings2 size={16} />
                </button>

                <button onClick={openHistory} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-white border border-slate-600">
                    <Clock size={16} />
                </button>
                
                {selectedMatch.status === 'scheduled' && (
                    <button onClick={() => updateMatchStatus('live')} className="bg-emerald-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20">
                        <Play size={16}/> Iniciar
                    </button>
                )}
                 {selectedMatch.status === 'live' && (
                    <button onClick={() => updateMatchStatus('finished')} className="bg-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-500 text-white shadow-lg shadow-red-900/20">
                        <Square size={16}/> Encerrar
                    </button>
                )}
                {selectedMatch.status === 'finished' && (
                    <div className="bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs font-bold border border-slate-600 flex items-center gap-1">
                        <CheckCircle2 size={14} className="text-emerald-500"/> Finalizado
                    </div>
                )}
                
                {selectedMatch.status !== 'finished' && (
                    <button onClick={() => setShowWOModal(true)} className="bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-red-200 px-3 py-2 rounded-lg border border-slate-600 font-bold text-xs">
                        W.O.
                    </button>
                )}
                <Link to={`/match/${selectedMatch.id}/sheet`} target="_blank" className="bg-slate-700 px-3 py-2 rounded-lg text-white border border-slate-600">
                   <FileText size={16} />
                </Link>
             </div>
          </div>
    
          {/* Scoreboard */}
          <div className="bg-slate-900 p-4 py-6 flex justify-between items-center border-b border-slate-800 shadow-inner shrink-0 relative overflow-hidden">
             {selectedMatch.is_wo && <div className="absolute top-0 inset-x-0 bg-red-600 text-white text-[10px] font-black uppercase text-center tracking-widest">Partida Encerrada por W.O.</div>}
             
             {/* Home Team */}
             <div className="text-center w-1/3 flex flex-col items-center">
                 <div className="font-black text-5xl md:text-6xl text-white tracking-tighter">{selectedMatch.home_score}</div>
                 <div className="text-xs md:text-sm font-bold text-slate-400 mt-2 uppercase tracking-wide truncate w-full px-2">
                     {selectedMatch.home_team?.short_name || 'Casa'}
                 </div>
                 <button 
                    onClick={() => openRosterModal(selectedMatch.home_team_id!, selectedMatch.home_team?.name || '')} 
                    className={`mt-2 text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-colors ${!hasPlayers(selectedMatch.home_team_id!) ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white'}`}
                 >
                     {!hasPlayers(selectedMatch.home_team_id!) ? <AlertTriangle size={10}/> : <Edit size={10}/>}
                     {!hasPlayers(selectedMatch.home_team_id!) ? 'Cadastrar' : 'Editar'}
                 </button>
             </div>

             {/* Timer/Status */}
             <div className="text-center flex flex-col items-center justify-center">
                 <div className={`text-[10px] font-black px-2 py-0.5 rounded mb-1 border uppercase tracking-widest ${selectedMatch.status === 'live' ? 'bg-red-900/30 text-red-500 border-red-500/30 animate-pulse' : selectedMatch.status === 'finished' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-800 text-emerald-500 border-slate-700'}`}>
                     {selectedMatch.status === 'live' ? 'JOGANDO' : selectedMatch.status === 'finished' ? 'ENCERRADO' : 'AGUARDANDO'}
                 </div>
             </div>

             {/* Away Team */}
             <div className="text-center w-1/3 flex flex-col items-center">
                 <div className="font-black text-5xl md:text-6xl text-white tracking-tighter">{selectedMatch.away_score}</div>
                 <div className="text-xs md:text-sm font-bold text-slate-400 mt-2 uppercase tracking-wide truncate w-full px-2">
                     {selectedMatch.away_team?.short_name || 'Fora'}
                 </div>
                 <button 
                    onClick={() => openRosterModal(selectedMatch.away_team_id!, selectedMatch.away_team?.name || '')} 
                    className={`mt-2 text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-colors ${!hasPlayers(selectedMatch.away_team_id!) ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white'}`}
                 >
                     {!hasPlayers(selectedMatch.away_team_id!) ? <AlertTriangle size={10}/> : <Edit size={10}/>}
                     {!hasPlayers(selectedMatch.away_team_id!) ? 'Cadastrar' : 'Editar'}
                 </button>
             </div>
          </div>
    
          {/* Controls Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#0f172a]">
              {selectedMatch.status === 'scheduled' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Play size={48} className="mb-4 opacity-50"/>
                    <h3 className="text-xl font-bold text-white mb-2">Jogo Não Iniciado</h3>
                    <p className="text-center max-w-xs text-sm">Clique em "Iniciar" no topo para liberar os controles.</p>
                </div>
            ) : (
                <>
                    {/* Home Controls */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 
                            {selectedMatch.home_team?.name}
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button onClick={() => handleEventClick('gol', selectedMatch.home_team_id!)} className="bg-emerald-900/40 hover:bg-emerald-600 border-2 border-emerald-900/50 hover:border-emerald-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><Goal size={28} className="text-emerald-500 group-hover:text-white" /><span className="text-[10px] font-black uppercase tracking-widest">Gol</span></button>
                            <button onClick={() => handleEventClick('cartao_amarelo', selectedMatch.home_team_id!)} className="bg-yellow-900/30 hover:bg-yellow-600 border-2 border-yellow-900/50 hover:border-yellow-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><AlertCircle size={28} className="text-yellow-500 group-hover:text-white"/><span className="text-[10px] font-black uppercase tracking-widest">Amarelo</span></button>
                            <button onClick={() => handleEventClick('cartao_vermelho', selectedMatch.home_team_id!)} className="bg-red-900/30 hover:bg-red-600 border-2 border-red-900/50 hover:border-red-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><AlertTriangle size={28} className="text-red-500 group-hover:text-white"/><span className="text-[10px] font-black uppercase tracking-widest">Vermelho</span></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 my-2 opacity-20"><div className="h-px bg-slate-500 flex-1"></div><div className="text-[10px] font-bold uppercase text-slate-500">VS</div><div className="h-px bg-slate-500 flex-1"></div></div>
                    
                    {/* Away Controls */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase text-right flex items-center justify-end gap-2 tracking-widest">
                            {selectedMatch.away_team?.name}
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                             <button onClick={() => handleEventClick('cartao_vermelho', selectedMatch.away_team_id!)} className="bg-red-900/30 hover:bg-red-600 border-2 border-red-900/50 hover:border-red-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><AlertTriangle size={28} className="text-red-500 group-hover:text-white"/><span className="text-[10px] font-black uppercase tracking-widest">Vermelho</span></button>
                             <button onClick={() => handleEventClick('cartao_amarelo', selectedMatch.away_team_id!)} className="bg-yellow-900/30 hover:bg-yellow-600 border-2 border-yellow-900/50 hover:border-yellow-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><AlertCircle size={28} className="text-yellow-500 group-hover:text-white"/><span className="text-[10px] font-black uppercase tracking-widest">Amarelo</span></button>
                             <button onClick={() => handleEventClick('gol', selectedMatch.away_team_id!)} className="bg-emerald-900/40 hover:bg-emerald-600 border-2 border-emerald-900/50 hover:border-emerald-500 text-white p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group shadow-lg"><Goal size={28} className="text-emerald-500 group-hover:text-white" /><span className="text-[10px] font-black uppercase tracking-widest">Gol</span></button>
                        </div>
                    </div>
                </>
            )}
          </div>

          {/* Events Modal */}
          {showEventModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-white flex items-center gap-2 uppercase">Selecionar Jogador</h3>
                        <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="p-2 bg-slate-900 text-center text-xs font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                        {getTeamName(pendingTeamId)}
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2">
                        <button onClick={() => confirmEvent(null)} className="w-full text-left px-4 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 font-medium text-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">?</div>
                            Não identificado / Contra
                        </button>
                        {getFilteredPlayers().map(player => (
                            <button key={player.id} onClick={() => confirmEvent(player.id)} className="w-full text-left px-4 py-3 bg-slate-900 hover:bg-emerald-900/30 border border-slate-700 hover:border-emerald-500/50 rounded-lg text-white font-bold flex items-center gap-3 transition-all">
                                <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-mono">{player.number}</div>
                                <div className="flex-1">{player.name}<span className="block text-[10px] text-slate-500 font-normal uppercase">{player.position}</span></div>
                            </button>
                        ))}
                        {getFilteredPlayers().length === 0 && <div className="text-center py-8 text-slate-500 text-sm">Sem jogadores cadastrados.</div>}
                    </div>
                </div>
            </div>
          )}

          {/* History Modal */}
          {showHistoryModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-lg max-h-[80vh] flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-white text-lg">Histórico de Alterações</h3>
                          <button onClick={() => setShowHistoryModal(false)}><X className="text-slate-400 hover:text-white" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {matchHistory.length > 0 ? matchHistory.map(log => (
                              <div key={log.id} className="bg-slate-900 p-3 rounded border border-slate-700 text-sm">
                                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                                      <span>{new Date(log.created_at).toLocaleString()}</span>
                                      <span className="font-bold text-emerald-500">{log.user_profile?.full_name || 'Mesário/Admin'}</span>
                                  </div>
                                  <p className="text-white">{log.description}</p>
                              </div>
                          )) : (
                              <div className="text-center text-slate-500 py-4">Nenhuma alteração registrada.</div>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* W.O. Modal */}
          {showWOModal && (
              <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-slate-800 p-6 rounded-xl border border-red-500 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                      <h3 className="text-xl font-black text-white text-center mb-2 uppercase">Declarar W.O.</h3>
                      <p className="text-slate-400 text-xs text-center mb-6">Esta ação encerrará a partida imediatamente.</p>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quem venceu?</label>
                              <div className="flex gap-2">
                                  <button onClick={() => setWoData({...woData, winnerId: selectedMatch?.home_team_id!, homeScore: 3, awayScore: 0})} className={`flex-1 py-3 rounded-lg font-bold border transition-colors ${woData.winnerId === selectedMatch?.home_team_id ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{selectedMatch?.home_team?.short_name}</button>
                                  <button onClick={() => setWoData({...woData, winnerId: selectedMatch?.away_team_id!, homeScore: 0, awayScore: 3})} className={`flex-1 py-3 rounded-lg font-bold border transition-colors ${woData.winnerId === selectedMatch?.away_team_id ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{selectedMatch?.away_team?.short_name}</button>
                              </div>
                          </div>

                          {woData.winnerId && (
                              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                                  <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-bold text-slate-400">Usar Placar Padrão (3x0)?</span>
                                      <input type="checkbox" checked={woData.useDefaultScore} onChange={e => setWoData({...woData, useDefaultScore: e.target.checked})} className="w-4 h-4 rounded bg-slate-700 border-slate-500 accent-red-500"/>
                                  </div>
                                  {!woData.useDefaultScore && (
                                      <div className="flex items-center justify-center gap-3">
                                          <input type="number" value={woData.homeScore} onChange={e => setWoData({...woData, homeScore: parseInt(e.target.value)||0})} className="w-12 h-10 bg-slate-800 border border-slate-600 rounded text-center text-white font-bold"/>
                                          <span className="text-slate-600 font-black">X</span>
                                          <input type="number" value={woData.awayScore} onChange={e => setWoData({...woData, awayScore: parseInt(e.target.value)||0})} className="w-12 h-10 bg-slate-800 border border-slate-600 rounded text-center text-white font-bold"/>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>

                      <div className="flex gap-2 mt-6">
                          <button onClick={() => setShowWOModal(false)} className="flex-1 py-2 text-slate-400 hover:text-white font-bold">Cancelar</button>
                          <button onClick={handleConfirmWO} disabled={!woData.winnerId} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold disabled:opacity-50">Confirmar W.O.</button>
                      </div>
                  </div>
              </div>
          )}

          {/* Manual Correction Modal (New) */}
          {showCorrectionModal && (
              <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-slate-800 p-6 rounded-xl border border-yellow-500/50 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                      <h3 className="text-xl font-black text-white text-center mb-2 flex items-center justify-center gap-2">
                          <Settings2 size={24} className="text-yellow-500"/> Correção Manual
                      </h3>
                      <p className="text-slate-400 text-xs text-center mb-6">Use apenas para corrigir erros de status ou placar final.</p>
                      
                      <div className="space-y-4">
                          <div className="flex items-center justify-center gap-4">
                              <div className="text-center">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{selectedMatch?.home_team?.short_name}</label>
                                  <input 
                                    type="number" 
                                    value={correctionData.home} 
                                    onChange={e => setCorrectionData({...correctionData, home: parseInt(e.target.value) || 0})}
                                    className="w-16 h-16 bg-slate-900 border border-slate-600 rounded-xl text-center text-3xl font-black text-white focus:border-yellow-500 outline-none"
                                  />
                              </div>
                              <span className="text-slate-600 font-black text-xl mt-4">X</span>
                              <div className="text-center">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{selectedMatch?.away_team?.short_name}</label>
                                  <input 
                                    type="number" 
                                    value={correctionData.away} 
                                    onChange={e => setCorrectionData({...correctionData, away: parseInt(e.target.value) || 0})}
                                    className="w-16 h-16 bg-slate-900 border border-slate-600 rounded-xl text-center text-3xl font-black text-white focus:border-yellow-500 outline-none"
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status da Partida</label>
                              <select 
                                value={correctionData.status} 
                                onChange={e => setCorrectionData({...correctionData, status: e.target.value as any})}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-yellow-500 outline-none font-bold"
                              >
                                  <option value="scheduled">Agendado (Reiniciar)</option>
                                  <option value="live">Ao Vivo (Em andamento)</option>
                                  <option value="finished">Finalizado (Encerrar)</option>
                              </select>
                          </div>
                      </div>

                      <div className="flex gap-2 mt-6">
                          <button onClick={() => setShowCorrectionModal(false)} className="flex-1 py-2 text-slate-400 hover:text-white font-bold">Cancelar</button>
                          <button onClick={handleSaveCorrection} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                              <Save size={16}/> Salvar
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* Quick Roster Modal Reuse */}
          {showRosterModal && (
            <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
              <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-lg shrink-0">
                  <div>
                      <h3 className="text-white font-bold text-lg flex items-center gap-2"><Users className="text-emerald-500"/> {rosterTeamName}</h3>
                      <p className="text-xs text-slate-400">Cadastro rápido de elenco</p>
                  </div>
                  <button onClick={() => setShowRosterModal(false)} className="text-slate-400 hover:text-white p-2 bg-slate-700 rounded-full"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 bg-[#0f172a]">
                  <div className="space-y-2 pb-20">
                      <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          <div className="col-span-2 text-center">Nº</div>
                          <div className="col-span-5">Nome Completo</div>
                          <div className="col-span-3">Posição</div>
                          <div className="col-span-2 text-center">Letra</div>
                      </div>
                      {rosterEntries.map((entry, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
                              <div className="col-span-2"><input type="number" placeholder="#" className="w-full bg-slate-900 text-white text-center font-bold text-lg py-2 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.number} onChange={(e) => updateRosterRow(idx, 'number', e.target.value)} /></div>
                              <div className="col-span-5"><input type="text" placeholder="Nome" className="w-full bg-slate-900 text-white text-sm py-2.5 px-3 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.name} onChange={(e) => updateRosterRow(idx, 'name', e.target.value)} /></div>
                              <div className="col-span-3"><select className="w-full bg-slate-900 text-white text-xs py-2.5 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.position} onChange={(e) => updateRosterRow(idx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p} value={p}>{p.slice(0,3)}</option>)}</select></div>
                              <div className="col-span-2 relative">
                                  <input type="text" placeholder="-" maxLength={3} className="w-full bg-slate-900 text-white text-center text-xs py-2.5 rounded border border-slate-600 focus:border-emerald-500 outline-none uppercase" value={entry.letter} onChange={(e) => updateRosterRow(idx, 'letter', e.target.value.toUpperCase())} />
                                  {idx > 0 && <button onClick={() => removeRosterRow(idx)} className="absolute -right-3 -top-3 bg-red-500 text-white rounded-full p-0.5 shadow-md"><X size={10}/></button>}
                              </div>
                          </div>
                      ))}
                      <button onClick={addRosterRow} className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 font-bold hover:text-emerald-500 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"><Plus size={20}/> Adicionar Linha</button>
                  </div>
              </div>
              <div className="bg-slate-800 p-4 border-t border-slate-700 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex gap-3 z-10 shrink-0">
                  <button onClick={() => setShowRosterModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors">Cancelar</button>
                  <button onClick={saveRoster} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"><Save size={20}/> Salvar Elenco</button>
              </div>
            </div>
          )}
        </div>
    );
  }

  // --- RENDER: MAIN DASHBOARD (LISTS) ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Play size={24} className="text-emerald-500"/> Painel do Mesário
          </h2>
          <button 
              onClick={() => navigate('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
          >
              <ArrowLeft size={16}/> Sair
          </button>
      </div>

      {/* Tabs View Mode */}
      <div className="flex bg-slate-800 p-1 rounded-lg w-full max-w-md">
          <button 
            onClick={() => setViewMode('matches')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'matches' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
              Jogos
          </button>
          <button 
            onClick={() => setViewMode('rosters')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${viewMode === 'rosters' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
              <Users size={16}/> Cadastros / Elencos
          </button>
      </div>

      {viewMode === 'matches' ? (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
               {/* Match Filter Header */}
               <div className="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b border-slate-700">
                   <div className="flex bg-slate-900 p-1 rounded-lg">
                       <button onClick={() => setMatchViewScope('today')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${matchViewScope === 'today' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Jogos de Hoje</button>
                       <button onClick={() => setMatchViewScope('round')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${matchViewScope === 'round' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Por Rodada</button>
                   </div>
                   {matchViewScope === 'round' && (
                       <select 
                        value={selectedRoundFilter} 
                        onChange={(e) => setSelectedRoundFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500 w-full md:w-auto"
                       >
                           <option value="">Selecione uma Rodada...</option>
                           {rounds.map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                   )}
               </div>

               {filteredMatches.length === 0 ? (
                  <div className="text-slate-400 text-center py-10">
                      <AlertCircle className="mx-auto mb-4 text-slate-500" size={48} />
                      <p>{matchViewScope === 'today' ? 'Nenhum jogo agendado para hoje.' : 'Selecione uma rodada para ver os jogos.'}</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {filteredMatches.map(m => (
                          <div key={m.id} onClick={() => setSelectedMatch(m)} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-750 hover:border-emerald-500 transition-all group">
                              <div className="flex-1">
                                  <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold text-slate-400 mb-2">
                                      <span className="bg-slate-800 px-2 py-0.5 rounded">{m.stage === 'group_stage' ? `Rodada ${m.round_number}` : m.stage}</span>
                                      {m.group && <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-500">{m.group.name}</span>}
                                      {m.start_time && !m.start_time.includes('00:00:00') && <span className="bg-slate-800 px-2 py-0.5 rounded text-white">{new Date(m.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                      {/* Home */}
                                      <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                                              {m.home_team?.logo_url ? <img src={m.home_team.logo_url} className="w-full h-full object-cover"/> : <div className="text-[8px] text-slate-500">{m.home_team?.short_name.slice(0,2)}</div>}
                                          </div>
                                          <span className={`font-bold ${m.status !== 'scheduled' ? 'text-white' : 'text-slate-300'}`}>{m.home_team?.name}</span>
                                      </div>
                                      
                                      {/* Score */}
                                      {m.status !== 'scheduled' ? (
                                          <div className="px-3 py-1 bg-slate-800 rounded font-black text-white text-lg border border-slate-700">{m.home_score} - {m.away_score}</div>
                                      ) : (
                                          <span className="text-xs font-bold text-slate-600 px-2">VS</span>
                                      )}

                                      {/* Away */}
                                      <div className="flex items-center gap-2">
                                          <span className={`font-bold ${m.status !== 'scheduled' ? 'text-white' : 'text-slate-300'}`}>{m.away_team?.name}</span>
                                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                                              {m.away_team?.logo_url ? <img src={m.away_team.logo_url} className="w-full h-full object-cover"/> : <div className="text-[8px] text-slate-500">{m.away_team?.short_name.slice(0,2)}</div>}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 self-start md:self-center ${m.status === 'live' ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50' : m.status === 'finished' ? 'bg-emerald-900/30 text-emerald-500 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}>
                                  {m.status === 'live' && 'AO VIVO'}
                                  {m.status === 'finished' && <><CheckCircle2 size={12}/> FINALIZADO</>}
                                  {m.status === 'scheduled' && 'AGUARDANDO'}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      ) : (
          // Rosters Grid View (Unchanged logic, just keeping structure)
          <div className="grid md:grid-cols-2 gap-4">
              {allTeams.map(team => {
                  const pCount = getPlayerCount(team.id);
                  let statusColor = 'bg-red-500/10 text-red-500 border-red-500/20';
                  let statusText = 'Sem Elenco';
                  
                  if (pCount > 0 && pCount < 5) {
                      statusColor = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                      statusText = 'Incompleto';
                  } else if (pCount >= 5) {
                      statusColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                      statusText = 'Pronto';
                  }

                  return (
                      <div key={team.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border border-slate-600">
                                  {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover"/> : <span className="font-bold text-slate-500">{team.short_name.slice(0,2)}</span>}
                              </div>
                              <div>
                                  <h3 className="font-bold text-white">{team.name}</h3>
                                  <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border inline-block mt-1 ${statusColor}`}>
                                      {statusText} • {pCount} Atletas
                                  </div>
                              </div>
                          </div>
                          <button 
                            onClick={() => openRosterModal(team.id, team.name)}
                            className="bg-slate-900 hover:bg-emerald-600 hover:text-white text-slate-400 p-3 rounded-lg transition-colors border border-slate-600"
                            title="Editar Elenco"
                          >
                              <ClipboardList size={20}/>
                          </button>
                      </div>
                  );
              })}
              {allTeams.length === 0 && <div className="col-span-full text-center text-slate-500 py-10">Nenhum time cadastrado no campeonato.</div>}
          </div>
      )}

      {/* Reuse Roster Modal for when clicking from Roster Grid */}
      {showRosterModal && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-lg shrink-0">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2"><Users className="text-emerald-500"/> {rosterTeamName}</h3>
                    <p className="text-xs text-slate-400">Cadastro rápido de elenco</p>
                </div>
                <button onClick={() => setShowRosterModal(false)} className="text-slate-400 hover:text-white p-2 bg-slate-700 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-[#0f172a]">
                <div className="space-y-2 pb-20">
                    <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <div className="col-span-2 text-center">Nº</div>
                        <div className="col-span-5">Nome Completo</div>
                        <div className="col-span-3">Posição</div>
                        <div className="col-span-2 text-center">Letra</div>
                    </div>
                    {rosterEntries.map((entry, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
                            <div className="col-span-2"><input type="number" placeholder="#" className="w-full bg-slate-900 text-white text-center font-bold text-lg py-2 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.number} onChange={(e) => updateRosterRow(idx, 'number', e.target.value)} /></div>
                            <div className="col-span-5"><input type="text" placeholder="Nome" className="w-full bg-slate-900 text-white text-sm py-2.5 px-3 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.name} onChange={(e) => updateRosterRow(idx, 'name', e.target.value)} /></div>
                            <div className="col-span-3"><select className="w-full bg-slate-900 text-white text-xs py-2.5 rounded border border-slate-600 focus:border-emerald-500 outline-none" value={entry.position} onChange={(e) => updateRosterRow(idx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p} value={p}>{p.slice(0,3)}</option>)}</select></div>
                            <div className="col-span-2 relative">
                                <input type="text" placeholder="-" maxLength={3} className="w-full bg-slate-900 text-white text-center text-xs py-2.5 rounded border border-slate-600 focus:border-emerald-500 outline-none uppercase" value={entry.letter} onChange={(e) => updateRosterRow(idx, 'letter', e.target.value.toUpperCase())} />
                                {idx > 0 && <button onClick={() => removeRosterRow(idx)} className="absolute -right-3 -top-3 bg-red-500 text-white rounded-full p-0.5 shadow-md"><X size={10}/></button>}
                            </div>
                        </div>
                    ))}
                    <button onClick={addRosterRow} className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 font-bold hover:text-emerald-500 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"><Plus size={20}/> Adicionar Linha</button>
                </div>
            </div>
            <div className="bg-slate-800 p-4 border-t border-slate-700 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex gap-3 z-10 shrink-0">
                <button onClick={() => setShowRosterModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors">Cancelar</button>
                <button onClick={saveRoster} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"><Save size={20}/> Salvar Elenco</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default MesarioMatchControl;
