#!/usr/bin/env node
/**
 * seed-fhir-patients.mjs
 * 
 * Populates the GCP FHIR Store with realistic and varied synthetic patients.
 * Uses the Service Account configured in GOOGLE_APPLICATION_CREDENTIALS.
 * 
 * Usage: node scripts/seed-fhir-patients.mjs
 */

import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Configuration ────────────────────────────────────
const FHIR_BASE_URL = process.env.GCP_FHIR_BASE_URL 
  || 'https://healthcare.googleapis.com/v1/projects/aegishealth-core/locations/us-central1/datasets/aegis-healthcare-data/fhirStores/clinical-records-r4/fhir';

// ─── Realistic synthetic patients (Latin America + USA) ──
const SYNTHETIC_PATIENTS = [
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "García", given: ["María", "Elena"] }],
    gender: "female",
    birthDate: "1985-03-14",
    telecom: [
      { system: "phone", value: "+57 310 456 7890", use: "mobile" },
      { system: "email", value: "maria.garcia@correo.com" }
    ],
    address: [{ city: "Bogotá", state: "Cundinamarca", country: "CO", line: ["Cra 15 #82-31"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Rodríguez", given: ["Carlos", "Andrés"] }],
    gender: "male",
    birthDate: "1972-11-28",
    telecom: [
      { system: "phone", value: "+57 315 678 1234", use: "mobile" },
      { system: "email", value: "c.rodriguez@email.com" }
    ],
    address: [{ city: "Medellín", state: "Antioquia", country: "CO", line: ["Cll 50 #45-12"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Thompson", given: ["Sarah", "Jane"] }],
    gender: "female",
    birthDate: "1995-07-22",
    telecom: [
      { system: "phone", value: "+1 555 234 5678", use: "mobile" },
      { system: "email", value: "sarah.thompson@gmail.com" }
    ],
    address: [{ city: "Austin", state: "Texas", country: "US", line: ["4521 Oak Drive"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "S", display: "Never Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "en", display: "English" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Martínez", given: ["José", "Luis"] }],
    gender: "male",
    birthDate: "1960-01-09",
    telecom: [
      { system: "phone", value: "+52 55 9123 4567", use: "mobile" },
      { system: "email", value: "jlmartinez@outlook.com" }
    ],
    address: [{ city: "Ciudad de México", state: "CDMX", country: "MX", line: ["Av. Insurgentes Sur 1234"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "W", display: "Widowed" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Patel", given: ["Priya"] }],
    gender: "female",
    birthDate: "1988-09-03",
    telecom: [
      { system: "phone", value: "+1 555 876 5432", use: "mobile" },
      { system: "email", value: "priya.patel@hospital.org" }
    ],
    address: [{ city: "San Francisco", state: "California", country: "US", line: ["789 Mission St"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "en", display: "English" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "López", given: ["Ana", "Sofía"] }],
    gender: "female",
    birthDate: "2001-12-15",
    telecom: [
      { system: "phone", value: "+57 320 111 2233", use: "mobile" },
      { system: "email", value: "anasofial@unal.edu.co" }
    ],
    address: [{ city: "Cali", state: "Valle del Cauca", country: "CO", line: ["Av 6 Norte #23N-45"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "S", display: "Never Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Williams", given: ["James", "Robert"] }],
    gender: "male",
    birthDate: "1949-04-30",
    telecom: [
      { system: "phone", value: "+1 555 321 9876", use: "home" },
      { system: "email", value: "jrwilliams@aol.com" }
    ],
    address: [{ city: "Chicago", state: "Illinois", country: "US", line: ["1200 Lake Shore Dr"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "en", display: "English" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Hernández", given: ["Diego", "Fernando"] }],
    gender: "male",
    birthDate: "1993-06-17",
    telecom: [
      { system: "phone", value: "+57 318 555 6789", use: "mobile" },
      { system: "email", value: "dhernandez@empresa.co" }
    ],
    address: [{ city: "Barranquilla", state: "Atlántico", country: "CO", line: ["Cra 53 #76-20"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "S", display: "Never Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Chen", given: ["Wei", "Lin"] }],
    gender: "male",
    birthDate: "1978-02-20",
    telecom: [
      { system: "phone", value: "+1 555 444 7777", use: "mobile" },
      { system: "email", value: "wchen@tech.com" }
    ],
    address: [{ city: "Seattle", state: "Washington", country: "US", line: ["456 Pine Street"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M", display: "Married" }] },
    communication: [
      { language: { coding: [{ system: "urn:ietf:bcp:47", code: "zh", display: "Chinese" }] } },
      { language: { coding: [{ system: "urn:ietf:bcp:47", code: "en", display: "English" }] } }
    ]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Morales", given: ["Valentina"] }],
    gender: "female",
    birthDate: "2010-08-25",
    telecom: [
      { system: "phone", value: "+57 301 987 6543", use: "mobile" }
    ],
    address: [{ city: "Bucaramanga", state: "Santander", country: "CO", line: ["Cll 36 #28-15"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "S", display: "Never Married" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Nakamura", given: ["Yuki"] }],
    gender: "female",
    birthDate: "1990-05-11",
    telecom: [
      { system: "phone", value: "+1 555 888 1234", use: "mobile" },
      { system: "email", value: "yuki.nakamura@med.edu" }
    ],
    address: [{ city: "Los Angeles", state: "California", country: "US", line: ["321 Wilshire Blvd"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "S", display: "Never Married" }] },
    communication: [
      { language: { coding: [{ system: "urn:ietf:bcp:47", code: "ja", display: "Japanese" }] } },
      { language: { coding: [{ system: "urn:ietf:bcp:47", code: "en", display: "English" }] } }
    ]
  },
  {
    resourceType: "Patient",
    active: true,
    name: [{ use: "official", family: "Ramírez", given: ["Pedro", "Antonio"] }],
    gender: "male",
    birthDate: "1955-10-03",
    telecom: [
      { system: "phone", value: "+57 316 222 3344", use: "home" }
    ],
    address: [{ city: "Cartagena", state: "Bolívar", country: "CO", line: ["Centro Histórico, Cll del Arsenal #10-50"] }],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "W", display: "Widowed" }] },
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "es", display: "Español" }] } }]
  },
];

// ─── Clinical conditions (Conditions) ─────────────────
// Will be assigned to patients after creation
const CONDITION_TEMPLATES = [
  { code: "44054006", display: "Type 2 diabetes mellitus", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "38341003", display: "Essential hypertension", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "195662009", display: "Congestive heart failure", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "233604007", display: "Pneumonia", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "40055000", display: "Chronic obstructive pulmonary disease", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "73211009", display: "Type 1 diabetes mellitus", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "49436004", display: "Atrial fibrillation", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "235595009", display: "Chronic gastritis", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "396275006", display: "Osteoarthritis", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "386661006", display: "Fever", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "267036007", display: "Chest pain", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "13645005", display: "Chronic kidney disease", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "39848009", display: "Asthma", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "35489007", display: "Clinical depression", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
  { code: "230690007", display: "Cerebrovascular accident (Stroke)", system: "http://snomed.info/sct", category: "encounter-diagnosis" },
];

// Assign 1-3 conditions per patient
const PATIENT_CONDITIONS_MAP = [
  [0, 1],       // María García: Diabetes T2, Hipertensión
  [1, 4, 6],    // Carlos Rodríguez: Hipertensión, EPOC, Fibrilación auricular
  [13],         // Sarah Thompson: Depresión
  [0, 2, 12],   // José Luis Martínez: Diabetes T2, ICC, Enfermedad renal
  [7, 8],       // Priya Patel: Gastritis, Osteoartritis
  [12],         // Ana Sofía López: Asma
  [0, 1, 2, 6], // James Williams: Diabetes T2, Hipertensión, ICC, Fib. auricular
  [9, 3],       // Diego Hernández: Fiebre, Neumonía
  [1, 10],      // Wei Lin Chen: Hipertensión, Dolor torácico
  [12, 9],      // Valentina Morales: Asma, Fiebre
  [13, 7],      // Yuki Nakamura: Depresión, Gastritis
  [0, 1, 11, 14], // Pedro Ramírez: Diabetes T2, Hipertensión, Enf. renal, ACV
];

// ─── Main ─────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  AegisHealth FHIR Seeder — GCP Healthcare   ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  
  // Auth
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });
  const client = await auth.getClient();
  console.log("✅ Authenticated with Service Account\n");

  const createdPatientIds = [];

  // 1. Create patients
  console.log("━━━ Creating Patients ━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  for (let i = 0; i < SYNTHETIC_PATIENTS.length; i++) {
    const patient = SYNTHETIC_PATIENTS[i];
    const displayName = `${patient.name[0].given.join(" ")} ${patient.name[0].family}`;
    
    try {
      const res = await client.request({
        url: `${FHIR_BASE_URL}/Patient`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json',
        },
        data: patient,
        responseType: 'json',
      });

      const id = res.data.id;
      createdPatientIds.push(id);
      console.log(`  ✅ [${i + 1}/${SYNTHETIC_PATIENTS.length}] ${displayName} → ID: ${id}`);
    } catch (e) {
      console.error(`  ❌ Error creating ${displayName}:`, e.message);
      createdPatientIds.push(null);
    }
  }

  console.log(`\n📊 Patients created: ${createdPatientIds.filter(Boolean).length}/${SYNTHETIC_PATIENTS.length}\n`);

  // 2. Create clinical conditions
  console.log("━━━ Creating Clinical Conditions ━━━━━━━━━━━━━\n");

  let conditionsCreated = 0;
  
  for (let pIdx = 0; pIdx < PATIENT_CONDITIONS_MAP.length; pIdx++) {
    const patientId = createdPatientIds[pIdx];
    if (!patientId) continue;

    const conditionIndices = PATIENT_CONDITIONS_MAP[pIdx];
    const patientName = `${SYNTHETIC_PATIENTS[pIdx].name[0].given[0]} ${SYNTHETIC_PATIENTS[pIdx].name[0].family}`;
    
    for (const cIdx of conditionIndices) {
      const template = CONDITION_TEMPLATES[cIdx];
      
      const condition = {
        resourceType: "Condition",
        clinicalStatus: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }]
        },
        verificationStatus: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed", display: "Confirmed" }]
        },
        category: [{
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: template.category, display: "Encounter Diagnosis" }]
        }],
        code: {
          coding: [{ system: template.system, code: template.code, display: template.display }],
          text: template.display
        },
        subject: { reference: `Patient/${patientId}` },
        onsetDateTime: randomPastDate(),
        recordedDate: new Date().toISOString().split('T')[0],
      };

      try {
        await client.request({
          url: `${FHIR_BASE_URL}/Condition`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json',
          },
          data: condition,
          responseType: 'json',
        });
        conditionsCreated++;
        console.log(`  💊 ${patientName}: ${template.display}`);
      } catch (e) {
        console.error(`  ❌ Error creating condition for ${patientName}:`, e.message);
      }
    }
  }

  console.log(`\n📊 Conditions created: ${conditionsCreated}\n`);

  // 3. Summary
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║           ✅ SEED COMPLETED                 ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Patients:    ${String(createdPatientIds.filter(Boolean).length).padStart(3)} created                   ║`);
  console.log(`║  Conditions:  ${String(conditionsCreated).padStart(3)} created                   ║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log("\n🔄 Refresh the app at http://localhost:3000 to see the patients.\n");
}

function randomPastDate() {
  const daysAgo = Math.floor(Math.random() * 365 * 5) + 30; // 30 days to 5 years ago
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().split('T')[0];
}

main().catch(err => {
  console.error("💀 Fatal error:", err);
  process.exit(1);
});
