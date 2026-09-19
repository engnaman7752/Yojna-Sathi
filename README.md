# Yojana Saathi

**Built for Bharat Build Tour**

A multilingual platform that tells Indian families which government welfare schemes they qualify for, explains why, and provides AI-powered scheme chat using official text — all while guarding sensitive data with fine-grained access control.

## Architecture Overview

**Yojana Saathi** uses a distributed microservices approach prioritizing deterministic rule execution, separation of privileges, and strict AI safety boundries.

*   **Frontend**: React + Vite
*   **Core API Backend**: Spring Boot 3 / Java 21 (REST API, Rule Engine, AuthZ)
*   **AI Service**: Python + Strands Agents SDK (LLM RAG, Chat, PDF Extraction)
*   **Identity & Auth**: Amazon Cognito / JWT
*   **Authorization Policy**: Amazon Verified Permissions (Cedar)
*   **Database**: Amazon DynamoDB (Single-table design layer)
*   **Vector Store**: Bedrock Knowledge Bases / Pinecone
*   **LLMs**: Amazon Bedrock Models (Claude 3.5, Titan) / Google Gemini

### Three Inviolable Rules
1. **The AI never decides eligibility.** It only extracts facts and drafts rules. A deterministic backend engine decides.
2. **Nothing AI-generated goes live without human approval.** Approvers must be different from the drafters.
3. **Citizens only see published content.** Drafts are strictly kept out of vector and search indexing to prevent hallucinated rules.

## Core Components Flow

### 1. Data Ingestion (Admin Flow)
- Admins upload official scheme PDFs. 
- The AI Service extracts clauses against `vocabulary.json` fields.
- The rule-engine generates candidate deterministic rules and saves them to DynamoDB in `DRAFT` status.
- A secondary Admin must approve these before they enter `PUBLISHED` status. Only published text goes to the Vector Store for embeddings.

### 2. Scheme Eligibility (Citizen Flow)
- A Citizen (or CSC Operator) submits baseline facts (Age, Gender, Land size, Income, etc.).
- The JVM Backend (Spring Boot) cross-references this with `PUBLISHED` scheme rules using `json-logic-java`.
- Results are reliably calculated without any LLM latency or hallucination risks.

### 3. AI Chat Query (Knowledge Base Flow)
- When a user asks a question, the AI service gets the request.
- The AI Service injects the User's JWT token for every backend query, ensuring no elevated/service privileges are used.
- RAG uses the Vector Store to find semantic matches from standard, verified Scheme Documents and responds to the user.

## Data Model (DynamoDB)
The system employs a Single-Table Design configured with PK, SK, and three Global Secondary Indexes (GSIs):
- `GSI1`: Operator-to-Household mappings.
- `GSI2`: District Officer jurisdiction queries.
- `GSI3`: Admin Draft Queue states.

## Running it (Local Stack)
Requires Docker and Docker Compose (brings up Local DynamoDB, Chroma, Seed script).
```bash
docker-compose up -d --build
```

Ports: Frontend `:5173`, Backend `:8080`, AI `:8000`, DB `:8001`, Chroma `:8002`.
