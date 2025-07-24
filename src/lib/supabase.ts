import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create supabase client with fallback for missing configuration
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.') }),
        insert: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        upsert: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        in: () => ({ select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }),
        gte: () => ({ lte: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }),
        lte: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }),
        limit: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') })
      })
    } as any;

// Database types for type safety
export interface Engineer {
  id: string;
  zendesk_id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  zendesk_id: number;
  subject: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'problem' | 'incident' | 'question' | 'task';
  assignee_id: number | null;
  requester_id: number;
  submitter_id: number;
  created_at: string;
  updated_at: string;
  solved_at: string | null;
  tags: string[];
  custom_fields: any;
  imported_at: string;
}

export interface EngineerMetric {
  id: string;
  engineer_id: string;
  period_start: string;
  period_end: string;
  ces_percent: number;
  avg_pcc: number;
  closed: number;
  open: number;
  open_greater_than_14: number;
  closed_less_than_7: number;
  closed_equal_1: number;
  participation_rate: number;
  link_count: number;
  citation_count: number;
  creation_count: number;
  enterprise_percent: number;
  technical_percent: number;
  survey_count: number;
  calculated_at: string;
}
