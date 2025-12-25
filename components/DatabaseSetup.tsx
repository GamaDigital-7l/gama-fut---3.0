
import React, { useState, useRef } from 'react';
import { Clipboard, Check, Database, RefreshCw, ShieldAlert, KeyRound, Eraser, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { SQL_SETUP_SCRIPT, SQL_FIX_ADMIN_SCRIPT, SQL_FIX_CASCADE_SCRIPT, SQL_UPDATE_WO_VENUES_SCRIPT, SQL_PERFORMANCE_SCRIPT, SQL_RLS_FIX_SCRIPT } from '../sqlSchema';

interface DatabaseSetupProps {
  onRetry: () => void;
  errorDetail?: string;
}

const DatabaseSetup: React.FC<DatabaseSetupProps> = ({ onRetry, errorDetail }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'fix' | 'cascade' | 'features' | 'performance' | 'rls'>('setup');
  const [copied, setCopied] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const getScript = () => {
      switch(activeTab) {
          case 'setup': return SQL_SETUP_SCRIPT;
          case 'fix': return SQL_FIX_ADMIN_SCRIPT;
          case 'cascade': return SQL_FIX_CASCADE_SCRIPT;
          case 'features': return SQL_UPDATE_WO_VENUES_SCRIPT;
          case 'performance': return SQL_PERFORMANCE_SCRIPT;
          case 'rls': return SQL_RLS_FIX_SCRIPT;
          default: return SQL_SETUP_SCRIPT;
      }
  };

  const handleCopy = () => {
    const cleanScript = getScript().trim();
    navigator.clipboard.writeText(cleanScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    if (textAreaRef.current) {
        textAreaRef.current.select();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#0f172a] p-6 border-b border-slate-800 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${activeTab === 'setup' ? 'bg-emerald-500/20 text-emerald-500' : activeTab === 'rls' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-700/50 text-slate-400'}`}>
                {activeTab === 'setup' ? <Database size={24} /> : activeTab === 'rls' ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
            </div>
            <div>
                <h1 className="text-xl font-bold text-white">Configuração do Sistema</h1>
                <p className="text-slate-400 text-sm">
                   {activeTab === 'setup' 
                     ? 'Execute o script para criar as tabelas necessárias.' 
                     : activeTab === 'rls' ? 'Corrija problemas de acesso público (RLS Policies).'
                     : 'Selecione uma ferramenta de manutenção.'}
                </p>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-lg flex-wrap">
              <button onClick={() => setActiveTab('setup')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'setup' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Instalação</button>
              <button onClick={() => setActiveTab('features')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'features' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Sparkles size={14} /> Recursos</button>
              <button onClick={() => setActiveTab('performance')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'performance' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Zap size={14} /> Performance</button>
              <button onClick={() => setActiveTab('rls')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'rls' ? 'bg-yellow-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><ShieldCheck size={14} /> Reparar RLS</button>
              <button onClick={() => setActiveTab('fix')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'fix' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><KeyRound size={14} /> Admin</button>
              <button onClick={() => setActiveTab('cascade')} className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'cascade' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Eraser size={14} /> Cascade</button>
          </div>
        </div>

        {errorDetail && (
            <div className="bg-red-900/30 px-6 py-2 border-b border-red-900/50 text-[10px] font-mono text-red-300 break-all max-h-20 overflow-y-auto">
                DIAGNÓSTICO: {errorDetail}
            </div>
        )}

        {/* Action Bar */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
             <div className="flex flex-col">
                 <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                     {activeTab === 'setup' ? 'SQL: Instalação Completa' : activeTab === 'rls' ? 'SQL: Liberar Acesso Público (RLS)' : 'SQL: Manutenção'}
                 </span>
                 <span className="text-[10px] text-slate-500">Copie e execute no Supabase SQL Editor.</span>
             </div>
             <button 
                onClick={handleCopy}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-slate-200'}`}
             >
                {copied ? <Check size={16}/> : <Clipboard size={16}/>}
                {copied ? 'Copiado!' : 'Copiar SQL'}
             </button>
        </div>

        {/* Script Area */}
        <div className="flex-1 relative bg-[#0f172a]">
             <textarea 
                ref={textAreaRef}
                readOnly
                className="absolute inset-0 w-full h-full bg-transparent text-emerald-400 font-mono text-xs p-6 resize-none outline-none border-none selection:bg-emerald-500/30"
                value={getScript()}
                spellCheck={false}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
             />
        </div>

        {/* Footer */}
        <div className="bg-slate-800 p-4 border-t border-slate-700 shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-400">
                1. Clique no botão <strong>COPIAR SQL</strong>.<br/>
                2. Vá para o <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" className="text-blue-400 hover:underline font-bold">Supabase SQL Editor</a>.<br/>
                3. Cole e clique em <strong>RUN</strong>.<br/>
                4. Volte aqui e clique em Verificar.
            </div>
            <button 
                onClick={onRetry}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
            >
                <RefreshCw size={18} /> Verificar e Entrar
            </button>
        </div>

      </div>
    </div>
  );
};

export default DatabaseSetup;
