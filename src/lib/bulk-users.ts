import { nameToIdMap } from "./engineerMap.js";

interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ZendeskUsersResponse {
  users: ZendeskUser[];
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

// Generic API request function
async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`/api/zendesk${endpoint}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// Bulk user fetching function that uses only ONE API call
export async function getBulkUsers(): Promise<ZendeskUser[]> {
  console.log("🎯 BULK USER FETCH - Using single API call to avoid rate limits");
  
  const engineerEntries = Array.from(nameToIdMap.entries());
  console.log(`📋 Target engineers: ${engineerEntries.length}`);

  // Create placeholder users as fallback
  const placeholderUsers: ZendeskUser[] = engineerEntries.map(([name, id]) => ({
    id: id,
    name: name,
    email: `${name.toLowerCase().replace(" ", ".")}@placeholder.com`,
    role: "agent",
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  try {
    // SINGLE API CALL - no individual requests!
    console.log("📦 Making ONE bulk API call to /users...");
    const allUsersResponse = await apiRequest<ZendeskUsersResponse>("/users");
    console.log(`📦 Success! Retrieved ${allUsersResponse.users.length} total users`);
    
    // Filter to engineers we need
    const engineerIds = new Set(Array.from(nameToIdMap.values()));
    const foundEngineers = allUsersResponse.users.filter(user => engineerIds.has(user.id));
    
    console.log(`👥 Found ${foundEngineers.length} real engineers from bulk data`);
    foundEngineers.forEach(user => {
      console.log(`✅ Real: ${user.name} (${user.id})`);
    });
    
    // Combine real data with placeholders for missing engineers
    const foundIds = new Set(foundEngineers.map(u => u.id));
    const missingEngineers = placeholderUsers.filter(u => !foundIds.has(u.id));
    
    if (missingEngineers.length > 0) {
      console.log(`📝 Creating ${missingEngineers.length} placeholders for missing engineers`);
      missingEngineers.forEach(user => {
        console.log(`📝 Placeholder: ${user.name} (${user.id})`);
      });
    }
    
    const finalUsers = [...foundEngineers, ...missingEngineers];
    console.log(`📊 Final result: ${finalUsers.length} engineers total`);
    return finalUsers;
    
  } catch (error) {
    console.warn("❌ Bulk API failed, using all placeholder data:", error);
    console.log(`📝 Using ${placeholderUsers.length} placeholder engineers`);
    return placeholderUsers;
  }
}
