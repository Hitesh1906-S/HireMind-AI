# HireMind AI - API Documentation

Base URL: `http://localhost:5001/api/v1` (or configured `NEXT_PUBLIC_API_URL`)

All responses adhere to the standard envelope:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation description",
  "data": { ... },
  "meta": { ... }
}
```

---

## 1. System & Health

### `GET /health` or `GET /api/v1/health`
Checks backend uptime, memory usage, and live database connectivity.

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "HireMind AI Backend Server is operational",
  "data": {
    "status": "UP",
    "database": {
      "status": "CONNECTED",
      "latency": "4ms"
    },
    "uptime": "342s",
    "memoryUsage": {
      "rss": "84MB",
      "heapUsed": "48MB",
      "heapTotal": "62MB"
    },
    "nodeVersion": "v20.14.0",
    "environment": "production",
    "timestamp": "2026-10-26T18:30:00.000Z"
  }
}
```

---

## 2. Authentication (`/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public (Rate Limited) | Register a new user (`CANDIDATE` or `RECRUITER`) |
| `POST` | `/auth/login` | Public (Rate Limited) | Authenticate user and issue tokens |
| `POST` | `/auth/refresh-token` | Public | Refresh expired access token using refresh token |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token and clear session cookies |
| `GET` | `/auth/me` | Authenticated | Fetch current authenticated user profile |
| `POST` | `/auth/forgot-password`| Public (Rate Limited) | Request password reset token via email |
| `POST` | `/auth/reset-password` | Public (Rate Limited) | Reset account password with token |

---

## 3. Candidate Resumes & Profiles (`/resumes`, `/profiles`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/resumes/upload` | Candidate | Upload candidate resume (PDF only, max 5MB) |
| `GET` | `/resumes` | Candidate | List uploaded resumes for authenticated candidate |
| `GET` | `/resumes/:id` | Candidate/Recruiter | Fetch resume details and extracted skills |
| `GET` | `/resumes/:id/pdf` | Candidate/Recruiter | Stream resume PDF file securely |
| `DELETE` | `/resumes/:id` | Candidate | Delete resume |
| `GET` | `/profiles/me` | Authenticated | Get full user profile |
| `PUT` | `/profiles/me` | Authenticated | Update user profile, skills, and bio |

---

## 4. Jobs & Requisitions (`/jobs`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/jobs` | Public | List published jobs with search and filter |
| `GET` | `/jobs/:id` | Public | Get single job details |
| `POST` | `/jobs` | Recruiter/Admin | Create job opening |
| `PUT` | `/jobs/:id` | Recruiter/Admin | Update job requisition details |
| `DELETE` | `/jobs/:id` | Recruiter/Admin | Archive or delete job requisition |
| `GET` | `/jobs/:id/match` | Candidate | Calculate AI resume match percentage against job |

---

## 5. Job Applications (`/applications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/applications` | Candidate | Apply for job with selected resume and cover letter |
| `GET` | `/applications/candidate` | Candidate | List applications submitted by current candidate |
| `GET` | `/applications/job/:jobId` | Recruiter | List all candidates who applied for a specific job |
| `PATCH`| `/applications/:id/status`| Recruiter | Update candidate application status (SHORTLIST, REJECT, etc.) |

---

## 6. Technical Interviews & Code Assessments (`/interviews`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/interviews/schedule` | Recruiter | Schedule technical interview session for candidate |
| `GET` | `/interviews/:id` | Candidate/Recruiter | Retrieve interview metadata and session state |
| `POST` | `/interviews/:id/start` | Candidate | Initialize interview chamber, questions, and audio stream |
| `POST` | `/interviews/:id/response`| Candidate | Submit voice transcript or answer to current question |
| `POST` | `/interviews/:id/complete`| Candidate | Conclude interview and trigger asynchronous evaluation |
| `POST` | `/interviews/:id/proctoring`| Candidate | Ingest proctoring integrity signal |
| `GET` | `/interviews/:id/timeline` | Recruiter | Retrieve integrity event timeline and audit metrics |

---

## 7. Recruiter Intelligence & Analytics (`/analytics`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/analytics/overview` | Recruiter | High-level KPI metrics (active jobs, candidate counts, avg scores) |
| `GET` | `/analytics/funnel` | Recruiter | Hiring pipeline conversion funnel statistics |
| `GET` | `/analytics/skills` | Recruiter | Aggregate skill distribution across candidate pool |
| `GET` | `/analytics/rankings/:jobId` | Recruiter | Deterministic candidate ranking table with component breakdown |
| `PUT` | `/analytics/rankings/:jobId/weights` | Recruiter | Update custom score weighting model for job |
| `POST` | `/analytics/pipeline-action` | Recruiter | Execute pipeline transitions (Shortlist, Reject, Move to Interview) |

---

## 8. PDF Report Generation (`/reports`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/candidate/:candidateId/job/:jobId/pdf` | Recruiter | Generate and download professional multi-section PDF candidate report |
| `GET` | `/reports/candidate/:candidateId/job/:jobId/preview` | Recruiter | Fetch structured report JSON preview |

---

## 9. Notifications Subsystem (`/notifications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Authenticated | List in-app notifications (paginated) |
| `GET` | `/notifications/unread-count` | Authenticated | Count of unread notifications |
| `PATCH`| `/notifications/:id/read` | Authenticated | Mark single notification as read |
| `PATCH`| `/notifications/read-all` | Authenticated | Mark all notifications as read |
| `DELETE`| `/notifications/:id` | Authenticated | Delete a notification |
