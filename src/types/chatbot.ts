export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages?: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface QueryRequest {
  query: string;
}

export interface QueryResponse {
  query: string;
  ai_response: string;
  data?: any[];
  function_called?: string;
  sql_executed?: boolean;
}

export interface DuplicateDetectionRequest {
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
}

export interface DuplicateDetectionResponse {
  is_duplicate: boolean;
  confidence: number;
  strategy: string;
  matched_invoice_id?: string;
  reasoning: string;
}
