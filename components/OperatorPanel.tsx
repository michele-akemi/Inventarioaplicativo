
import React, { useState, useRef, useMemo, useEffect, memo } from 'react';
import { 
  Scan, MapPin, Package, Trash2, Lock, History, 
  RotateCcw, Pencil, X, CheckCircle2, AlertTriangle, 
  Calendar, ChevronRight, Calculator, Box, XCircle, Info, Star, AlertOctagon, Ban,
  Delete, Check, Keyboard, UnlockKeyhole, Clock, CheckCheck, ArrowRightCircle, Camera
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Product, CountLog, InventorySession, UnknownBarcode, LocationState } from '../types';

interface OperatorPanelProps {
  user: { id: string, name: string };
  session: InventorySession;
  updateSession: (session: InventorySession | ((prev: InventorySession) => InventorySession)) => void;
  countLogs: CountLog[];
  setCountLogs: React.Dispatch<React.SetStateAction<CountLog[]>>;
  unknownBarcodes: UnknownBarcode[];
  setUnknownBarcodes: React.Dispatch<React.SetStateAction<UnknownBarcode[]>>;
}

const cleanSku = (sku: string) => sku ? sku.toString().replace(/^0+/, '').trim() : '';

// --- AUDIO UTILS (ENHANCED) ---
const playFeedbackSound = (type: 'success' | 'error' | 'warning' | 'info' | 'multiplier') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    let duration = 0.3; // Default max duration

    // Helper to create oscillator
    const createOsc = (freq: number, type: OscillatorType, startTime: number, oscDuration: number, gainVal: number = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + oscDuration);
      osc.start(startTime);
      osc.stop(startTime + oscDuration);
      return { osc, gain };
    };
    
    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine'; 
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08); 
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      duration = 0.1;

    } else if (type === 'warning') {
      createOsc(150, 'sawtooth', now, 0.15, 0.2); 
      createOsc(150, 'sawtooth', now + 0.2, 0.15, 0.2); 
      duration = 0.4;

    } else if (type === 'info') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle'; 
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2); 
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.25);
      duration = 0.3;

    } else if (type === 'multiplier') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      duration = 0.15;

    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3); 
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      duration = 0.35;
    }

    // CRITICAL: Close context to prevent memory leak (max 6 contexts usually)
    setTimeout(() => {
        if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, duration * 1000 + 100);

  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

// --- SUB-COMPONENTS ---

const NumericKeypad = ({ 
  onKeyPress, 
  onDelete, 
  onConfirm, 
  showMultiplier = false,
  confirmLabel = 'OK'
}: { 
  onKeyPress: (key: string) => void, 
  onDelete: () => void, 
  onConfirm?: () => void,
  showMultiplier?: boolean,
  confirmLabel?: string
}) => {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  return (
    <div className="flex flex-col gap-3 w-full select-none">
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onKeyPress(key.toString())}
            className="h-16 rounded-2xl bg-white shadow-sm border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 text-2xl font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center"
          >
            {key}
          </button>
        ))}
        {showMultiplier ? (
           <button
             type="button"
             onClick={() => onKeyPress('*')}
             className="h-16 rounded-2xl bg-indigo-50 shadow-sm border-b-4 border-indigo-100 active:border-b-0 active:translate-y-1 text-2xl font-black text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center"
           >
             *
           </button>
        ) : (
           <button
             type="button"
             onClick={onDelete}
             className="h-16 rounded-2xl bg-red-50 shadow-sm border-b-4 border-red-100 active:border-b-0 active:translate-y-1 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center"
           >
             <Delete size={24}/>
           </button>
        )}
        
        <button
          type="button"
          onClick={() => onKeyPress('0')}
          className="h-16 rounded-2xl bg-white shadow-sm border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 text-2xl font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center"
        >
          0
        </button>

        {showMultiplier ? (
           <button
             type="button"
             onClick={onDelete}
             className="h-16 rounded-2xl bg-red-50 shadow-sm border-b-4 border-red-100 active:border-b-0 active:translate-y-1 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center"
           >
             <Delete size={24}/>
           </button>
        ) : (
          onConfirm && (
             <button
               type="button"
               onClick={onConfirm}
               className="h-16 rounded-2xl bg-blue-600 shadow-sm shadow-blue-200 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-xl font-black text-white hover:bg-blue-700 transition-all flex items-center justify-center"
             >
               {confirmLabel}
             </button>
          )
        )}
      </div>
    </div>
  );
};

const EditQuantityModal = ({ 
  item, 
  onSave, 
  onClose 
}: { 
  item: { sku: string, qty: number, description: string, location: string }, 
  onSave: (newQty: number) => void, 
  onClose: () => void 
}) => {
  const [qtyString, setQtyString] = useState(item.qty.toString());

  const handleKeyPress = (key: string) => {
    if (qtyString === '0') setQtyString(key);
    else setQtyString(prev => prev + key);
  };

  const handleDelete = () => {
    setQtyString(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const handleSave = () => {
    const val = parseInt(qtyString);
    if (!isNaN(val) && val >= 0) {
      onSave(val);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-slate-100 w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-800">Editar Quantidade</h3>
            <p className="text-sm text-slate-500 font-medium">{item.sku}</p>
            <p className="text-[10px] text-blue-500 font-bold uppercase">{item.location}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-slate-200"><X size={20}/></button>
        </div>
        
        <div className="bg-white p-6 rounded-2xl mb-6 shadow-inner border border-slate-200 text-center relative overflow-hidden">
          <span className="text-6xl font-black text-blue-600 tracking-tighter">{qtyString}</span>
          <p className="text-[10px] text-slate-300 font-bold uppercase mt-1">Nova Quantidade</p>
        </div>

        <div className="mb-2">
          <NumericKeypad 
            onKeyPress={handleKeyPress} 
            onDelete={handleDelete} 
            onConfirm={handleSave}
            confirmLabel="SALVAR"
          />
        </div>
      </div>
    </div>
  );
};

const LocationDetailModal = ({ 
  locationData, 
  items, 
  onClose, 
  onEdit, 
  onRemove,
  onRequestUnlock,
  onFinishLocation,
  onResumeCounting
}: { 
  locationData: LocationState, 
  items: { sku: string, qty: number, description: string, isRemoved?: boolean }[], 
  onClose: () => void,
  onEdit: (item: { sku: string, qty: number, description: string, location: string }) => void,
  onRemove: (sku: string, location: string) => void,
  onRequestUnlock: () => void,
  onFinishLocation: () => void,
  onResumeCounting: () => void
}) => {
  const isLocked = locationData.status === 'finished';
  
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isLocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
               {isLocked ? <Lock size={24}/> : <MapPin size={24}/>}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">{locationData.name}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase flex items-center gap-1">
                 {isLocked ? 'Local Finalizado' : 'Detalhes da Contagem'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <Package size={48} className="mx-auto mb-2"/>
              <p>Nenhum item contado.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-2xl flex items-center justify-between border group transition-colors ${
                  item.isRemoved 
                    ? 'bg-slate-50 border-slate-100 opacity-60' 
                    : 'bg-white border-slate-100 hover:border-blue-200'
                }`}
              >
                <div className="flex-1 min-w-0 mr-4">
                   <p className={`font-black truncate ${item.isRemoved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                     {item.sku}
                   </p>
                   <p className="text-[10px] text-slate-400 font-bold truncate">{item.description}</p>
                   {item.isRemoved && <p className="text-[9px] font-black text-red-300 uppercase mt-0.5">REMOVIDO PELO OPERADOR</p>}
                </div>
                <div className="flex items-center gap-3">
                  {!item.isRemoved ? (
                    <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-black text-slate-900 min-w-[40px] text-center">
                      {item.qty}
                    </div>
                  ) : (
                    <div className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 font-black text-xs uppercase">
                      Excluído
                    </div>
                  )}
                  
                  {!isLocked && !item.isRemoved && (
                    <div className="flex items-center gap-1">
                       <button 
                         type="button"
                         onClick={() => onEdit({...item, location: locationData.name})}
                         className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                       >
                         <Pencil size={14}/>
                       </button>
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           onRemove(item.sku, locationData.name);
                         }}
                         className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                       >
                         <Trash2 size={14}/>
                       </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* ACTION FOOTER */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          {isLocked ? (
             locationData.unlockRequest === 'pending' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-amber-600">
                  <Clock size={20} className="animate-pulse"/>
                  <span className="font-black text-xs uppercase">Aguardando Aprovação do Supervisor</span>
                </div>
             ) : locationData.unlockRequest === 'rejected' ? (
                <div className="space-y-3">
                   <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-red-600">
                     <Ban size={20}/>
                     <span className="font-black text-xs uppercase">Solicitação de Edição Negada</span>
                   </div>
                   <button 
                     type="button"
                     onClick={onRequestUnlock}
                     className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 py-3 rounded-2xl font-black text-xs uppercase transition-all"
                   >
                     Tentar Novamente
                   </button>
                </div>
             ) : (
                <button 
                  type="button"
                  onClick={onRequestUnlock}
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2 shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                  <UnlockKeyhole size={18}/> Solicitar Edição
                </button>
             )
          ) : (
             <div className="flex gap-3">
               <button 
                 type="button"
                 onClick={onResumeCounting}
                 className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-95"
               >
                 <ArrowRightCircle size={18}/> Retomar / Editar
               </button>
               {/* WAY 3: FINISH VIA MODAL BUTTON */}
               <button 
                 type="button"
                 onClick={(e) => {
                   e.stopPropagation();
                   onFinishLocation();
                 }}
                 className="flex-1 bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-95"
               >
                 <CheckCheck size={18}/> Finalizar Local
               </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CountItemRow = memo(({ 
  item, 
  isLocked, 
  onRemove,
  onEdit,
  location
}: { 
  item: any, 
  isLocked: boolean, 
  onRemove: (sku: string, location: string) => void,
  onEdit: (item: any) => void,
  location: string
}) => (
  <div className={`p-5 rounded-[24px] shadow-sm border-2 transition-all flex items-center justify-between group animate-in slide-in-from-top-2 duration-300 ${
    item.isRemoved 
      ? 'bg-slate-50 border-slate-100 shadow-none opacity-70'
      : item.isReview 
        ? 'bg-amber-50 border-amber-300 shadow-amber-100' 
        : 'bg-white border-slate-50 hover:border-blue-100 shadow-slate-100'
  }`}>
    <div className="min-w-0 flex-1 pr-4">
      <div className="flex items-center gap-2 mb-1">
        {item.isReview && !item.isRemoved && <AlertTriangle size={16} className="text-amber-500 animate-pulse"/>}
        {item.isRemoved && <Ban size={16} className="text-slate-400"/>}
        <h4 className={`font-black text-xl tracking-tight truncate ${
          item.isRemoved ? 'text-slate-400 line-through' :
          item.isReview ? 'text-amber-700' : 'text-slate-900'
        }`}>
          {item.sku}
        </h4>
      </div>
      {item.isReview && !item.isRemoved && (
        <span className="inline-block bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-md font-black uppercase mb-1">
          REVISÃO SOLICITADA
        </span>
      )}
      <p className="text-xs text-slate-400 font-bold truncate">{item.description}</p>
    </div>
    
    <div className="flex items-center gap-3">
      {item.isRemoved ? (
        <div className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase">
          REMOVIDO
        </div>
      ) : (
        <div className={`px-4 py-2 rounded-xl font-black text-2xl min-w-[60px] text-center ${item.isReview ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
          {item.qty}
        </div>
      )}
      
      {!isLocked && !item.isRemoved && (
        <div className="flex flex-col gap-1">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit({...item, location}); }}
            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <Pencil size={18} />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(item.sku, location); }}
            className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  </div>
));

// --- MAIN COMPONENT ---

const OperatorPanel: React.FC<OperatorPanelProps> = ({ 
  user, session, updateSession, countLogs, setCountLogs, unknownBarcodes, setUnknownBarcodes
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  const [currentLocation, setCurrentLocation] = useState<string>('');
  
  // Single Unified Input State
  const [inputCode, setInputCode] = useState<string>('');
  const [activeMultiplier, setActiveMultiplier] = useState<number>(1);
  const [showMainKeypad, setShowMainKeypad] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info' | 'multiplier', message: string, key: number } | null>(null);
  
  // Modal States
  const [editingItem, setEditingItem] = useState<{ sku: string, qty: number, description: string, location: string } | null>(null);
  const [viewingHistoryLocation, setViewingHistoryLocation] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const activeLocationState = useMemo(() => 
    session.locations.find(l => l.name === currentLocation)
  , [session.locations, currentLocation]);

  const viewingHistoryState = useMemo(() => 
    viewingHistoryLocation ? session.locations.find(l => l.name === viewingHistoryLocation) || null : null
  , [session.locations, viewingHistoryLocation]);

  const isLocked = activeLocationState?.status === 'finished';
  const isReview = activeLocationState?.status === 'review';

  // Force Focus Logic for "No Hands" operation
  useEffect(() => {
    if (activeTab === 'scan' && !editingItem && !viewingHistoryLocation && !showMainKeypad && !showCamera) {
      scanInputRef.current?.focus();
    }
  }, [activeTab, editingItem, viewingHistoryLocation, countLogs, feedback, activeMultiplier, showMainKeypad, showCamera]); 

  const barcodeToSkuMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of session.products) {
      const cleanedSku = cleanSku(p.sku);
      for (const b of p.barcodes) {
        map.set(b, cleanedSku);
        map.set(cleanSku(b), cleanedSku);
      }
    }
    return map;
  }, [session.products]);

  const currentItems = useMemo(() => {
    const counts: Record<string, { qty: number, lastScanTime: number, hasRejected: boolean }> = {};
    const locationLogs = countLogs.filter(log => log.location === currentLocation);
    
    for (const log of locationLogs) {
      const sku = cleanSku(log.sku);
      if (!counts[sku]) {
        counts[sku] = { qty: 0, lastScanTime: 0, hasRejected: false };
      }
      if (log.status === 'rejected') {
        counts[sku].hasRejected = true;
      } else {
        counts[sku].qty += log.quantity;
      }
      const logTime = new Date(log.timestamp).getTime();
      if (logTime > counts[sku].lastScanTime) {
        counts[sku].lastScanTime = logTime;
      }
    }

    const productsMap = new Map<string, Product>();
    for (const p of session.products) productsMap.set(cleanSku(p.sku), p);

    const result = Object.entries(counts).map(([sku, data]) => {
      const prod = productsMap.get(sku);
      const isSkuReview = activeLocationState?.reviewSkus?.includes(sku) || false;
      const isRemoved = data.qty === 0 && data.hasRejected;
      
      return {
        sku,
        description: prod?.description || 'Desconhecido',
        qty: data.qty,
        isReview: isSkuReview,
        isRemoved,
        lastScanTime: data.lastScanTime
      };
    }).filter(item => item.qty > 0 || item.isRemoved).sort((a, b) => {
        if (a.isRemoved !== b.isRemoved) return a.isRemoved ? 1 : -1;
        if (a.isReview !== b.isReview) return b.isReview ? 1 : -1;
        return b.lastScanTime - a.lastScanTime;
    });

    return result;
  }, [countLogs, currentLocation, session.products, activeLocationState]);

  const locationHistory = useMemo(() => {
    return session.locations.map(loc => {
      const locLogs = countLogs.filter(l => l.location === loc.name && l.status !== 'rejected');
      const uniqueSkus = new Set(locLogs.map(l => cleanSku(l.sku))).size;
      const totalQty = locLogs.reduce((acc, curr) => acc + curr.quantity, 0);
      
      return {
        ...loc,
        totalQty,
        uniqueSkus
      };
    }).sort((a, b) => {
        const scoreA = a.status === 'counting' || a.status === 'review' ? 2 : a.status === 'finished' ? 1 : 0;
        const scoreB = b.status === 'counting' || b.status === 'review' ? 2 : b.status === 'finished' ? 1 : 0;
        return scoreB - scoreA || a.name.localeCompare(b.name);
    });
  }, [session.locations, countLogs]);

  const historyDetails = useMemo(() => {
      if (!viewingHistoryLocation) return [];
      const counts: Record<string, { qty: number, hasRejected: boolean }> = {};
      const locationLogs = countLogs.filter(log => log.location === viewingHistoryLocation);
      
      for (const log of locationLogs) {
        const sku = cleanSku(log.sku);
        if (!counts[sku]) counts[sku] = { qty: 0, hasRejected: false };
        if (log.status === 'rejected') counts[sku].hasRejected = true;
        else counts[sku].qty += log.quantity;
      }

      const productsMap = new Map<string, Product>();
      for (const p of session.products) productsMap.set(cleanSku(p.sku), p);

      return Object.entries(counts).map(([sku, data]) => ({
        sku,
        qty: data.qty,
        description: productsMap.get(sku)?.description || 'Desconhecido',
        isRemoved: data.qty === 0 && data.hasRejected
      })).filter(item => item.qty > 0 || item.isRemoved);
  }, [viewingHistoryLocation, countLogs, session.products]);

  const triggerFeedback = (type: 'success' | 'error' | 'warning' | 'info' | 'multiplier', message: string) => {
    setFeedback({ type, message, key: Date.now() });
    playFeedbackSound(type); 
    setTimeout(() => setFeedback(null), 2500); 
  };

  const processScan = (rawCode: string) => {
    if (!rawCode) return;
    const multiplierOnlyMatch = rawCode.match(/^(\d+)\*$/);
    if (multiplierOnlyMatch) {
       const newMult = parseInt(multiplierOnlyMatch[1]);
       if (newMult > 0) {
         setActiveMultiplier(newMult);
         triggerFeedback('multiplier', `MULTIPLICADOR: x${newMult}`);
         setInputCode('');
         return;
       }
    }
    let quantity = activeMultiplier;
    let actualCode = rawCode;
    let isTemporaryMultiplier = false;
    const inlineCommandMatch = rawCode.match(/^(\d+)\*(.+)$/);
    if (inlineCommandMatch) {
        quantity = parseInt(inlineCommandMatch[1]);
        actualCode = inlineCommandMatch[2];
        isTemporaryMultiplier = true;
    }
    const isNumericSku = /^\d+$/.test(actualCode);
    const isLocationCode = !isNumericSku;

    if (isLocationCode) {
      const newLocName = actualCode.toUpperCase();
      let feedbackMsg = `LOCAL ATIVO: ${newLocName}`;
      
      updateSession(prev => {
          let locs = [...prev.locations];
          const now = new Date().toISOString();

          // 1. Close current location if exists and different
          if (currentLocation && currentLocation !== newLocName) {
             feedbackMsg = "TROCA: ANTERIOR FECHADO";
             locs = locs.map(l => {
                 if (l.name === currentLocation) return { ...l, status: 'finished', finishedAt: now };
                 return l;
             });
          }

          // 2. Open new location
          const idx = locs.findIndex(l => l.name === newLocName);
          if (idx > -1) {
              // If idle, start it. If counting/review, just focus it. If finished, it remains finished unless unlocked.
              if (locs[idx].status === 'idle') {
                  locs[idx] = { ...locs[idx], status: 'counting', assignedOperatorId: user.id, startedAt: now };
              }
          } else {
              locs.push({ 
                  id: Math.random().toString(36), 
                  name: newLocName, 
                  status: 'counting', 
                  assignedOperatorId: user.id,
                  startedAt: now
              });
          }
          return { ...prev, locations: locs };
      });
      
      setCurrentLocation(newLocName);
      triggerFeedback('info', feedbackMsg);
      setInputCode('');
      setActiveMultiplier(1);
      return;
    }

    if (!currentLocation) {
       triggerFeedback('warning', 'BIPE UM LOCAL PRIMEIRO');
       setInputCode('');
       return;
    }
    if (isLocked) {
      triggerFeedback('error', 'ERRO: LOCAL BLOQUEADO');
      setInputCode('');
      return;
    }
    const cleanedBipe = cleanSku(actualCode);
    const sku = barcodeToSkuMap.get(actualCode) || barcodeToSkuMap.get(cleanedBipe) || cleanedBipe;
    const isUnknown = !barcodeToSkuMap.has(actualCode) && !barcodeToSkuMap.has(cleanedBipe) && !session.products.some(p => cleanSku(p.sku) === cleanedBipe);

    if (isUnknown) {
      setUnknownBarcodes(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        sessionId: session.id,
        barcode: actualCode,
        location: currentLocation,
        operatorId: user.id,
        timestamp: new Date().toISOString(),
        status: 'pending'
      }]);
      triggerFeedback('warning', 'ITEM DESCONHECIDO');
    } else {
      triggerFeedback('success', `ITEM OK: ${sku} (x${quantity})`);
    }
    setCountLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      sessionId: session.id,
      sku,
      location: currentLocation,
      quantity: quantity,
      operatorId: user.id,
      timestamp: new Date().toISOString(),
      type: quantity > 1 ? 'manual' : 'scan'
    }]);
    setInputCode('');
    if (activeMultiplier > 1 && !isTemporaryMultiplier) {
        setActiveMultiplier(1);
    }
  };

  const processScanRef = useRef(processScan);
  useEffect(() => { processScanRef.current = processScan; });

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let mounted = true;

    if (showCamera) {
      const timer = setTimeout(() => {
        if (!mounted) return;
        scanner = new Html5Qrcode("reader");
        scanner.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => { 
             processScanRef.current(decodedText); 
             // Optional: Close camera on success? No, continuous scanning is usually better.
             // setShowCamera(false); 
          }, 
          () => {} // Ignore errors frame-by-frame
        ).catch(err => { 
            console.error("Camera start error", err); 
            if (mounted) {
                setShowCamera(false); 
                alert("Erro ao acessar câmera. Verifique permissões.");
            }
        });
      }, 100);

      return () => { 
        mounted = false;
        clearTimeout(timer); 
        if (scanner) {
            scanner.stop().then(() => scanner?.clear()).catch(console.error);
        }
      };
    }
  }, [showCamera]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScan(inputCode.trim());
    setTimeout(() => {
      if (!editingItem && !viewingHistoryLocation && !showMainKeypad && !showCamera) {
         scanInputRef.current?.focus();
      }
    }, 10);
  };

  const handleKeypadPress = (key: string) => setInputCode(prev => prev + key);
  const handleKeypadDelete = () => setInputCode(prev => prev.slice(0, -1));

  const handleEditSave = (newQty: number) => {
    if (!editingItem) return;
    const targetLocation = editingItem.location;
    const locState = session.locations.find(l => l.name === targetLocation);
    if (locState?.status === 'finished') {
       triggerFeedback('error', 'LOCAL FINALIZADO');
       setEditingItem(null);
       return;
    }
    const logsToKeep = countLogs.filter(l => !(cleanSku(l.sku) === cleanSku(editingItem.sku) && l.location === targetLocation));
    const newLog: CountLog = {
      id: Math.random().toString(36).substr(2, 9),
      sessionId: session.id,
      sku: editingItem.sku,
      location: targetLocation,
      quantity: newQty,
      operatorId: user.id,
      timestamp: new Date().toISOString(),
      type: 'manual'
    };
    setCountLogs([...logsToKeep, newLog]);
    setEditingItem(null);
    triggerFeedback('success', 'QUANTIDADE ATUALIZADA');
  };

  const handleRemove = (sku: string, targetLocation: string) => {
     const locState = session.locations.find(l => l.name === targetLocation);
     const isEditable = (locState?.status === 'counting' || locState?.status === 'review') || (targetLocation === currentLocation && activeLocationState?.status !== 'finished');
     
     if (!isEditable) {
       triggerFeedback('error', 'LOCAL BLOQUEADO / FINALIZADO');
       return;
     }

     if(window.confirm(`Remover todos os itens de ${sku} em ${targetLocation}?`)) {
        setCountLogs(prev => prev.map(l => {
          const isSameLocation = l.location === targetLocation;
          const isSameSku = cleanSku(l.sku) === cleanSku(sku);
          if (isSameLocation && isSameSku) {
             return { ...l, status: 'rejected' as const };
          }
          return l;
        }));

        if (locState?.status === 'review' && locState.reviewSkus) {
            updateSession(prev => ({
                ...prev,
                locations: prev.locations.map(l => {
                    if (l.name === targetLocation && l.reviewSkus) {
                        return { ...l, reviewSkus: l.reviewSkus.filter(s => cleanSku(s) !== cleanSku(sku)) };
                    }
                    return l;
                })
            }));
        }
        triggerFeedback('info', 'ITEM REMOVIDO');
     }
  };

  const handleRequestUnlock = () => {
    if (!viewingHistoryLocation) return;
    updateSession(prev => ({ ...prev, locations: prev.locations.map(l => { if (l.name === viewingHistoryLocation) { return { ...l, unlockRequest: 'pending' }; } return l; }) }));
    triggerFeedback('info', 'SOLICITAÇÃO ENVIADA');
  };

  const handleFinishLocation = (locationName: string) => {
    if (window.confirm(`Deseja realmente finalizar o local ${locationName}?`)) {
        updateSession(prev => {
            const updatedLocations = prev.locations.map(l => {
                if (l.name === locationName) {
                    return { ...l, status: 'finished' as const, finishedAt: new Date().toISOString() };
                }
                return l;
            });
            return { ...prev, locations: updatedLocations };
        });
        
        if (currentLocation === locationName) {
            setCurrentLocation('');
        }
        
        setViewingHistoryLocation(null); 
        triggerFeedback('success', 'LOCAL FINALIZADO');
    }
  };

  const handleResumeLocation = (locationName: string) => {
      setCurrentLocation(locationName);
      setActiveTab('scan');
      setViewingHistoryLocation(null);
      triggerFeedback('info', `EDITANDO: ${locationName}`);
  };

  const handleBulkFinish = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const activeLocations = session.locations.filter(l => 
        l.status === 'counting' && l.assignedOperatorId === user.id
      );
      
      if (activeLocations.length === 0) {
          triggerFeedback('info', "Nenhum local em andamento.");
          return;
      }

      if (window.confirm(`Finalizar ${activeLocations.length} locais em andamento?`)) {
          const namesFinished = activeLocations.map(l => l.name);
          const now = new Date().toISOString();
          
          updateSession(prev => ({
              ...prev,
              locations: prev.locations.map(l => {
                  if (l.status === 'counting' && l.assignedOperatorId === user.id) {
                      return { ...l, status: 'finished' as const, finishedAt: now };
                  }
                  return l;
              })
          }));

          if (currentLocation && namesFinished.includes(currentLocation)) {
             setCurrentLocation('');
          }

          triggerFeedback('success', `${activeLocations.length} LOCAIS FINALIZADOS!`);
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full bg-slate-50 relative overflow-hidden md:shadow-2xl md:border-x md:border-slate-200">
      
      <div className={`p-8 shadow-2xl relative transition-colors duration-500 ${
        isReview ? 'bg-amber-500' : isLocked ? 'bg-slate-900' : currentLocation ? 'bg-blue-600' : 'bg-slate-400'
      } text-white`}>
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-5 rounded-[28px] bg-white/20">
            {isReview ? <RotateCcw size={40} className="animate-spin-slow"/> : isLocked ? <Lock size={40}/> : <MapPin size={40}/>}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
              {isReview ? 'Atenção: Revisão Solicitada' : 'Localização Atual'}
            </p>
            <h2 className="text-5xl font-black tracking-tighter truncate">
              {currentLocation || 'SEM LOCAL'}
            </h2>
          </div>
        </div>
        {isReview && (
          <div className="absolute top-4 right-4 bg-white/20 px-4 py-2 rounded-full border border-white/10 animate-pulse">
            <span className="text-[10px] font-black uppercase">Refazer Contagem</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {feedback && (
            <div className={`absolute top-0 left-0 w-full z-50 px-6 py-4 animate-in zoom-in slide-in-from-top-4 duration-300 pointer-events-none`}>
                <div className={`w-full shadow-2xl rounded-2xl p-4 flex items-center justify-between border-b-4 pointer-events-auto ${
                  feedback.type === 'success' ? 'bg-emerald-500 border-emerald-700 text-white' : 
                  feedback.type === 'error' ? 'bg-red-600 border-red-800 text-white' : 
                  feedback.type === 'warning' ? 'bg-amber-400 border-amber-600 text-amber-900' : 
                  feedback.type === 'multiplier' ? 'bg-indigo-600 border-indigo-800 text-white' :
                  'bg-blue-600 border-blue-800 text-white'
                }`}>
                  <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        {feedback.type === 'success' ? <CheckCircle2 size={24}/> :
                        feedback.type === 'error' ? <XCircle size={24}/> :
                        feedback.type === 'warning' ? <AlertTriangle size={24}/> :
                        feedback.type === 'multiplier' ? <Star size={24}/> :
                        <Info size={24}/>}
                      </div>
                      <span className="font-black text-lg uppercase tracking-tight">{feedback.message}</span>
                  </div>
                </div>
            </div>
        )}

        {activeTab === 'scan' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden animate-in slide-in-from-left duration-300 relative">
             {isReview && (
              <div className="mx-6 mt-6 mb-2 bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2 shadow-lg relative overflow-hidden">
                <div className="bg-amber-500/10 p-3 rounded-xl absolute -right-4 -top-4 opacity-50">
                  <AlertTriangle size={120} />
                </div>
                <div className="bg-amber-500 text-white p-3 rounded-xl z-10 shadow-sm">
                  <RotateCcw size={24} />
                </div>
                <div className="z-10">
                  <h3 className="font-black text-amber-900 text-lg uppercase leading-none mb-1">Modo de Revisão Ativo</h3>
                  <p className="text-amber-700 text-xs font-bold leading-relaxed max-w-[80%]">
                    O supervisor rejeitou itens neste local. A contagem deve ser verificada.
                  </p>
                  {activeLocationState?.reviewSkus && activeLocationState.reviewSkus.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeLocationState.reviewSkus.map(sku => (
                          <span key={sku} className="bg-white/60 border border-amber-200 text-amber-900 px-2 py-1 rounded-md text-[10px] font-black">
                            SKU: {sku}
                          </span>
                        ))}
                      </div>
                  )}
                </div>
              </div>
             )}

             <div className={`bg-white p-6 border-b border-slate-100 relative z-30 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                <form onSubmit={handleScanSubmit} className="pt-4">
                  <div className="relative">
                    {activeMultiplier > 1 && (
                      <div className="absolute -top-3 left-6 z-10 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        Próximo Bipe: x{activeMultiplier}
                      </div>
                    )}
                    
                    <input 
                      ref={scanInputRef}
                      type="text"
                      autoComplete="off"
                      autoFocus
                      onBlur={() => {
                        if (!editingItem && !viewingHistoryLocation && !showMainKeypad && !showCamera) {
                           setTimeout(() => scanInputRef.current?.focus(), 100);
                        }
                      }}
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      placeholder={currentLocation ? (activeMultiplier > 1 ? `BIPE (QTD: ${activeMultiplier})` : "BIPE OU DIGITE QTD*") : "BIPE O LOCAL"}
                      className={`w-full pl-6 pr-28 py-5 border-4 rounded-[24px] outline-none text-3xl font-black bg-slate-50 uppercase placeholder:text-slate-300 transition-colors ${
                        activeMultiplier > 1 ? 'border-indigo-500 text-indigo-900 bg-indigo-50' :
                        feedback 
                          ? (feedback.type === 'success' ? 'border-emerald-500' 
                             : feedback.type === 'error' ? 'border-red-500' 
                             : feedback.type === 'warning' ? 'border-amber-400' 
                             : 'border-blue-500') 
                          : 'border-slate-50 focus:border-blue-600'
                      }`}
                    />
                    
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       <button 
                         type="button"
                         onClick={() => setShowCamera(!showCamera)}
                         className={`p-3 rounded-xl font-black text-xs transition-all ${
                           showCamera ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500 hover:bg-blue-100 hover:text-blue-600'
                         }`}
                       >
                          <Camera size={20}/>
                       </button>
                       {inputCode ? (
                         <button 
                           type="button"
                           onClick={() => { setInputCode(''); setActiveMultiplier(1); scanInputRef.current?.focus(); }}
                           className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300"
                         >
                           <X size={16}/>
                         </button>
                       ) : (
                         <button 
                           type="button"
                           onClick={() => setShowMainKeypad(!showMainKeypad)}
                           className={`p-3 rounded-xl font-black text-xs transition-all ${
                             showMainKeypad ? 'bg-blue-600 text-white' : 
                             activeMultiplier > 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500 hover:bg-blue-100 hover:text-blue-600'
                           }`}
                         >
                            {activeMultiplier > 1 ? <span className="text-lg">x{activeMultiplier}</span> : (showMainKeypad ? <Keyboard size={20}/> : <Calculator size={20}/>)}
                         </button>
                       )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 px-2">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                       {currentLocation ? 'Dica: Digite "10*" para quantidade' : 'Inicie bipando um local'}
                     </p>
                     {currentLocation && (
                       <button 
                        type="button"
                        onClick={() => {
                          if(window.confirm('Deseja fechar a contagem deste local?')) {
                            updateSession(prev => ({
                              ...prev, 
                              locations: prev.locations.map(l => l.name === currentLocation ? {...l, status: 'finished' as const, finishedAt: new Date().toISOString()} : l)
                            }));
                            setCurrentLocation('');
                          }
                        }}
                        className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 flex items-center gap-1 bg-red-50 px-3 py-1 rounded-full"
                       >
                         <CheckCircle2 size={12}/> Fechar Local
                       </button>
                     )}
                  </div>
                </form>
             </div>

             <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3 pb-64">
                {!currentLocation ? (
                  <div className="text-center py-16 opacity-50">
                    <MapPin size={64} className="mx-auto mb-4 text-slate-300"/>
                    <p className="font-black uppercase text-xs text-slate-400">Aguardando Local</p>
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className="text-center py-16 opacity-50">
                    <Box size={64} className="mx-auto mb-4 text-slate-300"/>
                    <p className="font-black uppercase text-xs text-slate-400">Local Vazio</p>
                  </div>
                ) : (
                  currentItems.map(item => (
                    <CountItemRow 
                      key={item.sku} 
                      item={item} 
                      isLocked={isLocked} 
                      onRemove={handleRemove}
                      onEdit={setEditingItem}
                      location={currentLocation}
                    />
                  ))
                )}
             </div>

             {showCamera && (
               <div className="fixed inset-0 z-50 bg-black flex flex-col">
                 <div className="relative flex-1 flex flex-col justify-center bg-black">
                    <div id="reader" className="w-full"></div>
                    <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                       <p className="text-white font-bold text-sm">Escaneando...</p>
                       <button onClick={() => setShowCamera(false)} className="bg-white/20 p-2 rounded-full text-white"><X size={24}/></button>
                    </div>
                 </div>
               </div>
             )}

             {showMainKeypad && (
                <div className="absolute bottom-0 left-0 w-full bg-slate-100 border-t border-slate-200 p-4 rounded-t-[32px] shadow-2xl z-40 animate-in slide-in-from-bottom-full">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <p className="text-xs font-black uppercase text-slate-400">Entrada Manual / Multiplicador</p>
                    <button onClick={() => setShowMainKeypad(false)} className="bg-slate-200 p-2 rounded-full text-slate-500"><X size={16}/></button>
                  </div>
                  <NumericKeypad 
                    onKeyPress={handleKeypadPress}
                    onDelete={handleKeypadDelete}
                    showMultiplier={true}
                  />
                  <button 
                    onClick={() => { processScan(inputCode); setShowMainKeypad(false); }}
                    className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl mt-4 shadow-lg shadow-blue-200"
                  >
                    CONFIRMAR
                  </button>
                </div>
             )}

          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 pb-24 animate-in slide-in-from-right duration-300 bg-slate-100">
            <div className="flex justify-between items-center mb-6 px-2">
               <h3 className="text-2xl font-black text-slate-800">Histórico</h3>
               <button 
                 type="button"
                 onClick={handleBulkFinish}
                 className="bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-sm active:scale-95"
               >
                 <CheckCheck size={16}/> FINALIZAR LOCAIS EM ANDAMENTO
               </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               {locationHistory.map(loc => (
                 <button 
                  type="button"
                  key={loc.id}
                  onClick={() => setViewingHistoryLocation(loc.name)}
                  className={`p-5 rounded-[28px] border-2 text-left transition-all active:scale-95 shadow-sm relative overflow-hidden group ${
                    loc.status === 'finished' ? 'bg-white border-emerald-100' :
                    loc.status === 'review' ? 'bg-amber-50 border-amber-200' :
                    loc.status === 'counting' ? 'bg-white border-blue-200 shadow-blue-100' :
                    'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                 >
                    <div className="flex justify-between items-start mb-4">
                       <span className={`p-2 rounded-xl text-white ${
                         loc.status === 'finished' ? 'bg-emerald-500' :
                         loc.status === 'review' ? 'bg-amber-500' :
                         loc.status === 'counting' ? 'bg-blue-500' :
                         'bg-slate-300'
                       }`}>
                         {loc.status === 'finished' ? <CheckCircle2 size={16}/> :
                          loc.status === 'review' ? <RotateCcw size={16}/> :
                          loc.status === 'counting' ? <Scan size={16}/> :
                          <Box size={16}/>}
                       </span>
                       {loc.totalQty > 0 && (
                         <span className="text-xl font-black text-slate-800">{loc.totalQty}</span>
                       )}
                    </div>
                    <h4 className="font-black text-lg text-slate-800 truncate mb-1 group-hover:text-blue-600 transition-colors">{loc.name}</h4>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {loc.uniqueSkus} SKUs • {loc.status}
                    </p>
                    {loc.unlockRequest === 'pending' && (
                       <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full animate-pulse shadow-sm">
                          <Lock size={12}/>
                       </div>
                    )}
                    {loc.assignedOperatorId === user.id && (
                       <div className="absolute bottom-0 right-0 p-2 bg-slate-900 rounded-tl-2xl">
                          <p className="text-[8px] font-black text-white uppercase">MEU</p>
                       </div>
                    )}
                 </button>
               ))}
            </div>
          </div>
        )}

      </div>

      {!showMainKeypad && (
        <div className="bg-white border-t border-slate-200 p-4 flex gap-4 absolute bottom-0 w-full z-10 pb-6">
           <button 
             type="button"
             onClick={() => setActiveTab('scan')}
             className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeTab === 'scan' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Scan size={24} strokeWidth={activeTab === 'scan' ? 3 : 2} />
             <span className="text-[10px] font-black uppercase tracking-widest">Coleta</span>
           </button>
           <button 
             type="button"
             onClick={() => setActiveTab('history')}
             className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <History size={24} strokeWidth={activeTab === 'history' ? 3 : 2} />
             <span className="text-[10px] font-black uppercase tracking-widest">Histórico</span>
           </button>
        </div>
      )}

      {editingItem && (
        <EditQuantityModal 
          item={editingItem} 
          onSave={handleEditSave} 
          onClose={() => setEditingItem(null)} 
        />
      )}

      {viewingHistoryLocation && viewingHistoryState && (
        <LocationDetailModal 
          locationData={viewingHistoryState} 
          items={historyDetails} 
          onClose={() => setViewingHistoryLocation(null)} 
          onEdit={setEditingItem} 
          onRemove={handleRemove}
          onRequestUnlock={handleRequestUnlock}
          onFinishLocation={() => handleFinishLocation(viewingHistoryLocation)}
          onResumeCounting={() => handleResumeLocation(viewingHistoryLocation)}
        />
      )}

    </div>
  );
};

export default OperatorPanel;
