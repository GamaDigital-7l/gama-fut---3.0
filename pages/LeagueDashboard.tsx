import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Championship, Organization, Subscription } from '../types';
import { Plus, Trophy, Calendar, Users, Activity, Copy, Trash2, LayoutGrid, MapPin, Award, Eye, EyeOff, MonitorPlay, AlertTriangle, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const LeagueDashboard: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  // Create Form State
  const [newChamp, setNewChamp] = useState({
      name: '',
      season: new Date().getFullYear().toString(),
      category: 'Amador',
      city: '',
      state: '',
      startDate: ''
  });

  // NEW: Delete state
  const [champToDelete, setChampToDelete] = useState<Championship | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
      setLoading(true);
      
      // Fetch Org with Sub
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*, subscription:subscriptions(*, plan:plans(*))')
        .eq('id', orgId)
        .single();
      
      setOrg(orgData);
      if (orgData?.subscription) setSubscription(orgData.subscription);

      // Fetch Championships with counts
      const { data: champData } = await supabase
        .from('championships')
        .select('*, teams(count), matches(count)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      
      if (champData) setChampionships(champData as any[]);
      setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // SaaS Check: Limit
      const limit = subscription?.plan?.limits.championships || 1;
      if (championships.length >= limit) {
          alert(`Limite de campeonatos atingido (${limit}). Faça upgrade do seu plano para criar mais.`);
          return;
      }

      const slug = newChamp.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      
      const { data, error } = await supabase.from('championships').insert({
          organization_id: orgId,
          name: newChamp.name,
          slug: slug,
          season: newChamp.season,
          category: newChamp.category,
          city: newChamp.city,
          state: newChamp.state,
          start_date: newChamp.startDate || null,
          status: 'rascunho',
          tiebreakers: ['wins', 'goal_diff', 'goals_for'],
          zone_config: { mode: 'traditional', promotion: 4, relegation: 1, gold: 0, silver: 0, bronze: 0 }
      }).select().single();

      if (error) {
          alert("Erro ao criar: " + error.message);
      } else {
          setShowCreateModal(false);
          navigate(`/dashboard/championship/${data.id}`);
      }
  };

  const toggleStatus = async (champ: Championship) => {
      // SaaS Check: Overdue
      if (subscription?.status === 'overdue' || subscription?.status === 'blocked') {
          alert("Sua assinatura está vencida. Regularize para publicar campeonatos.");
          return;
      }

      const newStatus = champ.status === 'publicado' ? 'rascunho' : 'publicado';
      const { error } = await supabase.from('championships').update({ status: newStatus }).eq('id', champ.id);
      
      if (error) {
          alert("Erro ao atualizar status: " + error.message);
      } else {
          setChampionships(championships.map(c => c.id === champ.id ? { ...c, status: newStatus } : c));
      }
  };

  const handleDelete = async (id: string) => {
      setIsDeleting(true);
      const { error } = await supabase.from('championships').delete().eq('id', id);
      if (error) {
          alert("Erro ao deletar: " + error.message);
      } else {
          setChampionships(championships.filter(c => c.id !== id));
      }
      setIsDeleting(false);
      setChampToDelete(null);
  };

  const copyLink = (slug: string) => {
      const url = `${window.location.origin}/#/championship/${slug}`; 
      navigator.clipboard.writeText(url);
      alert("Link copiado: " + url);
  };

  if (loading) return <div className="text-white p-10 animate-pulse">Carregando sua liga...</div>;

  const activeCount = championships.filter(c => c.status !== 'encerrado').length;
  const planLimit = subscription?.plan?.limits.championships || 1;
  const isOverdue = subscription?.status === 'overdue' || subscription?.status === 'blocked';
  const isWarning = subscription?.status === 'warning';

  return (
    <div className="space-y-8 pb-20">
        
        {isOverdue && (
            <div className="bg-red-900/80 border border-red-500 text-white p-4 rounded-xl flex items-center gap-4 shadow-xl">
                <AlertTriangle size={32} className="text-red-300"/>
                <div>
                    <h3 className="font-bold text-lg">Assinatura Vencida ou Bloqueada</h3>
                    <p className="text-sm text-red-200">Algumas funcionalidades estão restritas. Entre em contato com o suporte para regularizar.</p>
                </div>
            </div>
        )}
        {!isOverdue && isWarning && (
            <div className="bg-yellow-900/80 border border-yellow-500 text-white p-4 rounded-xl flex items-center gap-4 shadow-xl">
                <AlertTriangle size={32} className="text-yellow-300"/>
                <div>
                    <h3 className="font-bold text-lg">Assinatura Vencendo em Breve</h3>
                    <p className="text-sm text-yellow-200">Renove seu plano para evitar interrupções.</p>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    {org?.logo_url && <img src={org.logo_url} className="w-8 h-8 rounded-full bg-white object-contain"/>}
                    {org?.name || 'Minha Liga'}
                </h1>
                <p className="text-slate-400 font-medium flex items-center gap-2 mt-1">
                    <MapPin size={14}/> {championships[0]?.city ? `${championships[0].city}/${championships[0].state}` : 'Gestão Esportiva'}
                    <span className="text-emerald-500 px-2 border-l border-slate-700 font-bold uppercase text-xs">Plano {subscription?.plan?.name || 'Gratuito'}</span>
                </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
                 <Link 
                    to="/dashboard/live"
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-600 shadow-lg transition-all"
                >
                    <MonitorPlay size={20}/> Painel de Súmula (Mesário)
                </Link>

                <button 
                    onClick={() => {
                        if (championships.length >= planLimit) return alert("Limite do plano atingido!");
                        if (isOverdue) return alert("Assinatura bloqueada.");
                        setShowCreateModal(true);
                    }}
                    className={`text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${isOverdue || championships.length >= planLimit ? 'bg-slate-600 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                >
                    {championships.length >= planLimit ? <Lock size={20}/> : <Plus size={20}/>} Novo Campeonato
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={64} className="text-emerald-500"/>
                </div>
                <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Em Andamento</h3>
                <div className="text-4xl font-black text-white">{activeCount}</div>
                <div className="text-xs text-emerald-500 mt-2 font-bold">Campeonatos ativos</div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <LayoutGrid size={64} className="text-blue-500"/>
                </div>
                <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Capacidade do Plano</h3>
                <div className="text-4xl font-black text-white">{championships.length} <span className="text-xl text-slate-600 font-medium">/ {planLimit}</span></div>
                <div className="w-full bg-slate-700 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div className={`h-full ${championships.length >= planLimit ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (championships.length / planLimit) * 100)}%` }}></div>
                </div>
            </div>

             <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl flex items-center justify-center text-center">
                <div>
                     <Trophy className="mx-auto text-indigo-400 mb-2" size={32}/>
                     <h3 className="text-white font-bold">Plano {subscription?.plan?.name || 'Free'}</h3>
                     <p className="text-xs text-indigo-200 mt-1">Validade: {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'Ilimitado'}</p>
                </div>
            </div>
        </div>

        <div>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Trophy size={20} className="text-emerald-500"/> Meus Campeonatos
            </h2>

            <div className="grid gap-4">
                {championships.map(champ => (
                    <div key={champ.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-emerald-500/30 transition-all shadow-lg flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${champ.status === 'publicado' ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>

                        <div className="w-24 h-24 bg-white rounded-xl flex-shrink-0 flex items-center justify-center border-4 border-slate-700 overflow-hidden shadow-lg">
                            {champ.logo_url ? <img src={champ.logo_url} className="w-full h-full object-contain"/> : <Trophy className="text-slate-800" size={32}/>}
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-2">
                            <div className="flex flex-col md:flex-row items-center gap-3">
                                <h3 className="text-2xl font-black text-white tracking-tight">{champ.name}</h3>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${champ.status === 'publicado' ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                    {champ.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-400 font-medium">
                                {champ.city} • {champ.category} • {champ.season}
                            </p>
                            
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-xs font-bold text-slate-500 uppercase mt-2">
                                <span className="flex items-center gap-1.5"><Users size={14} className="text-emerald-500"/> {champ.teams?.[0]?.count || 0} Times</span>
                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-500"/> {champ.matches?.[0]?.count || 0} Jogos</span>
                                <span className="flex items-center gap-1.5 text-yellow-500"><Award size={14}/> Gestão Pro</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
                            <button 
                                onClick={() => toggleStatus(champ)}
                                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${champ.status === 'publicado' ? 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:border-slate-400' : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'}`}
                                title={champ.status === 'publicado' ? 'Ocultar do Público' : 'Publicar Agora'}
                            >
                                {champ.status === 'publicado' ? <><EyeOff size={16}/> Ocultar</> : <><Eye size={16}/> Publicar</>}
                            </button>

                            <Link 
                                to={`/dashboard/championship/${champ.id}`}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                            >
                                Gerenciar
                            </Link>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => copyLink(champ.id)}
                                    className="p-2 bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
                                    title="Copiar Link"
                                >
                                    <Copy size={16}/>
                                </button>
                                <button 
                                    onClick={() => setChampToDelete(champ)}
                                    className="p-2 bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
                                    title="Apagar"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {championships.length === 0 && (
                    <div className="text-center py-16 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
                        <Trophy size={48} className="mx-auto text-slate-600 mb-4"/>
                        <p className="text-slate-400 font-medium">Você ainda não tem campeonatos criados.</p>
                        <button onClick={() => setShowCreateModal(true)} className="mt-4 text-emerald-500 font-bold hover:underline">Criar meu primeiro campeonato</button>
                    </div>
                )}
            </div>
        </div>

        {showCreateModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                        <Plus size={24} className="text-emerald-500"/> Novo Campeonato
                    </h2>
                    
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Campeonato</label>
                            <input autoFocus type="text" value={newChamp.name} onChange={e => setNewChamp({...newChamp, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none" placeholder="Ex: Copa Verão 2024" required/>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Temporada / Ano</label>
                                <input type="text" value={newChamp.season} onChange={e => setNewChamp({...newChamp, season: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoria</label>
                                <select value={newChamp.category} onChange={e => setNewChamp({...newChamp, category: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none">
                                    <option>Amador</option>
                                    <option>Profissional</option>
                                    <option>Base (Sub-20)</option>
                                    <option>Base (Sub-17)</option>
                                    <option>Base (Sub-15)</option>
                                    <option>Feminino</option>
                                    <option>Veterano</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cidade</label>
                                <input type="text" value={newChamp.city} onChange={e => setNewChamp({...newChamp, city: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estado (UF)</label>
                                <input type="text" maxLength={2} value={newChamp.state} onChange={e => setNewChamp({...newChamp, state: e.target.value.toUpperCase()})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"/>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Início Previsto</label>
                            <input type="date" value={newChamp.startDate} onChange={e => setNewChamp({...newChamp, startDate: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"/>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white px-4 py-2 font-bold">Cancelar</button>
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Criar Campeonato</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        <DeleteConfirmationModal
            isOpen={!!champToDelete}
            onClose={() => setChampToDelete(null)}
            onConfirm={() => champToDelete && handleDelete(champToDelete.id)}
            isDeleting={isDeleting}
            title="Apagar Campeonato"
            message={
                <p>
                    Tem certeza que deseja apagar o campeonato <strong>"{champToDelete?.name}"</strong>?<br/>
                    Todos os times, jogos e dados relacionados serão perdidos permanentemente.
                </p>
            }
        />
    </div>
  );
};

export default LeagueDashboard;
