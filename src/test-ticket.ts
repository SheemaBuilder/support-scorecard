import { getTicketById } from "./lib/zendesk-api";

// Test function to fetch specific ticket
export async function testTicket20225() {
  try {
    console.log("🧪 Testing ticket 20225 fetch...");
    const ticket = await getTicketById(20225);
    console.log("✅ Ticket 20225 fetched successfully:", {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.created_at,
      solved_at: ticket.solved_at,
      assignee_id: ticket.assignee_id,
    });
    return ticket;
  } catch (error) {
    console.error("❌ Failed to fetch ticket 20225:", error);
    throw error;
  }
}

// Add to window for browser console testing
if (typeof window !== "undefined") {
  (window as any).testTicket20225 = testTicket20225;
}
