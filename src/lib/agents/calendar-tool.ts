import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';

export const googleCalendarTool = tool(
  async (input, config) => {
    console.log("\n=======================================================");
    console.log("🗓️  STARTING TOOL: GOOGLE CALENDAR");
    console.log("=======================================================");
    
    const refreshToken = config?.configurable?.auth0?.refreshToken;
    
    console.log(`[1. SETUP] Checking environment and session...`);
    console.log(`- AUTH0_DOMAIN: ${process.env.AUTH0_DOMAIN}`);
    console.log(`- Refresh token in session?: ${refreshToken ? '✅ YES' : '❌ NO'}`);
    
    if (!refreshToken) {
      console.error("[1. SETUP] Critical Failure: No refresh token to initiate exchange.");
      throw new Error("AUTH0_AI_INTERRUPT: No Refresh Token in session. Please log out and log in again.");
    }

    // 1. DIRECT EXCHANGE WITH TOKEN VAULT
    let googleToken = null;
    try {
      console.log("\n[2. TOKEN VAULT] Requesting Google Federated Token from Auth0...");
      
      const res = await axios.post(
        `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
        {
          client_id: process.env.AUTH0_CLIENT_ID,
          client_secret: process.env.AUTH0_CLIENT_SECRET,
          subject_token: refreshToken,
          grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
          subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
          requested_token_type: "http://auth0.com/oauth/token-type/federated-connection-access-token",
          connection: "google-oauth2"
        }
      );
      
      googleToken = res.data.access_token;
      
      console.log("[2. TOKEN VAULT] ✅ Token Exchange Successful!");
      console.log("[2. TOKEN VAULT] --- RETURNED TOKEN DETAILS ---");
      console.log(`- Token Type: ${res.data.token_type}`);
      console.log(`- Expires in: ${res.data.expires_in} seconds`);
      // THIS IS KEY! Here we see if Google actually granted Calendar permissions
      console.log(`- Scopes Granted: ${res.data.scope || 'NONE REPORTED'}`); 
      console.log(`- Token Format: ${googleToken.substring(0, 15)}...[TRUNCATED]`);
      console.log("----------------------------------------------------\n");
      
    } catch (error: any) {
      const auth0Error = error.response?.data || error.message;
      console.error("\n[2. TOKEN VAULT] ❌ AUTH0 TOKEN EXCHANGE FAILED");
      console.error("- HTTP Status:", error.response?.status);
      console.error("- Error Detail:", JSON.stringify(auth0Error, null, 2));
      console.log("=======================================================\n");
      
      throw new Error("AUTH0_AI_INTERRUPT: " + JSON.stringify(auth0Error));
    }

    // 2. EVENT CREATION IN GOOGLE CALENDAR
    console.log(`[3. GOOGLE CALENDAR] Preparing payload for Google API...`);
    
    const calendarPayload = {
      summary: `Medical Discharge - Patient ID: ${input.patientId}`,
      description: `# 📋 MediLink AI Scribe Medical Report\n\n**Discharge Diagnosis:** ${input.diagnosis}.\n\nCreated by GLM 5.1 Clinical Copilot (MediLink Intelligence)`,
      start: {
        dateTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        timeZone: "UTC"
      },
      end: {
        dateTime: new Date(Date.now() + 7200 * 1000).toISOString(),
        timeZone: "UTC"
      }
    };

    console.log("[3. GOOGLE CALENDAR] Payload:");
    console.log(JSON.stringify(calendarPayload, null, 2));
    
    try {
      console.log("\n[3. GOOGLE CALENDAR] Sending POST to https://www.googleapis.com/calendar/v3/calendars/primary/events ...");
      const response = await axios.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        calendarPayload,
        {
          headers: {
            "Authorization": `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("[3. GOOGLE CALENDAR] ✅ Event created successfully!");
      console.log(`- HTTP Status: ${response.status}`);
      console.log(`- Event ID: ${response.data.id}`);
      console.log(`- HTML Link: ${response.data.htmlLink}`);
      console.log("=======================================================\n");

      return `Discharge successfully scheduled in Google Calendar. Link: ${response.data.htmlLink}`;
    } catch (e: any) {
      // 🔥 THE FIX: If Google says 401, force Token Vault popup
      if (e.response?.status === 401) {
        throw new Error("AUTH0_AI_INTERRUPT: Google access token expired or revoked. Please authorize again.");
      }

      // Other errors (e.g. 400 Bad Request, 403 Forbidden) are returned to the LLM
      return `Error scheduling in Calendar: HTTP ${e.response?.status} - ${JSON.stringify(e.response?.data)}`;
    }
  },
  {
    name: "schedule_medical_discharge",
    description: "Schedules a formal medical discharge appointment for a patient in the calendar.",
    schema: z.object({
      patientId: z.string().describe("Patient ID for whom the appointment is scheduled"),
      diagnosis: z.string().describe("Primary medical diagnosis for the discharge")
    })
  }
);
