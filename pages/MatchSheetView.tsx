
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Match, MatchEvent, Player } from '../types';
import { Printer, Download } from 'lucide-react';

const MatchSheetView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
        // Fetch Match & Related Data
        const { data: matchData } = await supabase
            .from('matches')
            .select(`*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), championship:championships(*)`)
            .eq('id', id)
            .single();
        setMatch(matchData as Match);

        // Fetch Events
        const { data: eventData } = await supabase
            .from('match_events')
            .select(`*, team:teams(name, short_name), player:players(name, number)`)
            .eq('match_id', id)
            .order('minute', { ascending: true });
        setEvents(eventData as any[]);

        // Fetch Players for Lineups
        if (matchData) {
            if (matchData.home_team_id) {
                const { data: hp } = await supabase.from('players').select('*').eq('team_id', matchData.home_team_id).order('number', { ascending: true });
                setHomePlayers(hp as Player[] || []);
            }
            if (matchData.away_team_id) {
                const { data: ap } = await supabase.from('players').select('*').eq('team_id', matchData.away_team_id).order('number', { ascending: true });
                setAwayPlayers(ap as Player[] || []);
            }
        }
    };
    fetchData();
  }, [id]);

  if (!match) return <div className="text-white p-8">Carregando Súmula...</div>;

  const getStageName = (m: Match) => {
      if (m.stage === 'group_stage') return `Rodada ${m.round_number}`;
      if (m.stage === 'round_16') return 'Oitavas de Final';
      if (m.stage === 'quarter_finals') return 'Quartas de Final';
      if (m.stage === 'semi_finals') return 'Semifinal';
      if (m.stage === 'final') return 'Final';
      return m.stage || 'Fase Única';
  };

  const formatDate = (dateStr?: string | null) => {
      if (!dateStr) return 'Data não definida';
      const d = new Date(dateStr);
      return `${d.toLocaleDateString()} às ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const padRows = (players: Player[], minRows: number = 20) => {
      const rows = [...players];
      while (rows.length < minRows) {
          rows.push({ id: `empty-${rows.length}`, name: '', number: 0, position: '', team_id: '' } as any);
      }
      return rows;
  };

  const goals = events.filter(e => e.type === 'gol');
  const cards = events.filter(e => e.type === 'cartao_amarelo' || e.type === 'cartao_vermelho');
  const subs = events.filter(e => e.type === 'substituicao');

  return (
    <div className="bg-slate-900 min-h-screen p-8 print:p-0 print:bg-white flex justify-center">
        {/* Actions Bar */}
        <div className="fixed top-0 left-0 right-0 bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center print:hidden shadow-lg z-50">
            <h1 className="text-white font-bold text-lg">Visualização de Súmula</h1>
            <button 
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
            >
                <Printer size={18}/> Imprimir Súmula Oficial
            </button>
        </div>

        {/* A4 Sheet Container */}
        <div className="bg-white w-[210mm] min-h-[297mm] p-[10mm] shadow-2xl print:shadow-none print:w-full text-black font-sans text-xs relative mt-16 print:mt-0 leading-tight">
            
            {/* Header */}
            <div className="border-b-2 border-black pb-2 mb-2 flex items-center justify-between">
                <div className="w-20 h-20 flex items-center justify-center">
                   {match.championship?.logo_url && <img src={match.championship.logo_url} className="max-w-full max-h-full object-contain" />}
                </div>
                <div className="text-center flex-1 px-4">
                    <h1 className="text-xl font-black uppercase tracking-widest">{match.championship?.name}</h1>
                    <h2 className="text-sm font-bold uppercase text-slate-700 mt-1">{match.championship?.category} • Temporada {match.championship?.season}</h2>
                    <div className="inline-block bg-black text-white px-3 py-1 mt-2 text-xs font-bold uppercase rounded-sm">Súmula Oficial de Jogo</div>
                </div>
                 <div className="w-20 h-20 flex items-center justify-center">
                    {/* Placeholder for Federation Logo or League Logo */}
                    <div className="w-16 h-16 border border-slate-200 rounded-full flex items-center justify-center text-[8px] text-center text-slate-400">
                        USO EXCLUSIVO DA LIGA
                    </div>
                </div>
            </div>

            {/* Match Details */}
            <div className="grid grid-cols-4 gap-0 border border-black mb-4">
                <div className="border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Jogo Nº</div>
                <div className="border-r border-black p-1 text-[10px] flex items-center">{match.id.slice(0, 8).toUpperCase()}</div>
                <div className="border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Fase / Rodada</div>
                <div className="p-1 text-[10px] flex items-center uppercase">{getStageName(match)}</div>
                
                <div className="border-t border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Data / Hora</div>
                <div className="border-t border-r border-black p-1 text-[10px] flex items-center uppercase">{formatDate(match.start_time)}</div>
                <div className="border-t border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Local</div>
                <div className="border-t border-black p-1 text-[10px] flex items-center uppercase">{match.location || 'Não Definido'}</div>

                <div className="border-t border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Grupo</div>
                <div className="border-t border-r border-black p-1 text-[10px] flex items-center uppercase">{match.group?.name || 'Único'}</div>
                <div className="border-t border-r border-black p-1 bg-slate-100 font-bold uppercase text-[9px]">Cidade</div>
                <div className="border-t border-black p-1 text-[10px] flex items-center uppercase">{match.championship?.city}/{match.championship?.state}</div>
            </div>

            {/* Teams & Score */}
            <div className="border border-black mb-4 flex">
                <div className="flex-1 p-2 text-center border-r border-black">
                    <h3 className="font-black text-lg uppercase">{match.home_team?.name}</h3>
                    <div className="text-[9px] mt-1 text-slate-600 font-bold">MANDANTE</div>
                    <div className="text-[9px] mt-1">Uniforme: {match.uniform_home || '______________'}</div>
                </div>
                <div className="w-32 bg-slate-100 flex flex-col items-center justify-center border-r border-black">
                     <div className="text-3xl font-black tracking-widest">{match.home_score} x {match.away_score}</div>
                     {match.status !== 'finished' && <div className="text-[8px] uppercase font-bold text-slate-500">(Em Andamento)</div>}
                </div>
                <div className="flex-1 p-2 text-center">
                    <h3 className="font-black text-lg uppercase">{match.away_team?.name}</h3>
                    <div className="text-[9px] mt-1 text-slate-600 font-bold">VISITANTE</div>
                    <div className="text-[9px] mt-1">Uniforme: {match.uniform_away || '______________'}</div>
                </div>
            </div>

            {/* Arbitration */}
            <div className="mb-4">
                 <h4 className="font-bold uppercase text-[9px] bg-black text-white px-2 py-0.5 mb-1 inline-block">Equipe de Arbitragem</h4>
                 <div className="grid grid-cols-2 border border-black text-[9px]">
                     <div className="flex border-b border-black">
                         <div className="w-24 bg-slate-100 p-1 font-bold border-r border-black">Árbitro</div>
                         <div className="p-1 uppercase flex-1">{match.referee_name}</div>
                     </div>
                     <div className="flex border-b border-l border-black">
                         <div className="w-24 bg-slate-100 p-1 font-bold border-r border-black">Assistente 1</div>
                         <div className="p-1 uppercase flex-1">{match.assistant_referee_1}</div>
                     </div>
                     <div className="flex">
                         <div className="w-24 bg-slate-100 p-1 font-bold border-r border-black">Assistente 2</div>
                         <div className="p-1 uppercase flex-1">{match.assistant_referee_2}</div>
                     </div>
                     <div className="flex border-l border-black">
                         <div className="w-24 bg-slate-100 p-1 font-bold border-r border-black">4º Árbitro/Mes.</div>
                         <div className="p-1 uppercase flex-1">{match.fourth_official}</div>
                     </div>
                 </div>
            </div>

            {/* Lineups */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Home Lineup */}
                <div>
                    <h4 className="font-bold uppercase text-[9px] bg-slate-800 text-white px-2 py-0.5 mb-0.5 text-center">{match.home_team?.name} - Atletas</h4>
                    <table className="w-full border-collapse border border-black text-[9px]">
                        <thead>
                            <tr className="bg-slate-200">
                                <th className="border border-black w-8 py-1">Nº</th>
                                <th className="border border-black py-1 text-left px-2">Nome Completo / Apelido</th>
                                <th className="border border-black w-10 py-1">Doc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {padRows(homePlayers).map((p, idx) => (
                                <tr key={p.id} className="h-5">
                                    <td className="border border-black text-center font-bold">{p.number || ''}</td>
                                    <td className="border border-black px-2 uppercase truncate max-w-[120px]">{p.name}</td>
                                    <td className="border border-black text-center"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     <div className="border border-black border-t-0 p-1 flex text-[9px]">
                        <span className="font-bold mr-2">Técnico:</span> {match.home_team?.coach_name || '_______________________'}
                    </div>
                     <div className="border border-black border-t-0 p-1 flex text-[9px]">
                        <span className="font-bold mr-2">Capitão:</span> ____________________________________
                    </div>
                </div>

                {/* Away Lineup */}
                <div>
                     <h4 className="font-bold uppercase text-[9px] bg-slate-800 text-white px-2 py-0.5 mb-0.5 text-center">{match.away_team?.name} - Atletas</h4>
                     <table className="w-full border-collapse border border-black text-[9px]">
                        <thead>
                            <tr className="bg-slate-200">
                                <th className="border border-black w-8 py-1">Nº</th>
                                <th className="border border-black py-1 text-left px-2">Nome Completo / Apelido</th>
                                <th className="border border-black w-10 py-1">Doc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {padRows(awayPlayers).map((p, idx) => (
                                <tr key={p.id} className="h-5">
                                    <td className="border border-black text-center font-bold">{p.number || ''}</td>
                                    <td className="border border-black px-2 uppercase truncate max-w-[120px]">{p.name}</td>
                                    <td className="border border-black text-center"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     <div className="border border-black border-t-0 p-1 flex text-[9px]">
                        <span className="font-bold mr-2">Técnico:</span> {match.away_team?.coach_name || '_______________________'}
                    </div>
                     <div className="border border-black border-t-0 p-1 flex text-[9px]">
                        <span className="font-bold mr-2">Capitão:</span> ____________________________________
                    </div>
                </div>
            </div>

            {/* Events Tables */}
            <div className="mb-4">
                <h4 className="font-bold uppercase text-[9px] bg-black text-white px-2 py-0.5 mb-1 inline-block">Relatório da Partida (Gols e Cartões)</h4>
                
                <table className="w-full border-collapse border border-black text-[9px] mb-2">
                    <thead>
                        <tr className="bg-slate-200">
                            <th className="border border-black w-10 py-1">Min</th>
                            <th className="border border-black w-12 py-1">1T/2T</th>
                            <th className="border border-black w-24 py-1">Equipe</th>
                            <th className="border border-black w-8 py-1">Nº</th>
                            <th className="border border-black py-1 text-left px-2">Jogador</th>
                            <th className="border border-black w-24 py-1">Tipo de Evento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.length > 0 ? events.map(e => (
                             <tr key={e.id}>
                                <td className="border border-black text-center">{e.minute}'</td>
                                <td className="border border-black text-center">{e.minute <= 45 ? '1T' : '2T'}</td>
                                <td className="border border-black text-center uppercase font-bold text-[8px]">{e.team?.short_name}</td>
                                <td className="border border-black text-center font-bold">{e.player?.number || '-'}</td>
                                <td className="border border-black px-2 uppercase">{e.player?.name || 'Não Identificado'}</td>
                                <td className={`border border-black text-center uppercase font-bold ${e.type === 'gol' ? 'bg-emerald-100' : e.type === 'cartao_vermelho' ? 'bg-red-100' : e.type === 'cartao_amarelo' ? 'bg-yellow-50' : ''}`}>
                                    {e.type.replace('_', ' ')}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={6} className="border border-black p-2 text-center italic text-slate-500">Nenhum evento registrado eletronicamente.</td></tr>
                        )}
                        {/* Empty rows for manual entry */}
                        {[1,2,3].map(i => (
                            <tr key={i} className="h-5">
                                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Observations */}
            <div className="mb-8 break-inside-avoid">
                 <h4 className="font-bold uppercase text-[9px] bg-black text-white px-2 py-0.5 mb-1 inline-block">Observações da Arbitragem</h4>
                 <div className="border border-black min-h-[80px] p-2 text-[10px] uppercase font-mono bg-slate-50 relative">
                     {match.observations || ''}
                     <div className="absolute bottom-1 right-2 text-[8px] text-slate-400">Espaço reservado para relato de ocorrências</div>
                 </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-12 break-inside-avoid">
                <div className="text-center">
                    <div className="border-t border-black pt-1"></div>
                    <div className="font-bold uppercase text-[9px]">Árbitro Principal</div>
                    <div className="text-[8px] text-slate-500">{match.referee_name || 'Assinatura'}</div>
                </div>
                 <div className="text-center">
                    <div className="border-t border-black pt-1"></div>
                    <div className="font-bold uppercase text-[9px]">Capitão {match.home_team?.short_name}</div>
                    <div className="text-[8px] text-slate-500">Assinatura</div>
                </div>
                 <div className="text-center">
                    <div className="border-t border-black pt-1"></div>
                    <div className="font-bold uppercase text-[9px]">Capitão {match.away_team?.short_name}</div>
                    <div className="text-[8px] text-slate-500">Assinatura</div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] text-slate-400 mt-8 pt-2 border-t border-slate-200">
                Documento gerado digitalmente pela plataforma GAMA FUT em {new Date().toLocaleString()}. 
                Este documento possui validade para a organização da competição.
            </div>
        </div>
    </div>
  );
};

export default MatchSheetView;
