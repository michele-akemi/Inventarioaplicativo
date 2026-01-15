
import React, { useState, useMemo, useEffect } from 'react';
import { UserRole, InventorySession, CountLog, UnknownBarcode, Product, LocationState } from './types';
import SupervisorDashboard from './components/SupervisorDashboard';
import OperatorPanel from './components/OperatorPanel';
import InventoryList from './components/InventoryList';
import { LogOut, PackageSearch, ChevronLeft, User, ShieldCheck, Users, Database, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE WITH PERSISTENCE INITIALIZATION ---
  
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string, role: UserRole } | null>(() => {
    const saved = localStorage.getItem('inv_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [sessions, setSessions] = useState<InventorySession[]>(() => {
    const saved = localStorage.getItem('inv_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('inv_active_session');
  });
  
  const [countLogs, setCountLogs] = useState<CountLog[]>(() => {
    const saved = localStorage.getItem('inv_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [unknownBarcodes, setUnknownBarcodes] = useState<UnknownBarcode[]>(() => {
    const saved = localStorage.getItem('inv_unknowns');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Login Flow State
  const [showOperatorLogin, setShowOperatorLogin] = useState(false);
  const [operatorName, setOperatorName] = useState('');

  // --- PERSISTENCE EFFECTS ---

  useEffect(() => {
    localStorage.setItem('inv_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('inv_logs', JSON.stringify(countLogs));
  }, [countLogs]);

  useEffect(() => {
    localStorage.setItem('inv_unknowns', JSON.stringify(unknownBarcodes));
  }, [unknownBarcodes]);

  useEffect(() => {
    if (currentUser) localStorage.setItem('inv_user', JSON.stringify(currentUser));
    else localStorage.removeItem('inv_user');
  }, [currentUser]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('inv_active_session', activeSessionId);
    else localStorage.removeItem('inv_active_session');
  }, [activeSessionId]);

  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId) || null
  , [sessions, activeSessionId]);

  const handleLogin = (id: string, name: string, role: UserRole) => {
    setCurrentUser({ id, name, role });
    setOperatorName('');
    setShowOperatorLogin(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveSessionId(null);
  };

  const createSession = (name: string) => {
    const newSession: InventorySession = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      createdAt: new Date().toISOString(),
      status: 'active',
      products: [],
      movements: [],
      locations: []
    };
    setSessions(prev => [...prev, newSession]);
  };

  // --- DEMO DATA LOADER ---
  const loadDemoData = () => {
    if (!window.confirm("Isso criará uma sessão de demonstração com produtos e locais fictícios. Continuar?")) return;

    const demoSessionId = 'DEMO-' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const demoProducts: Product[] = [
      { sku: '1001', description: 'REFRIGERANTE COLA 2L', barcodes: ['7891000100100'], initialBalance: 120, location: 'A-01-01' },
      { sku: '1002', description: 'SABAO EM PO 1KG', barcodes: ['7891000100200'], initialBalance: 50, location: 'A-01-02' },
      { sku: '1003', description: 'BISCOITO RECHEADO MORANGO', barcodes: ['7891000100300'], initialBalance: 200, location: 'B-05-01' },
      { sku: '1004', description: 'LEITE INTEGRAL 1L', barcodes: ['7891000100400'], initialBalance: 60, location: 'A-02-01' },
      { sku: '1005', description: 'ARROZ BRANCO 5KG', barcodes: ['7891000100500'], initialBalance: 100, location: 'P-01' },
    ];

    const demoLocations: LocationState[] = [
      { id: 'L1', name: 'A-01-01', status: 'idle' },
      { id: 'L2', name: 'A-01-02', status: 'idle' },
      { id: 'L3', name: 'B-05-01', status: 'idle' },
      { id: 'L4', name: 'A-02-01', status: 'finished', assignedOperatorId: 'OP-DEMO', finishedAt: now }, // Já finalizado para teste
      { id: 'L5', name: 'P-01', status: 'idle' },
      { id: 'L6', name: 'RECEBIMENTO', status: 'idle' }
    ];

    // Simular alguns logs já existentes para o local finalizado
    const demoLogs: CountLog[] = [
       { id: 'log1', sessionId: demoSessionId, sku: '1004', location: 'A-02-01', quantity: 55, operatorId: 'OP-DEMO', timestamp: now, type: 'scan', status: 'approved' },
       // Divergência simulada: Esperado 60, Contado 55 (Falta de 5)
    ];

    const newSession: InventorySession = {
      id: demoSessionId,
      name: 'Demonstração Varejo',
      createdAt: now,
      status: 'active',
      products: demoProducts,
      movements: [],
      locations: demoLocations
    };

    setSessions(prev => [...prev, newSession]);
    setCountLogs(prev => [...prev, ...demoLogs]);
    alert("Dados de demonstração carregados! Use os códigos EAN (ex: 7891000100100) ou SKUs (1001) para testar.");
  };

  const handleResetData = () => {
    if (window.confirm("ATENÇÃO: Isso apagará TODOS os dados, logs e sessões do navegador. Deseja prosseguir?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const updateSession = (updatedSession: InventorySession | ((prev: InventorySession) => InventorySession)) => {
    setSessions(prev => prev.map(s => {
      if (typeof updatedSession === 'function') {
        return s.id === activeSessionId ? updatedSession(s) : s;
      }
      return s.id === updatedSession.id ? updatedSession : s;
    }));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 right-0 w-80 h-80 bg-indigo-400 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md border border-slate-200 relative z-10 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl shadow-slate-300">
              <PackageSearch size={40} />
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-center text-slate-800 mb-2 tracking-tight">InventoryMaster</h1>
          <p className="text-center text-slate-400 mb-8 font-medium text-sm uppercase tracking-widest">Controle de Estoque Profissional</p>
          
          {!showOperatorLogin ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => handleLogin('SUP001', 'Supervisor Master', UserRole.SUPERVISOR)}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                <ShieldCheck size={20} /> Entrar como Supervisor
              </button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Acesso Operacional</span></div>
              </div>

              <button
                onClick={() => setShowOperatorLogin(true)}
                className="w-full bg-white hover:bg-blue-50 text-blue-600 border-2 border-blue-100 hover:border-blue-200 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                <Users size={20} className="group-hover:scale-110 transition-transform"/> Entrar como Operador
              </button>
            </div>
          ) : (
             <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                <div className="text-center mb-4">
                   <h3 className="text-lg font-black text-slate-800">Login de Operador</h3>
                   <p className="text-xs text-slate-400">Identifique-se para iniciar a contagem</p>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Nome / Identificação</label>
                   <div className="relative">
                     <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                     <input 
                        autoFocus
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                        placeholder="Ex: João Silva"
                        value={operatorName}
                        onChange={e => setOperatorName(e.target.value)}
                        onKeyDown={e => {
                           if(e.key === 'Enter' && operatorName.trim()) {
                              const id = 'OP-' + operatorName.trim().toUpperCase().replace(/\s/g, '').slice(0,4) + Math.floor(Math.random() * 100);
                              handleLogin(id, operatorName.trim(), UserRole.OPERATOR);
                           }
                        }}
                     />
                   </div>
                </div>

                <button
                  onClick={() => {
                     if(operatorName.trim()) {
                        const id = 'OP-' + operatorName.trim().toUpperCase().replace(/\s/g, '').slice(0,4) + Math.floor(Math.random() * 100);
                        handleLogin(id, operatorName.trim(), UserRole.OPERATOR);
                     }
                  }}
                  disabled={!operatorName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95"
                >
                  Confirmar Acesso <ChevronLeft size={16} className="rotate-180"/>
                </button>
                <button
                  onClick={() => setShowOperatorLogin(false)}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold py-2 text-sm"
                >
                  Voltar
                </button>
             </div>
          )}
          
          {sessions.length > 0 && (
             <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 mb-2">Dados salvos no navegador</p>
                <button onClick={handleResetData} className="text-[10px] uppercase font-black text-red-400 hover:text-red-600 flex items-center justify-center gap-1 mx-auto">
                   <Trash2 size={12}/> Limpar Dados
                </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          {activeSessionId && (
            <button 
              onClick={() => setActiveSessionId(null)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="bg-slate-900 p-2 rounded-lg text-white shadow-md">
            <PackageSearch size={24} />
          </div>
          <div className="hidden sm:block">
            <h2 className="font-black text-slate-800 leading-tight">InventoryMaster Pro</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
               {currentUser.role === UserRole.SUPERVISOR ? <ShieldCheck size={10}/> : <User size={10}/>}
               {currentUser.role} • {currentUser.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {activeSession && (
            <div className="bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 hidden md:block">
              <span className="text-xs font-black text-blue-700 uppercase tracking-wide">Sessão: {activeSession.name}</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {!activeSessionId ? (
          <div className="flex flex-col h-full">
              <InventoryList 
                sessions={sessions} 
                onSelect={setActiveSessionId} 
                onCreate={createSession}
                role={currentUser.role}
              />
              <div className="p-6 text-center">
                  <button 
                    onClick={loadDemoData}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
                  >
                     <Database size={14}/> Carregar Dados de Demo (Teste Rápido)
                  </button>
              </div>
          </div>
        ) : (
          currentUser.role === UserRole.SUPERVISOR ? (
            <SupervisorDashboard 
              session={activeSession!}
              updateSession={updateSession}
              countLogs={countLogs.filter(l => l.sessionId === activeSessionId)}
              setCountLogs={setCountLogs}
              unknownBarcodes={unknownBarcodes.filter(u => u.sessionId === activeSessionId)}
              setUnknownBarcodes={setUnknownBarcodes}
            />
          ) : (
            <OperatorPanel 
              user={currentUser}
              session={activeSession!}
              updateSession={updateSession}
              countLogs={countLogs.filter(l => l.sessionId === activeSessionId)}
              setCountLogs={setCountLogs}
              unknownBarcodes={unknownBarcodes.filter(u => u.sessionId === activeSessionId)}
              setUnknownBarcodes={setUnknownBarcodes}
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;
