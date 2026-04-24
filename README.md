# UM-Hackathon-2026

# 🚀 Tauke.AI 

> **UM Hackathon 2026** | *Your Autonomous F&B Business Analyst & Strategy Simulator*

Tauke.AI is an end-to-end intelligence platform designed to help Malaysian Food & Beverage (F&B) SMEs make enterprise-grade, data-driven decisions. By combining Vision AI for financial extraction, multi-agent debate for strategy generation, and Swarm Intelligence for "What-If" scenario simulations, Tauke.AI acts as a virtual Board of Directors for business owners.

### ⚠️ Important Note: Waking up the Server
Since our backend API is hosted on Render, the server may automatically go to sleep after a period of inactivity. 

**Before using or testing the live application, please click the link below to "wake up" the backend:**
👉 **[https://tauke-ai-backend.onrender.com/health](https://tauke-ai-backend.onrender.com/health)**

*(Please allow up to 30-50 seconds for the server to spin up and return a "Healthy" status. Once awake, the main app will be lightning fast!)*

---

## ✨ Core Features

* 📄 **Automated Financial Ingestion:** Upload PDF Profit & Loss statements or Supplier Invoices. The system utilizes Vision AI (ZhipuAI GLM-5.1) to automatically extract, structure, and categorize expenses and revenues.
* 📊 **Detective Analysis:** Ingest CSV sales logs to automatically identify peak hours, compute Average Order Value (AOV), and flag top-rising or falling menu items.
* 👔 **The AI Boardroom:** * **Interrogation:** The AI Analyst reviews diagnostic patterns and asks the business owner targeted questions to gain real-world context.
  * **Multi-Agent Debate:** Three distinct AI personas (CMO, CFO, COO) argue different recovery or growth strategies based on the financial data.
  * **CEO Synthesis:** Synthesizes the debate into aggressive, hybrid, or defensive strategic vectors.
* 🦠 **MicroFish Swarm Simulation (Sandbox):** Test business ideas before spending capital. The system generates virtual customer agents governed by real-time API signals (Weather, Foot Traffic) to simulate whether a new promotion will actually boost net profit.
* 🗺️ **Dynamic Execution Roadmaps:** Converts the final approved strategy into a hyper-specific, actionable timeline adapted to local competitor and environmental data.

---

## 🏗️ Architecture & Tech Stack

### Frontend (`/tauke-ai-web`)
A modern, responsive Single Page Application (SPA) built for speed and seamless UX.
* **Framework:** React.js + Vite
* **Routing:** React Router (Dashboard, DataSync, DetectiveAnalysis, AIDebate, SwarmSimulation, CampaignRoadmap)
* **Authentication & State:** Supabase Client (`src/supabaseClient.js`)
* **Styling:** CSS / UI Components

### Backend (`/backend`)
A high-performance asynchronous API handling LLM orchestration and data processing.
* **Framework:** FastAPI (Python) + Uvicorn
* **Database:** Supabase (PostgreSQL)
* **AI & LLMs:** ZhipuAI & ILMU API (Multi-layered fallback loops)
* **Data Processing:** Pandas, PyMuPDF (`fitz`)

### External Data Integrations (Live Signals)
* **Google Places API:** Nearby competitor density and location geocoding.
* **OpenWeather API:** Real-time and historical weather correlation.
* **GNews API:** Local events and macro-economic shifts.
* **Google Routes & BestTime API:** Live traffic and footfall intensity.

---

## 🚀 Local Development Setup

### Prerequisites
* Node.js (v18+)
* Python (3.10+)
* A Supabase Project

### 1. Clone the Repository
```bash
git clone [https://github.com/Gohpeijia/UM-Hackathon-2026.git](https://github.com/Gohpeijia/UM-Hackathon-2026.git)
cd UM-Hackathon-2026

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and set up your environment variables.
