# 🛡️ MediLink AI Scribe: Zero-Trust Cross-Lingual Clinical Agent

[![Built with Z.AI](https://img.shields.io/badge/Built_with-Z.AI_GLM_5.1-blue.svg)](https://z.ai/)
[![Secured by Auth0](https://img.shields.io/badge/Secured_by-Auth0_Token_Vault-eb5424.svg)](https://auth0.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)

An enterprise-grade medical co-pilot designed to solve the two biggest bottlenecks in global healthcare automation: **Language Barriers** and **LLM Security Risks**.

Built for the **Global AI Hackathon (Z.AI & Auth0)**.

## ⚠️ The Problem

1. **Language Barriers:** Most cutting-edge clinical systems expect English inputs, but doctors in LATAM, Asia, and Europe dictate notes in their native languages.
2. **The "Rogue AI" Risk:** Giving an autonomous LLM raw API keys to write directly to a doctor's agenda or a hospital's database is a massive security and HIPAA compliance risk.

## 🚀 The Solution

MediLink acts as a **Cross-Lingual Zero-Trust Scribe**:

- **Cross-Lingual Reasoning (Z.AI):** The doctor speaks in Spanish. Z.AI's `GLM-ASR` transcribes it, and `GLM-5.1` acts as a cultural bridge, reasoning the clinical context and outputting standardized Medical English.
- **Zero-Trust Architecture (Auth0):** The AI orchestrates the clinical workflow (LangGraph), but it **does not hold the Google Calendar tokens**. When the AI attempts to schedule a medical discharge, the **Auth0 Token Vault** intercepts the action, halting the LLM and demanding human cryptographic consent before proceeding. _Human-in-the-loop, always._

---

## ✨ Key Features

- **🗣️ Z.AI Cross-Lingual Pipeline:** Audio (es-CO) ➔ GLM-ASR ➔ GLM-5.1 Reasoning ➔ FHIR/Calendar Output (en-US).
- **🔐 Auth0 Token Vault Integration:** Secure Google Workspace integration using `@auth0/ai-langchain` intercepts. The LLM never touches the underlying Google access tokens.
- **🏥 GCP FHIR Native:** Fully integrated with Google Cloud Healthcare API (FHIR R4 standard) for enterprise-grade clinical record management.
- **🧠 LangGraph Orchestration:** Multi-step agentic workflow ensuring strictly ordered clinical operations.

---

## 🏗️ Architecture

1. **User Input:** Physician uploads an audio note (or types) in Spanish.
2. **Transcription:** Audio is chunked and sent to Z.AI `glm-asr-2512`.
3. **Orchestration:** LangGraph triggers the `GLM-5.1` agent.
4. **Data Retrieval:** Agent uses the FHIR Tool (Server-to-Server) to read the patient's medical history.
5. **Action Attempt:** Agent tries to use the `googleCalendarTool` to schedule a discharge.
6. **Zero-Trust Intercept:** Auth0 Token Vault halts the graph (`GraphInterrupt`).
7. **Human Consent:** The UI prompts the doctor. Once authorized, Auth0 exchanges the session token for a Google federated token.
8. **Execution:** The event is scheduled, and the AI concludes the workflow, generating a clinical Markdown report.

---

## 💻 Getting Started

### Prerequisites

- Node.js 18+
- [Z.AI API Key](https://z.ai/)
- Auth0 Tenant (with Token Vault and Google Social Connection configured)
- Google Cloud Project (with Healthcare API / FHIR Store enabled)

### 1. Clone the repository

```bash
git clone https://github.com/jespere06/medi-link.git
cd medi-link
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# AUTH0 CONFIGURATION
AUTH0_SECRET='your_auth0_secret'
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://your-tenant.us.auth0.com'
AUTH0_CLIENT_ID='your_client_id'
AUTH0_CLIENT_SECRET='your_client_secret'

# Z.AI CONFIGURATION
Z_AI_API_KEY='your_glm_api_key'
Z_AI_ENDPOINT='https://api.z.ai/api/paas/v4/'

# GCP FHIR CONFIGURATION
GCP_FHIR_BASE_URL='https://healthcare.googleapis.com/v1/projects/.../fhir'
GOOGLE_APPLICATION_CREDENTIALS='./auth0-key.json'
```

_(Make sure to place your GCP service account JSON file as `auth0-key.json` in the root)._

### 4. Seed the FHIR Database (Optional)

To test the app with synthetic patients (LATAM & US demographic):

```bash
node scripts/seed-fhir-patients.mjs
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🛠️ Built With

- **[Next.js 15 (App Router)](https://nextjs.org/)** - React Framework
- **[Z.AI (GLM-5.1 & GLM-ASR)](https://z.ai/)** - Large Language & Audio Models
- **[Auth0 by Okta](https://auth0.com/)** - Identity & Token Vault
- **[LangChain & LangGraph](https://www.langchain.com/)** - AI Orchestration
- **[Google Cloud Healthcare API](https://cloud.google.com/healthcare-api)** - FHIR R4 Store
- **Tailwind CSS** - Styling

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
