// Simple function to test Zendesk API connectivity
export async function testZendeskConnection() {
  console.log("🔬 Testing Zendesk API connection...");

  try {
    // Test the basic auth endpoint
    console.log("1️⃣ Testing authentication...");
    const authResponse = await fetch("/api/test-zendesk");
    const authData = await authResponse.json();

    let userInfo = "No user data";
    if (authData.body) {
      try {
        const parsedBody = JSON.parse(authData.body);
        userInfo = parsedBody.user?.name || "No user name";
      } catch (parseError) {
        userInfo = `Parse error: ${authData.body.substring(0, 50)}...`;
      }
    }

    console.log("✅ Auth test:", {
      status: authData.status,
      success: authData.success,
      userInfo,
    });

    // Test users endpoint
    console.log("2️⃣ Testing users endpoint...");
    const usersResponse = await fetch("/api/zendesk/users");
    if (!usersResponse.ok) {
      console.error(
        `Users endpoint failed: ${usersResponse.status} ${usersResponse.statusText}`,
      );
      const errorText = await usersResponse.text();
      console.error("Error response:", errorText.substring(0, 200));
    } else {
      const usersData = await usersResponse.json();
      console.log("✅ Users test:", {
        totalUsers: usersData.users?.length || 0,
        users: usersData.users?.map((u) => ({ id: u.id, name: u.name })) || [],
      });
    }

    // Test tickets endpoint
    console.log("3️⃣ Testing tickets endpoint...");
    const ticketsResponse = await fetch("/api/zendesk/tickets");
    if (!ticketsResponse.ok) {
      console.error(
        `Tickets endpoint failed: ${ticketsResponse.status} ${ticketsResponse.statusText}`,
      );
      const errorText = await ticketsResponse.text();
      console.error("Error response:", errorText.substring(0, 200));
    } else {
      const ticketsData = await ticketsResponse.json();
      console.log("✅ Tickets test:", {
        totalTickets: ticketsData.tickets?.length || 0,
        sampleTickets:
          ticketsData.tickets?.slice(0, 3).map((t) => ({
            id: t.id,
            status: t.status,
            assignee_id: t.assignee_id,
          })) || [],
      });
    }

    // Test satisfaction ratings endpoint
    console.log("4️⃣ Testing satisfaction ratings endpoint...");
    const ratingsResponse = await fetch("/api/zendesk/satisfaction_ratings");
    if (!ratingsResponse.ok) {
      console.error(
        `Ratings endpoint failed: ${ratingsResponse.status} ${ratingsResponse.statusText}`,
      );
      const errorText = await ratingsResponse.text();
      console.error("Error response:", errorText.substring(0, 200));
    } else {
      const ratingsData = await ratingsResponse.json();
      console.log("✅ Ratings test:", {
        totalRatings: ratingsData.satisfaction_ratings?.length || 0,
        sampleRatings: ratingsData.satisfaction_ratings?.slice(0, 3) || [],
      });
    }

    return {
      success: true,
      usersCount: usersData.users?.length || 0,
      ticketsCount: ticketsData.tickets?.length || 0,
      ratingsCount: ratingsData.satisfaction_ratings?.length || 0,
    };
  } catch (error) {
    console.error("❌ Zendesk API test failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Make it available on window for console testing
if (typeof window !== "undefined") {
  window.testZendeskConnection = testZendeskConnection;
}
