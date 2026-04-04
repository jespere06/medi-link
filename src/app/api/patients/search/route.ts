import { auth0 } from '../../../../lib/auth0';
import { GoogleAuth } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/patients/search?q=García&type=name
 * 
 * Searches for patients in the GCP Healthcare API FHIR Store.
 * 
 * Parameters:
 *   - q: Search term (name, last name, or UUID)
 *   - type: "name" | "id" (default: "name")
 * 
 * Zero-Trust Principle: Only executes if the user is authenticated.
 * Minimum Necessary Principle: Only returns necessary clinical fields.
 */
export async function GET(req: NextRequest) {
  // 1. Verify authentication
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type') || 'name';

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const baseUrl = process.env.GCP_FHIR_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "FHIR store not configured" }, { status: 503 });
  }

  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();

    // Build the FHIR search URL
    let searchUrl: string;
    if (type === 'id') {
      // Exact search by ID
      searchUrl = `${baseUrl}/Patient/${query}`;
    } else {
      // Search by name (name:contains is a standard FHIR modifier)
      searchUrl = `${baseUrl}/Patient?name:contains=${encodeURIComponent(query)}&_count=15&_sort=-_lastUpdated`;
    }

    console.log(`[FHIR Search] ${session.user.name || session.user.email} searching: "${query}" (type: ${type})`);

    const res = await client.request({
      url: searchUrl,
      headers: { 'Accept': 'application/fhir+json' },
      responseType: 'json',
    });

    const data = JSON.parse(JSON.stringify(res.data));

    // If it was an ID search, return as a single-element array
    if (type === 'id') {
      if (data?.resourceType === 'Patient') {
        return NextResponse.json({ patients: [data], total: 1 });
      }
      return NextResponse.json({ patients: [], total: 0 });
    }

    // For name search, parse the Bundle
    const patients = data?.entry?.map((e: any) => e.resource).filter((r: any) => r?.resourceType === 'Patient') || [];
    
    console.log(`[FHIR Search] ✅ Found: ${patients.length} results`);

    return NextResponse.json({
      patients,
      total: data?.total ?? patients.length,
    });
  } catch (e: any) {
    // If the patient does not exist (404 in ID search)
    if (e.response?.status === 404) {
      return NextResponse.json({ patients: [], total: 0 });
    }
    console.error("[FHIR Search] ❌ Error:", e.message);
    return NextResponse.json({ error: "Error querying FHIR" }, { status: 500 });
  }
}
