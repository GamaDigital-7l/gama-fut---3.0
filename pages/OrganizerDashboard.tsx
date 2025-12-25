import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Championship, Team, Match, Group, MatchStatus, Player, Sponsor, AuditLog, Venue } from '../types';
import { Trophy, Calendar, MapPin, Edit, Save, Trash, Plus, Link as LinkIcon, Printer, Play, RefreshCw, MoveRight, X, User, ArrowUp, ArrowDown, Upload, Loader2, CheckCircle2, ChevronDown, ChevronUp, GripVertical, ArrowLeft, BarChart3, TrendingUp, MousePointerClick, Eye, DollarSign, EyeOff, FileText, Settings2, ClipboardEdit, Minus, PlusCircle, Clock, FileCheck, Landmark, AlertTriangle, Trash2 } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

type Tab = 'geral' | 'regras' | 'grupos' | 'times' | 'agenda' | 'sumulas' | 'visibilidade';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AVAILABLE_TIEBREAKERS = [
    { key: 'wins', label: 'NÚMERO DE VITÓRIAS' },
    { key: 'goal_diff', label: 'SALDO DE GOLS' },
    { key: 'goals_for', label: 'GOLS PRÓ (MARCADOS)' },
    { key: 'head_to_head', label: 'CONFRONTO DIRETO' },
    { key: 'fewest_yellow', label: 'MENOS CARTÕES AMARELOS' },
    { key: 'fewest_red', label: 'MENOS CARTÕES VERMELHOS' }
];

const MATCH_STAGES = [
    { value: 'group_stage', label: 'Fase de Grupos', slots: 0 },
    { value: 'round_16', label: 'Oitavas de Final', slots: 8 },
    { value: 'quarter_finals', label: 'Quartas de Final', slots: 4 },
    { value: 'semi_finals', label: 'Semifinal', slots: 2 },
    { value: 'final', label: 'Final', slots: 1 }
];

const POSITIONS = [
    'Goleiro', 'Zagueiro', 'Lateral Direito', 'Lateral Esquerdo', 
    'Volante', 'Meia', 'Ponta', 'Atacante', 'Pivô', 'Fixo', 'Ala'
];

const OrganizerDashboard: React.FC<{ orgId: string }> = ({ orgId }) => {
  const { id: championshipId } = useParams<{ id: string }>(); // Get ID from URL
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  
  // Auto Save State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- DELETE MODAL STATES ---
  const [isDeleting, setIsDeleting] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [roundToDelete, setRoundToDelete] = useState<string | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  
  // --- MODAL STATES ---
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [showRoundCreator, setShowRoundCreator] = useState(false);
  const [showSheetConfigModal, setShowSheetConfigModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  
  // Quick Score Modal State
  const [showQuickScoreModal, setShowQuickScoreModal] = useState(false);
  const [quickScoreMatch, setQuickScoreMatch] = useState<Match | null>(null);
  const [quickScores, setQuickScores] = useState({ home: 0, away: 0, penalty_home: 0, penalty_away: 0, is_wo: false, wo_winner_id: '' });
  
  // Match History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [matchHistory, setMatchHistory] = useState<AuditLog[]>([]);

  // --- FORM STATES ---
  const [newGroup, setNewGroup] = useState('');
  const [teamForm, setTeamForm] = useState<{id?: string, name: string, short_name: string, group_id: string, logo_url: string, logoFile: File | null}>({ id: undefined, name: '', short_name: '', group_id: '', logo_url: '', logoFile: null });
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'Atacante', letter: '' });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [editingMatchSheet, setEditingMatchSheet] = useState<Match | null>(null);
  const [newVenue, setNewVenue] = useState({ name: '', address: '', city: '', state: '' });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editedGroupName, setEditedGroupName] = useState('');
  
  // Round Creator State
  const [roundConfig, setRoundConfig] = useState({
      type: 'group_stage',
      number: 1,
      matchCount: 4,
      groupId: ''
  });

  useEffect(() => {
    if (championshipId) {
        loadData(championshipId);
    } else {
        // Fallback: if no ID, go back to dashboard list
        navigate('/dashboard');
    }
  }, [championshipId]);

  // --- AUTO SAVE LOGIC ---
  const triggerAutoSave = useCallback((updatedChamp: Championship) => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      setSaveStatus('saving');
      
      autoSaveTimeoutRef.current = setTimeout(async () => {
          const { error } = await supabase.from('championships').update({
              name: updatedChamp.name,
              slug: updatedChamp.slug,
              city: updatedChamp.city,
              state: updatedChamp.state,
              description: updatedChamp.description,
              logo_url: updatedChamp.logo_url,
              banner_url: updatedChamp.banner_url,
              primary_color: updatedChamp.primary_color,
              secondary_color: updatedChamp.secondary_color,
              start_date: updatedChamp.start_date,
              end_date: updatedChamp.end_date,
              points_win: updatedChamp.points_win,
              points_draw: updatedChamp.points_draw,
              points_loss: updatedChamp.points_loss,
              tiebreakers: updatedChamp.tiebreakers,
              zone_config: updatedChamp.zone_config,
              status: updatedChamp.status,
              regulations_url: updatedChamp.regulations_url,
              regulations_text: updatedChamp.regulations_text
          }).eq('id', updatedChamp.id);

          if (error) {
              console.error("Auto-save failed:", error.message || JSON.stringify(error));
              setSaveStatus('error');
          } else {
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
          }
      }, 1500); // 1.5s debounce
  }, []);

  const updateChampionship = (updates: Partial<Championship>) => {
      if (!championship) return;
      const updated = { ...championship, ...updates };
      setChampionship(updated);
      triggerAutoSave(updated);
  };

  const togglePublishStatus = () => {
      if (!championship) return;
      const newStatus = championship.status === 'publicado' ? 'rascunho' : 'publicado';
      updateChampionship({ status: newStatus });
  };

  const loadData = async (id: string) => {
    setLoading(true);
    
    // Fetch Specific Championship
    const { data: champData, error } = await supabase
        .from('championships')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId) // Security check
        .single();
    
    if (error || !champData) {
        alert("Campeonato não encontrado.");
        navigate('/dashboard');
        return;
    }

    setChampionship(champData);

    const [tRes, gRes, mRes, vRes] = await Promise.all([
        supabase.from('teams').select('*').eq('championship_id', champData.id).order('name'),
        supabase.from('groups').select('*').eq('championship_id', champData.id).order('name'),
        supabase.from('matches').select(`*, home_team:teams!home_team_id(name, short_name, logo_url, group_id), away_team:teams!away_team_id(name, short_name, logo_url, group_id), group:groups(name)`).eq('championship_id', champData.id).order('start_time', { ascending: true }),
        supabase.from('venues').select('*').eq('organization_id', orgId).order('name')
    ]);
    setTeams(tRes.data as Team[] || []);
    setGroups(gRes.data as Group[] || []);
    setMatches(mRes.data as Match[] || []);
    setVenues(vRes.data as Venue[] || []);
    
    setLoading(false);
  };

  // --- VENUE LOGIC ---
  const handleCreateVenue = async (e: React.FormEvent) => {
      e.preventDefault();
      const { data, error } = await supabase.from('venues').insert({
          organization_id: orgId,
          name: newVenue.name,
          address: newVenue.address,
          city: newVenue.city,
          state: newVenue.state
      }).select().single();

      if (error) {
          alert("Erro ao criar campo: " + error.message);
      } else {
          setVenues([...venues, data]);
          setNewVenue({ name: '', address: '', city: '', state: '' });
          setShowVenueModal(false);
      }
  };

  // --- AGENDA & DELETE FUNCTIONS ---
  const handleCreateRoundSlots = async () => {
      if (!championship) return;
      setLoading(true);
      const slotsToCreate = [];
      
      for(let i=0; i<roundConfig.matchCount; i++) {
          slotsToCreate.push({
              organization_id: orgId,
              championship_id: championship.id,
              round_number: roundConfig.type === 'group_stage' ? roundConfig.number : 0,
              stage: roundConfig.type,
              status: 'scheduled',
              home_team_id: null,
              away_team_id: null,
              group_id: roundConfig.groupId || null
          });
      }

      const { data, error } = await supabase.from('matches').insert(slotsToCreate).select(`*, home_team:teams!home_team_id(name, short_name, logo_url, group_id), away_team:teams!away_team_id(name, short_name, logo_url, group_id), group:groups(name)`);
      if (error) {
          alert('Erro ao criar slots: ' + error.message);
      } else {
          setMatches([...matches, ...(data as Match[])]);
          setShowRoundCreator(false);
      }
      setLoading(false);
  };

  const executeDeleteRound = async () => {
    if(!roundToDelete) return;
    setIsDeleting(true);
    let matchesToDelete = [];
    
    if(roundToDelete.startsWith('Rodada')) {
        const roundNum = parseInt(roundToDelete.split(' ')[1]);
        matchesToDelete = matches.filter(m => m.stage === 'group_stage' && m.round_number === roundNum);
    } else {
        const stageValue = MATCH_STAGES.find(s => s.label === roundToDelete)?.value;
        matchesToDelete = matches.filter(m => m.stage === stageValue);
    }

    const ids = matchesToDelete.map(m => m.id);
    if(ids.length > 0) {
        const { error } = await supabase.from('matches').delete().in('id', ids);
        if(!error) {
            setMatches(matches.filter(m => !ids.includes(m.id)));
        } else {
            alert("Erro ao apagar rodada: " + error.message);
        }
    }
    setIsDeleting(false);
    setRoundToDelete(null);
  };

  const handleUpdateMatch = async (matchId: string, field: string, value: any) => {
      // Logic for Venues: Update ID and Location String for compatibility
      let extraUpdates: any = {};
      
      if (field === 'venue_id') {
          if (value === 'NEW_VENUE') {
              setShowVenueModal(true);
              return; // Stop here, modal handles creation
          }
          const venue = venues.find(v => v.id === value);
          if (venue) {
              extraUpdates['location'] = venue.name;
          } else {
              extraUpdates['location'] = null; // Clear if unselected
          }
      }

      // Logic for Home Team -> Group ID
      if (field === 'home_team_id') {
          const team = teams.find(t => t.id === value);
          if (team && team.group_id) {
              extraUpdates['group_id'] = team.group_id;
          }
      }

      const optimisticMatch = matches.find(m => m.id === matchId);
      if (optimisticMatch) {
          setMatches(matches.map(m => m.id === matchId ? { ...m, [field]: value, ...extraUpdates } : m));
      }
      
      setSaveStatus('saving');

      const { error } = await supabase.from('matches').update({ [field]: value, ...extraUpdates }).eq('id', matchId);
      if (error) {
          console.error(error);
          setSaveStatus('error');
      } else {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      }
  };

  const executeDeleteMatch = async () => {
    if (!matchToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from('matches').delete().eq('id', matchToDelete.id);
    if (error) {
        alert("Erro ao apagar jogo: " + error.message);
    } else {
        setMatches(matches.filter(m => m.id !== matchToDelete.id));
    }
    setIsDeleting(false);
    setMatchToDelete(null);
  };

  // Quick Score Handlers
  const handleOpenQuickScore = (match: Match) => {
      setQuickScoreMatch(match);
      setQuickScores({
          home: match.home_score || 0,
          away: match.away_score || 0,
          penalty_home: match.penalty_home_score || 0,
          penalty_away: match.penalty_away_score || 0,
          is_wo: match.is_wo || false,
          wo_winner_id: match.wo_winner_team_id || ''
      });
      setShowQuickScoreModal(true);
  };

  const handleSaveQuickScore = async () => {
      if (!quickScoreMatch) return;
      setLoading(true);

      const updates: any = {
          home_score: quickScores.home,
          away_score: quickScores.away,
          status: 'finished', // Force status to finished
          is_wo: quickScores.is_wo,
          wo_winner_team_id: quickScores.is_wo ? quickScores.wo_winner_id : null
      };

      // Only save penalties if not W.O. and it's a knockout stage
      if (!quickScores.is_wo && quickScoreMatch.stage !== 'group_stage') {
          updates.penalty_home_score = quickScores.penalty_home;
          updates.penalty_away_score = quickScores.penalty_away;
      } else {
          updates.penalty_home_score = null;
          updates.penalty_away_score = null;
      }

      const { error } = await supabase.from('matches').update(updates).eq('id', quickScoreMatch.id);

      if (error) {
          alert("Erro ao salvar placar: " + error.message);
          setSaveStatus('error');
      } else {
          // Log Change
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
             const desc = quickScores.is_wo 
                ? `W.O. Registrado. Vencedor: ${teams.find(t => t.id === quickScores.wo_winner_id)?.name}`
                : `Placar alterado: ${quickScores.home} x ${quickScores.away}`;
             
             await supabase.from('audit_logs').insert({
                 match_id: quickScoreMatch.id,
                 user_id: user.id,
                 action_type: 'SCORE_UPDATE',
                 description: desc
             });
          }

          // Update Local State
          setMatches(matches.map(m => m.id === quickScoreMatch.id ? { ...m, ...updates, status: 'finished' } : m));
          setSaveStatus('saved');
          setShowQuickScoreModal(false);
          setTimeout(() => setSaveStatus('idle'), 2000);
      }
      setLoading(false);
  };

  // Match History
  const openMatchHistory = async (match: Match) => {
      setLoading(true);
      const { data } = await supabase.from('audit_logs').select(`*, user_profile:user_profiles(full_name, role)`).eq('match_id', match.id).order('created_at', { ascending: false });
      setMatchHistory(data as AuditLog[] || []);
      setQuickScoreMatch(match); // Reuse this state just to show title
      setShowHistoryModal(true);
      setLoading(false);
  };

  // Sheet Config
  const openSheetConfig = (match: Match) => {
      setEditingMatchSheet(match);
      setShowSheetConfigModal(true);
  };
  
  const handleSaveSheetConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingMatchSheet) return;
      setLoading(true);

      const { error } = await supabase.from('matches').update({
          referee_name: editingMatchSheet.referee_name,
          assistant_referee_1: editingMatchSheet.assistant_referee_1,
          assistant_referee_2: editingMatchSheet.assistant_referee_2,
          fourth_official: editingMatchSheet.fourth_official,
          uniform_home: editingMatchSheet.uniform_home,
          uniform_away: editingMatchSheet.uniform_away,
          observations: editingMatchSheet.observations
      }).eq('id', editingMatchSheet.id);

      if (error) {
          alert('Erro ao salvar dados da súmula.');
      } else {
          setMatches(matches.map(m => m.id === editingMatchSheet.id ? editingMatchSheet : m));
          setShowSheetConfigModal(false);
      }
      setLoading(false);
  };

  const getGroupName = (teamId?: string) => {
      const t = teams.find(x => x.id === teamId);
      if (!t || !t.group_id) return '';
      const g = groups.find(gr => gr.id === t.group_id);
      return g ? `(${g.name})` : '';
  };

  // Group Matches Logic
  const groupedMatches = useMemo(() => {
      const groups: Record<string, Match[]> = {};
      
      matches.forEach(m => {
          let key = m.stage === 'group_stage' ? `Rodada ${m.round_number}` : MATCH_STAGES.find(s => s.value === m.stage)?.label || 'Playoffs';
          if (!groups[key]) groups[key] = [];
          groups[key].push(m);
      });

      // Sort keys: Rounds first (numeric), then Playoffs
      return Object.entries(groups).sort((a, b) => {
          if (a[0].startsWith('Rodada') && b[0].startsWith('Rodada')) {
              return parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]);
          }
          return a[0].localeCompare(b[0]);
      });
  }, [matches]);

  // --- IMAGE UPLOAD ---
  const handleImageUpload = async (file: File, bucket: 'championship-logos' | 'team-logos' | 'sponsor-logos' | 'regulations'): Promise<string | null> => {
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
          
          if (uploadError) {
              if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('security policy')) {
                  alert(`Erro de Permissão ou Configuração (${bucket}). Por favor, recarregue a página e execute o script de Setup do Banco de Dados.`);
              }
              throw uploadError;
          }
          
          const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
          return data.publicUrl;
      } catch (error: any) {
          console.error("Upload error:", error);
          alert(`Erro no upload: ${error.message}`);
          return null;
      }
  };

  const handleChampionshipLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
      if (!e.target.files || e.target.files.length === 0) return;
      setSaveStatus('saving');
      const url = await handleImageUpload(e.target.files[0], 'championship-logos');
      if (url) {
          const field = type === 'logo' ? 'logo_url' : 'banner_url';
          updateChampionship({ [field]: url });
      } else {
          setSaveStatus('error');
      }
  };

  const handleRegulationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setSaveStatus('saving');
      const url = await handleImageUpload(e.target.files[0], 'regulations');
      if (url) {
          updateChampionship({ regulations_url: url });
      } else {
          setSaveStatus('error');
      }
  };

  // --- OTHER LOGIC (Rules, Teams, etc) ---
  const toggleTiebreaker = (key: string) => {
      if (!championship) return;
      const current = championship.tiebreakers || [];
      const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      updateChampionship({ tiebreakers: updated });
  };
  const handleCreateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!championship) return;
      const { data, error } = await supabase.from('groups').insert({ championship_id: championship.id, name: newGroup }).select().single();
      if (!error && data) { setGroups([...groups, data]); setShowGroupModal(false); setNewGroup(''); }
  };
  const moveTeamToGroup = async (teamId: string, groupId: string | null) => {
      setTeams(teams.map(t => t.id === teamId ? { ...t, group_id: groupId || undefined } : t));
      await supabase.from('teams').update({ group_id: groupId }).eq('id', teamId);
  };
  
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!championship) return;
    let logoUrl = teamForm.logo_url;
    if (teamForm.logoFile) {
        const uploaded = await handleImageUpload(teamForm.logoFile, 'team-logos');
        if (uploaded) logoUrl = uploaded;
    }

    const payload = {
        organization_id: orgId,
        championship_id: championship.id,
        name: teamForm.name,
        short_name: teamForm.short_name.toUpperCase(),
        logo_url: logoUrl,
        group_id: teamForm.group_id || null
    };

    if (teamForm.id) { // Update
        const { data, error } = await supabase.from('teams').update(payload).eq('id', teamForm.id).select().single();
        if (!error && data) {
            setTeams(teams.map(t => t.id === data.id ? data : t));
        }
    } else { // Insert
        const { data, error } = await supabase.from('teams').insert(payload).select().single();
        if (!error && data) {
            setTeams([...teams, data]);
        }
    }
    
    setShowTeamModal(false);
    setTeamForm({ id: undefined, name: '', short_name: '', group_id: '', logo_url: '', logoFile: null });
  };

  const openTeamModal = (team: Team | null) => {
    if (team) {
        setTeamForm({
            id: team.id,
            name: team.name,
            short_name: team.short_name,
            group_id: team.group_id || '',
            logo_url: team.logo_url,
            logoFile: null
        });
    } else {
        setTeamForm({ id: undefined, name: '', short_name: '', group_id: '', logo_url: '', logoFile: null });
    }
    setShowTeamModal(true);
  };

  const executeDeleteTeam = async () => {
    if (!teamToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from('teams').delete().eq('id', teamToDelete.id);
    if (error) {
        alert("Erro ao apagar time: " + error.message);
    } else {
        setTeams(teams.filter(t => t.id !== teamToDelete.id));
    }
    setIsDeleting(false);
    setTeamToDelete(null);
  };

  const openSquadModal = async (team: Team) => {
      setEditingTeam(team);
      const { data } = await supabase.from('players').select('*').eq('team_id', team.id).order('number');
      setTeamPlayers(data || []);
      setShowSquadModal(true);
  };
  const handleAddPlayer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingTeam) return;
      const { data, error } = await supabase.from('players').insert({ team_id: editingTeam.id, name: newPlayer.name, number: parseInt(newPlayer.number), position: newPlayer.position, letter: newPlayer.letter }).select().single();
      if (!error && data) { setTeamPlayers([...teamPlayers, data]); setNewPlayer({ name: '', number: '', position: 'Atacante', letter: '' }); }
  };
  
  const executeDeletePlayer = async () => {
    if (!playerToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from('players').delete().eq('id', playerToDelete.id);
    if (error) {
        alert("Erro ao apagar jogador: " + error.message);
    } else {
        setTeamPlayers(teamPlayers.filter(p => p.id !== playerToDelete.id));
    }
    setIsDeleting(false);
    setPlayerToDelete(null);
  };

  const handleStartEditGroup = (group: Group) => {
    setEditingGroupId(group.id);
    setEditedGroupName(group.name);
  };

  const handleSaveGroupName = async () => {
    if (!editingGroupId || !editedGroupName) return;
    const { error } = await supabase.from('groups').update({ name: editedGroupName }).eq('id', editingGroupId);
    if (!error) {
        setGroups(groups.map(g => g.id === editingGroupId ? { ...g, name: editedGroupName } : g));
    }
    setEditingGroupId(null);
  };

  // --- UI COMPONENTS HELPERS ---
  const StatusIndicator = () => (
      <div className="flex items-center gap-2 text-xs font-bold uppercase fixed top-24 right-8 z-50 bg-slate-900/90 px-3 py-1.5 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
          {saveStatus === 'saving' && <><Loader2 className="animate-spin text-blue-500" size={14} /> Salvando...</>}
          {saveStatus === 'saved' && <><CheckCircle2 className="text-emerald-500" size={14} /> Salvo</>}
          {saveStatus === 'error' && <span className="text-red-500">Erro ao salvar</span>}
          {saveStatus === 'idle' && <span className="text-slate-600">Sincronizado</span>}
      </div>
  );

  const SmartTeamSelect = ({ value, onChange, homeTeamId }: { value: string | null, onChange: (val: string) => void, homeTeamId?: string }) => {
      const homeTeam = homeTeamId ? teams.find(t => t.id === homeTeamId) : null;
      const sortedTeams = useMemo(() => {
          return [...teams].sort((a, b) => {
              if (homeTeam) {
                  const aGroup = a.group_id === homeTeam.group_id;
                  const bGroup = b.group_id === homeTeam.group_id;
                  if (aGroup && !bGroup) return -1;
                  if (!aGroup && bGroup) return 1;
              }
              return a.name.localeCompare(b.name);
          });
      }, [teams, homeTeam]);

      return (
          <select 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)} 
            className={`w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500 ${!value ? 'text-slate-500' : ''}`}
          >
              <option value="">Selecionar...</option>
              {sortedTeams.map(t => (
                  <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                      {t.name} {getGroupName(t.id)} {homeTeam && t.group_id === homeTeam.group_id ? '★' : ''}
                  </option>
              ))}
          </select>
      );
  };

  if (loading || !championship) return <div className="text-white p-10 animate-pulse">Carregando painel do campeonato...</div>;

  const ungroupedTeams = teams.filter(t => !t.group_id);

  return (
    <div className="pb-20 relative overflow-x-hidden">
      <StatusIndicator />

      {/* HEADER PRINCIPAL */}
      <div className="bg-[#1e293b] border border-slate-700 p-6 md:p-8 rounded-3xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
        {championship.banner_url && <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${championship.banner_url})` }}></div>}
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
             <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-xl shrink-0">
                {championship.logo_url ? <img src={championship.logo_url} className="w-full h-full object-contain"/> : <Trophy className="text-slate-800" size={40}/>}
             </div>
             <div>
                 <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter flex flex-col md:flex-row items-center gap-2 drop-shadow-lg">
                    <div className="flex items-center gap-2">
                        <Trophy className="text-yellow-500" fill="currentColor" size={28} />
                        {championship.name}
                    </div>
                 </h1>
                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                     <span className={`px-2 py-0.5 rounded border ${championship.status === 'publicado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                         {championship.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                     </span>
                     <span>Campo • {teams.length} Times</span>
                 </div>
             </div>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3 justify-center md:justify-end">
             <button 
                onClick={togglePublishStatus}
                className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg transition-all ${championship.status === 'publicado' ? 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
             >
                 {championship.status === 'publicado' ? <><EyeOff size={16}/> Ocultar</> : <><Eye size={16}/> Publicar</>}
             </button>
             <Link to={`/championship/${championship.id}`} target="_blank" className="border border-slate-600 bg-slate-800 text-slate-300 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition uppercase text-sm shadow-lg">Ver Público</Link>
        </div>
      </div>

      {/* TABS */}
      <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 mb-8 pb-1 -mx-4 px-4 pt-2">
          <div className="flex overflow-x-auto scrollbar-hide gap-2 min-w-full">
              {['geral', 'regras', 'grupos', 'times', 'agenda', 'sumulas', 'visibilidade'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab as Tab)} 
                    className={`px-4 py-2 font-bold text-xs md:text-sm tracking-wide uppercase rounded-t-lg transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${activeTab === tab ? 'border-emerald-500 text-emerald-500 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
                  >
                      {tab === 'regras' ? 'Regras / Regulamento' : tab === 'sumulas' ? 'Súmulas Pro' : tab}
                  </button>
              ))}
          </div>
      </div>

      {/* --- ABA REGRAS & ZONAS (ATUALIZADA) --- */}
      {activeTab === 'regras' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
             <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-700 shadow-xl space-y-8">
                  <div>
                      <h2 className="text-xl font-bold text-white mb-6 border-l-4 border-emerald-500 pl-3">Pontuação do Jogo</h2>
                      <div className="grid grid-cols-3 gap-6">
                          {[{l: 'Vitória', k: 'points_win'}, {l: 'Empate', k: 'points_draw'}, {l: 'Derrota', k: 'points_loss'}].map((item) => (
                              <div key={item.k}>
                                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{item.l}</label>
                                  <input 
                                    type="number" 
                                    value={(championship as any)[item.k]} 
                                    onChange={e => updateChampionship({ [item.k]: parseInt(e.target.value) })} 
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 text-center font-bold text-xl"
                                  />
                              </div>
                          ))}
                      </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-white mb-6 border-l-4 border-white pl-3">Critérios de Desempate</h2>
                    <div className="space-y-3">
                        {AVAILABLE_TIEBREAKERS.map((tb) => {
                            const isActive = championship.tiebreakers?.includes(tb.key);
                            const index = championship.tiebreakers?.indexOf(tb.key);
                            return (
                                <div key={tb.key} 
                                     onClick={() => toggleTiebreaker(tb.key)}
                                     className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${isActive ? 'bg-slate-800 border-emerald-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                    <div className="flex items-center gap-3">
                                        {isActive && <span className="bg-emerald-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{index! + 1}</span>}
                                        <span className={`font-bold text-sm uppercase ${isActive ? 'text-white' : 'text-slate-500'}`}>{tb.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isActive && <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                  </div>
              </div>
              <div className="space-y-8">
                <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-700 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-6 border-l-4 border-blue-500 pl-3">Zonas de Classificação</h2>
                    
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-emerald-500 uppercase mb-1">Promoção / G-X (Verde)</label>
                                <input type="number" 
                                    value={championship.zone_config.promotion} 
                                    onChange={(e) => updateChampionship({ zone_config: { ...championship.zone_config, promotion: parseInt(e.target.value) } })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-red-500 uppercase mb-1">Rebaixamento / Z-X (Vermelho)</label>
                                <input type="number" 
                                    value={championship.zone_config.relegation} 
                                    onChange={(e) => updateChampionship({ zone_config: { ...championship.zone_config, relegation: parseInt(e.target.value) } })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500" 
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-700">
                            <h3 className="font-bold text-white text-sm uppercase mb-4">Divisões / Séries (Para Play-offs)</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-yellow-500 uppercase mb-1">Série Ouro</label>
                                    <input type="number" 
                                        value={championship.zone_config.gold || 0} 
                                        onChange={(e) => updateChampionship({ zone_config: { ...championship.zone_config, gold: parseInt(e.target.value) } })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-yellow-500" 
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Série Prata</label>
                                    <input type="number" 
                                        value={championship.zone_config.silver || 0} 
                                        onChange={(e) => updateChampionship({ zone_config: { ...championship.zone_config, silver: parseInt(e.target.value) } })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-slate-400" 
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Série Bronze</label>
                                    <input type="number" 
                                        value={championship.zone_config.bronze || 0} 
                                        onChange={(e) => updateChampionship({ zone_config: { ...championship.zone_config, bronze: parseInt(e.target.value) } })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-amber-700" 
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                * Estes números definem as cores da tabela sequencialmente após a zona de Promoção. 
                                Ex: Se Promoção=4 e Ouro=4, os times de 1º a 4º ficam Verdes (Promoção) e de 5º a 8º ficam Amarelos (Ouro).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-700 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-6 border-l-4 border-yellow-500 pl-3">Regulamento Oficial</h2>
                    <div className="space-y-4">
                        <label className="block bg-slate-900 p-4 rounded-xl border border-slate-600 cursor-pointer hover:border-emerald-500 transition-colors">
                            <span className="text-xs font-bold text-emerald-500 uppercase mb-2 block">Upload PDF do Regulamento</span>
                            <div className="flex items-center gap-3">
                                <FileCheck className="text-slate-400"/>
                                <span className="text-sm text-slate-300 truncate">{championship.regulations_url ? 'Arquivo carregado (Clique para trocar)' : 'Selecionar Arquivo PDF'}</span>
                            </div>
                            <input type="file" className="hidden" accept="application/pdf" onChange={handleRegulationUpload} />
                        </label>
                        
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ou Cole o Link Externo</label>
                            <input 
                                type="url" 
                                value={championship.regulations_url || ''} 
                                onChange={e => updateChampionship({ regulations_url: e.target.value })} 
                                placeholder="https://drive.google.com/..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 pl-10 text-white focus:border-emerald-500 transition-colors"
                            />
                            <LinkIcon size={16} className="absolute left-3 top-9 text-slate-500"/>
                        </div>

                         <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Texto Explicativo (Cards)</label>
                            <textarea 
                                rows={4} 
                                value={championship.regulations_text || ''} 
                                onChange={e => updateChampionship({ regulations_text: e.target.value })} 
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors"
                                placeholder="Descreva aqui pontos importantes como critérios de inscrição, punições, etc."
                            />
                        </div>
                    </div>
                </div>
              </div>
          </div>
      )}

      {/* --- ABA VISIBILIDADE (ATUALIZADA) --- */}
      {activeTab === 'visibilidade' && (
          <div className="animate-in fade-in space-y-8">
              <div className="flex flex-col gap-2">
                   <h2 className="text-3xl font-black text-white">Relatório de Visibilidade</h2>
                   <p className="text-slate-400">Métricas de acesso da sua página pública.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Visualizações da Página</h3>
                          <Eye size={24} className="text-emerald-500"/>
                      </div>
                      <div className="text-4xl font-black text-white">{championship.views_page || 0}</div>
                      <p className="text-xs text-slate-500 mt-2">Acessos totais à página do campeonato.</p>
                  </div>

                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Visualizações da Tabela</h3>
                          <BarChart3 size={24} className="text-blue-500"/>
                      </div>
                      <div className="text-4xl font-black text-white">{championship.views_table || 0}</div>
                      <p className="text-xs text-slate-500 mt-2">Interações com a aba de classificação.</p>
                  </div>
              </div>

              <div className="bg-slate-800/50 p-8 rounded-xl border border-dashed border-slate-700 text-center">
                  <TrendingUp className="mx-auto text-slate-600 mb-4" size={48}/>
                  <h3 className="text-white font-bold text-lg mb-2">Métricas de Engajamento</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Os dados de cliques em times e jogos estão sendo coletados e aparecerão aqui em breve. 
                      Continue compartilhando sua liga para gerar mais dados.
                  </p>
              </div>
          </div>
      )}

      {/* --- ABA GERAL (Com Gestão de Campos) --- */}
      {activeTab === 'geral' && (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-700 shadow-xl">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <h3 className="text-lg font-bold text-white mb-4">Identidade Visual</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="bg-slate-900 p-6 rounded-xl border-2 border-dashed border-slate-600 text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-800/50 transition-all flex flex-col items-center justify-center gap-4">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden">
                                    {championship.logo_url ? <img src={championship.logo_url} className="w-full h-full object-contain"/> : <Upload className="text-slate-400" size={24}/>}
                                </div>
                                <span className="text-xs font-bold text-emerald-500 uppercase">Logo Oficial</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleChampionshipLogoUpload(e, 'logo')} />
                            </label>
                            <label className="bg-slate-900 p-6 rounded-xl border-2 border-dashed border-slate-600 text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-800/50 transition-all flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                                {championship.banner_url && <img src={championship.banner_url} className="absolute inset-0 w-full h-full object-cover opacity-30"/>}
                                <div className="relative z-10">
                                    <Upload className="mx-auto text-slate-300 mb-2" size={24}/>
                                    <span className="text-xs font-bold text-emerald-500 uppercase">Banner / Capa</span>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleChampionshipLogoUpload(e, 'banner')} />
                            </label>
                        </div>
                    </div>
                     <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white mb-4">Informações Básicas</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Oficial</label>
                            <input type="text" value={championship.name} onChange={e => updateChampionship({ name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors" />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Slug URL (Link)</label>
                            <input type="text" value={championship.slug || ''} onChange={e => updateChampionship({ slug: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cidade</label>
                                <input type="text" value={championship.city} onChange={e => updateChampionship({ city: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estado</label>
                                <input type="text" value={championship.state} onChange={e => updateChampionship({ state: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descrição</label>
                            <textarea rows={3} value={championship.description} onChange={e => updateChampionship({ description: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 transition-colors" />
                        </div>
                    </div>
                 </div>
                 
                 {/* Venues Section */}
                 <div className="mt-8 border-t border-slate-700 pt-8">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-bold text-white flex items-center gap-2"><Landmark size={20}/> Campos e Locais</h3>
                         <button onClick={() => setShowVenueModal(true)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded flex items-center gap-1 font-bold border border-slate-600">
                             <Plus size={14}/> Adicionar Local
                         </button>
                     </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {venues.map(venue => (
                             <div key={venue.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                                 <div>
                                     <div className="font-bold text-white text-sm">{venue.name}</div>
                                     <div className="text-[10px] text-slate-500 uppercase">{venue.address}</div>
                                 </div>
                                 <div className="text-xs text-slate-600 font-bold px-2 py-1 bg-slate-800 rounded">
                                     {venue.city ? `${venue.city}/${venue.state}` : 'Local'}
                                 </div>
                             </div>
                         ))}
                         {venues.length === 0 && <div className="text-slate-500 text-sm col-span-full">Nenhum local cadastrado. Adicione para facilitar na agenda.</div>}
                     </div>
                 </div>
            </div>
        </div>
      )}

      {/* Agenda (Updated with Venue Select and Delete Modal) */}
      {activeTab === 'agenda' && (
          <div className="animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-white">Agenda de Jogos</h2>
                  <button onClick={() => setShowRoundCreator(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded font-bold uppercase text-sm shadow-lg flex items-center gap-2 w-full md:w-auto justify-center">
                      <Plus size={16}/> Nova Rodada
                  </button>
              </div>
              <div className="space-y-8">
                  {groupedMatches.map(([roundName, roundMatches]) => (
                      <div key={roundName} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                          <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                              <h3 className="font-bold text-white uppercase text-sm tracking-widest">{roundName}</h3>
                              <div className="flex items-center gap-4">
                                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">{roundMatches.length} Jogos</span>
                                  <button onClick={() => setRoundToDelete(roundName)} className="text-slate-500 hover:text-red-500" title="Apagar Rodada">
                                      <Trash2 size={16}/>
                                  </button>
                              </div>
                          </div>
                          <div className="divide-y divide-slate-700/50">
                              {roundMatches.map(m => (
                                  <div key={m.id} className="p-4 hover:bg-slate-700/20 transition-colors flex flex-col md:flex-row items-center gap-4 group">
                                      {/* Match Row Content */}
                                      <div className="md:hidden w-full flex justify-between items-center mb-2">
                                           <span className="text-[10px] font-bold bg-slate-700 text-white px-2 py-0.5 rounded uppercase">
                                               {getGroupName(m.home_team_id || undefined) || 'JOGO'}
                                           </span>
                                           <div className="flex gap-2 text-[10px] text-slate-500 uppercase font-bold">
                                               <span>{m.start_time ? new Date(m.start_time).toLocaleDateString() + ' ' + new Date(m.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Data N/D'}</span>
                                               {m.location && <span>• {m.location}</span>}
                                           </div>
                                      </div>

                                      <div className="flex flex-col md:flex-row items-center gap-3 flex-1 w-full justify-center md:justify-start">
                                          <div className="flex items-center gap-2 flex-1 justify-between md:justify-end w-full md:w-auto">
                                              <span className="text-xs text-slate-500 font-bold hidden md:inline">{getGroupName(m.home_team_id || undefined)}</span>
                                              <div className="w-full md:w-48">
                                                  <SmartTeamSelect 
                                                    value={m.home_team_id} 
                                                    onChange={(val) => handleUpdateMatch(m.id, 'home_team_id', val)} 
                                                  />
                                              </div>
                                          </div>
                                          <div className="flex flex-col items-center px-2 py-1 md:py-0">
                                              <span className="text-xs font-black text-slate-500">VS</span>
                                              {m.status === 'finished' && <span className="text-xs font-bold text-emerald-500">{m.home_score}-{m.away_score}</span>}
                                              {m.is_wo && <span className="text-[9px] font-black bg-red-600 text-white px-1 rounded">W.O.</span>}
                                          </div>
                                          <div className="flex items-center gap-2 flex-1 justify-between md:justify-start w-full md:w-auto">
                                              <div className="w-full md:w-48">
                                                  <SmartTeamSelect 
                                                    value={m.away_team_id} 
                                                    onChange={(val) => handleUpdateMatch(m.id, 'away_team_id', val)}
                                                    homeTeamId={m.home_team_id || undefined}
                                                  />
                                              </div>
                                              <span className="text-xs text-slate-500 font-bold hidden md:inline">{getGroupName(m.away_team_id || undefined)}</span>
                                          </div>
                                      </div>

                                      <div className="flex items-center gap-2 w-full md:w-auto justify-center mt-4 md:mt-0">
                                          {/* Date/Time Inputs */}
                                          <div className="relative hidden md:block">
                                              <input type="date" className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-32 outline-none focus:border-emerald-500" value={m.start_time ? m.start_time.split('T')[0] : ''} onChange={(e) => { const time = m.start_time ? m.start_time.split('T')[1] : '00:00:00'; handleUpdateMatch(m.id, 'start_time', e.target.value ? `${e.target.value}T${time}` : null); }} />
                                          </div>
                                          <div className="relative hidden md:block">
                                              <input type="time" className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-20 outline-none focus:border-emerald-500" value={m.start_time ? m.start_time.split('T')[1].substring(0,5) : ''} onChange={(e) => { const date = m.start_time ? m.start_time.split('T')[0] : new Date().toISOString().split('T')[0]; handleUpdateMatch(m.id, 'start_time', `${date}T${e.target.value}:00`); }} />
                                          </div>
                                          
                                          {/* Venue Select */}
                                          <div className="hidden md:block w-32">
                                               <select 
                                                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-full outline-none focus:border-emerald-500"
                                                  value={m.venue_id || ''}
                                                  onChange={(e) => handleUpdateMatch(m.id, 'venue_id', e.target.value)}
                                               >
                                                   <option value="">Local...</option>
                                                   {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                   <option value="NEW_VENUE" className="font-bold text-emerald-400">+ Cadastrar Novo</option>
                                               </select>
                                          </div>
                                          
                                          <div className="flex gap-2 shrink-0">
                                              <button onClick={() => openMatchHistory(m)} className="p-2 md:p-1.5 text-slate-500 hover:text-blue-400 bg-slate-900 md:bg-transparent rounded border md:border-none border-slate-700" title="Histórico"><Clock size={18}/></button>
                                              <button onClick={() => handleOpenQuickScore(m)} className="p-2 md:p-1.5 text-slate-400 hover:text-emerald-500 bg-slate-900 md:bg-transparent rounded transition-colors border md:border-none border-slate-700" title="Placar" disabled={!m.home_team_id || !m.away_team_id}><ClipboardEdit size={18}/></button>
                                              <button onClick={() => setMatchToDelete(m)} className="p-2 md:p-1.5 text-slate-500 hover:text-red-500 bg-slate-900 md:bg-transparent rounded border md:border-none border-slate-700"><Trash2 size={18}/></button>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Groups, Teams, Sumulas Tabs - Reused logic, condensed for brevity as logic is unchanged */}
      {activeTab === 'grupos' && (
          <div className="animate-in fade-in space-y-8">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">Gestão de Grupos e Chaves</h2>
                  <button onClick={() => setShowGroupModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Plus size={16}/> Novo Grupo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Ungrouped Teams */}
                  <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl p-4 shadow-lg h-full">
                        <h3 className="font-bold text-slate-400 text-lg mb-4">Times sem Grupo ({ungroupedTeams.length})</h3>
                        <div className="space-y-2">
                            {ungroupedTeams.map(t => (
                                <div key={t.id} className="bg-slate-900 p-2 rounded flex items-center justify-between border border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden">{t.logo_url && <img src={t.logo_url} className="w-full h-full object-cover"/>}</div>
                                        <span className="text-sm font-bold text-white">{t.name}</span>
                                    </div>
                                    <select onChange={(e) => moveTeamToGroup(t.id, e.target.value)} value="" className="bg-slate-700 text-xs text-white rounded p-1 border border-slate-600 focus:outline-none focus:border-emerald-500">
                                        <option value="">Mover para...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                            ))}
                            {ungroupedTeams.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Todos os times estão em grupos.</p>}
                        </div>
                  </div>

                  {groups.map(g => (
                      <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg">
                          <div className="flex justify-between items-center mb-4">
                            {editingGroupId === g.id ? (
                                <input 
                                    type="text"
                                    value={editedGroupName}
                                    onChange={(e) => setEditedGroupName(e.target.value)}
                                    onBlur={handleSaveGroupName}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveGroupName()}
                                    className="bg-slate-900 text-white font-bold text-lg rounded border border-emerald-500 px-2 -ml-2"
                                    autoFocus
                                />
                            ) : (
                                <h3 className="font-bold text-white text-lg flex items-center gap-2">{g.name} <button onClick={() => handleStartEditGroup(g)}><Edit size={12} className="text-slate-500 hover:text-white"/></button></h3>
                            )}
                            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{teams.filter(t => t.group_id === g.id).length} times</span>
                          </div>
                          <div className="space-y-2 min-h-[100px]">
                              {teams.filter(t => t.group_id === g.id).map(t => (
                                  <div key={t.id} className="bg-slate-900 p-2 rounded flex items-center justify-between border border-slate-800 hover:border-emerald-500 transition-colors">
                                      <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden">{t.logo_url && <img src={t.logo_url} className="w-full h-full object-cover"/>}</div>
                                          <span className="text-sm font-bold text-white">{t.name}</span>
                                      </div>
                                      <button onClick={() => moveTeamToGroup(t.id, null)} className="text-slate-500 hover:text-red-500" title="Remover do Grupo"><X size={14}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'times' && (
          <div className="animate-in fade-in">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-white">Times ({teams.length})</h2>
                  <button onClick={() => openTeamModal(null)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Plus size={16}/> Novo Time</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {teams.map(t => (
                      <div key={t.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-slate-900 rounded-full mb-3 overflow-hidden flex items-center justify-center">
                              {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover"/> : t.short_name}
                          </div>
                          <div className="font-bold text-white text-sm">{t.name}</div>
                          <div className="text-xs text-slate-500 mb-3">{getGroupName(t.id) || 'Sem Grupo'}</div>
                          <div className="flex gap-2 w-full mt-2">
                              <button onClick={() => openSquadModal(t)} className="text-xs bg-slate-700 px-3 py-2 rounded hover:bg-slate-600 text-white flex-1">Elenco</button>
                              <button onClick={() => openTeamModal(t)} className="text-xs bg-slate-700 p-2 rounded hover:bg-slate-600 text-white"><Edit size={12}/></button>
                              <button onClick={() => setTeamToDelete(t)} className="text-xs bg-slate-700 p-2 rounded hover:bg-red-900 hover:text-white text-slate-400"><Trash2 size={12}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'sumulas' && (
          <div className="animate-in fade-in">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <h2 className="text-2xl font-bold text-white">Súmulas Profissionais</h2>
                      <p className="text-slate-400 text-sm">Geração automática de documentos oficiais para impressão.</p>
                  </div>
              </div>
               <div className="space-y-8">
                  {groupedMatches.map(([roundName, roundMatches]) => (
                      <div key={roundName} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                          <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center"><h3 className="font-bold text-white uppercase text-sm tracking-widest">{roundName}</h3></div>
                          <div className="divide-y divide-slate-700/50">
                              {roundMatches.filter(m => m.home_team_id && m.away_team_id).map(m => (
                                  <div key={m.id} className="p-4 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-700/20 transition-colors">
                                      <div className="flex items-center gap-4 flex-1">
                                           <div className="flex flex-col items-center gap-1 w-20"><div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">{m.home_team?.logo_url && <img src={m.home_team.logo_url} className="w-full h-full object-cover"/>}</div><span className="text-[10px] font-bold text-slate-400 uppercase truncate w-full text-center">{m.home_team?.short_name}</span></div>
                                           <div className="text-center"><span className="text-xl font-black text-white">VS</span></div>
                                            <div className="flex flex-col items-center gap-1 w-20"><div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">{m.away_team?.logo_url && <img src={m.away_team.logo_url} className="w-full h-full object-cover"/>}</div><span className="text-[10px] font-bold text-slate-400 uppercase truncate w-full text-center">{m.away_team?.short_name}</span></div>
                                           <div className="border-l border-slate-700 pl-4 ml-2"><div className="text-xs text-slate-300 font-bold">{new Date(m.start_time || '').toLocaleDateString()}</div><div className="text-[10px] text-slate-500 uppercase">{m.location || ''}</div></div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <button onClick={() => openSheetConfig(m)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"><Settings2 size={16}/> Editar Dados</button>
                                          <Link to={`/match/${m.id}/sheet`} target="_blank" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"><Printer size={16}/> Imprimir Súmula</Link>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Venue Modal */}
      {showVenueModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-sm">
                  <h3 className="font-bold text-white mb-4">Novo Local de Jogo</h3>
                  <form onSubmit={handleCreateVenue} className="space-y-3">
                      <div><label className="text-xs text-slate-400 font-bold uppercase">Nome do Campo/Estádio</label><input autoFocus type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={newVenue.name} onChange={e => setNewVenue({...newVenue, name: e.target.value})} required/></div>
                      <div><label className="text-xs text-slate-400 font-bold uppercase">Endereço (Opcional)</label><input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={newVenue.address} onChange={e => setNewVenue({...newVenue, address: e.target.value})}/></div>
                      <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs text-slate-400 font-bold uppercase">Cidade</label><input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={newVenue.city} onChange={e => setNewVenue({...newVenue, city: e.target.value})}/></div>
                          <div><label className="text-xs text-slate-400 font-bold uppercase">UF</label><input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" maxLength={2} value={newVenue.state} onChange={e => setNewVenue({...newVenue, state: e.target.value.toUpperCase()})}/></div>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                          <button type="button" onClick={() => setShowVenueModal(false)} className="text-slate-400 hover:text-white px-3">Cancelar</button>
                          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Salvar Local</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Quick Score Modal (UPDATED) */}
      {showQuickScoreModal && quickScoreMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                        <ClipboardEdit className="text-emerald-500"/> Placar Rápido
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Atualize o resultado oficial da partida manualmente.</p>
                </div>
                
                {/* W.O. Toggle */}
                <div className="mb-6 flex justify-center">
                    <button 
                        onClick={() => {
                            if (!quickScores.is_wo) {
                                // Enabling W.O.: Set Default
                                setQuickScores({ ...quickScores, is_wo: true, home: 3, away: 0, wo_winner_id: quickScoreMatch.home_team_id || '' });
                            } else {
                                // Disabling W.O.
                                setQuickScores({ ...quickScores, is_wo: false, home: 0, away: 0, wo_winner_id: '' });
                            }
                        }}
                        className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 border transition-all ${quickScores.is_wo ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-red-500'}`}
                    >
                        <AlertTriangle size={16}/> {quickScores.is_wo ? 'W.O. Ativado' : 'Marcar W.O.'}
                    </button>
                </div>

                {quickScores.is_wo ? (
                    <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl mb-6 text-center">
                        <h4 className="text-red-400 font-bold mb-3 uppercase text-sm">Quem venceu por W.O.?</h4>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => setQuickScores({...quickScores, wo_winner_id: quickScoreMatch.home_team_id!, home: 3, away: 0})}
                                className={`px-4 py-2 rounded-lg font-bold text-sm border ${quickScores.wo_winner_id === quickScoreMatch.home_team_id ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-600'}`}
                            >
                                {quickScoreMatch.home_team?.short_name}
                            </button>
                            <button 
                                onClick={() => setQuickScores({...quickScores, wo_winner_id: quickScoreMatch.away_team_id!, home: 0, away: 3})}
                                className={`px-4 py-2 rounded-lg font-bold text-sm border ${quickScores.wo_winner_id === quickScoreMatch.away_team_id ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-600'}`}
                            >
                                {quickScoreMatch.away_team?.short_name}
                            </button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-red-500/20">
                            <p className="text-slate-400 text-xs mb-2">Placar do W.O. (Padrão 3x0)</p>
                            <div className="flex items-center justify-center gap-3">
                                <input type="number" className="w-12 h-10 bg-slate-900 border border-red-900 rounded text-center text-white font-bold" value={quickScores.home} onChange={e => setQuickScores({...quickScores, home: parseInt(e.target.value) || 0})}/>
                                <span className="text-red-500 font-black">X</span>
                                <input type="number" className="w-12 h-10 bg-slate-900 border border-red-900 rounded text-center text-white font-bold" value={quickScores.away} onChange={e => setQuickScores({...quickScores, away: parseInt(e.target.value) || 0})}/>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-4 mb-8">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-600">
                                {quickScoreMatch.home_team?.logo_url ? <img src={quickScoreMatch.home_team.logo_url} className="w-full h-full object-cover"/> : <Trophy size={24} className="text-slate-500"/>}
                            </div>
                            <span className="font-bold text-white text-center text-sm leading-tight">{quickScoreMatch.home_team?.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                                <input type="number" className="w-16 h-16 bg-slate-900 border-2 border-slate-600 rounded-xl text-center text-3xl font-black text-white focus:border-emerald-500 outline-none" value={quickScores.home} onChange={(e) => setQuickScores({...quickScores, home: Math.max(0, parseInt(e.target.value) || 0)})}/>
                            </div>
                            <span className="text-slate-500 font-black text-xl">X</span>
                            <div className="flex flex-col items-center gap-1">
                                <input type="number" className="w-16 h-16 bg-slate-900 border-2 border-slate-600 rounded-xl text-center text-3xl font-black text-white focus:border-emerald-500 outline-none" value={quickScores.away} onChange={(e) => setQuickScores({...quickScores, away: Math.max(0, parseInt(e.target.value) || 0)})}/>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-600">
                                {quickScoreMatch.away_team?.logo_url ? <img src={quickScoreMatch.away_team.logo_url} className="w-full h-full object-cover"/> : <Trophy size={24} className="text-slate-500"/>}
                            </div>
                            <span className="font-bold text-white text-center text-sm leading-tight">{quickScoreMatch.away_team?.name}</span>
                        </div>
                    </div>
                )}

                {/* Penalties Section (Only for Knockout) */}
                {!quickScores.is_wo && quickScoreMatch.stage !== 'group_stage' && (
                    <div className="bg-slate-900 p-4 rounded-xl mb-6 border border-slate-700">
                        <h4 className="text-slate-400 font-bold text-xs uppercase text-center mb-3">Disputa de Pênaltis</h4>
                        <div className="flex items-center justify-center gap-4">
                             <input type="number" className="w-12 h-10 bg-slate-800 border border-slate-600 rounded text-center text-white font-bold" placeholder="0" value={quickScores.penalty_home} onChange={e => setQuickScores({...quickScores, penalty_home: parseInt(e.target.value) || 0})}/>
                             <span className="text-slate-500 text-xs">PÊNALTIS</span>
                             <input type="number" className="w-12 h-10 bg-slate-800 border border-slate-600 rounded text-center text-white font-bold" placeholder="0" value={quickScores.penalty_away} onChange={e => setQuickScores({...quickScores, penalty_away: parseInt(e.target.value) || 0})}/>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <button onClick={() => setShowQuickScoreModal(false)} className="px-4 py-3 text-slate-400 hover:text-white font-bold transition-colors">Cancelar</button>
                    <button onClick={handleSaveQuickScore} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                        <Save size={18}/> Salvar Resultado
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {showGroupModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-sm">
                  <h3 className="font-bold text-white mb-4">Novo Grupo</h3>
                  <form onSubmit={handleCreateGroup}>
                      <input autoFocus type="text" placeholder="Nome (ex: Grupo A)" value={newGroup} onChange={e => setNewGroup(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white mb-4"/>
                      <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-white px-3">Cancelar</button>
                          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Criar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showRoundCreator && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-md">
                  <h3 className="font-bold text-white mb-4 text-lg">Criar Rodada / Fase</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Tipo da Fase</label>
                          <select value={roundConfig.type} onChange={(e) => { const type = e.target.value; const defaultSlots = MATCH_STAGES.find(s => s.value === type)?.slots || 4; setRoundConfig({...roundConfig, type, matchCount: defaultSlots || 4}); }} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                              {MATCH_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                      </div>
                      {roundConfig.type === 'group_stage' && (
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Número da Rodada</label><input type="number" value={roundConfig.number} onChange={e => setRoundConfig({...roundConfig, number: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"/></div>
                              <div><label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Grupo (Opcional)</label><select value={roundConfig.groupId} onChange={e => setRoundConfig({...roundConfig, groupId: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"><option value="">Todos</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                          </div>
                      )}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Quantidade de Jogos (Slots)</label>
                          <input type="number" value={roundConfig.matchCount} onChange={e => setRoundConfig({...roundConfig, matchCount: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"/>
                          <p className="text-xs text-slate-500 mt-1">Isso criará {roundConfig.matchCount} espaços vazios para você preencher.</p>
                      </div>
                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                          <button onClick={() => setShowRoundCreator(false)} className="text-slate-400 hover:text-white px-3">Cancelar</button>
                          <button onClick={handleCreateRoundSlots} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-500">Gerar Slots</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showTeamModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-md">
                <h3 className="font-bold text-white mb-4">{teamForm.id ? 'Editar Time' : 'Cadastrar Time'}</h3>
                <form onSubmit={handleSaveTeam} className="space-y-3">
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Nome do Time</label><input type="text" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" required /></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Sigla / Abreviação</label><input type="text" value={teamForm.short_name} onChange={e => setTeamForm({...teamForm, short_name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" /></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Grupo / Chave</label><select value={teamForm.group_id} onChange={e => setTeamForm({...teamForm, group_id: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" disabled={groups.length === 0}><option value="">Sem Grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                    <div className="border border-slate-700 p-3 rounded-lg bg-slate-900/50"><label className="block text-xs font-bold text-slate-400 mb-2">Escudo</label><input type="file" accept="image/*" onChange={e => e.target.files && setTeamForm({...teamForm, logoFile: e.target.files[0]})} className="text-xs text-slate-400" /></div>
                    <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-white px-3 py-1">Cancelar</button><button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded font-bold">Salvar</button></div>
                </form>
            </div>
        </div>
      )}
      
      {showSquadModal && editingTeam && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl h-[80vh] flex flex-col p-6 shadow-2xl">
                <div className="flex justify-between mb-6 pb-4 border-b border-slate-700"><div><h3 className="font-bold text-white text-lg">Gerenciar Elenco</h3><p className="text-slate-400 text-sm">{editingTeam.name}</p></div><button onClick={() => setShowSquadModal(false)}><X className="text-slate-400 hover:text-white" /></button></div>
                <form onSubmit={handleAddPlayer} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6 grid grid-cols-12 gap-3 items-end">
                     <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número</label><input type="number" required value={newPlayer.number} onChange={e => setNewPlayer({...newPlayer, number: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-center" /></div>
                     <div className="col-span-4"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome</label><input type="text" required value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" /></div>
                      <div className="col-span-3"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Posição</label><select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs">{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                     <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Letra</label><input type="text" maxLength={3} value={newPlayer.letter || ''} onChange={e => setNewPlayer({...newPlayer, letter: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-center" placeholder="Z1" /></div>
                     <div className="col-span-1"><button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded flex items-center justify-center"><Plus size={20}/></button></div>
                </form>
                <div className="flex-1 overflow-y-auto pr-2">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-700/50 text-xs text-slate-400 uppercase"><tr><th className="p-2 text-center w-12">#</th><th className="p-2 text-center w-12">Letra</th><th className="p-2">Nome</th><th className="p-2">Posição</th><th className="p-2 w-10"></th></tr></thead>
                        <tbody className="divide-y divide-slate-700">{teamPlayers.map(p => (<tr key={p.id} className="hover:bg-slate-700/30 text-sm text-white"><td className="p-3 text-center font-bold">{p.number}</td><td className="p-3 text-center text-slate-400">{p.letter || '-'}</td><td className="p-3 font-medium">{p.name}</td><td className="p-3 text-slate-400 text-xs uppercase">{p.position}</td><td className="p-3 text-right"><button onClick={() => setPlayerToDelete(p)} className="text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td></tr>))}</tbody>
                    </table>
                    {teamPlayers.length === 0 && <div className="text-center py-8 text-slate-500 italic">Nenhum jogador cadastrado.</div>}
                </div>
            </div>
        </div>
      )}

      {/* History Modal reuse */}
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
                                  <span className="font-bold text-emerald-500">{log.user_profile?.full_name || 'Usuário'}</span>
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

      {/* --- ALL DELETE CONFIRMATION MODALS --- */}
        <DeleteConfirmationModal
            isOpen={!!matchToDelete}
            onClose={() => setMatchToDelete(null)}
            onConfirm={executeDeleteMatch}
            isDeleting={isDeleting}
            title="Apagar Jogo"
            message={<p>Tem certeza que deseja apagar este jogo permanentemente?</p>}
        />
        <DeleteConfirmationModal
            isOpen={!!roundToDelete}
            onClose={() => setRoundToDelete(null)}
            onConfirm={executeDeleteRound}
            isDeleting={isDeleting}
            title="Apagar Rodada"
            message={<p>Tem certeza que deseja apagar a rodada <strong>"{roundToDelete}"</strong> e todos os seus jogos? Esta ação não pode ser desfeita.</p>}
        />
        <DeleteConfirmationModal
            isOpen={!!playerToDelete}
            onClose={() => setPlayerToDelete(null)}
            onConfirm={executeDeletePlayer}
            isDeleting={isDeleting}
            title="Apagar Jogador"
            message={<p>Tem certeza que deseja apagar o jogador <strong>"{playerToDelete?.name}"</strong> permanentemente?</p>}
        />
        <DeleteConfirmationModal
            isOpen={!!teamToDelete}
            onClose={() => setTeamToDelete(null)}
            onConfirm={executeDeleteTeam}
            isDeleting={isDeleting}
            title="Apagar Time"
            message={<p>Tem certeza que deseja apagar o time <strong>"{teamToDelete?.name}"</strong>? Todos os jogadores e dados relacionados serão perdidos.</p>}
        />
    </div>
  );
};

export default OrganizerDashboard;
