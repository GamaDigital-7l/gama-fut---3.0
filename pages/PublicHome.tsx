
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Championship, GlobalSponsor } from '../types';
import { Search, MapPin, Users, ArrowRight, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const PublicHome: React.FC = () => {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [globalSponsors, setGlobalSponsors] = useState<GlobalSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchChampionships = async () => {
      // Fetch active championships with team counts
      const { data, error } = await supabase
        .from('championships')
        .select('*, teams(count)')
        .eq('status', 'publicado') // Only published ones
        .order('created_at', { ascending: false });

      if (data) setChampionships(data as any[]);
      
      // Fetch Home Sponsors
      const { data: sponsors } = await supabase
        .from('global_sponsors')
        .select('*')
        .eq('active', true)
        .order('display_order');
      if (sponsors) setGlobalSponsors(sponsors.filter(s => s.display_locations?.includes('home')));

      setLoading(false);
    };

    fetchChampionships();
  }, []);

  const filteredChampionships = championships.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      // The filter is already reactive
  };

  return (
    <div className="-mt-6 overflow-x-hidden"> {/* Prevent horizontal scroll globally here */}
        
        {/* HERO SECTION */}
        <div className="relative bg-[#022c22] border-b border-slate-800 overflow-hidden">
            {/* Background Pattern/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-[#0f172a] opacity-90"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            
            <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-24 sm:px-6 lg:px-8 text-center">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
                    Transforme a gestão da sua<br/>
                    <span className="text-emerald-400">liga de futebol.</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 px-4">
                    Súmulas profissionais, estatísticas em tempo real e a melhor experiência para organizadores e atletas.
                </p>

                {/* SEARCH BAR - MOBILE OPTIMIZED */}
                <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative w-full px-2 md:px-0 mb-8">
                    <div className="bg-white p-2 rounded-2xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-center gap-2">
                        <div className="flex-1 flex items-center w-full px-2">
                            <Search className="text-slate-400 min-w-[24px]" size={24} />
                            <input 
                                type="text" 
                                placeholder="Busque por cidade, liga ou nome..." 
                                className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 px-3 py-3 text-base md:text-lg outline-none truncate"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl md:rounded-full font-bold transition-all transform hover:scale-105 shadow-md">
                            Buscar
                        </button>
                    </div>
                </form>

                {/* WhatsApp Call to Action */}
                <div className="flex justify-center mt-8">
                    <a 
                        href="https://wa.me/5531999630882" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-emerald-950 font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:-translate-y-1"
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        Organizar meu campeonato
                    </a>
                </div>

                {/* Global Sponsors in Hero */}
                {globalSponsors.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-6 items-center opacity-80 mt-12">
                        {globalSponsors.map(sponsor => (
                            <img key={sponsor.id} src={sponsor.logo_url} alt={sponsor.name} className="h-8 md:h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all" />
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* FEATURED COMPETITIONS */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Competições em Destaque</h2>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-3 gap-6 animate-pulse">
                    {[1,2,3].map(i => <div key={i} className="bg-slate-800 h-64 rounded-2xl"></div>)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredChampionships.map(champ => (
                        <div key={champ.id} className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-emerald-900/20 group flex flex-col h-full">
                            {/* Card Image */}
                            <div className="h-40 bg-slate-800 relative overflow-hidden">
                                {champ.banner_url ? (
                                    <img 
                                        src={champ.banner_url} 
                                        loading="lazy" 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                        alt={`Banner ${champ.name}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                        <Trophy className="text-slate-700" size={48} />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg">
                                        {champ.logo_url ? <img src={champ.logo_url} className="w-full h-full object-contain" loading="lazy" alt="logo"/> : <Trophy size={20} className="text-slate-800"/>}
                                    </div>
                                </div>
                                {champ.category && (
                                    <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full uppercase border border-slate-600">
                                        {champ.category}
                                    </div>
                                )}
                            </div>

                            {/* Card Content */}
                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{champ.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-4 font-medium uppercase tracking-wide">
                                    <MapPin size={14} className="text-emerald-500" /> 
                                    {champ.city ? `${champ.city}, ${champ.state}` : 'Local não definido'}
                                </div>
                                
                                <div className="mt-auto pt-4 border-t border-slate-700/50 flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-500">
                                        <Users size={14} className="inline mr-1" />
                                        {champ.teams?.[0]?.count || 0} Equipes
                                    </div>
                                    <button 
                                        onClick={() => navigate(`/championship/${champ.id}`)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                                    >
                                        Acessar <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredChampionships.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-800/50 rounded-3xl border border-dashed border-slate-700">
                            <Trophy className="mx-auto text-slate-600 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-white">Nenhum campeonato encontrado</h3>
                            <p className="text-slate-400">Tente buscar por outro nome ou cidade.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default PublicHome;
