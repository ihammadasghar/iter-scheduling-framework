# Sequence Diagram: Merge Request & CI Pipeline
*University Scheduling System - "Blocked PR" Workflow*

## 1. Overview
This sequence diagram maps the flow of data across the four primary actors in our system (Frontend UI, Express API, GitHub Storage, and Memgraph Compute) during the most complex user story: submitting a Simulation for review.

We have explicitly chosen the **"Blocked PR" (Option B)** workflow. Instead of outright rejecting a failed simulation, the system flags the open Merge Request (MR) as "Blocked," allowing the user to push incremental fixes to the same request until the CI Pipeline passes.

## 2. Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant API as Express API
    participant Git as GitHub (Storage)
    participant DB as Memgraph (Compute Layer)
    actor Admin
    
    User->>API: 1. Submit Merge Request (branch: sim-user-1)
    API->>Git: 2. Create Pull Request (sim-user-1 into main)
    Git-->>API: PR Created (Status: Pending)
    
    rect rgb(255, 240, 240)
        Note over API, DB: CI Pipeline Run 1: Conflicts Detected
        API->>Git: 3. Fetch "Dry Run" merged JSON state
        Git-->>API: Combined schedule.json payload
        API->>DB: 4. Hydrate JSON (CREATE nodes & edges)
        API->>DB: 5. Execute Hard Constraint Cypher Queries
        DB-->>API: Result: 1 Conflict (e.g., Room Double-Booking)
        API->>DB: 6. Flush Ephemeral Data (Wipe Graph)
    end
    
    API->>Git: 7. Update PR Status (Blocked) & Add Comment with Conflict Details
    API-->>User: 8. Return MR Status: Blocked (Action Required)
    
    Note over User, Git: User fixes the conflict in their sandbox
    User->>API: 9. Update Branch (Move conflicting class to new Room/Time)
    API->>Git: 10. Commit updated JSON to sim-user-1 branch
    
    rect rgb(240, 255, 240)
        Note over API, DB: CI Pipeline Run 2: Re-Evaluation
        API->>Git: 11. Fetch new "Dry Run" merged JSON state
        API->>DB: 12. Hydrate JSON
        API->>DB: 13. Execute Hard Constraint Cypher Queries
        DB-->>API: Result: 0 Conflicts
        API->>DB: 14. Flush Ephemeral Data
    end
    
    API->>Git: 15. Update PR Status (Passed/Ready for Review)
    API-->>User: 16. Return MR Status: Ready for Admin Review
    
    Note over Admin, API: Admin Governance & Approval
    Admin->>API: 17. View Pending MR Details
    API->>Git: 18. Fetch PR Diff & Metric Impacts
    API-->>Admin: 19. Display Diff (What Changed) & Metric Delta
    Admin->>API: 20. Approve & Merge Request
    API->>Git: 21. Merge sim-user-1 into main branch
    API-->>Admin: 22. Success (Main Schedule Updated)
```
![alt text](image-2.png)

## 3. Step-by-Step Breakdown

### Phase 1: Submission & Initial Failure (Steps 1-8)
When the User submits their simulation, the Express API acts as the orchestrator. It tells GitHub to open a Pull Request, then immediately pulls what the resulting JSON *would* look like if merged. It hydrates Memgraph, runs the Cypher constraint checks, and detects a conflict. Memgraph is immediately flushed to save memory, and GitHub is updated to show the PR as blocked.

### Phase 2: The Fix & Re-Evaluation (Steps 9-16)
Because the PR is kept open, the user can easily fix the specific error (e.g., changing a room assignment) without losing the rest of their proposed changes. Pushing this fix triggers the Express API to run the CI Pipeline again. This time, Memgraph returns 0 conflicts, so the API updates GitHub to flag the PR as "Ready for Review."

### Phase 3: Admin Approval (Steps 17-22)
The Admin dashboard only shows MRs that have successfully passed the Memgraph CI Pipeline. The Admin reviews the clean Git diff (made possible by our flat JSON schem