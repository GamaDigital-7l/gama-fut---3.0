import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Team, Player, Match } from '../types';
import { Users, Calendar, Trophy, User, Plus, X } from 'lucide-react';

interface TechnicianDashboardProps {
  userProfile: UserProfile;
}

const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ userProfile }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Player Modal
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'Atacante' });

  useEffect(() => {
    loadTeamData();
  }, [userProfile]);

  const loadTeamData = async () => {
      if (!userProfile.team_id) {
        setLoading(false);
        return;
      }

      // 1. Get Team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', userProfile.team_id)
        .single();
      
      setTeam(teamData as Team);

      if (teamData) {
        // 2. Get Players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamData.id)
          .order('number', { ascending: true });
        setPlayers(playersData as Player[] || []);

        // 3. Get Matches (Home or Away)
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            *,
            home_team:teams!home_team_id(name, short_name, logo_url),
            away_team:teams!away_team_id(name, short_name, logo_url),
            championship:championships(name)
          `)
          .or(`home_team_id.eq.${teamData.id},away_team_id.eq.${teamData.id}`)
          .order('start_time', { ascending: true });
        setMatches(matchesData as Match[] || []);
      }
      setLoading(false);
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;

    const { data, error } = await supabase.from('players').insert({
        team_id: team.id,
        name: newPlayer.name,
        number: parseInt(newPlayer.number),
        position: newPlayer.position
    }).select().single();

    if (error) {
        alert("Error adding player: " + error.message);
    } else {
        setPlayers([...players, data as Player]);
        setShowPlayerModal(false);
        setNewPlayer({ name: '', number: '', position: 'Atacante' });
    }
  };

  if (loading) return <div className="text-white p-6">Loading team data...</div>;
  if (!team) return <div className="text-slate-400 p-6">No team assigned to this account. Please contact the organizer.</div>;

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-6">
        <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border-4 border-slate-600">
           {team.logo_url ? <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover"/> : <Trophy size={40} className="text-slate-500"/>}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{team.name}</h1>
          <p className="text-emerald-500 font-medium">{team.championship_id ? 'Participando do Campeonato' : 'Sem campeonato ativo'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Squad List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2"><Users size={20}/> Elenco ({players.length})</h3>
            <button 
                onClick={() => setShowPlayerModal(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-1 font-bold"
            >
                <Plus size={14}/> Adicionar Atleta
            </button>
          </div>
          <div className="divide-y divide-slate-700 max-h-[400px] overflow-y-auto">
            {players.map(player => (
              <div key={player.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold text-white border border-slate-500">
                    {player.number}
                  </div>
                  <div>
                    <div className="font-medium text-white">{player.name}</div>
                    <div className="text-xs text-slate-400 uppercase">{player.position}</div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-white"><User size={16}/></button>
              </div>
            ))}
            {players.length === 0 && <div className="p-6 text-center text-slate-500">Nenhum jogador registrado.</div>}
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
             <h3 className="font-bold text-lg text-white flex items-center gap-2"><Calendar size={20}/> Calendário</h3>
          </div>
          <div className="divide-y divide-slate-700 max-h-[400px] overflow-y-auto">
             {matches.map(match => {
               const isHome = match.home_team_id === team.id;
               const opponent = isHome ? match.away_team : match.home_team;
               const result = match.status === 'finished' 
                  ? `${match.home_score} - ${match.away_score}` 
                  : match.status === 'live' ? 'AO VIVO' : 'VS';
               
               return (
                 <div key={match.id} className="px-6 py-4 hover:bg-slate-700/50">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded">{new Date(match.start_time).toLocaleDateString()}</span>
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${match.status === 'live' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{match.status}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isHome ? 'text-emerald-400' : 'text-white'}`}>Seu Time</span>
                        <span className="text-slate-500 text-sm font-bold">{result}</span>
                        <span className={`font-bold ${!isHome ? 'text-emerald-400' : 'text-white'}`}>{opponent?.short_name}</span>
                      </div>
                      <div className="text-xs text-slate-400">{match.location}</div>
                   </div>
                 </div>
               );
             })}
             {matches.length === 0 && <div className="p-6 text-center text-slate-500">Nenhum jogo agendado.</div>}
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">Novo Jogador</h3>
                    <button onClick={() => setShowPlayerModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleAddPlayer} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo</label>
                        <input type="text" required value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500" placeholder="Nome do atleta"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Número da Camisa</label>
                            <input type="number" required value={newPlayer.number} onChange={e => setNewPlayer({...newPlayer, number: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500" placeholder="10"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Posição</label>
                            <select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500">
                                <option>Goleiro</option>
                                <option>Zagueiro</option>
                                <option>Lateral</option>
                                <option>Volante</option>
                                <option>Meia</option>
                                <option>Atacante</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold">Cadastrar Jogador</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;