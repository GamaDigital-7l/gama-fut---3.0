
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { UserProfile } from './types';
import Layout from './components/Layout';
import PublicHome from './pages/PublicHome';
import PublicChampionship from './pages/PublicChampionship';
import PublicTeamDetails from './pages/PublicTeamDetails'; // Nova Importação
import Login from './pages/Login';
import OrganizerDashboard from './pages/OrganizerDashboard';
import LeagueDashboard from './pages/LeagueDashboard';
import MesarioMatchControl from './pages/MesarioMatchControl';
import TechnicianDashboard from './pages/TechnicianDashboard';
import MatchSheetView from './pages/MatchSheetView';
import PlatformSettings from './pages/PlatformSettings';
import DatabaseSetup from './components/DatabaseSetup';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: string[];
  userProfile: UserProfile | null;
}

const ProtectedRoute = ({ allowedRoles, children, userProfile }: React.PropsWithChildren<ProtectedRouteProps>) => {
    if (!userProfile) return <Navigate to="/login" />;
    if (!allowedRoles.includes(userProfile.role)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <ShieldAlert size={64} className="text-red-500 mb-4"/>
                <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
                <p className="text-slate-400 mt-2">Seu perfil atual é: <strong className="text-white uppercase">{userProfile.role}</strong></p>
                <p className="text-slate-400">Esta página exige permissões especiais.</p>
                {userProfile.role === 'torcedor' && (
                    <div className="mt-6 bg-slate-800 p-4 rounded-lg border border-slate-700 text-sm text-left max-w-md">
                        <p className="font-bold text-yellow-500 mb-2">DICA:</p>
                        <p className="text-slate-300">Se você deveria ser Admin, vá em <strong>/setup</strong> e use a aba <strong>"Corrigir Admin"</strong>.</p>
                    </div>
                )}
            </div>
        );
    }
    return <>{children}</>;
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para verificação do banco
  const [isDbReady, setIsDbReady] = useState(true);
  const [dbError, setDbError] = useState<string | undefined>(undefined);

  useEffect(() => {
    checkDatabaseAndAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user.email);
      else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkDatabaseAndAuth = async () => {
    setLoading(true);
    
    // VERIFICAÇÃO 1: Tabela 'plans' e coluna 'price_monthly'
    // Se esta tabela ou coluna não existir, o setup não foi rodado corretamente.
    const { error: plansError } = await supabase.from('plans').select('price_monthly').limit(1);
    
    if (plansError) {
        console.error("Database plans check failed:", JSON.stringify(plansError));
        setIsDbReady(false);
        setDbError("Tabela 'Plans' desatualizada ou inexistente. Execute o SETUP.");
        setLoading(false);
        return;
    }

    // VERIFICAÇÃO 2: Tabela 'sponsors' (para garantir que a última versão do script rodou)
    const { error: sponsorsError } = await supabase.from('sponsors').select('id').limit(1);
    if (sponsorsError) {
        console.error("Database sponsors check failed:", JSON.stringify(sponsorsError));
        setIsDbReady(false);
        setDbError("Tabela de Patrocinadores (sponsors) ausente ou erro de permissão. Execute o SETUP para corrigir tabelas e buckets.");
        setLoading(false);
        return;
    }

    setIsDbReady(true);

    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    if (session) {
        await fetchProfile(session.user.id, session.user.email);
    }
    
    setLoading(false);
  };

  const fetchProfile = async (userId: string, email?: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
         if (email === 'gustavogama099@gmail.com') {
             console.warn("Admin profile missing. Triggering setup.");
             setDbError("Conta Admin detectada (gustavogama099@gmail.com), mas sem perfil no banco. Por favor, rode o script de SETUP para sincronizar e liberar acesso.");
             setIsDbReady(false);
             return;
         }

         console.warn("User has no profile, setting as default Torcedor.");
         setUserProfile({
            id: userId,
            organization_id: '00000000-0000-0000-0000-000000000000',
            full_name: email?.split('@')[0] || 'Novo Usuário',
            role: 'torcedor',
            avatar_url: '',
            email: email
         });
         return;
      }

      console.error("Error fetching profile:", error);
      
      if (error.code === '42P01' || error.code === '42703' || error.code === '22P02' || error.code === 'PGRST205') {
          setDbError(`Erro Crítico no Perfil (${error.code}): ${error.message}`);
          setIsDbReady(false);
          return;
      }
    } else {
      setUserProfile({ ...data, email: email } as UserProfile);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-500 font-bold text-xl animate-pulse">Iniciando GAMA FUT...</div>;
  }

  if (!isDbReady) {
      return <DatabaseSetup onRetry={() => window.location.reload()} errorDetail={dbError} />;
  }

  const getDashboardComponent = () => {
    if (!userProfile) return <Navigate to="/login" />;
    
    switch (userProfile.role) {
      case 'organizer_admin':
      case 'super_admin':
        return <LeagueDashboard orgId={userProfile.organization_id} />;
      case 'mesario':
        return <MesarioMatchControl orgId={userProfile.organization_id} />;
      case 'tecnico':
        return <TechnicianDashboard userProfile={userProfile} />;
      default:
        // Fallback melhorado para Torcedor Logado
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-md text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Área do Torcedor</h2>
                    <p className="text-slate-400 mb-6">Você está logado como torcedor. Acesse os campeonatos públicos para ver tabelas e jogos.</p>
                    <a href="/" className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold block">Ver Campeonatos</a>
                </div>
            </div>
        );
    }
  };

  return (
    <Router>
      <Layout userProfile={userProfile}>
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<PublicHome />} />
          
          {/* Public Views */}
          <Route path="/championship/:id" element={<PublicChampionship />} />
          <Route path="/team/:id" element={<PublicTeamDetails />} /> {/* Rota Nova */}

          <Route path="/setup" element={<DatabaseSetup onRetry={() => window.location.href = '/'} />} />
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
          
          {/* Rota Principal do Dashboard (redireciona com base no cargo) */}
          <Route path="/dashboard" element={getDashboardComponent()} />

          {/* Settings Route */}
          <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['super_admin']} userProfile={userProfile}>
                  <PlatformSettings />
              </ProtectedRoute>
          } />
          
          {/* Rotas Específicas de Gestão */}
          {userProfile && (
               <Route path="/dashboard/championship/:id" element={
                   <ProtectedRoute allowedRoles={['super_admin', 'organizer_admin']} userProfile={userProfile}>
                       <OrganizerDashboard orgId={userProfile.organization_id} />
                   </ProtectedRoute>
               } />
          )}

          {/* Rota de Mesário (Acessível também por Admins agora) */}
          {userProfile && (
              <Route path="/dashboard/live" element={
                  <ProtectedRoute allowedRoles={['super_admin', 'organizer_admin', 'mesario']} userProfile={userProfile}>
                      <MesarioMatchControl orgId={userProfile.organization_id} />
                  </ProtectedRoute>
              } />
          )}

          <Route path="/match/:id/sheet" element={<MatchSheetView />} />

          {/* Catch-all: Redireciona qualquer rota desconhecida para Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
