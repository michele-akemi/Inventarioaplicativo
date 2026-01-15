
import React, { useState } from 'react';
import { InventorySession, UserRole } from '../types';
import { Plus, ClipboardList, Calendar, ChevronRight, PackageCheck } from 'lucide-react';

interface InventoryListProps {
  sessions: InventorySession[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  role: UserRole;
}

const InventoryList: React.FC<InventoryListProps> = ({ sessions, onSelect, onCreate, role }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Inventários</h1>
          <p className="text-slate-500 font-medium">Selecione uma sessão para iniciar a contagem</p>
        </div>
        {role === UserRole.SUPERVISOR && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Plus size={20} /> Novo Inventário
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 animate-in zoom-in-95">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Nomear nova sessão</h3>
          <div className="flex gap-4">
            <input 
              type="text" 
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Inventário Mensal Outubro"
              className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 rounded-xl font-bold">Criar</button>
            <button type="button" onClick={() => setIsCreating(false)} className="px-6 rounded-xl font-bold text-slate-400">Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <ClipboardList size={32} />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Nenhuma sessão encontrada</p>
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md hover:border-blue-200 transition-all text-left"
            >
              <div className="flex items-center gap-6">
                <div className="bg-slate-100 p-4 rounded-xl text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <PackageCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 mb-1">{session.name}</h3>
                  <div className="flex items-center gap-4 text-slate-400 text-sm font-medium">
                    <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(session.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 uppercase tracking-tighter text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                      {session.status}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" size={24} />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default InventoryList;
