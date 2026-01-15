export interface Product {
  sku: string;
  description: string;
  barcodes: string[]; // Suporta múltiplos códigos (interno, fornecedores)
  initialBalance: number;
  location: string;
}

export interface CountLog {
  id: string;
  sessionId: string;
  sku: string;
  location: string;
  quantity: number;
  operatorId: string;
  timestamp: string;
  type: 'manual' | 'scan';
  status?: 'approved' | 'rejected'; // Novo campo para auditoria
}

export interface UnknownBarcode {
  id: string;
  sessionId: string;
  barcode: string;
  location: string;
  operatorId: string;
  timestamp: string;
  resolvedSku?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review'; // Status de fluxo
}

export interface Movement {
  sku: string;
  quantity: number;
  timestamp: string;
  type: 'in' | 'out';
  reason?: string; // Motivo da movimentação (ex: Venda, Avaria, Recebimento)
}

export enum UserRole {
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR'
}

export interface LocationState {
  id: string;
  name: string;
  status: 'idle' | 'counting' | 'finished' | 'review';
  assignedOperatorId?: string;
  startedAt?: string;
  finishedAt?: string;
  reviewSkus?: string[]; // SKUs específicos que precisam ser recontados
  unlockRequest?: 'pending' | 'rejected'; // Solicitação de desbloqueio pelo operador
}

export interface InventorySession {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'closed';
  products: Product[];
  movements: Movement[];
  locations: LocationState[];
}