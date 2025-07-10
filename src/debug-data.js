// Debug script to test data fetching
export async function debugDataFetching() {
  try {
    console.log("🔍 Starting debug data fetching...");

    // Test individual API endpoints
    const usersResponse = await fetch("/api/zendesk/users");
    const users = await usersResponse.json();
    console.log("📊 Users data:", users);

    const ticketsResponse = await fetch("/api/zendesk/tickets");
    const tickets = await ticketsResponse.json();
    console.log("🎫 Tickets data:", {
      total: tickets.tickets.length,
      sample: tickets.tickets.slice(0, 3),
    });

    const ratingsResponse = await fetch("/api/zendesk/satisfaction_ratings");
    const ratings = await ratingsResponse.json();
    console.log("⭐ Ratings data:", {
      total: ratings.satisfaction_ratings.length,
      sample: ratings.satisfaction_ratings.slice(0, 3),
    });

    // Test engineer filtering
    const targetEngineers = new Map([
      ["Jared Beckler", 29215234714775],
      ["Rahul Joshi", 29092423638935],
      ["Parth Sharma", 29092389569431],
      ["Fernando Duran", 24100359866391],
      ["Alex Bridgeman", 19347232342679],
      ["Sheema Parwaz", 16211207272855],
      ["Manish Sharma", 5773445002519],
      ["Akash Singh", 26396676511767],
    ]);

    const filteredUsers = users.users.filter(
      (user) =>
        targetEngineers.has(user.name) &&
        targetEngineers.get(user.name) === user.id,
    );

    console.log(
      "👥 Filtered engineers:",
      filteredUsers.map((u) => ({ name: u.name, id: u.id })),
    );

    // Test ticket assignments for each engineer
    filteredUsers.forEach((user) => {
      const userTickets = tickets.tickets.filter(
        (ticket) => ticket.assignee_id === user.id,
      );
      const userRatings = ratings.satisfaction_ratings.filter(
        (rating) => rating.assignee_id === user.id,
      );

      console.log(`🔍 ${user.name}:`, {
        totalTickets: userTickets.length,
        ratingsCount: userRatings.length,
        ticketStatuses: userTickets.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {}),
      });
    });

    return {
      users: users.users.length,
      tickets: tickets.tickets.length,
      ratings: ratings.satisfaction_ratings.length,
      filteredEngineers: filteredUsers.length,
    };
  } catch (error) {
    console.error("❌ Debug error:", error);
    return { error: error.message };
  }
}

// Add this to window for easy access in console
if (typeof window !== "undefined") {
  window.debugDataFetching = debugDataFetching;
}
