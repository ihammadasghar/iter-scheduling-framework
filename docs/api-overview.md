# API Overview & Architectural Decisions
*University Scheduling System*

## 1. Overview
The REST API serves as the orchestrator between the persistent storage layer (GitHub) and the ephemeral compute layer (Memgraph). It strictly follows RESTful principles, utilizing nouns for endpoints and standard HTTP methods for actions. 

---

## 2. API Endpoints Summary

| HTTP Method | Endpoint | Description | Layer Interacted With |
| :--- | :--- | :--- | :--- |
| **POST** | `/simulations` | Branch off `main`, create simulation, hydrate graph. | GitHub & Memgraph |
| **POST** | `/simulations/{id}/heartbeat` | Keep graph session active; resets GC timer. | Memgraph |
| **POST** | `/simulations/{id}/commit` | Export graph data to JSON and save to Git. | Memgraph -> GitHub |
| **GET** | `/simulations/{id}/classes` | Fetch paginated classes for current simulation. | Memgraph |
| **PATCH** | `/simulations/{id}/classes/{id}` | Update class assignment (micro-edit). | Memgraph |
| **GET** | `/simulations/{id}/classes/{id}/suggestions` | Pathfind valid slots/rooms (no conflicts). | Memgraph |
| **GET** | `/simulations/{id}/conflicts` | Run all hard constraint checks for session. | Memgraph |
| **GET** | `/simulations/{id}/metrics` | Evaluate all active metric rules for session. | Memgraph |
| **POST** | `/proposals` | Submit a simulation as a MR; trigger CI pipeline. | GitHub & Memgraph |
| **GET** | `/proposals` | List MRs (Admins view READY PRs). | GitHub |
| **GET** | `/proposals/{id}` | View PR diffs and metric impacts. | GitHub & Memgraph |
| **POST** | `/proposals/{id}/merge` | Approve and merge PR into `main`. | GitHub |
| **GET/POST** | `/rules/metrics` | Manage Admin-defined custom metrics. | GitHub (`main`) |
| **DELETE** | `/rules/metrics/{id}` | Remove a custom metric. | GitHub (`main`) |
| **GET/POST** | `/rules/constraints` | Manage Admin-defined hard constraints. | GitHub (`main`) |
| **DELETE** | `/rules/constraints/{id}` | Remove a hard constraint. | GitHub (`main`) |

---

## 3. Key Design Decisions & Justifications

### Decision 1: Stateful Session Sandbox
We run a stateful session. When `/simulations` is called, the file is hydrated into Memgraph *once* and tagged with the user's `branchId`. 

### Decision 2: The Heartbeat Mechanism (`/heartbeat`)
The frontend pings the `/heartbeat` endpoint every 60 seconds to prevent abandoned sessions from keeping 30,000 nodes in Memgraph RAM indefinitely. 

### Decision 3: Pagination for 30,000 Classes
The `GET /simulations/{id}/classes` endpoint enforces strict pagination (`page` and `limit` queries) combined with filtering to prevent overwhelming frontend rendering.

### Decision 4: Renaming "Merge Requests" to "Proposals"
"Proposals" accurately reflects the human-in-the-loop domain. Users are proposing a new reality for the timetable, which the Admin then reviews.

### Decision 5: Frontend-Agnostic Rule Builder
* **The Problem:** Having the frontend send raw Cypher queries for the rule builder tightly couples the UI to the database technology, posing a massive security and maintenance risk.
* **The Solution:** The UI sends a structured JSON payload (e.g., `{"target": "Class", "condition": "consecutive", "threshold": 3}`). The Express API acts as a translation layer, dynamically building the safe Cypher strings before execution.
* **Justification:** Perfect separation of concerns. The frontend doesn't need to know Memgraph exists.

### Decision 6: Global Rules Configuration
* **The Problem:** Where do we save Admin-defined rules without applying them to just a single user's branch?
* **The Solution:** We maintain a `rules.json` file exclusively on the `main` branch. 
* **Justification:** This acts as global configuration state. It doesn't need to be versioned alongside schedule edits, keeping our `schedule.json` files purely focused on timetable data.