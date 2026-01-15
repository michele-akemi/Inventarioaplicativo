
import React, { useState, useMemo, memo, useEffect } from 'react';
import { 
  FileUp, Download, PieChart as PieChartIcon, AlertTriangle, MapPin, 
  CheckCircle2, FileText, Upload, FileCheck, Loader2, 
  Check, X, Settings2, UserCheck, ShieldAlert, History,
  RotateCcw, Search, Square, CheckSquare, ChevronDown, Table as TableIcon,
  Navigation, PackageSearch, XCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  CheckCircle, User, Clock, AlertOctagon, ScrollText, Filter, ListFilter,
  UnlockKeyhole, Lock, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Info, Layers,
  AlertCircle, Activity, LayoutGrid, List, Pencil, Trash2, Plus, MoreHorizontal,
  RefreshCcw, Eye as EyeIcon, Send, SortAsc, Timer, TrendingUp, Users
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Product, CountLog, UnknownBarcode, InventorySession, Movement, LocationState } from '../types';

interface SupervisorDashboardProps {
  session: InventorySession;
  updateSession: (session: InventorySession | ((prev: InventorySession) => InventorySession)) => void;
  countLogs: CountLog[];
  setCountLogs: React.Dispatch<React.SetStateAction<CountLog[]>>;
  unknownBarcodes: UnknownBarcode[];
  setUnknownBarcodes: React.Dispatch<React.SetStateAction<UnknownBarcode[]>>;
}

interface ImportStatus {
  isFileReading: boolean;
  isProcessing: boolean;
  isMapping: boolean;
  isCompleted: boolean;
  progress: number;
  total: number;
  processedCount: number;
  errorCount: number;
  successCount: number;
  errors: string[];
  fileName: string | null;
  fileContent: string | null;
  headers: string[];
  previewRows: string[][];
  mapping: Record<string, number>;
  skipFirstRow: boolean;
  delimiter: string;
}

type ColumnKey = 'selection' | 'sku' | 'description' | 'locationDetail' | 'initialBalance' | 'adjustedBalance' | 'countQty' | 'countMov' | 'diff' | 'status' | 'reasons' | 'actions';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  exportable?: boolean; 
}

const REPORT_COLUMNS: ColumnDef[] = [
  { key: 'selection', label: 'Sel.', sortable: false, exportable: false },
  { key: 'sku', label: 'SKU', sortable: true, exportable: true },
  { key: 'description', label: 'Descrição', sortable: true, exportable: true },
  { key: 'locationDetail', label: 'Análise de Local', sortable: false, exportable: true },
  { key: 'initialBalance', label: 'Saldo Inicial', sortable: true, exportable: true },
  { key: 'adjustedBalance', label: 'Saldo Ajustado', sortable: true, exportable: true },
  { key: 'countQty', label: 'Contagem Total', sortable: true, exportable: true },
  { key: 'countMov', label: 'Contagem + Mov', sortable: true, exportable: true },
  { key: 'diff', label: 'Diferença', sortable: true, exportable: true },
  { key: 'status', label: 'Status', sortable: true, exportable: true },
  { key: 'reasons', label: 'Motivos', sortable: false, exportable: true },
  { key: 'actions', label: 'Ação', sortable: false, exportable: false },
];

const INITIAL_IMPORT_STATUS: ImportStatus = {
  isFileReading: false,
  isProcessing: false,
  isMapping: false,
  isCompleted: false,
  progress: 0, total: 0, processedCount: 0, errorCount: 0, successCount: 0,
  errors: [], fileName: null, fileContent: null, headers: [],
  previewRows: [], mapping: {}, skipFirstRow: true, delimiter: ';'
};

const FIELD_SYNONYMS: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod', 'item', 'ref', 'referencia', 'id'],
  description: ['descricao', 'desc', 'nome', 'produto', 'material'],
  barcodes: ['barras', 'barcode', 'ean', 'upc', 'gtin', 'cód barras'],
  initialBalance: ['saldo', 'quantidade', 'qty', 'qtd', 'estoque', 'balance'],
  location: ['local', 'endereco', 'area', 'posicao', 'vão', 'prateleira', 'nome local'],
  timestamp: ['data', 'hora', 'tempo', 'dh', 'time', 'date', 'registro'],
  entryQuantity: ['entrada', 'compra', 'ent', 'in', 'recebimento', 'plus'],
  exitQuantity: ['saida', 'saída', 'venda', 'out', 'baixa', 'minus'],
  reason: ['motivo', 'obs', 'observacao', 'justificativa', 'tipo', 'reason']
};

const cleanSku = (sku: unknown): string => sku ? String(sku).replace(/^0+/, '').trim() : '';

const parseFlexibleDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  const ptBrMatch = cleanStr.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ptBrMatch) {
    const day = parseInt(ptBrMatch[1], 10);
    const month = parseInt(ptBrMatch[2], 10) - 1;
    const year = parseInt(ptBrMatch[3], 10);
    const hour = ptBrMatch[4] ? parseInt(ptBrMatch[4], 10) : 0;
    const minute = ptBrMatch[5] ? parseInt(ptBrMatch[5], 10) : 0;
    const second = ptBrMatch[6] ? parseInt(ptBrMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const dStandard = new Date(cleanStr);
  if (!isNaN(dStandard.getTime())) return dStandard.toISOString();
  return null;
};

const MovementHistoryModal = ({ item, movements, onClose }: { item: any, movements: Movement[], onClose: () => void }) => {
  const preCountMovs = movements.filter(m => new Date(m.timestamp).getTime() < item.firstCountTs);
  const postCountMovs = movements.filter(m => new Date(m.timestamp).getTime() >= item.firstCountTs);

  const preCountTotal = preCountMovs.reduce((acc, m) => acc + (m.type === 'in' ? m.quantity : -m.quantity), 0);
  const postCountTotal = postCountMovs.reduce((acc, m) => acc + (m.type === 'in' ? m.quantity : -m.quantity), 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Detalhes do Saldo</h3>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-sm font-bold text-slate-500">SKU: {item.sku}</span>
               <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-bold uppercase">{item.expectedLocation}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-[10px] uppercase font-black text-slate-400">Saldo Inicial</p>
              <p className="text-2xl font-black text-slate-700">{item.initialBalance}</p>
           </div>
           <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-200 text-[8px] font-black px-2 py-0.5 text-blue-800 rounded-bl-lg">PRÉ</div>
              <p className="text-[10px] uppercase font-black text-blue-400">Mov. Anterior</p>
              <p className="text-2xl font-black text-blue-700">
                {preCountTotal > 0 ? '+' : ''}{preCountTotal}
              </p>
           </div>
           <div className="bg-slate-900 p-4 rounded-2xl text-center shadow-lg shadow-slate-200 relative overflow-hidden">
              <p className="text-[10px] uppercase font-black text-slate-400">Saldo Ajustado</p>
              <p className="text-3xl font-black text-white">
                {item.adjustedBalance}
              </p>
           </div>
           <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-200 text-[8px] font-black px-2 py-0.5 text-indigo-800 rounded-bl-lg">PÓS</div>
              <p className="text-[10px] uppercase font-black text-indigo-400">Mov. Posterior</p>
              <p className="text-2xl font-black text-indigo-700">
                {postCountTotal > 0 ? '+' : ''}{postCountTotal}
              </p>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border-t border-slate-100 pt-4">
           <div className="flex items-center justify-between mb-4">
             <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Extrato de Movimentações</h4>
           </div>
           
           {movements.length === 0 ? (
             <div className="text-center py-10 opacity-50">
               <History size={32} className="mx-auto mb-2 text-slate-300"/>
               <p className="text-xs font-bold text-slate-400">Nenhuma movimentação contabilizada.</p>
             </div>
           ) : (
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                   <tr>
                     <th className="px-4 py-2 rounded-l-lg">Data</th>
                     <th className="px-4 py-2">Fase</th>
                     <th className="px-4 py-2">Motivo</th>
                     <th className="px-4 py-2">Tipo</th>
                     <th className="px-4 py-2 text-right rounded-r-lg">Qtd</th>
                   </tr>
                </thead>
                <tbody className="text-xs">
                   {movements.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((m, idx) => {
                      const isPre = new Date(m.timestamp).getTime() < item.firstCountTs;
                      return (
                        <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3 font-bold text-slate-600">
                              {new Date(m.timestamp).toLocaleString()}
                           </td>
                           <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isPre ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {isPre ? 'Pré-Contagem' : 'Pós-Contagem'}
                              </span>
                           </td>
                           <td className="px-4 py-3 font-medium text-slate-500">
                              {m.reason || '-'}
                           </td>
                           <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${m.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {m.type === 'in' ? 'Entrada' : 'Saída'}
                              </span>
                           </td>
                           <td className={`px-4 py-3 text-right font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.type === 'in' ? '+' : '-'}{m.quantity}
                           </td>
                        </tr>
                      );
                   })}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
};

const ReportRow = memo(({ 
  item, 
  onReject, 
  isSelected, 
  onToggle, 
  visibleColumns,
  onViewMovements
}: { 
  item: any, 
  onReject: (sku: string, loc: string) => void,
  isSelected: boolean,
  onToggle: (key: string) => void,
  visibleColumns: Set<ColumnKey>,
  onViewMovements: (item: any) => void
}) => {
  const itemKey = item.sku;
  
  return (
    <tr className={`hover:bg-slate-50/50 transition-colors border-b border-slate-50 ${isSelected ? 'bg-amber-50/50' : ''}`}>
      {visibleColumns.has('selection') && (
        <td className="px-6 py-4 text-center">
          {!item.isCorrect && (
            <button 
              onClick={() => onToggle(itemKey)}
              className={`p-2 rounded-lg transition-all ${isSelected ? 'text-amber-600' : 'text-slate-300 hover:text-slate-400'}`}
            >
              {isSelected ? <CheckSquare size={20} fill="currentColor" fillOpacity={0.1} /> : <Square size={20} />}
            </button>
          )}
        </td>
      )}
      {visibleColumns.has('sku') && (
        <td className="px-4 py-4">
          <p className="font-black text-slate-800 text-sm">{item.sku}</p>
        </td>
      )}
      {visibleColumns.has('description') && (
        <td className="px-4 py-4">
          <p className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{item.description}</p>
        </td>
      )}
      {visibleColumns.has('locationDetail') && (
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-1 text-[10px] uppercase text-slate-400 font-bold">
                <span>Esperado:</span>
                <span className={item.expectedLocation !== 'NÃO DEFINIDO' ? 'text-slate-600' : 'text-amber-500'}>{item.expectedLocation}</span>
             </div>
             {item.countedLocations.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                   {item.countedLocations.map((loc: any) => (
                      <span key={loc.name} className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase flex items-center gap-1 ${
                         loc.name === item.expectedLocation 
                           ? 'bg-blue-50 border-blue-100 text-blue-700' 
                           : 'bg-red-50 border-red-100 text-red-600'
                      }`}>
                         {loc.name}: {loc.qty}
                         {loc.name !== item.expectedLocation && <AlertCircle size={8}/>}
                      </span>
                   ))}
                </div>
             ) : (
                <span className="text-[9px] text-slate-300 font-bold italic">Não contado</span>
             )}
          </div>
        </td>
      )}
      {visibleColumns.has('initialBalance') && (
        <td className="px-6 py-4 text-center font-bold text-slate-400 text-sm">{item.initialBalance}</td>
      )}
      {visibleColumns.has('adjustedBalance') && (
        <td className="px-6 py-4 text-center">
           <button 
             onClick={() => onViewMovements(item)}
             className="font-black text-blue-600 text-sm hover:underline hover:text-blue-800 flex items-center justify-center gap-1 mx-auto"
           >
             {item.adjustedBalance}
             {item.hasMovements && <Info size={12} className="text-blue-400"/>}
           </button>
        </td>
      )}
      {visibleColumns.has('countQty') && (
        <td className="px-6 py-4 text-center font-black text-slate-900 text-lg">{item.countQty}</td>
      )}
      {visibleColumns.has('countMov') && (
        <td className="px-6 py-4 text-center font-black text-indigo-700 text-lg bg-indigo-50/30">
           {item.countMov}
           {item.countMov !== item.countQty && (
             <span className="block text-[9px] text-indigo-400 font-bold uppercase">
               {item.countMov - item.countQty > 0 ? '+' : ''}{item.countMov - item.countQty} Mov
             </span>
           )}
        </td>
      )}
      {visibleColumns.has('diff') && (
        <td className="px-6 py-4 text-center font-bold text-slate-500 text-sm">
           {item.countQty - item.adjustedBalance > 0 ? `+${item.countQty - item.adjustedBalance}` : item.countQty - item.adjustedBalance}
        </td>
      )}
      {visibleColumns.has('status') && (
        <td className="px-6 py-4 text-center">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${item.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {item.isCorrect ? 'OK' : 'DIVERGENTE'}
          </span>
        </td>
      )}
      {visibleColumns.has('reasons') && (
        <td className="px-4 py-4">
           <div className="flex flex-wrap gap-1 justify-end">
              {item.isCorrect && <span className="text-[10px] font-bold text-emerald-400">-</span>}
              {item.divergenceReasons.map((r: string, i: number) => (
                 <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[9px] font-black uppercase border border-red-100 whitespace-nowrap">
                    {r}
                 </span>
              ))}
           </div>
        </td>
      )}
      {visibleColumns.has('actions') && (
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {!item.isCorrect && (
              <button 
                onClick={() => {
                   const locs = new Set(item.countedLocations.map((l:any) => l.name));
                   if(item.expectedLocation !== 'NÃO DEFINIDO') locs.add(item.expectedLocation);
                   locs.forEach(l => onReject(String(item.sku), l as string));
                }}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Solicitar Recontagem (Todos Locais Afetados)"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  session, updateSession, countLogs, setCountLogs, unknownBarcodes, setUnknownBarcodes
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'approvals' | 'reports' | 'imports' | 'audit'>('overview');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [approvalTab, setApprovalTab] = useState<'unknown' | 'unlock'>('unknown');
  const [progressViewMode, setProgressViewMode] = useState<'cards' | 'list'>('cards');
  const [progressSearch, setProgressSearch] = useState('');
  const [cardsSortBy, setCardsSortBy] = useState<'name' | 'operator' | 'status'>('name');
  const [listSortConfig, setListSortConfig] = useState<{ key: keyof CountLog | 'timestamp', direction: 'asc' | 'desc' } | null>(null);
  const [selectedLocationForDetail, setSelectedLocationForDetail] = useState<LocationState | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [editingLog, setEditingLog] = useState<CountLog | null>(null);
  const [selectedLocationForDivergence, setSelectedLocationForDivergence] = useState<{location: LocationState; divergences: any[]} | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditShowDiscrepanciesOnly, setAuditShowDiscrepanciesOnly] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [reportSearch, setReportSearch] = useState('');
  const [reportFilterType, setReportFilterType] = useState<'all' | 'correct' | 'error' | 'uncounted' | 'location_error'>('all');
  const [reportPage, setReportPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: ColumnKey, direction: 'asc' | 'desc' } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(REPORT_COLUMNS.map(c => c.key)));
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [viewingMovementsFor, setViewingMovementsFor] = useState<{ item: any, movements: Movement[], firstCountDate: number } | null>(null);
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalShowHistory, setApprovalShowHistory] = useState(false);
  const ITEMS_PER_PAGE = 100;
  const [productImport, setProductImport] = useState<ImportStatus>(INITIAL_IMPORT_STATUS);
  const [movementImport, setMovementImport] = useState<ImportStatus>(INITIAL_IMPORT_STATUS);
  const [locationImport, setLocationImport] = useState<ImportStatus>(INITIAL_IMPORT_STATUS);

  const kpiStats = useMemo(() => {
    // 1. Locations
    const totalLocs = session.locations.length;
    const finishedLocs = session.locations.filter(l => l.status === 'finished').length;
    const countingLocs = session.locations.filter(l => l.status === 'counting').length;
    const reviewLocs = session.locations.filter(l => l.status === 'review').length;
    const idleLocs = session.locations.filter(l => l.status === 'idle').length;
    const closedLocs = finishedLocs;
    const openLocs = totalLocs - finishedLocs;

    // 2. Completion %
    const totalProducts = session.products.length;
    const countedSkus = new Set(countLogs.filter(l => l.status !== 'rejected').map(l => cleanSku(l.sku))).size;
    
    let completionPercentage = 0;
    if (totalProducts > 0) {
        completionPercentage = Math.round((countedSkus / totalProducts) * 100);
    } else if (totalLocs > 0) {
        completionPercentage = Math.round((finishedLocs / totalLocs) * 100);
    }

    // 3. Active Operators (Last 30 mins logs OR assigned to counting locations)
    const activeOpSet = new Set<string>();
    session.locations.filter(l => l.status === 'counting' && l.assignedOperatorId).forEach(l => activeOpSet.add(l.assignedOperatorId!));
    
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).getTime();
    countLogs.forEach(l => {
        if (new Date(l.timestamp).getTime() > thirtyMinsAgo) activeOpSet.add(l.operatorId);
    });
    const activeOperators = activeOpSet.size;

    // 4. Pendings
    const pendingUnknowns = unknownBarcodes.filter(u => u.status === 'pending').length;
    const pendingUnlocks = session.locations.filter(l => l.unlockRequest === 'pending').length;
    const totalPendings = pendingUnknowns + pendingUnlocks;

    // 5. Avg Time per Location
    let totalMinutes = 0;
    let locsWithTime = 0;
    session.locations.filter(l => l.status === 'finished').forEach(loc => {
        const locLogs = countLogs.filter(l => l.location === loc.name).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (locLogs.length >= 2) {
            const start = new Date(locLogs[0].timestamp).getTime();
            const end = new Date(locLogs[locLogs.length-1].timestamp).getTime();
            const mins = (end - start) / 60000;
            if (mins > 0 && mins < 480) { // Filter outliers > 8 hours
                totalMinutes += mins;
                locsWithTime++;
            }
        }
    });
    const avgTime = locsWithTime > 0 ? Math.round(totalMinutes / locsWithTime) : 0;

    return {
        totalLocs, finishedLocs, countingLocs, reviewLocs, idleLocs, closedLocs, openLocs,
        completionPercentage,
        activeOperators,
        totalPendings,
        avgTime
    };
  }, [session.locations, session.products, countLogs, unknownBarcodes]);

  const finishedLocationAlerts = useMemo(() => {
    const finishedLocs = session.locations.filter(l => l.status === 'finished');
    const alerts: Array<{
        location: LocationState;
        divergences: Array<{sku: string, description: string, expected: number, counted: number, type: 'missing' | 'surplus' | 'location_error'}>
    }> = [];

    finishedLocs.forEach(loc => {
        const divergences: Array<{sku: string, description: string, expected: number, counted: number, type: 'missing' | 'surplus' | 'location_error'}> = [];
        
        const expectedProducts = session.products.filter(p => p.location === loc.name);
        const locLogs = countLogs.filter(l => l.location === loc.name && l.status !== 'rejected');
        const countMap = new Map<string, number>();
        locLogs.forEach(l => {
            const sku = cleanSku(l.sku);
            countMap.set(sku, (countMap.get(sku) || 0) + l.quantity);
        });

        expectedProducts.forEach(p => {
            const sku = cleanSku(p.sku);
            const expected = p.initialBalance;
            const counted = countMap.get(sku) || 0;
            if (counted !== expected) {
                divergences.push({
                    sku: p.sku,
                    description: p.description,
                    expected,
                    counted,
                    type: counted < expected ? 'missing' : 'surplus'
                });
            }
            countMap.delete(sku);
        });

        countMap.forEach((qty, sku) => {
            const prod = session.products.find(p => cleanSku(p.sku) === sku);
            divergences.push({
                sku: sku,
                description: prod?.description || 'Desconhecido',
                expected: 0,
                counted: qty,
                type: 'location_error'
            });
        });

        if (divergences.length > 0) {
            alerts.push({ location: loc, divergences });
        }
    });

    return alerts;
  }, [session.locations, session.products, countLogs]);

  // Chart Data Preparation
  const locationStatusData = useMemo(() => {
      const { finishedLocs, countingLocs, reviewLocs, idleLocs } = kpiStats;
      const data = [
          { name: 'Finalizados', value: finishedLocs, color: '#10B981' }, // Emerald-500
          { name: 'Em Contagem', value: countingLocs, color: '#3B82F6' }, // Blue-500
          { name: 'Revisão', value: reviewLocs, color: '#F59E0B' }, // Amber-500
          { name: 'Não Iniciado', value: idleLocs, color: '#94A3B8' } // Slate-400
      ];
      return data.filter(d => d.value > 0);
  }, [kpiStats]);

  const reportData = useMemo(() => {
    const results: any[] = [];
    const correctItems: any[] = [];
    const discrepancies: any[] = [];

    const validLogs = countLogs.filter(l => l.status !== 'rejected');

    const movementsBySku = new Map<string, Movement[]>();
    for (const m of session.movements) {
      const sku = cleanSku(m.sku);
      if (!movementsBySku.has(sku)) movementsBySku.set(sku, []);
      movementsBySku.get(sku)!.push(m);
    }

    const masterSkus = new Set<string>();
    session.products.forEach(p => masterSkus.add(cleanSku(p.sku)));
    validLogs.forEach(l => masterSkus.add(cleanSku(l.sku)));

    const productsMap = new Map<string, Product>();
    session.products.forEach(p => productsMap.set(cleanSku(p.sku), p));

    for (const val of masterSkus) {
        const sku = String(val);
        const productInfo = productsMap.get(sku);
        const expectedLocation = productInfo?.location || 'NÃO DEFINIDO';
        const initialBalance = productInfo?.initialBalance || 0;
        const description = productInfo?.description || 'Item não cadastrado';

        const skuLogs = validLogs.filter(l => cleanSku(l.sku) === sku);
        
        let firstCountTs = Infinity;
        let countQty = 0;
        const countedLocationsMap = new Map<string, number>();

        skuLogs.forEach(log => {
            const logTs = new Date(log.timestamp).getTime();
            if (logTs < firstCountTs) firstCountTs = logTs;
            countQty += log.quantity;
            
            const currentLocQty = countedLocationsMap.get(log.location) || 0;
            countedLocationsMap.set(log.location, currentLocQty + log.quantity);
        });

        let adjustedBalance = initialBalance;
        let postCountMovBalance = 0;
        const skuMovements = movementsBySku.get(sku) || [];
        let hasMovements = false;

        skuMovements.forEach(m => {
            const movTs = new Date(m.timestamp).getTime();
            const qty = m.type === 'in' ? m.quantity : -m.quantity;
            hasMovements = true;

            if (movTs < firstCountTs) {
                adjustedBalance += qty;
            } else {
                postCountMovBalance += qty;
            }
        });
        if (adjustedBalance < 0) adjustedBalance = 0;

        const countMov = countQty + postCountMovBalance;
        const divergenceReasons: string[] = [];
        let isCorrect = true;

        if (countQty !== adjustedBalance) {
            isCorrect = false;
            if (countQty > adjustedBalance) divergenceReasons.push('SOBRA FÍSICA');
            else if (countQty === 0) divergenceReasons.push('NÃO CONTADO');
            else divergenceReasons.push('FALTA FÍSICA');
        }

        const countedLocationsList = Array.from(countedLocationsMap.entries()).map(([name, qty]) => ({ name, qty }));
        
        if (countQty > 0) {
            if (!productInfo) {
                divergenceReasons.push('NÃO CADASTRADO');
                isCorrect = false;
            } else {
                const foundInExpected = countedLocationsMap.has(expectedLocation);
                const foundInOthers = countedLocationsList.some(l => l.name !== expectedLocation);

                if (!foundInExpected && foundInOthers) {
                    divergenceReasons.push('LOCAL ERRADO');
                    isCorrect = false; 
                } else if (foundInExpected && foundInOthers) {
                    divergenceReasons.push('LOCAL MÚLTIPLO');
                    isCorrect = false; 
                }
            }
        }

        if (countQty === adjustedBalance && countQty > 0 && divergenceReasons.length > 0) {
            isCorrect = false;
        }

        const itemData = {
            sku,
            description,
            expectedLocation,
            initialBalance,
            adjustedBalance,
            countQty,
            countMov,
            isCorrect,
            divergenceReasons,
            countedLocations: countedLocationsList,
            hasMovements,
            firstCountTs
        };

        if (isCorrect) correctItems.push(itemData);
        else discrepancies.push(itemData);
        results.push(itemData);
    }

    return { results, correctItems, discrepancies };
  }, [session.products, session.movements, countLogs]);

  const processedReportResults = useMemo(() => {
    let data = [...reportData.results];

    if (reportFilterType === 'correct') {
      data = data.filter(i => i.isCorrect);
    } else if (reportFilterType === 'error') {
      data = data.filter(i => !i.isCorrect);
    } else if (reportFilterType === 'uncounted') {
      data = data.filter(i => i.adjustedBalance > 0 && i.countQty === 0);
    } else if (reportFilterType === 'location_error') {
      data = data.filter(i => Array.isArray(i.divergenceReasons) && i.divergenceReasons.some((r: any) => r === 'LOCAL ERRADO' || r === 'LOCAL MÚLTIPLO'));
    }

    if (reportSearch.trim()) {
      const term = reportSearch.toLowerCase();
      data = data.filter((i: any) => 
        i.sku.toLowerCase().includes(term) || 
        i.description.toLowerCase().includes(term) ||
        (i.expectedLocation && i.expectedLocation.toLowerCase().includes(term))
      );
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (sortConfig.key === 'diff') {
             const diffA = a.countQty - a.adjustedBalance;
             const diffB = b.countQty - b.adjustedBalance;
             return sortConfig.direction === 'asc' ? diffA - diffB : diffB - diffA;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
           return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        
        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [reportData.results, reportFilterType, reportSearch, sortConfig]);

  const paginatedResults = useMemo(() => {
    return processedReportResults.slice((reportPage - 1) * ITEMS_PER_PAGE, reportPage * ITEMS_PER_PAGE);
  }, [processedReportResults, reportPage]);

  const totalReportPages = Math.ceil(processedReportResults.length / ITEMS_PER_PAGE);

  const filteredApprovals = useMemo(() => {
    let items = unknownBarcodes;
    if (approvalShowHistory) {
      items = items.filter(u => u.status !== 'pending' && u.status !== 'in_review');
    } else {
      items = items.filter(u => u.status === 'pending' || u.status === 'in_review');
    }
    if (approvalSearch.trim()) {
      const term = approvalSearch.toLowerCase();
      items = items.filter(u => 
        u.barcode.toLowerCase().includes(term) ||
        u.location.toLowerCase().includes(term) ||
        u.operatorId.toLowerCase().includes(term) ||
        (u.resolvedSku && u.resolvedSku.toLowerCase().includes(term))
      );
    }
    return items.sort((a, b) => {
       if (a.status !== b.status) {
          if (a.status === 'pending') return -1;
          if (b.status === 'pending') return 1;
       }
       return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [unknownBarcodes, approvalSearch, approvalShowHistory]);

  const pendingApprovals = useMemo(() => filteredApprovals.filter(u => u.status === 'pending'), [filteredApprovals]);
  const reviewApprovals = useMemo(() => filteredApprovals.filter(u => u.status === 'in_review'), [filteredApprovals]);

  const unlockRequests = useMemo(() => {
    return session.locations.filter(l => l.unlockRequest === 'pending');
  }, [session.locations]);

  const filteredAuditLogs = useMemo(() => {
    let logs = [...countLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (auditShowDiscrepanciesOnly) {
      const discrepantSkus = new Set(reportData.discrepancies.map(d => d.sku));
      logs = logs.filter(l => discrepantSkus.has(cleanSku(l.sku)));
    }
    if (auditSearch.trim()) {
      const lowerSearch = auditSearch.toLowerCase();
      logs = logs.filter(l => 
        l.sku.toLowerCase().includes(lowerSearch) ||
        l.location.toLowerCase().includes(lowerSearch) ||
        l.operatorId.toLowerCase().includes(lowerSearch)
      );
    }
    return logs;
  }, [countLogs, auditSearch, auditShowDiscrepanciesOnly, reportData.discrepancies]);

  const paginatedAuditLogs = useMemo(() => {
    return filteredAuditLogs.slice((auditPage - 1) * ITEMS_PER_PAGE, auditPage * ITEMS_PER_PAGE);
  }, [filteredAuditLogs, auditPage]);

  // -- PROGRESS TAB CALCULATIONS --
  const progressData = useMemo(() => {
    if (progressViewMode === 'cards') {
        const data = session.locations.map(loc => {
            const locLogs = countLogs.filter(l => l.location === loc.name && l.status !== 'rejected');
            const totalItems = locLogs.reduce((acc, l) => acc + l.quantity, 0);
            const distinctSkus = new Set(locLogs.map(l => cleanSku(l.sku))).size;
            return { ...loc, totalItems, distinctSkus };
        }).filter(loc => 
            loc.name.toLowerCase().includes(progressSearch.toLowerCase()) || 
            (loc.assignedOperatorId && loc.assignedOperatorId.toLowerCase().includes(progressSearch.toLowerCase()))
        );

        // Sorting Logic for Cards
        return data.sort((a, b) => {
            if (cardsSortBy === 'name') {
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            } else if (cardsSortBy === 'operator') {
                return (a.assignedOperatorId || 'zz').localeCompare(b.assignedOperatorId || 'zz');
            } else if (cardsSortBy === 'status') {
                // Priority: Review -> Counting -> Finished -> Idle
                const statusPriority: Record<string, number> = {
                    'review': 0,
                    'counting': 1,
                    'finished': 2,
                    'idle': 3
                };
                return statusPriority[a.status] - statusPriority[b.status];
            }
            return 0;
        });
    } else {
        // List Mode
        let logs = countLogs
            .filter(l => l.status !== 'rejected')
            .filter(l => 
                l.location.toLowerCase().includes(progressSearch.toLowerCase()) ||
                l.sku.toLowerCase().includes(progressSearch.toLowerCase()) ||
                l.operatorId.toLowerCase().includes(progressSearch.toLowerCase())
            );

        // Sorting Logic for List
        if (listSortConfig) {
            logs = logs.sort((a, b) => {
                let valA: any = a[listSortConfig.key as keyof CountLog];
                let valB: any = b[listSortConfig.key as keyof CountLog];

                if (listSortConfig.key === 'timestamp') {
                    return listSortConfig.direction === 'asc' 
                        ? new Date(valA).getTime() - new Date(valB).getTime()
                        : new Date(valB).getTime() - new Date(valA).getTime();
                }

                if (typeof valA === 'string' && typeof valB === 'string') {
                    return listSortConfig.direction === 'asc'
                        ? valA.localeCompare(valB, undefined, { numeric: true })
                        : valB.localeCompare(valA, undefined, { numeric: true });
                }
                
                if (typeof valA === 'number' && typeof valB === 'number') {
                     return listSortConfig.direction === 'asc' ? valA - valB : valB - valA;
                }
                
                return 0;
            });
        } else {
            // Default sort
            logs = logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return logs;
    }
  }, [session.locations, countLogs, progressViewMode, progressSearch, cardsSortBy, listSortConfig]);

  const locationDetailItems = useMemo(() => {
      if (!selectedLocationForDetail) return [];
      const logs = countLogs.filter(l => l.location === selectedLocationForDetail.name && l.status !== 'rejected');
      const grouped = new Map<string, {sku: string, qty: number, description: string}>();
      
      logs.forEach(l => {
          const sku = cleanSku(l.sku);
          if(!grouped.has(sku)) {
              const prod = session.products.find(p => cleanSku(p.sku) === sku);
              grouped.set(sku, {sku, qty: 0, description: prod?.description || 'Desconhecido'});
          }
          grouped.get(sku)!.qty += l.quantity;
      });
      return Array.from(grouped.values()).sort((a,b) => a.sku.localeCompare(b.sku));
  }, [selectedLocationForDetail, countLogs, session.products]);

  useEffect(() => {
    setReportPage(1);
  }, [reportSearch, reportFilterType]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSearch, auditShowDiscrepanciesOnly]);

  const handleSort = (key: ColumnKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleListSort = (key: keyof CountLog | 'timestamp') => {
      setListSortConfig(prev => {
          if (prev && prev.key === key) {
              return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
          }
          return { key, direction: 'asc' };
      });
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportCSV = () => {
    const exportableCols = REPORT_COLUMNS.filter(col => col.exportable && visibleColumns.has(col.key));
    const headerRow = exportableCols.map(col => col.label).join(';');
    
    const rows = processedReportResults.map(item => {
      return exportableCols.map(col => {
        let val: any = item[col.key];
        
        if (col.key === 'diff') val = item.countQty - item.adjustedBalance;
        if (col.key === 'status') val = item.isCorrect ? 'OK' : 'DIVERGENTE';
        if (col.key === 'locationDetail') {
            val = `Exp: ${item.expectedLocation} | Real: ${item.countedLocations.map((l:any) => `${l.name}(${l.qty})`).join(', ')}`;
        }
        if (col.key === 'reasons') val = item.divergenceReasons.join(', ');
        
        if (typeof val === 'string') return `"${(val as string).replace(/"/g, '""')}"`;
        return val;
      }).join(';');
    });

    const csvContent = [headerRow, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventario_${session.name}_CONSOLIDADO_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApproveUnknown = (item: UnknownBarcode, realSku: string) => {
    const cleanedSku = cleanSku(realSku);
    if (!cleanedSku) return;
    setUnknownBarcodes(prev => prev.map(u => u.id === item.id ? { ...u, status: 'approved', resolvedSku: cleanedSku } : u));
    setCountLogs(prev => prev.map(log => {
      if (log.sku === item.barcode && log.location === item.location && log.operatorId === item.operatorId) {
        return { ...log, sku: cleanedSku, status: 'approved' };
      }
      return log;
    }));
  };

  const handleRejectUnknown = (item: UnknownBarcode) => {
    setUnknownBarcodes(prev => prev.map(u => u.id === item.id ? { ...u, status: 'rejected' } : u));
    setCountLogs(prev => prev.map(log => {
      if (log.sku === item.barcode && log.location === item.location && log.operatorId === item.operatorId) {
        return { ...log, status: 'rejected' };
      }
      return log;
    }));
  };

  const handleRequestReviewUnknown = (unknown: UnknownBarcode) => {
    setUnknownBarcodes(prev => prev.map(u => u.id === unknown.id ? { ...u, status: 'in_review' } : u));
    const updatedLocations = session.locations.map(loc => {
      if (loc.name === unknown.location) {
        return { 
          ...loc, 
          status: 'review' as const, 
          assignedOperatorId: unknown.operatorId,
          reviewSkus: Array.from(new Set([...(loc.reviewSkus || []), unknown.barcode]))
        };
      }
      return loc;
    });
    updateSession({ ...session, locations: updatedLocations });
  };

  const handleApproveUnlock = (locationId: string) => {
    updateSession(prev => ({
      ...prev,
      locations: prev.locations.map(l => {
        if (l.id === locationId) {
          const { unlockRequest, ...rest } = l;
          return { ...rest, status: 'counting' };
        }
        return l;
      })
    }));
  };

  const handleRejectUnlock = (locationId: string) => {
    updateSession(prev => ({
      ...prev,
      locations: prev.locations.map(l => {
        if (l.id === locationId) {
          return { ...l, unlockRequest: 'rejected' };
        }
        return l;
      })
    }));
  };

  const handleRequestReview = () => {
    if (selectedItems.size === 0) return;
    const itemsByLocation: Record<string, string[]> = {};
    
    const selectedSkus = Array.from(selectedItems);
    
    selectedSkus.forEach(sku => {
        const itemData = reportData.results.find(r => r.sku === sku);
        if (itemData) {
            itemData.countedLocations.forEach((loc: any) => {
                if (!itemsByLocation[loc.name]) itemsByLocation[loc.name] = [];
                itemsByLocation[loc.name].push(sku);
            });
            if (itemData.expectedLocation !== 'NÃO DEFINIDO') {
                 if (!itemsByLocation[itemData.expectedLocation]) itemsByLocation[itemData.expectedLocation] = [];
                 itemsByLocation[itemData.expectedLocation].push(sku);
            }
        }
    });

    const locationNames = Object.keys(itemsByLocation);
    if (!confirm(`Solicitar revisão para ${selectedItems.size} SKUs? Isso afetará ${locationNames.length} locais.`)) return;
    
    setCountLogs(prev => prev.map(log => {
      const sku = cleanSku(log.sku);
      if (selectedItems.has(sku)) return { ...log, status: 'rejected' };
      return log;
    }));

    const updatedLocations = session.locations.map(loc => {
      if (itemsByLocation[loc.name]) {
        const skusToReview = itemsByLocation[loc.name];
        const lastLog = [...countLogs].reverse().find(l => l.location === loc.name && skusToReview.includes(cleanSku(l.sku)));
        const existingSkus = new Set(loc.reviewSkus || []);
        skusToReview.forEach(s => existingSkus.add(s));
        return {
          ...loc,
          status: 'review' as const, 
          assignedOperatorId: lastLog?.operatorId || loc.assignedOperatorId,
          reviewSkus: Array.from(existingSkus)
        };
      }
      return loc;
    });
    updateSession({ ...session, locations: updatedLocations });
    setSelectedItems(new Set());
  };

  const toggleSelection = (key: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRejectCount = (sku: string, location: string) => {
    const lastLog = [...countLogs].reverse().find(l => cleanSku(l.sku) === cleanSku(sku) && l.location === location);
    if (!lastLog) return;
    setCountLogs(prev => prev.map(log => {
      if (cleanSku(log.sku) === cleanSku(sku) && log.location === location) return { ...log, status: 'rejected' };
      return log;
    }));
    const updatedLocations = session.locations.map(loc => {
      if (loc.name === location) {
        return { 
          ...loc, 
          status: 'review' as const, 
          assignedOperatorId: lastLog.operatorId,
          reviewSkus: [...(loc.reviewSkus || []), cleanSku(sku)]
        };
      }
      return loc;
    });
    updateSession({ ...session, locations: updatedLocations });
  };

  const handleViewMovements = (item: any) => {
    const sku = cleanSku(item.sku);
    const relevantMovements = session.movements.filter(m => {
       const isSameSku = cleanSku(m.sku) === sku;
       return isSameSku;
    });

    setViewingMovementsFor({ 
      item, 
      movements: relevantMovements,
      firstCountDate: item.firstCountTs || Infinity 
    });
  };

  const handleUpdateLog = (logId: string, newQty: number) => {
      if (newQty < 0) return;
      setCountLogs(prev => prev.map(l => l.id === logId ? { ...l, quantity: newQty } : l));
      setEditingLog(null);
  };

  const handleDeleteLog = (logId: string) => {
      if(!confirm("Tem certeza que deseja excluir este registro?")) return;
      setCountLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'rejected' } : l));
  };

  const handleAddLog = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const location = formData.get('location') as string;
      const sku = formData.get('sku') as string;
      const quantity = parseInt(formData.get('quantity') as string);

      if(!location || !sku || isNaN(quantity)) return;

      const locExists = session.locations.find(l => l.name === location);
      if(!locExists) {
          updateSession(prev => ({
              ...prev,
              locations: [...prev.locations, { 
                  id: Math.random().toString(36), 
                  name: location, 
                  status: 'counting',
                  assignedOperatorId: 'SUPERVISOR' 
              }]
          }));
      }

      setCountLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          sessionId: session.id,
          sku: cleanSku(sku),
          location,
          quantity,
          operatorId: 'SUPERVISOR',
          timestamp: new Date().toISOString(),
          type: 'manual',
          status: 'approved'
      }]);
      setIsAddingLog(false);
  };

  const handleDeleteItemFromLocation = (sku: string, location: string) => {
      if(!confirm(`Remover todos os itens ${sku} do local ${location}?`)) return;
      setCountLogs(prev => prev.map(l => {
          if(l.location === location && cleanSku(l.sku) === cleanSku(sku)) {
              return { ...l, status: 'rejected' };
          }
          return l;
      }));
  };

  // ... (File Import Logic)
  const initFileMapping = (type: 'products' | 'movements' | 'locations', file: File) => {
    const setStatus = type === 'products' ? setProductImport : type === 'movements' ? setMovementImport : setLocationImport;
    setStatus(prev => ({ ...prev, isFileReading: true, fileName: file.name }));
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            if (!text || text.length === 0) throw new Error("O arquivo está vazio.");
            const firstChunk = text.slice(0, 50000); 
            const sampleLines = firstChunk.split(/\r?\n/).filter(line => line.trim() !== "");
            if (sampleLines.length === 0) throw new Error("Nenhuma linha de dados encontrada.");
            let delimiter = ';';
            const firstLine = sampleLines[0];
            if (firstLine.includes('\t')) delimiter = '\t';
            else if (firstLine.includes('|')) delimiter = '|';
            else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delimiter = ';';
            else delimiter = ',';
            const previewRows = sampleLines.slice(0, 6).map(l => l.split(delimiter).map(c => c.trim()));
            const headers = previewRows[0];
            const initialMapping: Record<string, number> = {};
            const fields = type === 'products' ? ['sku', 'description', 'barcodes', 'initialBalance', 'location'] : type === 'movements' ? ['sku', 'entryQuantity', 'exitQuantity', 'timestamp', 'reason'] : ['location']; 
            fields.forEach(field => {
                const index = headers.findIndex(h => FIELD_SYNONYMS[field]?.some(syn => h.toLowerCase().includes(syn.toLowerCase())));
                if (index !== -1) initialMapping[field] = index;
            });
            const estimatedLines = text.length / (firstLine.length + 1);
            setStatus({ ...INITIAL_IMPORT_STATUS, isFileReading: false, isMapping: true, fileName: file.name, fileContent: text, headers, previewRows: previewRows.slice(1), delimiter, mapping: initialMapping, total: Math.floor(estimatedLines) });
          } catch (err: any) {
            alert("Erro ao ler arquivo: " + err.message);
            setStatus(prev => ({ ...prev, isFileReading: false, fileName: null }));
          }
        };
        reader.onerror = () => {
            alert("Erro de leitura do arquivo. Tente novamente.");
            setStatus(prev => ({ ...prev, isFileReading: false, fileName: null }));
        };
        reader.readAsText(file);
    }, 100);
  };

  const startProcessing = async (type: 'products' | 'movements' | 'locations') => {
    const status = type === 'products' ? productImport : type === 'movements' ? movementImport : locationImport;
    const setStatus = type === 'products' ? setProductImport : type === 'movements' ? setMovementImport : setLocationImport;
    if (!status.fileContent) return;
    setStatus(prev => ({ ...prev, isProcessing: true, isMapping: false, isCompleted: false, processedCount: 0, errorCount: 0, successCount: 0, progress: 0 }));
    setTimeout(async () => {
        let allLines = status.fileContent!.split(/\r?\n/).filter(l => l.trim() !== "");
        if (status.skipFirstRow) allLines = allLines.slice(1);
        const totalLines = allLines.length;
        setStatus(prev => ({ ...prev, total: totalLines }));
        const CHUNK_SIZE = 5000;
        const newProducts: Product[] = [];
        const newMovements: Movement[] = [];
        const newLocations: LocationState[] = [];
        let chunkSuccess = 0;
        let chunkError = 0;
        let processedGlobal = 0;
        for (let i = 0; i < totalLines; i += CHUNK_SIZE) {
            const chunk = allLines.slice(i, Math.min(i + CHUNK_SIZE, totalLines));
            chunk.forEach(line => {
                const p = line.split(status.delimiter).map(c => c.trim());
                try {
                  if (type === 'products') {
                    const sku = cleanSku(p[status.mapping['sku']] as string);
                    if (!sku) throw new Error('SKU inválido');
                    const barcode = status.mapping['barcodes'] !== undefined ? p[status.mapping['barcodes']] : sku;
                    const location = status.mapping['location'] !== undefined ? (p[status.mapping['location']] || 'NÃO DEFINIDO') : 'NÃO DEFINIDO';
                    newProducts.push({ sku, description: p[status.mapping['description']] || 'Sem descrição', barcodes: [barcode], initialBalance: parseInt(p[status.mapping['initialBalance']]) || 0, location: location });
                    chunkSuccess++;
                  } else if (type === 'movements') {
                    const sku = cleanSku(p[status.mapping['sku']] as string);
                    if (!sku) throw new Error('SKU inválido');
                    
                    const entryRaw = parseFloat(p[status.mapping['entryQuantity']]) || 0;
                    const exitRaw = parseFloat(p[status.mapping['exitQuantity']]) || 0;
                    const timestampRaw = status.mapping['timestamp'] !== undefined ? p[status.mapping['timestamp']] : null;
                    const reason = status.mapping['reason'] !== undefined ? p[status.mapping['reason']] : undefined;
                    
                    let timestamp = new Date().toISOString();
                    
                    if (timestampRaw && typeof timestampRaw === 'string') {
                        const parsedDate = parseFlexibleDate(timestampRaw);
                        if (parsedDate) timestamp = parsedDate;
                    }

                    let quantity = 0;
                    let movType: 'in' | 'out' = 'in';

                    if (entryRaw > 0) {
                      quantity = entryRaw;
                      movType = 'in';
                    } else if (exitRaw > 0) {
                      quantity = exitRaw;
                      movType = 'out';
                    } else {
                       throw new Error("Quantidade inválida");
                    }

                    newMovements.push({ 
                        sku, 
                        quantity: Math.abs(quantity), 
                        timestamp, 
                        type: movType,
                        reason: reason
                    });
                    chunkSuccess++;
                  } else if (type === 'locations') {
                    const name = p[status.mapping['location']] || p[0];
                    if (!name) throw new Error('Nome inválido');
                    newLocations.push({ id: Math.random().toString(36).substr(2, 9), name: name.toUpperCase(), status: 'idle' as const });
                    chunkSuccess++;
                  }
                } catch (e) { chunkError++; }
            });
            processedGlobal += chunk.length;
            const progress = Math.min(Math.round((processedGlobal / totalLines) * 100), 100);
            setStatus(prev => ({ ...prev, processedCount: processedGlobal, successCount: chunkSuccess, errorCount: chunkError, progress: progress }));
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (type === 'products') updateSession(prev => ({...prev, products: [...prev.products, ...newProducts]}));
        else if (type === 'movements') updateSession(prev => ({...prev, movements: [...prev.movements, ...newMovements]}));
        else if (type === 'locations') updateSession(prev => ({...prev, locations: [...prev.locations, ...newLocations]}));
        setTimeout(() => { setStatus(prev => ({ ...prev, isProcessing: false, isCompleted: true, progress: 100 })); }, 300);
    }, 200);
  };
  
  const renderMappingUI = (type: 'products' | 'movements' | 'locations') => {
    const status = type === 'products' ? productImport : type === 'movements' ? movementImport : locationImport;
    const setStatus = type === 'products' ? setProductImport : type === 'movements' ? setMovementImport : setLocationImport;
    const fields = type === 'products' 
      ? [{id: 'sku', label: 'SKU (Obrigatório)', required: true}, {id: 'description', label: 'Descrição', required: false}, {id: 'barcodes', label: 'Código de Barras', required: false}, {id: 'initialBalance', label: 'Saldo de Estoque', required: false}, {id: 'location', label: 'Local Vinculado', required: false}] 
      : type === 'movements' 
        ? [{id: 'sku', label: 'SKU do Item', required: true}, {id: 'entryQuantity', label: 'Qtd Entrada', required: false}, {id: 'exitQuantity', label: 'Qtd Saída', required: false}, {id: 'timestamp', label: 'Data/Hora', required: false}, {id: 'reason', label: 'Motivo', required: false}] 
        : [{id: 'location', label: 'Nome do Local/Endereço', required: true}];
    const canImport = fields.every(f => !f.required || status.mapping[f.id] !== undefined);
    
    const canImportMovementExtra = type === 'movements' ? (status.mapping['entryQuantity'] !== undefined || status.mapping['exitQuantity'] !== undefined) : true;

    if (status.isFileReading) return (<div className="flex flex-col items-center justify-center p-12 space-y-8 animate-in fade-in fixed inset-0 z-[60] bg-white/95 backdrop-blur-sm"><div className="flex flex-col items-center"><Loader2 size={64} className="text-blue-600 animate-spin mb-6" /><h3 className="text-3xl font-black text-slate-800 tracking-tight">Analisando Arquivo...</h3><p className="text-base text-slate-400 font-medium mt-2">Isso pode levar alguns segundos para arquivos grandes.</p></div></div>);
    if (status.isProcessing) return (<div className="flex flex-col items-center justify-center p-12 space-y-8 animate-in fade-in fixed inset-0 z-[60] bg-white/95 backdrop-blur-sm"><div className="relative w-48 h-48 flex items-center justify-center"><svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 36 36"><path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" /><path className="text-blue-600 transition-all duration-300 ease-out" strokeDasharray={`${status.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" /></svg><div className="absolute inset-0 flex items-center justify-center flex-col"><span className="text-5xl font-black text-slate-800">{status.progress}%</span><span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Processando</span></div></div><div className="text-center space-y-2"><h3 className="text-2xl font-black text-slate-800">Importando dados...</h3><p className="text-slate-500">Por favor, não feche esta janela.</p></div><div className="grid grid-cols-2 gap-6 w-full max-w-lg mt-4"><div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center"><p className="text-[10px] uppercase font-black text-emerald-600 mb-2 tracking-widest">Sucesso</p><p className="text-4xl font-black text-slate-800">{status.successCount}</p></div><div className="bg-red-50 p-6 rounded-3xl border border-red-100 text-center"><p className="text-[10px] uppercase font-black text-red-600 mb-2 tracking-widest">Erros / Ignorados</p><p className="text-4xl font-black text-slate-800">{status.errorCount}</p></div></div><div className="w-full max-w-lg bg-slate-100 h-2 rounded-full overflow-hidden mt-4"><div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(status.processedCount / (status.total || 1)) * 100}%` }}></div></div><p className="text-xs font-bold text-slate-400">Linha {status.processedCount} de {status.total}</p></div>);
    
    if (status.isCompleted) return (
      <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-300">
        <div className="w-full max-w-2xl flex flex-col items-center text-center">
           
           <div className="mb-8 relative">
              <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center animate-bounce-short">
                 <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center border-8 border-white shadow-xl shadow-emerald-100">
                    <Check size={48} className="text-emerald-500" strokeWidth={4} />
                 </div>
              </div>
           </div>

           <div className="space-y-4 mb-12">
              <div className="flex items-center justify-center gap-4">
                 <div className="h-px w-12 bg-slate-200"></div>
                 <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Importação Concluída!</h3>
                 <div className="h-px w-12 bg-slate-200"></div>
              </div>
              <p className="text-lg text-slate-500 font-medium">Os dados foram processados e adicionados com sucesso.</p>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mb-12 max-w-lg">
              <div className="bg-white p-8 rounded-[32px] border border-emerald-100 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.1)] flex flex-col items-center justify-center relative overflow-hidden group">
                 <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-200"></div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Registros Criados</p>
                 <p className="text-6xl font-black text-slate-900 tracking-tight group-hover:scale-110 transition-transform">{status.successCount}</p>
              </div>
              
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center relative overflow-hidden group">
                 <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-200 opacity-50"></div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Falhas / Ignorados</p>
                 <p className={`text-6xl font-black tracking-tight group-hover:scale-110 transition-transform ${status.errorCount > 0 ? 'text-red-500' : 'text-slate-300'}`}>{status.errorCount}</p>
              </div>
           </div>

           <button 
             onClick={() => setStatus(INITIAL_IMPORT_STATUS)} 
             className="bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-300 hover:shadow-slate-400 transition-all active:scale-95 hover:-translate-y-1"
           >
             Fechar e Voltar
           </button>
        </div>
      </div>
    );

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 mb-8"><h4 className="text-blue-600 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Settings2 size={16}/> Configurar Colunas: {status.fileName}<span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-[10px]">Delimitador: "{status.delimiter === '\t' ? 'TAB' : status.delimiter}"</span></h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields.map(f => (<div key={f.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col gap-1"><div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{f.label}</label>{!f.required && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">OPCIONAL</span>}</div><select value={status.mapping[f.id] ?? ''} onChange={(e) => setStatus(prev => ({...prev, mapping: {...prev.mapping, [f.id]: parseInt(e.target.value)}}))} className="w-full bg-transparent font-bold text-slate-700 outline-none cursor-pointer"><option value="">{f.required ? 'Selecione...' : 'Ignorar coluna'}</option>{status.headers.map((h, idx) => (<option key={idx} value={idx}>{idx} - {h}</option>))}</select></div>))}</div></div><div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-100"><tr>{status.headers.map((h, i) => (<th key={i} className="px-4 py-3 font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap">{status.mapping['sku'] === i && <span className="mr-1 text-blue-500 underline">SKU</span>}{status.mapping['barcodes'] === i && <span className="mr-1 text-emerald-500 underline">EAN</span>}{h}</th>))}</tr></thead><tbody>{status.previewRows.map((row, i) => (<tr key={i} className="border-b border-slate-50">{row.map((cell, j) => (<td key={j} className={`px-4 py-3 font-medium ${Object.values(status.mapping).includes(j) ? 'bg-blue-50/20 text-blue-700' : 'text-slate-400'}`}>{cell}</td>))}</tr>))}</tbody></table></div><div className="flex justify-end gap-4 mt-8"><button onClick={() => setStatus(prev => ({...prev, isMapping: false, fileName: null}))} className="px-8 py-4 rounded-2xl font-black text-xs text-slate-400 hover:bg-slate-100">CANCELAR</button><button onClick={() => startProcessing(type)} disabled={!canImport || !canImportMovementExtra} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-xl shadow-blue-200 transition-all active:scale-95">IMPORTAR {status.total > 0 ? `(~${status.total} linhas)` : ''}</button></div></div>
    );
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-slate-50">
      <aside className="w-full md:w-80 bg-white border-r border-slate-200 p-8 flex flex-col gap-3 shadow-sm z-10">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 px-4">Painel Gestor</h2>
        {[
          {id: 'overview', icon: PieChartIcon, label: 'Dashboard'},
          {id: 'progress', icon: Activity, label: 'Andamento'},
          {id: 'approvals', icon: UserCheck, label: 'Aprovações', alert: unknownBarcodes.filter(u => u.status === 'pending').length + unlockRequests.length},
          {id: 'audit', icon: ScrollText, label: 'Auditoria'},
          {id: 'reports', icon: FileText, label: 'Relatórios'},
          {id: 'imports', icon: FileUp, label: 'Importação'}
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as any)} 
            className={`flex items-center justify-between px-6 py-5 rounded-[24px] font-black text-sm transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-4">
              <item.icon size={20} /> {item.label}
            </div>
            {item.alert ? (
              <span className="bg-amber-500 text-white text-[9px] px-2 py-1 rounded-full">{item.alert}</span>
            ) : null}
          </button>
        ))}
      </aside>

      <main className="flex-1 overflow-y-auto p-10 md:p-16 relative">
        {activeTab === 'overview' && (
          <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in">
             <header className="mb-8">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Painel de Controle</h1>
                <p className="text-slate-500 font-medium">Visão em tempo real da operação de inventário.</p>
             </header>

             {/* ALERTAS DE DIVERGÊNCIA EM LOCAIS FINALIZADOS (Se houver) */}
             {finishedLocationAlerts.length > 0 && (
                <div className="bg-red-50 rounded-[32px] p-8 border border-red-100 animate-in slide-in-from-top-4">
                    <h3 className="text-xl font-black text-red-600 mb-4 flex items-center gap-2">
                        <AlertTriangle className="animate-pulse" /> ALERTAS DE DIVERGÊNCIA EM LOCAIS FINALIZADOS
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {finishedLocationAlerts.map(({location, divergences}: any) => (
                             <button 
                                key={location.id} 
                                onClick={() => setSelectedLocationForDivergence({location, divergences})} 
                                className="bg-white p-6 rounded-[32px] shadow-lg shadow-red-100 border-2 border-red-100 hover:border-red-300 transition-all text-left relative overflow-hidden group"
                             >
                                 <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-2 rounded-bl-2xl font-black text-xs uppercase">
                                     {divergences.length} ERROS
                                 </div>
                                 <h4 className="text-2xl font-black text-slate-800 mb-1">{location.name}</h4>
                                 <p className="text-xs text-slate-400 font-bold uppercase mb-4">Finalizado por: {location.assignedOperatorId}</p>
                                 <div className="flex flex-col gap-1">
                                     {divergences.slice(0, 3).map((div: any, i: number) => (
                                         <div key={i} className="flex items-center justify-between text-xs bg-red-50 p-2 rounded-lg border border-red-100">
                                             <span className="font-bold text-slate-700 truncate max-w-[100px]">{div.sku}</span>
                                             <span className="font-black text-red-600">
                                                 {div.type === 'missing' ? `FALTA (${div.expected - div.counted})` : 
                                                  div.type === 'surplus' ? `SOBRA (+${div.counted - div.expected})` : 
                                                  'LOCAL ERRADO'}
                                             </span>
                                         </div>
                                     ))}
                                     {divergences.length > 3 && (
                                         <p className="text-[10px] text-center font-bold text-slate-400 mt-1">+ {divergences.length - 3} outros itens</p>
                                     )}
                                 </div>
                                 <div className="mt-4 w-full bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 group-hover:bg-red-600 transition-colors">
                                     Resolver Pendências <ChevronRight size={14}/>
                                 </div>
                             </button>
                        ))}
                    </div>
                </div>
             )}

             {/* KPI GRID */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 1. PROGRESS CARD */}
                <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={120} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Progresso Total</p>
                        <div className="flex items-end gap-2 mb-4">
                            <h3 className="text-6xl font-black tracking-tighter">{kpiStats.completionPercentage}%</h3>
                        </div>
                        <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full transition-all duration-1000" style={{width: `${kpiStats.completionPercentage}%`}}></div>
                        </div>
                        <p className="text-xs font-bold mt-4 opacity-80">
                            Baseado em {session.products.length > 0 ? 'SKUs contados' : 'Locais finalizados'}
                        </p>
                    </div>
                </div>

                {/* 2. LOCATION STATUS CARD */}
                <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 z-10">Status dos Locais</p>
                    <div className="flex-1 min-h-[140px] relative z-0 -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie
                                data={locationStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {locationStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                 itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              />
                           </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="absolute bottom-6 right-6 flex flex-col items-end z-10 pointer-events-none">
                       <span className="text-3xl font-black text-slate-800">{kpiStats.finishedLocs}</span>
                       <span className="text-[10px] uppercase font-black text-emerald-500">Concluídos</span>
                    </div>
                </div>

                {/* 3. EFFICIENCY & OPERATORS CARD */}
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-between">
                     <div className="flex items-center justify-between mb-4">
                         <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Eficiência</p>
                         <Timer size={20} className="text-slate-300"/>
                     </div>
                     <div className="flex-1 flex flex-col justify-center items-center text-center">
                         <h3 className="text-5xl font-black text-slate-800 mb-2">{kpiStats.avgTime}<span className="text-lg text-slate-400 ml-1">min</span></h3>
                         <p className="text-xs font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full">Tempo Médio / Local</p>
                     </div>
                     <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Operadores Ativos</span>
                        <div className="flex items-center gap-2">
                            <Users size={14} className="text-blue-500"/>
                            <span className="text-lg font-black text-slate-800">{kpiStats.activeOperators}</span>
                        </div>
                     </div>
                </div>

                {/* 4. ACTION CARD */}
                <div 
                    onClick={() => setActiveTab('approvals')}
                    className={`p-8 rounded-[40px] shadow-sm border transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between ${kpiStats.totalPendings > 0 ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200' : 'bg-white border-slate-100'}`}
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${kpiStats.totalPendings > 0 ? 'text-amber-100' : 'text-slate-400'}`}>Atenção Necessária</p>
                            <ShieldAlert size={20} className={kpiStats.totalPendings > 0 ? 'text-amber-200' : 'text-slate-300'}/>
                        </div>
                        <h3 className={`text-5xl font-black mb-2 ${kpiStats.totalPendings > 0 ? 'text-white' : 'text-slate-300'}`}>{kpiStats.totalPendings}</h3>
                        <p className={`text-xs font-bold uppercase ${kpiStats.totalPendings > 0 ? 'text-amber-100' : 'text-slate-400'}`}>
                            Pendências Abertas
                        </p>
                    </div>
                    {kpiStats.totalPendings > 0 && (
                        <div className="absolute -bottom-4 -right-4 text-amber-600 opacity-20">
                            <AlertOctagon size={120} />
                        </div>
                    )}
                    {kpiStats.totalPendings > 0 && (
                         <div className="mt-4 bg-white/20 p-2 rounded-xl text-center text-[10px] font-black uppercase hover:bg-white/30 transition-colors">
                             Resolver Agora
                         </div>
                    )}
                </div>
             </div>

          </div>
        )}

        {/* ... Rest of the component (Progress, Approvals, Audit, Reports, Imports, etc.) ... */}
        {activeTab === 'progress' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in h-full flex flex-col">
             <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
               <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Andamento da Contagem</h2>
                  <p className="text-slate-500 font-medium">Monitore o progresso por local ou lista geral.</p>
               </div>
               
               <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <Search size={20} className="ml-2 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Filtrar local, SKU ou operador..." 
                      className="px-2 py-2 w-full md:w-64 bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                      value={progressSearch}
                      onChange={(e) => setProgressSearch(e.target.value)}
                    />
                  </div>
                  
                  {progressViewMode === 'cards' && (
                    <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase mr-1 pl-2 hidden lg:block">Ordenar:</span>
                        <button 
                            onClick={() => setCardsSortBy('name')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${cardsSortBy === 'name' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            Local
                        </button>
                        <button 
                            onClick={() => setCardsSortBy('operator')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${cardsSortBy === 'operator' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            Operador
                        </button>
                        <button 
                            onClick={() => setCardsSortBy('status')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${cardsSortBy === 'status' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            Status
                        </button>
                    </div>
                  )}
                  
                  <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex items-center">
                     <button 
                       onClick={() => setProgressViewMode('cards')}
                       className={`p-3 rounded-xl transition-all ${progressViewMode === 'cards' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                       title="Visualização em Cards"
                     >
                       <LayoutGrid size={20}/>
                     </button>
                     <button 
                       onClick={() => setProgressViewMode('list')}
                       className={`p-3 rounded-xl transition-all ${progressViewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                       title="Visualização em Lista"
                     >
                       <List size={20}/>
                     </button>
                  </div>

                  <button 
                    onClick={() => setIsAddingLog(true)}
                    className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                  >
                    <Plus size={18}/> ADICIONAR CONTAGEM
                  </button>
               </div>
             </header>

             <div className="flex-1 min-h-0 overflow-y-auto">
               {progressViewMode === 'cards' ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {(progressData as any[]).map((loc) => (
                       <div 
                         key={loc.id} 
                         onClick={() => setSelectedLocationForDetail(loc)}
                         className={`bg-white p-6 rounded-[32px] border-2 cursor-pointer transition-all hover:shadow-xl group relative overflow-hidden ${
                           loc.status === 'finished' ? 'border-emerald-100 hover:border-emerald-300' :
                           loc.status === 'counting' ? 'border-blue-100 hover:border-blue-300' :
                           loc.status === 'review' ? 'border-amber-100 hover:border-amber-300' :
                           'border-slate-100 hover:border-slate-200'
                         }`}
                       >
                          <div className={`absolute top-0 right-0 p-4 rounded-bl-[32px] ${
                             loc.status === 'finished' ? 'bg-emerald-50 text-emerald-600' :
                             loc.status === 'counting' ? 'bg-blue-50 text-blue-600' :
                             loc.status === 'review' ? 'bg-amber-50 text-amber-600' :
                             'bg-slate-50 text-slate-400'
                          }`}>
                             {loc.status === 'finished' ? <CheckCircle2 size={20}/> :
                              loc.status === 'counting' ? <Activity size={20}/> :
                              loc.status === 'review' ? <AlertTriangle size={20}/> :
                              <Square size={20}/>}
                          </div>
                          
                          <h3 className="text-2xl font-black text-slate-800 mb-1">{loc.name}</h3>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-6">
                             <User size={14}/> {loc.assignedOperatorId || 'Não atribuído'}
                          </div>
                          
                          <div className="flex items-end justify-between">
                             <div>
                                <p className="text-[10px] font-black uppercase text-slate-300 mb-1">Itens Contados</p>
                                <p className="text-3xl font-black text-slate-800">{loc.totalItems}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-300 mb-1">SKUs Distintos</p>
                                <p className="text-lg font-bold text-slate-500">{loc.distinctSkus}</p>
                             </div>
                          </div>
                       </div>
                    ))}
                    {progressData.length === 0 && (
                       <div className="col-span-full text-center py-20 opacity-50">
                          <MapPin size={48} className="mx-auto mb-4 text-slate-300"/>
                          <p className="font-bold text-slate-400">Nenhum local encontrado com os filtros atuais.</p>
                       </div>
                    )}
                 </div>
               ) : (
                 <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                          <tr>
                             <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleListSort('timestamp')}>
                                <div className="flex items-center gap-1">
                                    Data/Hora 
                                    {listSortConfig?.key === 'timestamp' && (listSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                             </th>
                             <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleListSort('location')}>
                                <div className="flex items-center gap-1">
                                    Local
                                    {listSortConfig?.key === 'location' && (listSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                             </th>
                             <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleListSort('sku')}>
                                <div className="flex items-center gap-1">
                                    SKU
                                    {listSortConfig?.key === 'sku' && (listSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                             </th>
                             <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleListSort('quantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    Quantidade
                                    {listSortConfig?.key === 'quantity' && (listSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                             </th>
                             <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleListSort('operatorId')}>
                                <div className="flex items-center gap-1">
                                    Operador
                                    {listSortConfig?.key === 'operatorId' && (listSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                             </th>
                             <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-600">
                          {(progressData as CountLog[]).map(log => (
                             <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 text-blue-600">{log.location}</td>
                                <td className="px-6 py-4 text-slate-800">{log.sku}</td>
                                <td className="px-6 py-4 text-center text-lg text-slate-900">{log.quantity}</td>
                                <td className="px-6 py-4">{log.operatorId}</td>
                                <td className="px-6 py-4 text-right">
                                   <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => setEditingLog(log)}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                      >
                                         <Pencil size={14}/>
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteLog(log.id)}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                      >
                                         <Trash2 size={14}/>
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                          {progressData.length === 0 && (
                             <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-medium">Nenhum registro encontrado.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
               )}
             </div>
          </div>
        )}

        {/* Approvals Section */}
        {activeTab === 'approvals' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in flex flex-col h-full">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
               <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Central de Aprovação</h2>
                  <p className="text-slate-500 font-medium">Gestão de pendências e solicitações.</p>
               </div>
               <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                 <button 
                    onClick={() => setApprovalTab('unknown')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${approvalTab === 'unknown' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                 >
                    ITENS DESCONHECIDOS ({unknownBarcodes.filter(u => u.status === 'pending').length})
                 </button>
                 <button 
                    onClick={() => setApprovalTab('unlock')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${approvalTab === 'unlock' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                 >
                    DESBLOQUEIO DE LOCAL ({unlockRequests.length})
                 </button>
               </div>
            </header>
            
            {approvalTab === 'unknown' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="relative">
                     <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                     <input 
                       type="text" 
                       placeholder="Buscar EAN, Local..." 
                       className="pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-slate-700 w-64 focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-medium"
                       value={approvalSearch}
                       onChange={(e) => setApprovalSearch(e.target.value)}
                     />
                   </div>
                   <button 
                     onClick={() => setApprovalShowHistory(!approvalShowHistory)}
                     className={`px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${approvalShowHistory ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                     >
                       <History size={16} /> 
                       {approvalShowHistory ? 'VOLTAR PARA PENDÊNCIAS' : 'VER HISTÓRICO'}
                     </button>
                  </div>
                  
                  {!approvalShowHistory ? (
                    <div className="space-y-10">
                      
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                          <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center">{pendingApprovals.length}</span>
                          Novas Pendências
                        </h4>
                        {pendingApprovals.length === 0 ? (
                           <div className="py-12 text-center opacity-30 border-2 border-dashed border-slate-200 rounded-[24px]">
                              <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" strokeWidth={1}/>
                              <p className="font-black uppercase text-xs tracking-widest text-slate-400">Nenhuma nova pendência.</p>
                           </div>
                        ) : (
                          <div className="space-y-4">
                            {pendingApprovals.map(u => (
                              <div key={u.id} className="bg-white p-6 rounded-[24px] shadow-sm border-l-4 border-l-amber-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:shadow-md transition-all animate-in slide-in-from-bottom-2">
                                <div className="flex items-start gap-4">
                                  <div className="bg-amber-50 p-3 rounded-2xl text-amber-600"><AlertOctagon size={24}/></div>
                                  <div>
                                    <div className="flex items-center gap-3 mb-1">
                                       <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Desconhecido</span>
                                       <span className="text-[9px] font-black uppercase text-slate-300 flex items-center gap-1"><Clock size={10}/> {new Date(u.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{u.barcode}</h4>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                                       <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                         <MapPin size={12} className="text-blue-500"/> {u.location}
                                       </span>
                                       <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                         <User size={12} className="text-slate-500"/> {u.operatorId}
                                       </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                  <button 
                                    onClick={() => {
                                      const sku = prompt(`Vincular o código "${u.barcode}" a qual SKU existente?`);
                                      if(sku) handleApproveUnknown(u, sku);
                                    }}
                                    className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                                  >
                                    <Check size={16}/> Aprovar
                                  </button>
                                  <button 
                                    onClick={() => handleRequestReviewUnknown(u)}
                                    className="flex-1 md:flex-none bg-indigo-50 text-indigo-600 border border-indigo-100 px-4 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                  >
                                    <RefreshCcw size={16}/> Solicitar Revisão
                                  </button>
                                  <button 
                                    onClick={() => handleRejectUnknown(u)}
                                    className="flex-1 md:flex-none bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                    title="Rejeitar e manter no histórico"
                                  >
                                    <X size={16}/> Rejeitar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
  
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center">{reviewApprovals.length}</span>
                          Em Revisão de Campo
                        </h4>
                        {reviewApprovals.length === 0 ? (
                           <div className="py-8 text-center opacity-30 border-2 border-dashed border-slate-200 rounded-[24px]">
                              <p className="font-black uppercase text-xs tracking-widest text-slate-400">Nenhum item em revisão.</p>
                           </div>
                        ) : (
                          <div className="space-y-4">
                            {reviewApprovals.map(u => {
                               const loc = session.locations.find(l => l.name === u.location);
                               const isReviewed = loc?.status === 'finished';
                               
                               return (
                                <div key={u.id} className={`bg-white p-6 rounded-[24px] shadow-sm border-l-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:shadow-md transition-all animate-in slide-in-from-bottom-2 ${isReviewed ? 'border-l-emerald-400' : 'border-l-indigo-300'}`}>
                                  <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-2xl ${isReviewed ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-400'}`}>
                                      {isReviewed ? <CheckCircle2 size={24}/> : <RefreshCcw size={24} className="animate-spin-slow"/>}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-3 mb-1">
                                         <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Em Revisão</span>
                                         {isReviewed && <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center gap-1"><Check size={10}/> Revisado pelo Operador</span>}
                                      </div>
                                      <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{u.barcode}</h4>
                                      <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                                         <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                           <MapPin size={12} className="text-blue-500"/> {u.location}
                                         </span>
                                         <span className={`flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 ${isReviewed ? 'text-emerald-600 bg-emerald-50' : ''}`}>
                                           {isReviewed ? 'Local Fechado' : 'Aguardando Fechamento...'}
                                         </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full md:w-auto">
                                    <button 
                                      onClick={() => {
                                        const sku = prompt(`O item "${u.barcode}" foi validado? Vincular a qual SKU?`);
                                        if(sku) handleApproveUnknown(u, sku);
                                      }}
                                      className="flex-1 md:flex-none bg-white border-2 border-slate-100 text-slate-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                    >
                                      <Check size={16}/> Vincular
                                    </button>
                                    <button 
                                      onClick={() => handleRejectUnknown(u)}
                                      className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${
                                        isReviewed 
                                          ? 'bg-slate-900 text-white hover:bg-black shadow-lg' 
                                          : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white'
                                      }`}
                                      title="Confirmar que o item foi removido ou é inválido"
                                    >
                                      {isReviewed ? 'Concluir (Rejeitar)' : 'Rejeitar'}
                                    </button>
                                  </div>
                                </div>
                               );
                            })}
                          </div>
                        )}
                      </div>
  
                    </div>
                  ) : (
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Código Original</th>
                                <th className="px-6 py-4">SKU Resolvido</th>
                                <th className="px-6 py-4">Local</th>
                                <th className="px-6 py-4">Operador</th>
                                <th className="px-6 py-4">Data</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredApprovals.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                   <td className="px-6 py-4">
                                      <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-full ${
                                        u.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 
                                        u.status === 'in_review' ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-red-100 text-red-600'
                                      }`}>
                                         {u.status === 'approved' ? 'APROVADO' : u.status === 'in_review' ? 'EM REVISÃO' : 'REJEITADO'}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 font-bold text-slate-800">{u.barcode}</td>
                                   <td className="px-6 py-4 font-medium text-slate-500">{u.resolvedSku || '-'}</td>
                                   <td className="px-6 py-4 text-xs font-bold text-blue-600">{u.location}</td>
                                   <td className="px-6 py-4 text-xs text-slate-500">{u.operatorId}</td>
                                   <td className="px-6 py-4 text-xs text-slate-400">{new Date(u.timestamp).toLocaleString()}</td>
                                </tr>
                              ))}
                              {filteredApprovals.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-20 text-slate-400">Nenhum histórico encontrado.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                    </div>
                  )}
                </div>
              )}
              {approvalTab === 'unlock' && (
                <div className="space-y-6">
                   {unlockRequests.length === 0 ? (
                     <div className="py-24 text-center opacity-30 border-2 border-dashed border-slate-200 rounded-[40px]">
                        <CheckCircle size={80} className="mx-auto mb-6 text-emerald-500" strokeWidth={1}/>
                        <p className="font-black uppercase text-sm tracking-widest text-slate-400">Nenhuma solicitação de desbloqueio.</p>
                     </div>
                   ) : (
                      unlockRequests.map(loc => (
                        <div key={loc.id} className="bg-white p-8 rounded-[32px] shadow-sm border-l-4 border-l-blue-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 group hover:shadow-md transition-all animate-in slide-in-from-bottom-2">
                          <div className="flex items-start gap-6">
                             <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><UnlockKeyhole size={28}/></div>
                             <div>
                                <div className="flex items-center gap-3 mb-1">
                                   <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Desbloqueio</span>
                                   <span className="text-[10px] font-black uppercase text-slate-300">Solicitado pelo Operador</span>
                                </div>
                                <h4 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{loc.name}</h4>
                                <p className="text-xs font-bold text-slate-400">O operador {loc.assignedOperatorId} solicitou permissão para editar este local finalizado.</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto">
                             <button 
                                onClick={() => handleApproveUnlock(loc.id)}
                                className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                             >
                                <Check size={18}/> PERMITIR EDIÇÃO
                             </button>
                             <button 
                                onClick={() => handleRejectUnlock(loc.id)}
                                className="flex-1 md:flex-none bg-red-50 text-red-600 border border-red-100 px-6 py-4 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                             >
                                <X size={18}/> NEGAR
                             </button>
                          </div>
                        </div>
                      ))
                   )}
                </div>
              )}
            </div>
          )}
  
          {/* ... Audit ... */}
          {activeTab === 'audit' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in h-full flex flex-col">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0">
                 <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Log de Auditoria</h2>
                    <p className="text-slate-500 font-medium">Histórico detalhado de todas as operações de contagem.</p>
                 </div>
                 <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="relative">
                      <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                        type="text" 
                        placeholder="Filtrar por SKU, Local ou Operador..." 
                        className="pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-slate-700 w-64 focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-medium"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setAuditShowDiscrepanciesOnly(!auditShowDiscrepanciesOnly)}
                      className={`px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${auditShowDiscrepanciesOnly ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      <Filter size={16} /> 
                      {auditShowDiscrepanciesOnly ? 'APENAS DIVERGÊNCIAS' : 'TODOS OS LOGS'}
                    </button>
                 </div>
              </header>
  
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                  <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">Data/Hora</th>
                          <th className="px-6 py-4">Operador</th>
                          <th className="px-6 py-4">SKU</th>
                          <th className="px-6 py-4">Descrição</th>
                          <th className="px-6 py-4">Local</th>
                          <th className="px-6 py-4 text-center">Qtd</th>
                          <th className="px-6 py-4 text-center">Tipo</th>
                          <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedAuditLogs.map((log) => {
                          const product = session.products.find(p => cleanSku(p.sku) === cleanSku(log.sku));
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 text-xs">{new Date(log.timestamp).toLocaleDateString()}</span>
                                  <span className="text-[10px] font-medium text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{log.operatorId}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-black text-slate-800 text-sm">{log.sku}</span>
                              </td>
                              <td className="px-6 py-4">
                                 <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{product?.description || 'Item não cadastrado'}</p>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-1 text-blue-600 font-bold text-xs"><MapPin size={12}/> {log.location}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 <span className="font-black text-slate-900">{log.quantity}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-full ${log.type === 'scan' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                   {log.type === 'scan' ? 'SCANNER' : 'MANUAL'}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-full ${
                                   log.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                   log.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                                   'bg-slate-100 text-slate-400'
                                 }`}>
                                   {log.status === 'rejected' ? 'REJEITADO' : log.status === 'approved' ? 'APROVADO' : 'REGISTRADO'}
                                 </span>
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedAuditLogs.length === 0 && (
                           <tr><td colSpan={8} className="text-center py-20 text-slate-400 font-medium">Nenhum registro encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                   <div className="border-t border-slate-100 p-4 flex items-center justify-between bg-slate-50 rounded-b-[40px] flex-shrink-0">
                     <div className="text-xs font-bold text-slate-400">
                        Pág. {auditPage} de {Math.ceil(filteredAuditLogs.length / ITEMS_PER_PAGE) || 1} ({filteredAuditLogs.length} logs)
                     </div>
                     <div className="flex gap-2">
                        <button disabled={auditPage === 1} onClick={() => setAuditPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronLeft size={20}/></button>
                        <button disabled={auditPage * ITEMS_PER_PAGE >= filteredAuditLogs.length} onClick={() => setAuditPage(p => p + 1)} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronRight size={20}/></button>
                     </div>
                  </div>
              </div>
            </div>
          )}
  
          {/* --- REPORT SECTION --- */}
          {activeTab === 'reports' && (
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in flex flex-col h-full">
               <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 flex-shrink-0">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Relatório de Inventário</h2>
                    <p className="text-slate-500 font-medium">Logs de contagem válidos processados.</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex-1">
                      <div className="relative flex-1">
                        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="Buscar SKU, Descrição, Local..." 
                          className="pl-10 pr-4 py-2 w-full md:w-56 rounded-xl bg-slate-50 border-none outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-medium text-sm"
                          value={reportSearch}
                          onChange={(e) => setReportSearch(e.target.value)}
                        />
                      </div>
                    </div>
  
                    <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1 overflow-x-auto">
                        <button 
                           onClick={() => setReportFilterType('all')}
                           className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-black transition-all ${reportFilterType === 'all' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                           TODOS
                        </button>
                        <button 
                           onClick={() => setReportFilterType('correct')}
                           className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-black transition-all ${reportFilterType === 'correct' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-emerald-600'}`}
                        >
                           OK
                        </button>
                        <button 
                           onClick={() => setReportFilterType('error')}
                           className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-black transition-all ${reportFilterType === 'error' ? 'bg-red-100 text-red-700' : 'text-slate-400 hover:text-red-600'}`}
                        >
                           DIV
                        </button>
                        <button 
                           onClick={() => setReportFilterType('location_error')}
                           className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-black transition-all ${reportFilterType === 'location_error' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-amber-600'}`}
                        >
                           LOCAL ERRADO
                        </button>
                        <button 
                           onClick={() => setReportFilterType('uncounted')}
                           className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-black transition-all ${reportFilterType === 'uncounted' ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-purple-600'}`}
                        >
                           NÃO CONTADOS
                        </button>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative">
                         <button
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className={`h-full px-4 rounded-xl border border-slate-200 font-bold text-slate-500 text-xs hover:bg-slate-50 flex items-center gap-2 ${showColumnSelector ? 'bg-slate-100' : 'bg-white'}`}
                         >
                            <Settings2 size={16}/> Colunas
                         </button>
                         {showColumnSelector && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-20 animate-in zoom-in-95">
                               {REPORT_COLUMNS.filter(c => c.key !== 'selection' && c.key !== 'actions').map(col => (
                                  <button
                                     key={col.key}
                                     onClick={() => toggleColumnVisibility(col.key)}
                                     className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-slate-50 flex items-center justify-between"
                                  >
                                     <span className={visibleColumns.has(col.key) ? 'text-slate-700' : 'text-slate-400'}>{col.label}</span>
                                     {visibleColumns.has(col.key) ? <Eye size={14} className="text-blue-500"/> : <EyeOff size={14} className="text-slate-300"/>}
                                  </button>
                               ))}
                            </div>
                         )}
                      </div>
                      <button
                         onClick={handleExportCSV}
                         className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold text-xs hover:bg-black transition-all shadow-lg flex items-center gap-2"
                      >
                         <Download size={16}/> Exportar CSV
                      </button>
                    </div>
                  </div>
               </header>
  
               {selectedItems.size > 0 && (
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                     <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                        <CheckSquare size={16}/>
                        {selectedItems.size} itens selecionados
                     </div>
                     <button 
                        onClick={handleRequestReview}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 shadow-sm transition-all"
                      >
                        <RotateCcw size={14}/> SOLICITAR REVISÃO EM MASSA
                      </button>
                  </div>
               )}
  
               <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                  <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          {REPORT_COLUMNS.map(col => {
                             if (!visibleColumns.has(col.key)) return null;
                             return (
                                <th 
                                  key={col.key} 
                                  className={`px-4 py-4 whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:bg-slate-100 hover:text-slate-600 transition-colors select-none' : ''} ${col.key === 'selection' ? 'w-16 text-center' : ''}`}
                                  onClick={() => col.sortable && handleSort(col.key)}
                                >
                                   <div className={`flex items-center gap-1 ${['initialBalance', 'adjustedBalance', 'countQty', 'diff', 'status', 'selection'].includes(col.key) ? 'justify-center' : ''} ${col.key === 'actions' ? 'justify-end' : ''}`}>
                                      {col.label}
                                      {col.sortable && (
                                         <span className="text-slate-300">
                                            {sortConfig?.key === col.key ? (
                                               sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>
                                            ) : <ArrowUpDown size={12}/>}
                                         </span>
                                      )}
                                   </div>
                                </th>
                             );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedResults.map((item, idx) => {
                          const itemKey = item.sku;
                          return (
                            <ReportRow 
                              key={idx} 
                              item={item} 
                              onReject={handleRejectCount} 
                              isSelected={selectedItems.has(itemKey)}
                              onToggle={toggleSelection}
                              visibleColumns={visibleColumns}
                              onViewMovements={handleViewMovements}
                            />
                          );
                        })}
                        {paginatedResults.length === 0 && (
                          <tr>
                            <td colSpan={visibleColumns.size} className="text-center py-20 text-slate-400">Nenhum dado encontrado</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-slate-100 p-4 flex items-center justify-between bg-slate-50 rounded-b-[40px] flex-shrink-0">
                     <div className="text-xs font-bold text-slate-400">
                        Mostrando {paginatedResults.length} de {processedReportResults.length} itens (Pág. {reportPage} de {totalReportPages || 1})
                     </div>
                     <div className="flex gap-2">
                        <button disabled={reportPage === 1} onClick={() => setReportPage(1)} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronsLeft size={20}/></button>
                        <button disabled={reportPage === 1} onClick={() => setReportPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronLeft size={20}/></button>
                        <button disabled={reportPage === totalReportPages} onClick={() => setReportPage(p => Math.min(totalReportPages, p + 1))} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronRight size={20}/></button>
                        <button disabled={reportPage === totalReportPages} onClick={() => setReportPage(totalReportPages)} className="p-2 rounded-lg hover:bg-white disabled:opacity-30 transition-all text-slate-600"><ChevronsRight size={20}/></button>
                     </div>
                  </div>
               </div>
            </div>
          )}
  
          {activeTab === 'imports' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-right">
               <div className="text-center mb-16">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">Central de Importação</h2>
                  <p className="text-lg text-slate-500 max-w-xl mx-auto">Carregue arquivos CSV ou TXT para alimentar a base de dados do inventário com rapidez e segurança.</p>
               </div>
  
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { id: 'products', label: 'Produtos', desc: 'SKU, Descrição, Saldo', icon: PackageSearch, color: 'blue', status: productImport },
                    { id: 'movements', label: 'Movimentações', desc: 'Entradas/Saídas (Fase 2)', icon: ArrowUpDown, color: 'indigo', status: movementImport },
                    { id: 'locations', label: 'Locais', desc: 'Endereços Físicos', icon: MapPin, color: 'emerald', status: locationImport }
                  ].map((type: any) => (
                     <div key={type.id} className="bg-white p-8 rounded-[40px] border-2 border-slate-50 hover:border-slate-200 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group relative overflow-hidden">
                        <div className={`p-6 rounded-3xl mb-6 bg-${type.color}-50 text-${type.color}-600 group-hover:scale-110 transition-transform duration-300`}>
                           <type.icon size={40} strokeWidth={1.5}/>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{type.label}</h3>
                        <p className="text-sm font-medium text-slate-400 mb-8 px-2 min-h-[40px]">{type.desc}</p>
                        
                        <label className="w-full cursor-pointer relative z-10">
                           <input type="file" className="hidden" accept=".csv,.txt" onClick={(e) => (e.target as HTMLInputElement).value = ''} onChange={(e) => e.target.files?.[0] && initFileMapping(type.id, e.target.files[0])}/>
                           <div className={`w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl group-hover:bg-${type.color}-600 transition-colors`}>
                              Selecionar Arquivo
                           </div>
                        </label>
  
                        {type.status.isCompleted && (
                           <div className="absolute top-6 right-6 text-emerald-500 animate-in zoom-in">
                              <CheckCircle2 size={24}/>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
               
               {(productImport.isMapping || productImport.isFileReading || productImport.isProcessing || productImport.isCompleted) && renderMappingUI('products')}
               {(movementImport.isMapping || movementImport.isFileReading || movementImport.isProcessing || movementImport.isCompleted) && renderMappingUI('movements')}
               {(locationImport.isMapping || locationImport.isFileReading || locationImport.isProcessing || locationImport.isCompleted) && renderMappingUI('locations')}
            </div>
          )}
        </main>
  
        {/* Movement Details Modal */}
        {viewingMovementsFor && (
          <MovementHistoryModal 
            item={viewingMovementsFor.item} 
            movements={viewingMovementsFor.movements}
            onClose={() => setViewingMovementsFor(null)} 
          />
        )}
  
        {/* NEW: Divergence Resolution Modal */}
        {selectedLocationForDivergence && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 animate-in fade-in">
                <div className="bg-white w-full max-w-4xl rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <AlertTriangle className="text-red-600" size={24}/>
                                Divergências: {selectedLocationForDivergence.location.name}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                                Operador: {selectedLocationForDivergence.location.assignedOperatorId} • {selectedLocationForDivergence.divergences.length} itens com erro
                            </p>
                        </div>
                        <button onClick={() => setSelectedLocationForDivergence(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">SKU / Produto</th>
                                    <th className="px-4 py-3 text-center">Esperado</th>
                                    <th className="px-4 py-3 text-center">Contado</th>
                                    <th className="px-4 py-3 text-center">Diferença</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                {selectedLocationForDivergence.divergences.map((div, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <p className="font-black text-slate-800 text-sm">{div.sku}</p>
                                            <p className="text-[10px] font-medium text-slate-400 truncate max-w-[250px]">{div.description}</p>
                                            {div.type === 'location_error' && (
                                                <span className="inline-block mt-1 bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200">
                                                    LOCAL INDEVIDO
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center text-slate-400 font-bold">{div.expected}</td>
                                        <td className="px-4 py-4 text-center font-black text-lg text-slate-900">{div.counted}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`px-2 py-1 rounded font-black ${
                                                div.type === 'missing' ? 'bg-red-50 text-red-600' : 
                                                div.type === 'surplus' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                                {div.counted - div.expected > 0 ? '+' : ''}{div.counted - div.expected}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* EDIT: Find the last log for this item in this location and edit it */}
                                                <button 
                                                  onClick={() => {
                                                      const log = [...countLogs].reverse().find(l => cleanSku(l.sku) === cleanSku(div.sku) && l.location === selectedLocationForDivergence.location.name && l.status !== 'rejected');
                                                      if (log) setEditingLog(log);
                                                      else alert("Não foi possível encontrar o registro original para edição.");
                                                  }}
                                                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                                  title="Editar Quantidade"
                                                >
                                                    <Pencil size={16}/>
                                                </button>
                                                
                                                {/* REVIEW: Send back to operator */}
                                                <button 
                                                  onClick={() => {
                                                      handleRejectCount(div.sku, selectedLocationForDivergence.location.name);
                                                      setSelectedLocationForDivergence(null);
                                                  }}
                                                  className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                                                  title="Mandar para Revisão (Operador)"
                                                >
                                                    <RotateCcw size={16}/>
                                                </button>
  
                                                {/* DELETE: Remove log */}
                                                <button 
                                                  onClick={() => handleDeleteItemFromLocation(div.sku, selectedLocationForDivergence.location.name)}
                                                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                  title="Excluir Contagem"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
  
        {/* Location Details Modal (Progress Tab) */}
        {selectedLocationForDetail && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 animate-in fade-in">
                <div className="bg-white w-full max-w-2xl rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <MapPin className="text-blue-600" size={24}/>
                                {selectedLocationForDetail.name}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Detalhes da contagem</p>
                        </div>
                        <button onClick={() => setSelectedLocationForDetail(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">SKU</th>
                                    <th className="px-4 py-3">Descrição</th>
                                    <th className="px-4 py-3 text-center">Quantidade</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-600">
                                {locationDetailItems.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-800">{item.sku}</td>
                                        <td className="px-4 py-3 text-slate-400 font-medium truncate max-w-[200px]">{item.description}</td>
                                        <td className="px-4 py-3 text-center text-lg text-slate-900">{item.qty}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                              onClick={() => handleDeleteItemFromLocation(item.sku, selectedLocationForDetail.name)}
                                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                              title="Excluir todos itens deste SKU neste local"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {locationDetailItems.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-10 text-slate-400">Nenhum item contado neste local.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
  
        {/* Edit Log Modal */}
        {editingLog && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl">
                    <h3 className="text-xl font-black text-slate-900 mb-1">Editar Quantidade</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-6">{editingLog.sku} @ {editingLog.location}</p>
                    
                    <div className="mb-6">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Nova Quantidade</label>
                        <input 
                            type="number" 
                            autoFocus
                            className="w-full text-4xl font-black text-slate-900 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-center focus:border-blue-500 outline-none"
                            defaultValue={editingLog.quantity}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter') handleUpdateLog(editingLog.id, parseInt(e.currentTarget.value));
                            }}
                        />
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={() => setEditingLog(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200">CANCELAR</button>
                        <button onClick={(e) => {
                            const input = (e.currentTarget.parentElement?.previousElementSibling?.querySelector('input') as HTMLInputElement);
                            handleUpdateLog(editingLog.id, parseInt(input.value));
                        }} className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-xs text-white hover:bg-blue-700 shadow-lg shadow-blue-200">SALVAR</button>
                    </div>
                </div>
            </div>
        )}
  
        {/* Add Log Modal */}
        {isAddingLog && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                <form onSubmit={handleAddLog} className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><Plus size={24} className="text-blue-600"/> Adicionar Contagem</h3>
                    
                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Local</label>
                            <input name="location" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-blue-500 outline-none" placeholder="Ex: A-01"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">SKU / Código de Barras</label>
                            <input name="sku" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-blue-500 outline-none" placeholder="Ex: 789..."/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Quantidade</label>
                            <input name="quantity" type="number" required min="1" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-blue-500 outline-none" placeholder="Ex: 10"/>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsAddingLog(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200">CANCELAR</button>
                        <button type="submit" className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-xs text-white hover:bg-blue-700 shadow-lg shadow-blue-200">ADICIONAR</button>
                    </div>
                </form>
            </div>
        )}
      </div>
    );
  };
  
  export default SupervisorDashboard;
