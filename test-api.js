// Simple Node.js script to test the API data
const fetch = require("node-fetch");

async function testAPI() {
  try {
    console.log("Testing API endpoints...");

    // Test users
    const usersRes = await fetch("http://localhost:3001/api/zendesk/users");
    const users = await usersRes.json();
    console.log(`Users: ${users.users.length}`);
    users.users.forEach((u) => console.log(`  - ${u.name} (${u.id})`));

    // Test tickets
    const ticketsRes = await fetch("http://localhost:3001/api/zendesk/tickets");
    const tickets = await ticketsRes.json();
    console.log(`\nTickets: ${tickets.tickets.length}`);

    // Count tickets per assignee
    const assigneeCounts = {};
    tickets.tickets.forEach((t) => {
      if (t.assignee_id) {
        assigneeCounts[t.assignee_id] =
          (assigneeCounts[t.assignee_id] || 0) + 1;
      }
    });

    console.log("\nTickets per assignee:");
    Object.entries(assigneeCounts).forEach(([id, count]) => {
      const user = users.users.find((u) => u.id == id);
      console.log(
        `  ${user ? user.name : "Unknown"} (${id}): ${count} tickets`,
      );
    });

    // Test satisfaction ratings
    const ratingsRes = await fetch(
      "http://localhost:3001/api/zendesk/satisfaction_ratings",
    );
    const ratings = await ratingsRes.json();
    console.log(
      `\nSatisfaction ratings: ${ratings.satisfaction_ratings.length}`,
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

testAPI();
