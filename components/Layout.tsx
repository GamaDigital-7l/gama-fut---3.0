import React, { useEffect, useState } from 'react';
import { UserProfile, GlobalSponsor } from '../types';
import { LogOut, LayoutDashboard, Trophy, MonitorPlay, User, Settings, Home, LogIn } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  userProfile: UserProfile | null;
}

const Layout: React.FC<LayoutProps> = ({ children, userProfile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [globalSponsors, setGlobalSponsors] = useState<GlobalSponsor[]>([]);

  useEffect(() => {
    const fetchGlobalSponsors = async () => {
      // Fetch only sponsors marked for global display (e.g. footer)
      // Note: 'footer' location logic is mainly visual here or handled by display_locations check
      const { data } = await supabase.from('global_sponsors').select('*').eq('active', true).order('display_order');
      if (data) setGlobalSponsors(data.filter(s => s.display_locations?.includes('footer')));
    };
    fetchGlobalSponsors();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
    window.location.reload();
  };

  const isActive = (path: string) => location.pathname === path ? "text-emerald-500 bg-slate-800" : "text-slate-400 hover:text-white";

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col w-full overflow-x-hidden relative">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-700 bg-slate-800 sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center flex-shrink-0">
                <img src="/logo-gama.svg" alt="GAMA FUT Logo" className="h-8 w-auto"/>
              </Link>
              
              {/* Desktop Nav Links */}
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link to="/" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                    Home
                  </Link>
                  {userProfile && (
                    <Link to="/dashboard" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                      Dashboard
                    </Link>
                  )}
                  {userProfile?.role === 'super_admin' && (
                    <Link to="/settings" className={`px-3 py-2 rounded-md text-sm font-medium ${location.pathname === '/settings' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                      Configurações
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile & Desktop Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              
              {/* Mobile Icons (Always Visible on small screens) */}
              <div className="md:hidden flex items-center gap-1">
                  <Link to="/" className={`p-2 rounded-lg ${isActive('/')}`} title="Home Público">
                      <Home size={20}/>
                  </Link>
                  {userProfile ? (
                      <Link to="/dashboard" className={`p-2 rounded-lg ${isActive('/dashboard')}`} title="Painel">
                          {userProfile.role === 'mesario' ? <MonitorPlay size={20}/> : <LayoutDashboard size={20}/>}
                      </Link>
                  ) : (
                      <Link to="/login" className={`p-2 rounded-lg ${isActive('/login')}`} title="Login">
                          <LogIn size={20}/>
                      </Link>
                  )}
              </div>

              {/* User Profile & Logout */}
              {userProfile ? (
                <div className="flex items-center gap-2 pl-2 md:pl-0 border-l md:border-none border-slate-700">
                  <span className="hidden md:block text-sm text-slate-300 text-right leading-tight">
                    <div className="font-bold">{userProfile.full_name}</div>
                    <div className="text-[10px] uppercase text-emerald-500">{userProfile.role}</div>
                  </span>
                  
                  {userProfile.role === 'super_admin' && (
                    <Link to="/settings" className="p-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors md:hidden" title="Configurações">
                      <Settings size={18} />
                    </Link>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-slate-700 text-slate-300 hover:text-white hover:bg-red-900 transition-colors"
                    title="Sair"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="hidden md:block">
                    <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
                    Login
                    </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
        {children}
      </main>

      {/* Global Sponsors Footer Area */}
      {globalSponsors.length > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 py-6">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Parceiros Oficiais</h3>
            <div className="flex flex-wrap justify-center gap-8 items-center">
              {globalSponsors.map(sponsor => (
                <a 
                  key={sponsor.id} 
                  href={sponsor.link_url || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100"
                >
                  <img src={sponsor.logo_url} alt={sponsor.name} className="h-10 md:h-12 w-auto object-contain" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Credits Footer */}
      <div className="bg-slate-950 py-3 text-center border-t border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-medium">
              Desenvolvido por <span className="text-emerald-500/70">Gama Creative Design</span>
          </p>
      </div>
    </div>
  );
};

export default Layout;