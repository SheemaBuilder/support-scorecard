// Test utilities for database operations
// Note: Direct Zendesk API calls have been removed to ensure frontend only uses Supabase

// Test function to fetch specific ticket from Supabase database
export async function testTicketFromDatabase(ticketId: number) {
  try {
    console.log(`🧪 Testing ticket ${ticketId} fetch from database...`);
    
    // Import Supabase client
    const { supabase } = await import("./lib/supabase");
    
    // Fetch ticket from database
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('zendesk_id', ticketId)
      .single();
      
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found in database`);
    }
    
    console.log(`✅ Ticket ${ticketId} fetched successfully from database:`, {
      id: ticket.zendesk_id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.created_at,
      solved_at: ticket.solved_at,
      assignee_id: ticket.assignee_id,
    });
    
    return ticket;
  } catch (error) {
    console.error(`❌ Failed to fetch ticket ${ticketId} from database:`, error);
    throw error;
  }
}

// Add to window for browser console testing
if (typeof window !== "undefined") {
  (window as any).testTicketFromDatabase = testTicketFromDatabase;
  // Keep the old function name for backward compatibility but redirect to database
  (window as any).testTicket20225 = () => testTicketFromDatabase(20225);
}
