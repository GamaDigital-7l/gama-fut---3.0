import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { UserProfile, GlobalSponsor, Plan, Subscription, Organization, AdminAuditLog, Championship } from '../types';
import { Shield, Users, Save, Trash2, Plus, Upload, Link as LinkIcon, AlertTriangle, Building, CreditCard, Activity, Search, Clock, Check, X, Lock, Unlock, ArrowLeft, FileText, Phone, Mail, Edit, Monitor, Layout, Home, LogIn, Trophy, User, Loader2, RefreshCw } from 'lucide-react';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const SPONSOR_LOCATIONS = [
  { id: 'home', label: 'Home Pública (Hero)', icon: Home },
  { id: 'footer', label: 'Rodapé Global', icon: Layout },
  { id: 'login', label: 'Tela de Login', icon: LogIn },
  { id: 'champ_page', label: 'Página de Campeonato', icon: Trophy },
  { id: 'admin_panel', label: 'Painel Admin', icon: Monitor },
] as const;

const PlatformSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'users' | 'plans' | 'sponsors' | 'audit'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [stats, setStats] = useState({ clients: 0, users: 0, championships: 0, revenue: 0 });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sponsors, setSponsors] = useState<GlobalSponsor[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  // --- CLIENT MANAGEMENT STATE ---
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientData, setSelectedClientData] = useState<{
      org: Organization, 
      sub: Subscription | null, 
      users: UserProfile[],
      championships: Championship[]
  } | null>(null);
  
  // Local State for Subscription Editing
  const [editSubData, setEditSubData] = useState<Partial<Subscription>>({});
  const [isSavingSub, setIsSavingSub] = useState(false);

  const [clientSearch, setClientSearch] = useState('');

  // Forms
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  // New Client Form
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({ 
      name: '', 
      planId: '', 
      trial: true,
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: ''
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [clientToDeleteId, setClientToDeleteId] = useState<string | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Sponsor Form
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ 
      name: '', 
      link_url: '', 
      logoFile: null as File | null, 
      logo_url: '',
      quota: 'ouro',
      locations: [] as string[]
  });
  
  // NEW: Sponsor Delete State
  const [sponsorToDelete, setSponsorToDelete] = useState<GlobalSponsor | null>(null);
  const [isDeletingSponsor, setIsDeletingSponsor] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
      if (selectedClientId) fetchClientDetails(selectedClientId);
  }, [selectedClientId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Always fetch plans
    const { data: plansData } = await supabase.from('plans').select('*').order('price_monthly');
    if (plansData) setPlans(plansData as Plan[]);

    if (activeTab === 'users' || activeTab === 'clients') {
         const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
         if (data) setUsers(data as UserProfile[]);
    }

    if (activeTab === 'dashboard') {
        const { count: clientCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
        const { count: userCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
        const { count: champCount } = await supabase.from('championships').select('*', { count: 'exact', head: true });
        setStats({ clients: clientCount || 0, users: userCount || 0, championships: champCount || 0, revenue: 0 }); 
    }

    if (activeTab === 'clients') {
        // Fetch orgs and manually join subscriptions later to avoid singular/plural issues
        const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
        
        if (orgs) {
            // Fetch subscriptions separately to map them correctly
            const { data: subs } = await supabase.from('subscriptions').select('*, plan:plans(*)');
            
            const merged = orgs.map(org => ({
                ...org,
                subscription: subs?.find(s => s.organization_id === org.id)
            }));
            setClients(merged);
        }
    }

    if (activeTab === 'sponsors') {
        const { data } = await supabase.from('global_sponsors').select('*').order('display_order');
        if (data) setSponsors(data as GlobalSponsor[]);
    }

    if (activeTab === 'audit') {
        const { data } = await supabase.from('admin_audit_logs').select('*, admin_profile:user_profiles(full_name)').order('created_at', { ascending: false }).limit(50);
        if (data) setLogs(data as any);
    }

    setLoading(false);
  };

  const fetchClientDetails = async (id: string) => {
      // Fetch fresh details
      const [orgRes, subRes, userRes, champRes] = await Promise.all([
          supabase.from('organizations').select('*').eq('id', id).single(),
          supabase.from('subscriptions').select('*, plan:plans(*)').eq('organization_id', id), // Returns array
          supabase.from('user_profiles').select('*').eq('organization_id', id),
          supabase.from('championships').select('*').eq('organization_id', id)
      ]);

      if (orgRes.data) {
          // Handle subscription being an array or potentially empty
          const sub = (subRes.data && subRes.data.length > 0) ? subRes.data[0] : null;
          
          setSelectedClientData({
              org: orgRes.data,
              sub: sub,
              users: userRes.data as UserProfile[] || [],
              championships: champRes.data as Championship[] || []
          });

          // Initialize Edit State
          if (sub) {
              setEditSubData({
                  plan_id: sub.plan_id,
                  status: sub.status,
                  start_date: sub.start_date,
                  end_date: sub.end_date
              });
          } else {
              // Create default if missing
              setEditSubData({
                  status: 'trial',
                  start_date: new Date().toISOString()
              });
          }
      }
  };

  const logAdminAction = async (action: string, description: string, targetId?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          action_type: action,
          description: description,
          target_id: targetId
      });
  };

  // --- ACTIONS ---

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'blocked') => {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(`Confirmar ${status === 'blocked' ? 'bloqueio' : 'desbloqueio'} do usuário?`)) return;
      await supabase.from('user_profiles').update({ status }).eq('id', userId);
      
      setUsers(users.map(u => u.id === userId ? { ...u, status } : u));
      if (selectedClientData) {
          setSelectedClientData({
              ...selectedClientData,
              users: selectedClientData.users.map(u => u.id === userId ? { ...u, status } : u)
          });
      }
      logAdminAction('USER_UPDATE', `Usuário ${userId} alterado para ${status}`, userId);
  };

  // --- DELETE CLIENT LOGIC (MODAL) ---
  const openDeleteModal = (orgId: string) => {
      console.log("Opening delete modal for:", orgId); // Debug
      setClientToDeleteId(orgId);
      setDeleteConfirmationText('');
      setShowDeleteModal(true);
  };

  const executeDeleteClient = async () => {
      if (!clientToDeleteId || deleteConfirmationText !== 'DELETAR') return;

      setIsDeletingClient(true);
      await logAdminAction('CLIENT_DELETE_ATTEMPT', `Tentativa de excluir org ${clientToDeleteId}`, clientToDeleteId);

      const { error } = await supabase.from('organizations').delete().eq('id', clientToDeleteId);

      if (error) {
          console.error("Erro ao deletar:", error);
          alert(`Erro ao excluir: ${error.message}\n\nDICA: Vá em /setup > Corrigir Exclusão e rode o SQL.`);
      } else {
          logAdminAction('CLIENT_DELETE', `Cliente ${clientToDeleteId} excluído permanentemente`, clientToDeleteId);
          setSelectedClientId(null);
          await fetchData();
          setShowDeleteModal(false);
      }
      setIsDeletingClient(false);
  };

  // --- SAVE SUBSCRIPTION LOGIC ---
  const handleSaveSubscription = async () => {
      if (!selectedClientData) return;
      setIsSavingSub(true);

      // Fix Dates: Append Noon UTC to prevent day shifting
      const formatDate = (dateStr?: string) => {
          if (!dateStr) return null;
          // Check if already full ISO
          if (dateStr.includes('T')) return dateStr;
          return `${dateStr}T12:00:00Z`;
      };

      const updates = {
          plan_id: editSubData.plan_id,
          status: editSubData.status,
          start_date: formatDate(editSubData.start_date),
          end_date: formatDate(editSubData.end_date)
      };

      // Check if subscription exists, if not insert, else update
      if (selectedClientData.sub) {
          const { error } = await supabase
              .from('subscriptions')
              .update(updates)
              .eq('id', selectedClientData.sub.id);
          
          if (error) alert("Erro ao atualizar: " + error.message);
      } else {
          const { error } = await supabase
              .from('subscriptions')
              .insert({ ...updates, organization_id: selectedClientData.org.id });
          
          if (error) alert("Erro ao criar: " + error.message);
      }

      // Force Refresh Data
      await fetchClientDetails(selectedClientData.org.id);
      
      setIsSavingSub(false);
      alert("Assinatura salva com sucesso!");
  };

  // --- CREATE CLIENT ---
  const handleCreateClient = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreatingClient(true);

      if (!newClientData.planId) {
          alert("Selecione um plano.");
          setIsCreatingClient(false);
          return;
      }

      // 1. Create Organization
      const slug = newClientData.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substr(2, 4);
      
      const { data: org, error: orgError } = await supabase.from('organizations').insert({
          name: newClientData.name,
          slug: slug,
          logo_url: null,
          notes: `Resp: ${newClientData.adminName} | Tel: ${newClientData.adminPhone} | Senha: ${newClientData.adminPassword}`
      }).select().single();

      if (orgError) {
          alert("Erro ao criar organização: " + orgError.message);
          setIsCreatingClient(false);
          return;
      }

      // 2. Create Subscription
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (newClientData.trial ? 14 : 30));

      const { error: subError } = await supabase.from('subscriptions').insert({
          organization_id: org.id,
          plan_id: newClientData.planId,
          status: newClientData.trial ? 'trial' : 'active',
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString()
      });

      if (subError) console.error("Sub Error", subError);

      // 3. Create AUTH User (Temp Client)
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
              storageKey: `temp_auth_${Date.now()}`
          }
      });

      try {
          const { data: authData, error: authError } = await tempClient.auth.signUp({
              email: newClientData.adminEmail,
              password: newClientData.adminPassword,
              options: { data: { full_name: newClientData.adminName } }
          });

          if (authError) {
              alert("Aviso: Org criada, mas erro ao criar usuário de login: " + authError.message);
          } else if (authData.user) {
              // 4. Retry Logic for Profile Link
              let attempts = 0;
              let success = false;
              while (attempts < 3 && !success) {
                  const { error: profileError } = await supabase.from('user_profiles').upsert({
                      id: authData.user.id,
                      organization_id: org.id,
                      role: 'organizer_admin',
                      full_name: newClientData.adminName,
                      status: 'active'
                  });
                  if (!profileError) success = true;
                  else await new Promise(r => setTimeout(r, 1000));
                  attempts++;
              }
          }
      } catch (err) {
          console.error("Critical Error", err);
      }

      logAdminAction('CLIENT_CREATE', `Cliente ${newClientData.name} criado`, org.id);
      setShowClientModal(false);
      setIsCreatingClient(false);
      setNewClientData({ name: '', planId: '', trial: true, adminName: '', adminEmail: '', adminPhone: '', adminPassword: '' });
      fetchData();
      alert("Cliente criado com sucesso!");
  };

  // --- HELPERS ---
  const handleUpdateOrgNotes = async (orgId: string, notes: string) => {
      await supabase.from('organizations').update({ notes }).eq('id', orgId);
  };

  const handleSponsorUpload = async (file: File): Promise<string | null> => {
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('sponsor-logos').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('sponsor-logos').getPublicUrl(fileName);
          return data.publicUrl;
      } catch (error: any) {
          alert(`Erro upload: ${error.message}`);
          return null;
      }
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
      e.preventDefault();
      let logoUrl = newSponsor.logo_url;
      if (newSponsor.logoFile) {
          const uploaded = await handleSponsorUpload(newSponsor.logoFile);
          if (uploaded) logoUrl = uploaded;
          else return;
      }

      await supabase.from('global_sponsors').insert({
          name: newSponsor.name,
          link_url: newSponsor.link_url,
          logo_url: logoUrl,
          active: true,
          display_order: sponsors.length + 1,
          quota: newSponsor.quota,
          display_locations: newSponsor.locations
      });

      setNewSponsor({ name: '', link_url: '', logoFile: null, logo_url: '', quota: 'ouro', locations: [] });
      setShowSponsorModal(false);
      fetchData();
  };

  const handleDeleteSponsor = async (id: string) => {
      setIsDeletingSponsor(true);
      const { error } = await supabase.from('global_sponsors').delete().eq('id', id);
      if (error) {
        alert("Erro ao apagar: " + error.message);
      } else {
        setSponsors(sponsors.filter(s => s.id !== id));
      }
      setIsDeletingSponsor(false);
      setSponsorToDelete(null);
  };

  const handlePlanSave = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const planData = {
          name: formData.get('name'),
          price_monthly: parseFloat(formData.get('price_monthly') as string),
          limits: {
              championships: parseInt(formData.get('limit_championships') as string),
              teams_per_championship: parseInt(formData.get('limit_teams') as string),
              users: parseInt(formData.get('limit_users') as string),
          },
          description: formData.get('description'),
          active: true
      };

      if (editingPlan) {
          await supabase.from('plans').update(planData).eq('id', editingPlan.id);
      } else {
          await supabase.from('plans').insert(planData);
      }
      setShowPlanModal(false);
      fetchData();
  };

  // --- RENDER ---

  if (loading && !selectedClientId) return <div className="text-white p-10 animate-pulse text-center">Carregando painel administrativo...</div>;

  // --- DETAILED CLIENT VIEW ---
  if (selectedClientId && selectedClientData) {
      const { org, sub, users, championships } = selectedClientData;
      
      // Date Helper for Input Value
      const toInputDate = (isoStr?: string) => isoStr ? isoStr.split('T')[0] : '';

      return (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 relative">
              <button onClick={() => { setSelectedClientId(null); fetchData(); }} className="text-slate-400 hover:text-white flex items-center gap-2 font-bold mb-4">
                  <ArrowLeft size={16}/> Voltar para Lista
              </button>

              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 flex flex-col md:flex-row gap-6 items-start">
                  <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center overflow-hidden border-4 border-slate-600">
                      {org.logo_url ? <img src={org.logo_url} className="w-full h-full object-contain"/> : <Building size={40} className="text-slate-400"/>}
                  </div>
                  <div className="flex-1">
                      <div className="flex justify-between items-start">
                          <div>
                              <h1 className="text-3xl font-black text-white">{org.name}</h1>
                              <p className="text-slate-400 text-sm mt-1">ID: {org.id}</p>
                          </div>
                          <div className={`px-4 py-2 rounded-lg font-black uppercase tracking-wider text-xs border ${sub?.status === 'active' ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/30' : 'bg-red-900/50 text-red-400 border-red-500/30'}`}>
                              {sub?.status || 'Sem Assinatura'}
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                              <span className="text-xs text-slate-500 uppercase font-bold">Plano Atual</span>
                              <div className="text-white font-bold">{sub?.plan?.name || 'Não definido'}</div>
                          </div>
                          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                              <span className="text-xs text-slate-500 uppercase font-bold">Campeonatos</span>
                              <div className="text-white font-bold">{championships.length} / {sub?.plan?.limits?.championships || 0}</div>
                          </div>
                          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                              <span className="text-xs text-slate-500 uppercase font-bold">Vencimento</span>
                              <div className="text-white font-bold">{sub?.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}</div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                  {/* Users Section */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-fit">
                      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                          <h3 className="font-bold text-white flex items-center gap-2"><Users size={18}/> Usuários Vinculados</h3>
                      </div>
                      <div className="divide-y divide-slate-700">
                          {users.map(u => (
                              <div key={u.id} className="p-4 flex items-center justify-between">
                                  <div>
                                      <div className="font-bold text-white">{u.full_name}</div>
                                      <div className="text-xs text-slate-500">{u.email || 'Email oculto'}</div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{u.role}</span>
                                      <button onClick={() => handleUpdateUserStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked')} className={`p-2 rounded hover:bg-slate-700 ${u.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>
                                          {u.status === 'blocked' ? <Lock size={16}/> : <Unlock size={16}/>}
                                      </button>
                                  </div>
                              </div>
                          ))}
                          {users.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum usuário vinculado.</div>}
                      </div>
                  </div>

                  {/* Subscription Edit Section - MANUAL SAVE */}
                  <div className="space-y-6">
                      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                          <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                              <h3 className="font-bold text-white flex items-center gap-2"><CreditCard size={18}/> Editar Assinatura</h3>
                              <button onClick={() => fetchClientDetails(org.id)} title="Recarregar Dados" className="text-slate-400 hover:text-white"><RefreshCw size={16}/></button>
                          </div>
                          <div className="p-6 space-y-4">
                              <div>
                                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Alterar Plano</label>
                                  <select 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                                    value={editSubData.plan_id || ''}
                                    onChange={(e) => setEditSubData({...editSubData, plan_id: e.target.value})}
                                  >
                                      <option value="" disabled>Selecione um plano</option>
                                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} (R$ {p.price_monthly})</option>)}
                                  </select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Data Início</label>
                                      <input 
                                        type="date" 
                                        value={toInputDate(editSubData.start_date)} 
                                        onChange={(e) => setEditSubData({...editSubData, start_date: e.target.value})} 
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Vencimento</label>
                                      <input 
                                        type="date" 
                                        value={toInputDate(editSubData.end_date)} 
                                        onChange={(e) => setEditSubData({...editSubData, end_date: e.target.value})} 
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Status</label>
                                  <select 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                                    value={editSubData.status || 'trial'}
                                    onChange={(e) => setEditSubData({...editSubData, status: e.target.value as any})}
                                  >
                                      <option value="trial">Trial (Teste)</option>
                                      <option value="active">Ativo</option>
                                      <option value="warning">Aviso (Vencendo)</option>
                                      <option value="overdue">Vencido</option>
                                      <option value="blocked">Bloqueado</option>
                                      <option value="canceled">Cancelado</option>
                                  </select>
                              </div>
                              
                              <button 
                                onClick={handleSaveSubscription}
                                disabled={isSavingSub}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
                              >
                                  {isSavingSub ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                                  Salvar Alterações
                              </button>
                          </div>
                      </div>

                      {/* Internal Notes */}
                      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                          <div className="p-4 border-b border-slate-700 bg-slate-900">
                              <h3 className="font-bold text-white flex items-center gap-2"><FileText size={18}/> Notas Internas</h3>
                          </div>
                          <div className="p-4">
                              <textarea 
                                className="w-full h-32 bg-slate-900 border border-slate-600 rounded p-3 text-white text-sm"
                                placeholder="Anotações..."
                                defaultValue={org.notes || ''}
                                onBlur={(e) => handleUpdateOrgNotes(org.id, e.target.value)}
                              ></textarea>
                          </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="border border-red-900/50 rounded-xl p-4 bg-red-900/10">
                          <h3 className="text-red-500 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Zona de Perigo</h3>
                          <button 
                            type="button"
                            onClick={() => openDeleteModal(org.id)}
                            className="w-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white py-2 rounded font-bold transition-colors text-sm flex items-center justify-center gap-2"
                          >
                              <Trash2 size={16}/> Excluir Cliente Permanentemente
                          </button>
                      </div>
                  </div>
              </div>

              {/* --- DELETE CONFIRMATION MODAL --- */}
              {showDeleteModal && (
                  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
                      <div className="bg-slate-800 p-6 rounded-xl border border-red-500 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex flex-col items-center text-center space-y-4">
                              <div className="bg-red-500/20 p-4 rounded-full">
                                  <AlertTriangle size={48} className="text-red-500" />
                              </div>
                              <h3 className="text-xl font-black text-white uppercase">Zona de Perigo</h3>
                              <p className="text-slate-300 text-sm">
                                  Você está prestes a apagar <strong>PERMANENTEMENTE</strong> este cliente.<br/>
                                  Todos os campeonatos, times, jogadores e usuários vinculados serão removidos do banco de dados.
                              </p>
                              <p className="text-red-400 font-bold text-xs uppercase bg-red-900/20 px-3 py-1 rounded">
                                  Esta ação não pode ser desfeita.
                              </p>
                              
                              <div className="w-full">
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-left">
                                      Digite <span className="text-white select-all">DELETAR</span> para confirmar:
                                  </label>
                                  <input 
                                      type="text" 
                                      autoFocus
                                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none text-center font-bold tracking-widest"
                                      placeholder="DELETAR"
                                      value={deleteConfirmationText}
                                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                  />
                              </div>

                              <div className="flex gap-3 w-full pt-2">
                                  <button 
                                      onClick={() => setShowDeleteModal(false)}
                                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                                  >
                                      Cancelar
                                  </button>
                                  <button 
                                      onClick={executeDeleteClient}
                                      disabled={deleteConfirmationText !== 'DELETAR' || isDeletingClient}
                                      className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                                  >
                                      {isDeletingClient ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>}
                                      Excluir
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- MAIN DASHBOARD (List View) ---
  return (
    <div className="space-y-6">
      {/* ... (Previous code remains the same for List View) ... */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Shield className="text-emerald-500" /> Painel Super Admin
          </h1>
          <div className="bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded text-xs font-mono border border-emerald-500/30">
              Modo SaaS Ativo
          </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 p-1 rounded-lg w-full overflow-x-auto scrollbar-hide">
          {[
              {id: 'dashboard', icon: Activity, label: 'Dashboard'},
              {id: 'clients', icon: Building, label: 'Clientes & Assinaturas'},
              {id: 'users', icon: Users, label: 'Usuários'},
              {id: 'plans', icon: CreditCard, label: 'Planos'},
              {id: 'sponsors', icon: AlertTriangle, label: 'Patrocinadores'},
              {id: 'audit', icon: Clock, label: 'Auditoria'}
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[120px] py-3 text-xs md:text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                  <tab.icon size={16}/> {tab.label}
              </button>
          ))}
      </div>

      {/* ... DASHBOARD STATS ... */}
      {activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Clientes (Ligas)</h3>
                  <div className="text-3xl font-black text-white mt-2">{stats.clients}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Usuários Totais</h3>
                  <div className="text-3xl font-black text-white mt-2">{stats.users}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Campeonatos</h3>
                  <div className="text-3xl font-black text-white mt-2">{stats.championships}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">MRR Estimado</h3>
                  <div className="text-3xl font-black text-emerald-400 mt-2">R$ --</div>
              </div>
          </div>
      )}

      {/* --- CLIENTS LIST --- */}
      {activeTab === 'clients' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-bold text-white">Gestão de Clientes</h2>
                  <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1">
                          <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                          <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm w-full focus:border-emerald-500 outline-none"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                          />
                      </div>
                      <button onClick={() => setShowClientModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap hover:bg-emerald-500 transition-colors">
                          <Plus size={16}/> Novo Cliente
                      </button>
                  </div>
              </div>
              
              <div className="space-y-4">
                  {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(client => {
                      const sub = (client as any).subscription;
                      const statusColor = sub?.status === 'active' ? 'text-emerald-400' : sub?.status === 'overdue' ? 'text-red-400' : 'text-yellow-400';
                      
                      return (
                          <div key={client.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 hover:border-slate-500 transition-colors">
                              <div className="flex items-center gap-4 flex-1 w-full">
                                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                      {client.logo_url ? <img src={client.logo_url} className="w-full h-full object-contain"/> : <Building className="text-slate-800"/>}
                                  </div>
                                  <div className="min-w-0">
                                      <h3 className="font-bold text-white truncate">{client.name}</h3>
                                      <div className="text-xs text-slate-400 flex flex-wrap gap-2 items-center">
                                          <span className={`uppercase font-bold ${statusColor}`}>{sub?.status || 'Sem Plano'}</span> •
                                          <span>{sub?.plan?.name || 'N/A'}</span>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 w-full md:w-auto justify-between">
                                  <div className="text-center">
                                      <div className="text-[10px] text-slate-500 uppercase">Campeonatos</div>
                                      <div className="font-bold text-white text-sm">-- / {sub?.plan?.limits?.championships || 0}</div>
                                  </div>
                                  <div className="w-px h-8 bg-slate-700"></div>
                                  <div className="text-center">
                                      <div className="text-[10px] text-slate-500 uppercase">Vencimento</div>
                                      <div className="font-bold text-white text-sm">{sub?.end_date ? new Date(sub.end_date).toLocaleDateString() : '-'}</div>
                                  </div>
                              </div>

                              <button 
                                onClick={() => setSelectedClientId(client.id)}
                                className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                              >
                                  <Edit size={16}/> Gerenciar
                              </button>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* ... OTHER TABS ... */}
      {activeTab === 'users' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-in fade-in">
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-700 text-xs uppercase text-slate-300">
                          <tr>
                              <th className="p-4">Usuário</th>
                              <th className="p-4">Role</th>
                              <th className="p-4">Status</th>
                              <th className="p-4">Data Cadastro</th>
                              <th className="p-4">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-slate-700/50">
                                  <td className="p-4">
                                      <div className="font-bold text-white">{u.full_name}</div>
                                      <div className="text-xs text-slate-500">{u.email || 'Email oculto'}</div>
                                  </td>
                                  <td className="p-4"><span className="bg-slate-900 px-2 py-1 rounded text-xs text-slate-300 border border-slate-600">{u.role}</span></td>
                                  <td className="p-4">
                                      <span className={`text-xs font-bold uppercase ${u.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>
                                          {u.status || 'active'}
                                      </span>
                                  </td>
                                  <td className="p-4 text-xs text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                                  <td className="p-4 flex gap-2">
                                      {u.status === 'blocked' ? (
                                          <button onClick={() => handleUpdateUserStatus(u.id, 'active')} className="text-emerald-500 hover:underline text-xs font-bold">Desbloquear</button>
                                      ) : (
                                          <button onClick={() => handleUpdateUserStatus(u.id, 'blocked')} className="text-red-500 hover:underline text-xs font-bold">Bloquear</button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'plans' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">Catálogo de Planos</h2>
                  <button onClick={() => { setEditingPlan(null); setShowPlanModal(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-sm flex gap-2"><Plus size={16}/> Criar Plano</button>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                  {plans.map(plan => (
                      <div key={plan.id} className={`bg-slate-800 p-6 rounded-2xl border ${plan.active ? 'border-emerald-500/30' : 'border-slate-700 opacity-70'}`}>
                          <div className="flex justify-between items-start mb-4">
                              <h3 className="text-xl font-black text-white">{plan.name}</h3>
                              <span className="text-lg font-bold text-emerald-400">R$ {plan.price_monthly}</span>
                          </div>
                          <p className="text-sm text-slate-400 mb-6 min-h-[40px]">{plan.description}</p>
                          <ul className="space-y-2 text-sm text-slate-300 mb-6">
                              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> {plan.limits.championships} Campeonatos</li>
                              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> {plan.limits.teams_per_championship} Times/Camp.</li>
                              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> {plan.limits.users} Usuários Admin</li>
                          </ul>
                          <button onClick={() => { setEditingPlan(plan); setShowPlanModal(true); }} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded font-bold transition-colors">Editar</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'sponsors' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                   <h2 className="text-xl font-bold text-white">Patrocinadores Globais</h2>
                   <button onClick={() => setShowSponsorModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold text-sm flex gap-2"><Plus size={16}/> Adicionar Novo</button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                  {sponsors.map(s => (
                      <div key={s.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 relative group">
                          <button onClick={() => setSponsorToDelete(s)} className="absolute top-3 right-3 text-slate-500 hover:text-red-500"><Trash2 size={16}/></button>
                          
                          <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2">
                                  <img src={s.logo_url} className="max-w-full max-h-full object-contain"/>
                              </div>
                              <div>
                                  <div className="font-bold text-white text-lg">{s.name}</div>
                                  <div className="text-xs text-emerald-500 uppercase font-bold">{s.quota}</div>
                              </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                              {s.display_locations && s.display_locations.map(loc => {
                                  const label = SPONSOR_LOCATIONS.find(l => l.id === loc)?.label || loc;
                                  return <span key={loc} className="bg-slate-900 text-slate-400 text-[10px] px-2 py-1 rounded border border-slate-700">{label}</span>
                              })}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- AUDIT --- */}
      {activeTab === 'audit' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-in fade-in">
              <div className="p-4 bg-slate-900 border-b border-slate-700">
                  <h3 className="font-bold text-white">Log de Ações Administrativas</h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-700">
                  {logs.map(log => (
                      <div key={log.id} className="p-4 text-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                              <span className="font-bold text-emerald-400">[{log.action_type}]</span> <span className="text-slate-300">{log.description}</span>
                              <div className="text-xs text-slate-500 mt-1">Por: {log.admin_profile?.full_name || 'Admin'}</div>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{new Date(log.created_at).toLocaleString()}</div>
                      </div>
                  ))}
                  {logs.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum registro encontrado.</div>}
              </div>
          </div>
      )}

      <DeleteConfirmationModal
        isOpen={!!sponsorToDelete}
        onClose={() => setSponsorToDelete(null)}
        onConfirm={() => sponsorToDelete && handleDeleteSponsor(sponsorToDelete.id)}
        isDeleting={isDeletingSponsor}
        title="Apagar Patrocinador"
        message={
            <p>
                Tem certeza que deseja apagar o patrocinador <strong>"{sponsorToDelete?.name}"</strong>?
            </p>
        }
      />
      
      {showClientModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  {/* ... Same content as before ... */}
                  <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
                      <Building size={20} className="text-emerald-500"/> Novo Cliente (Organização)
                  </h3>
                  
                  <form onSubmit={handleCreateClient} className="space-y-6">
                      {/* ... Same fields ... */}
                      <div className="space-y-4">
                          <h4 className="text-sm font-bold text-white uppercase bg-slate-900 p-2 rounded">Dados da Organização</h4>
                          <div className="grid md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Nome da Organização</label>
                                  <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors"
                                    placeholder="Ex: Liga Desportiva de SP"
                                    value={newClientData.name}
                                    onChange={e => setNewClientData({...newClientData, name: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Plano Inicial</label>
                                  <select 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors"
                                    value={newClientData.planId}
                                    onChange={e => setNewClientData({...newClientData, planId: e.target.value})}
                                  >
                                      <option value="">Selecione...</option>
                                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.price_monthly}</option>)}
                                  </select>
                              </div>
                              <div className="flex items-end">
                                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded border border-slate-700 w-full cursor-pointer hover:border-slate-500 transition-colors">
                                      <input 
                                        type="checkbox" 
                                        checked={newClientData.trial}
                                        onChange={e => setNewClientData({...newClientData, trial: e.target.checked})}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-500"
                                      />
                                      <span className="text-sm text-white font-bold">
                                          Período de Teste (14 dias)
                                      </span>
                                  </label>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="text-sm font-bold text-white uppercase bg-slate-900 p-2 rounded flex items-center gap-2">
                              <User size={16} /> Dados do Responsável (Acesso)
                          </h4>
                          <div className="grid md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Nome Completo</label>
                                  <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors"
                                    placeholder="Nome do Administrador da Liga"
                                    value={newClientData.adminName}
                                    onChange={e => setNewClientData({...newClientData, adminName: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Phone size={12}/> Telefone / WhatsApp</label>
                                  <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors"
                                    placeholder="(XX) 99999-9999"
                                    value={newClientData.adminPhone}
                                    onChange={e => setNewClientData({...newClientData, adminPhone: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Mail size={12}/> E-mail de Login</label>
                                  <input 
                                    type="email" 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors"
                                    placeholder="email@cliente.com"
                                    value={newClientData.adminEmail}
                                    onChange={e => setNewClientData({...newClientData, adminEmail: e.target.value})}
                                  />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="text-xs text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Lock size={12}/> Senha Provisória</label>
                                  <input 
                                    type="text" 
                                    required 
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 transition-colors font-mono"
                                    placeholder="Defina uma senha inicial"
                                    value={newClientData.adminPassword}
                                    onChange={e => setNewClientData({...newClientData, adminPassword: e.target.value})}
                                  />
                                  <p className="text-[10px] text-slate-500 mt-1">
                                      * Estes dados serão usados para criar o login do Admin da Liga.
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                          <button type="button" disabled={isCreatingClient} onClick={() => setShowClientModal(false)} className="px-6 py-2 text-slate-400 hover:text-white font-bold transition-colors">Cancelar</button>
                          <button type="submit" disabled={isCreatingClient} className="bg-emerald-600 px-8 py-3 rounded-xl text-white font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 flex items-center gap-2">
                              {isCreatingClient ? <><Loader2 className="animate-spin" size={18}/> Criando...</> : <><Save size={18}/> Criar Cliente</>}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Other Modals (Plan, Sponsor) remain the same as previous step, ensuring showDeleteModal is rendered */}
      {/* ... [Rest of modal rendering code] ... */}
    </div>
  );
};

export default PlatformSettings;
