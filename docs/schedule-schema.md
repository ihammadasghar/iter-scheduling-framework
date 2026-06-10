# Schedule JSON Schema & Data Model
*University Scheduling System - Single Source of Truth*

## 1. Overview
The schedule data is stored as a flat JSON document in a Git repository. This format is the definitive "Source of Truth" for any given branch (Main Schedule or User Simulation). 

The schema is specifically designed to balance two competing architectural needs:
1. **Human-Readable Version Control:** By keeping the `classes` array flat, moving a class from one room/time to another only modifies a few lines of JSON, resulting in clean, readable Git diffs during Merge Requests.
2. **Fast Ephemeral Hydration:** The flat, relational structure maps perfectly to Cypher `CREATE` and `MATCH` statements, allowing the Node.js/Express backend to rapidly load the JSON into the in-memory Memgraph database for instantaneous constraint checking.

---

## 2. JSON Schema Example (`schedule.json`)
```json
{
  "metadata": {
    "semesterId": "FALL_2026",
    "semesterName": "Fall Semester 2026",
    "academicYear": "2026-2027",
    "timeline": {
      "semesterStartDate": "2026-09-07",
      "semesterEndDate": "2026-12-18",
      "exclusionDates": [
        { "date": "2026-11-26", "reason": "Thanksgiving Break" }
      ]
    },
    "versioning": {
      "lastModifiedBy": "admin@university.edu",
      "lastModifiedAt": "2026-05-28T11:25:00Z",
      "schemaVersion": "1.0.0"
    }
  },
  "timeSlots": [
    { "id": "TS_MON_P1", "day": "Monday", "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_MON_P2", "day": "Monday", "name": "Period 2", "startTime": "10:30", "endTime": "12:15" },
    { "id": "TS_TUE_P1", "day": "Tuesday", "name": "Period 1", "startTime": "09:00", "endTime": "11:30" }
  ],
  "rooms": [
    { "id": "RM_101", "name": "Room 101", "capacity": 50, "building": "Science Hall" },
    { "id": "RM_102", "name": "Room 102", "capacity": 30, "building": "Arts Block" }
  ],
  "professors": [
    { "id": "PRF_SMITH", "name": "Dr. Jane Smith", "department": "Biology" },
    { "id": "PRF_JONES", "name": "Prof. Alan Jones", "department": "History" }
  ],
  "studentGroups": [
    { "id": "GRP_BIO_Y1", "name": "Biology Year 1", "size": 45 },
    { "id": "GRP_HIS_Y1", "name": "History Year 1", "size": 25 }
  ],
  "courses": [
        { "id": "CRS_BIO101", "code": "BIO101", "name": "Intro to Biology", "department": "Biology" }
        ],
        "classes": [
        {
        "id": "CLS_00001",
        "courseId": "CRS_BIO101",
        "title": "Intro to Biology Lecture - Section A",
        "professorId": "PRF_SMITH",
        "studentGroupId": "GRP_BIO_Y1",
        "roomId": "RM_101",
        "timeSlotIds": ["TS_MON_P1", "TS_MON_P2"]
        }
    ]
}
```
---

## 3. Key Architectural Decisions

### Decision 1: Flat Array Structure over Nesting

Instead of nesting classes inside rooms or time slots, everything is normalized into top-level arrays with foreign keys (e.g., `roomId`, `professorId`).

* **Git-Flow Benefit:** Prevents massive cascading indentation shifts in Git diffs.
* **Graph Benefit:** Allows Memgraph to construct all base nodes (Rooms, Groups, Slots) first, and then draw relationships `[:HELD_IN]`, `[:TAUGHT_BY]` for the classes in a single, efficient pass.

### Decision 2: Dynamic Admin-Defined Time Slots

Instead of using mathematical integer math for discrete time blocks (e.g., 30-minute chunks), time is defined by an array of exact `timeSlots`.

* **Why:** Real-world university schedules have odd lengths, varying passing times, and structural differences between days (e.g., M/W/F are 1-hour blocks, T/Th are 1.5-hour blocks).
* **Graph Implementation:** The Express backend will sort these slots chronologically and connect them in Memgraph via `[:NEXT]` relationships to allow for sequence-based constraint checks (like consecutive classes and gaps).

### Decision 3: Including Master Entities in Every File

The `schedule.json` file includes master data (Rooms, Professors, Groups) rather than separating them into a central database.

* **Why:** This ensures every simulation branch is a **completely self-contained sandbox**. If a user wants to simulate adding a new temporary Room or hiring an adjunct Professor for their hypothetical schedule, they can do so in their isolated branch without altering the main universe.

### Decision 4: Extended Metadata Segregation

Metadata is separated into distinct functional areas:

* **Display Data (`timeline`):** Used heavily by the frontend UI to render exact dates (e.g., translating "Monday Period 1" into "Sept 7th").
* **Compute Data (Ignored by Graph):** The calculation engine (Memgraph) largely ignores metadata during hydration, as its primary concern is the pattern of the week, not specific calendar dates.
