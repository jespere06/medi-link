import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';

/**
 * Tool to read the real clinical history of a patient from GCP FHIR.
 * This tool does not require the user's Token Vault since it uses the backend Service Account (medical read permissions).
 */
export const readPatientRecordTool = tool(
  async (input) => {
    const baseUrl = process.env.GCP_FHIR_BASE_URL;
    
    if (!baseUrl) {
       throw new Error("GCP_FHIR_BASE_URL is not configured.");
    }

    try {
      // Ensure the path to the credentials is absolute for greater reliability in Next.js
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      }

      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      });
      
      console.log(`[FHIR] Authenticating to query patient: ${input.patientId}...`);
      const client = await auth.getClient();

      // Configure an aggressive timeout (10s) to prevent infinite hangs
      const requestOptions = {
        timeout: 10000,
        headers: { 'Accept': 'application/fhir+json' },
        responseType: 'json' as const,
      };

      console.log(`[FHIR] Executing requests to GCP...`);

      const [patientRes, conditionRes] = await Promise.all([
        client.request({
          url: `${baseUrl}/Patient/${input.patientId}`,
          ...requestOptions
        }),
        client.request({
          url: `${baseUrl}/Condition?subject=Patient/${input.patientId}`,
          ...requestOptions
        })
      ]);

      const patientData = patientRes.data;
      const conditionData = (conditionRes.data as any)?.entry?.map((e: any) => e.resource) || [];

      console.log(`[FHIR] Data successfully retrieved for ${input.patientId}`);

      // Combine the data so the agent sees the full picture
      const clinicalRecord = {
        patient: patientData,
        conditions: conditionData
      };

      return JSON.stringify(clinicalRecord, null, 2);
    } catch (error: any) {
      console.error("[FHIR] Fatal error:", error.message);
      
      if (error.message.includes("Could not load the default credentials")) {
          return "Error: Could not load GCP credentials (auth0-key.json). Verify that the file exists in the root and is configured in .env.local";
      }
      
      return `Error retrieving clinical data: ${error.message}`;
    }
  },
  {
    name: "read_patient_clinical_record",
    description: "Reads the complete clinical history of a patient from the GCP FHIR Store server. Use it to analyze diagnoses, conditions, and general status before making medical decisions.",
    schema: z.object({
      patientId: z.string().describe("The Patient ID (UUID) to query"),
    }),
  }
);

/**
 * Tool to save a clinical note in the patient's FHIR history.
 * Uses the backend Service Account (same as the read tool).
 */
export const createClinicalNoteTool = tool(
  async (input) => {
    const baseUrl = process.env.GCP_FHIR_BASE_URL;
    if (!baseUrl) throw new Error("GCP_FHIR_BASE_URL is not configured.");

    try {
      // Ensure the path to the credentials is absolute
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      }

      const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
      const client = await auth.getClient();

      // Build a valid FHIR resource (Communication) for the clinical note
      const noteResource = {
        resourceType: "Communication",
        status: "completed",
        subject: { reference: `Patient/${input.patientId}` },
        sent: new Date().toISOString(),
        payload: [{ contentString: input.note }]
      };

      console.log(`[FHIR WRITE] Saving clinical note for patient: ${input.patientId}...`);

      const res = await client.request({
        url: `${baseUrl}/Communication`,
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        data: noteResource,
        responseType: 'json' as const,
      });

      console.log(`[FHIR WRITE] ✅ Note saved with ID: ${(res.data as any).id}`);
      return `Clinical note successfully saved in the FHIR Store (ID: ${(res.data as any).id}).`;
    } catch (error: any) {
      console.error("[FHIR WRITE] ❌ Error saving note:", error.message);
      return `Error saving note to FHIR: ${error.message}`;
    }
  },
  {
    name: "create_clinical_note",
    description: "Saves a progress note, diagnosis, or consultation summary in the official FHIR history of the patient.",
    schema: z.object({
      patientId: z.string().describe("The Patient ID (UUID)"),
      note: z.string().describe("The text content of the clinical note to save")
    }),
  }
);
