import { createClient } from '@supabase/supabase-js';

// Utility function to extract meaningful error messages
export function extractErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';

  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || 'Error object with no message';
  }

  // Handle Supabase error objects
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.error) return error.error;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code) return `Error code: ${error.code}`;

  // Last resort - try to stringify but limit length
  try {
    const stringified = JSON.stringify(error);
    if (stringified.length > 200) {
      return `Complex error: ${stringified.substring(0, 200)}...`;
    }
    return stringified;
  } catch {
    return 'Error object that cannot be stringified';
  }
}

// Enhanced error logging
function logError(context: string, error: any) {
  const errorMessage = extractErrorMessage(error);
  console.error(`❌ ${context}:`, errorMessage);

  // Try to extract more details safely
  let errorDetails = 'No additional details';
  try {
    errorDetails = JSON.stringify({
      type: typeof error,
      constructor: error?.constructor?.name,
      message: error?.message,
      code: error?.code,
      status: error?.status,
      stack: error?.stack?.substring(0, 200),
    }, null, 2);
  } catch {
    errorDetails = `Error details not serializable: ${error?.toString?.() || 'Unknown'}`;
  }

  console.error(`📋 Error details:`, errorDetails);
}

// Utility to safely handle any error and return a string
export function safeErrorToString(error: any): string {
  try {
    return extractErrorMessage(error);
  } catch {
    return `Error handling failed: ${error?.toString?.() || 'Unknown error'}`;
  }
}

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug configuration
console.log('🔧 Supabase client initialization:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlSample: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'
});

// Validate URL format
if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
  console.error('❌ Invalid Supabase URL format. Should be https://[project-id].supabase.co');
}

// Create supabase client with proper error handling
let supabaseClient: any;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client created successfully');
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    supabaseClient = null;
  }
} else {
  console.warn('⚠️ Supabase credentials missing');
  supabaseClient = null;
}

// Use fallback mode if Supabase is not available
export const supabase = supabaseClient || createFallbackSupabaseClient();

// Export a function to test the connection
export async function testSupabaseConnection() {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('🔗 Testing Supabase connection...');
    console.log('🔗 Using URL:', supabaseUrl?.substring(0, 30) + '...');

    // Try a simple query first
    const { data, error } = await supabaseClient.from('engineers').select('count').limit(1);

    console.log('🔗 Supabase query result:', {
      hasData: !!data,
      dataLength: data?.length,
      hasError: !!error
    });

    if (error) {
      logError('Supabase query error', error);
      const errorMessage = extractErrorMessage(error);

      // Check if it's a table not found error
      if (error.code === 'PGRST116' || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: `Database table 'engineers' not found. Please ensure the database schema is set up correctly.`
        };
      }

      return {
        success: false,
        error: `Database error: ${errorMessage}`
      };
    }

    console.log('✅ Supabase connection test successful');
    return { success: true, data };
  } catch (error) {
    logError('Supabase connection test exception', error);
    const errorMessage = extractErrorMessage(error);

    // Better error handling for different types of errors
    if (error instanceof TypeError && errorMessage.includes('fetch')) {
      return {
        success: false,
        error: 'Network error: Cannot reach Supabase. Check your internet connection and Supabase URL.'
      };
    }

    if (errorMessage.includes('Invalid JWT')) {
      return {
        success: false,
        error: 'Authentication error: Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY.'
      };
    }

    if (errorMessage.includes('invalid input syntax')) {
      return {
        success: false,
        error: 'Database schema error: The database structure may not be set up correctly.'
      };
    }

    if (errorMessage.includes('CORS')) {
      return {
        success: false,
        error: 'CORS error: The Supabase server is blocking the request. This might be a configuration issue.'
      };
    }

    return {
      success: false,
      error: `Connection failed: ${errorMessage}`
    };
  }
}

// Simple health check function
export async function checkSupabaseHealth() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('🔧 Supabase Health Check:', {
    hasUrl: !!url,
    hasKey: !!key,
    urlValid: url?.includes('supabase.co'),
    keyValid: key?.length > 100
  });

  if (!url || !key) {
    const missing = [];
    if (!url) missing.push('VITE_SUPABASE_URL');
    if (!key) missing.push('VITE_SUPABASE_ANON_KEY');
    return { success: false, error: `Missing environment variables: ${missing.join(', ')}` };
  }

  try {
    // Test basic connectivity to Supabase with shorter timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: 'Supabase is reachable' };
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    logError('Supabase health check', error);
    const errorMessage = extractErrorMessage(error);

    if (errorMessage.includes('aborted')) {
      return { success: false, error: 'Connection timeout: Supabase took too long to respond' };
    }

    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      return {
        success: false,
        error: 'Network connectivity issue: Cannot reach Supabase servers. Please check your internet connection.'
      };
    }

    return {
      success: false,
      error: `Connectivity error: ${errorMessage}`
    };
  }
}

// Check if we're in offline mode
export function isOfflineMode() {
  return !navigator.onLine;
}

// Enable offline mode with mock data
export function enableOfflineMode() {
  console.log('🔄 Enabling offline mode with mock data...');
  return {
    success: true,
    message: 'Offline mode enabled - using mock data for demonstration'
  };
}

// Create a fallback Supabase client that returns mock data
export function createFallbackSupabaseClient() {
  console.log('🔄 Creating fallback Supabase client with mock data...');

  const mockEngineerData = [
    {
      id: '1',
      name: 'Akash Singh',
      cesPercent: 83.3,
      surveyCount: 6,
      closed: 62,
      open: 18,
      avgPcc: 184.1,
      participationRate: 4.2,
      citationCount: 3.8,
      creationCount: 4.1,
      linkCount: 3.9,
      enterprisePercent: 25.5,
      technicalPercent: 68.2,
      closedEqual1: 45.2,
      closedLessThan7: 78.3,
      openGreaterThan14: 5
    },
    {
      id: '2',
      name: 'Manish Sharma',
      cesPercent: 100.0,
      surveyCount: 6,
      closed: 73,
      open: 13,
      avgPcc: 156.8,
      participationRate: 4.5,
      citationCount: 4.2,
      creationCount: 4.3,
      linkCount: 4.1,
      enterprisePercent: 31.2,
      technicalPercent: 72.1,
      closedEqual1: 52.1,
      closedLessThan7: 81.5,
      openGreaterThan14: 3
    }
  ];

  return {
    from: (table: string) => ({
      select: (columns?: string) => ({
        limit: (count: number) => Promise.resolve({
          data: table === 'engineers' ? mockEngineerData.slice(0, count) : [],
          error: null
        }),
        gte: (column: string, value: any) => ({
          lte: (column2: string, value2: any) => Promise.resolve({
            data: table === 'tickets' ? [] : mockEngineerData,
            error: null
          })
        }),
        eq: (column: string, value: any) => ({
          gte: (column2: string, value2: any) => ({
            lte: (column3: string, value3: any) => Promise.resolve({
              data: [],
              error: null
            })
          })
        }),
        order: (column: string, options?: any) => ({
          limit: (count: number) => Promise.resolve({
            data: [],
            error: null
          })
        })
      })
    })
  };
}

// Check if we should use fallback mode
export function shouldUseFallbackMode(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return !url || !key || !navigator.onLine;
}

// Test connection immediately on load for debugging
if (supabaseClient) {
  // First check basic connectivity
  checkSupabaseHealth().then(healthResult => {
    console.log('🏥 Supabase health check:', healthResult);

    // Then test the actual connection
    testSupabaseConnection().then(result => {
      if (!result.success) {
        console.warn('🚨 Initial Supabase connection test failed:', result.error);
      } else {
        console.log('🎉 Initial Supabase connection test passed');
      }
    }).catch(error => {
      console.error('🚨 Initial connection test threw error:', error);
    });
  });
}

// Database types for type safety (simplified to use zendesk_id instead of UUIDs)
export interface Engineer {
  zendesk_id: number; // Primary key - no UUID needed
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  zendesk_id: number; // Primary key - no UUID needed
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
  engineer_zendesk_id: number; // Reference engineers directly by zendesk_id
  period_start: string | null;
  period_end: string | null;
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
