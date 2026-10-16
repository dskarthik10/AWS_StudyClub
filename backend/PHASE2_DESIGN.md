# Phase 2: AI StudyClub Resource Management Design & Schema Proposal

**Date:** 2026-10-10  
**Phase:** Phase 2 (Resource Management & Security Hardening)  
**Target Region:** ap-south-1 (Mumbai)  
**Target Table:** `AIStudyClub`  
**Target S3 Bucket:** `aistudyclub-karthik-2026`  

---

## 1. Executive Summary

Phase 2 focuses on fixing critical security vulnerabilities in resource uploading and downloading, transitioning the resource architecture from expensive, unindexed table scans to high-performance single-table DynamoDB queries, enforcing server-side ownership and authorization verification via Cognito JWT claims, and establishing comprehensive tracking for uploads, downloads, ownership, and group sharing.

---

## 2. Security Vulnerability Analysis & Remediation

| Component | Current Vulnerability | Threat Model | Remediation |
|---|---|---|---|
| `AIStudyClub-CreateResource` | Accepts `uploadedBy` from client request body without validation. | Malicious client can spoof any user or administrator name. | Extract `sub`, `email`, and `name` directly from verified `requestContext.authorizer.jwt.claims`. Reject unauthenticated requests with 401. Store both immutable `ownerId` (`sub`) and display name. |
| `AIStudyClub-CreateResource` | Does not verify if S3 file actually exists. | Ghost resource records created without uploaded files. | Execute `s3.head_object()` to verify file existence and retrieve verified byte size before writing metadata. |
| `AIStudyClub-GenerateDownloadUrl` | Generates presigned URL for any requested `s3Key` without authorization. | Insecure Direct Object Reference (IDOR). Any authenticated user can download any private or group-restricted document. | Look up resource record via `s3Key` or `resourceId`. Verify user is owner, or resource is public, or user is an active member of the shared club. Return 403 Forbidden on failure. |
| `AIStudyClub-GenerateDownloadUrl` | Does not track downloads or audit activity. | No metrics, analytics, or download abuse tracking. | Atomically increment `downloads` counter on resource item and record `USER_DOWNLOAD` activity in DynamoDB. |
| `AIStudyClub-GetResources` | Executes `table.scan()` across the entire table. | Performance degrades exponentially; scans read non-resource entities; high cost. | Implement GSI-based query (`GSI2PK = "RESOURCE"`) and direct user partition query (`PK = USER#{userId}`). Fall back gracefully during GSI indexing. |

---

## 3. DynamoDB Single-Table Schema Proposal

### 3.1 Existing Data Preservation
The table `AIStudyClub` currently contains 13 items across 5 entity types (`USER`, `CLUB`, `CLUB_MEMBER`, `CLUB_MESSAGE`, `RESOURCE`).
**Guaranteed:** No existing items will be deleted or overwritten destructively. All existing attributes are preserved. Existing resources will be enriched with indexing attributes.

### 3.2 Entity Definitions

#### A. Resource Metadata (`RESOURCE`)
- **PK:** `RESOURCE#{resourceId}`
- **SK:** `METADATA`
- **entityType:** `RESOURCE`
- **resourceId:** `{resourceId}` (UUID)
- **title:** String (sanitized, 1–200 chars)
- **subject:** String (e.g., "Computer Science", "Cloud Computing")
- **type:** String (e.g., "Notes", "Question Paper", "Syllabus")
- **semester:** String
- **description:** String
- **ownerId:** String (Cognito user `sub` claim)
- **uploadedBy:** String (display name or email from Cognito claims)
- **s3Key:** String (`resources/{uuid}-{filename}`)
- **fileSize:** String (formatted, e.g., "2.4 MB")
- **fileSizeBytes:** Number
- **uploadDate:** String (ISO 8601 UTC)
- **downloads:** Number (default: 0)
- **likes:** Number (default: 0)
- **visibility:** String (`"PUBLIC"` | `"PRIVATE"` | `"GROUP"`)
- **sharedClubs:** List of Strings (optional club IDs)
- **GSI1PK:** `USER#{ownerId}`
- **GSI1SK:** `RESOURCE#{uploadDate}`
- **GSI2PK:** `RESOURCE`
- **GSI2SK:** `uploadDate`

#### B. User Ownership Record (`USER_RESOURCE`)
- **PK:** `USER#{userId}`
- **SK:** `RESOURCE#{resourceId}`
- **entityType:** `USER_RESOURCE`
- **userId:** `{userId}`
- **resourceId:** `{resourceId}`
- **title:** String
- **subject:** String
- **type:** String
- **s3Key:** String
- **uploadDate:** String (ISO 8601 UTC)
- **Access Pattern:** Query all resources uploaded by a user with zero table scanning:
  `PK = USER#{userId} AND SK begins_with RESOURCE#`

#### C. Group / Club Sharing Record (`CLUB_RESOURCE`)
- **PK:** `CLUB#{clubId}`
- **SK:** `RESOURCE#{resourceId}`
- **entityType:** `CLUB_RESOURCE`
- **clubId:** `{clubId}`
- **resourceId:** `{resourceId}`
- **sharedBy:** `{userId}`
- **sharedAt:** String (ISO 8601 UTC)
- **Access Pattern:** Query all resources shared in a study club:
  `PK = CLUB#{clubId} AND SK begins_with RESOURCE#`

#### D. Download Activity Record (`USER_DOWNLOAD`)
- **PK:** `USER#{userId}`
- **SK:** `DOWNLOAD#{timestamp}#{downloadId}`
- **entityType:** `USER_DOWNLOAD`
- **userId:** `{userId}`
- **resourceId:** `{resourceId}`
- **s3Key:** String
- **downloadedAt:** String (ISO 8601 UTC)
- **Access Pattern:** Track user downloads for dashboard analytics:
  `PK = USER#{userId} AND SK begins_with DOWNLOAD#`

---

## 4. Proposed Global Secondary Indexes (GSIs)

### GSI 1: `GSI1` (Multi-Entity User & Inverted Index)
- **Partition Key:** `GSI1PK` (String)
- **Sort Key:** `GSI1SK` (String)
- **Projection:** `ALL`
- **Use Cases:**
  - `GSI1PK = USER#{userId}` and `GSI1SK begins_with RESOURCE#` -> User's resources sorted by upload date.
  - Future phases: `GSI1PK = USER#{userId}` and `GSI1SK begins_with CLUB#` -> User's joined clubs.

### GSI 2: `GSI2` (Public Catalog & Categorization Index)
- **Partition Key:** `GSI2PK` (String)
- **Sort Key:** `GSI2SK` (String)
- **Projection:** `ALL`
- **Use Cases:**
  - `GSI2PK = "RESOURCE"`, `ScanIndexForward = False` -> All public resources ordered newest first, replacing full table scan!

### Index 3: `s3Key-index` (Direct S3 Key Lookup)
- **Partition Key:** `s3Key` (String)
- **Projection:** `ALL`
- **Use Cases:**
  - `s3Key = :key` -> Instant sub-10ms lookup of resource metadata when validating download requests.

---

## 5. IAM Least-Privilege Policy Enhancements

1. **`AIStudyClub-GenerateDownloadUrl-role-b3zb0k2u`**:
   - Current: `s3:GetObject` only.
   - Add inline policy `StudyClubDynamoDBDownloadAuth`:
     - Actions: `dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:UpdateItem`, `dynamodb:PutItem`
     - Resource: `AIStudyClub` table and its indexes.

2. **`AIStudyClub-CreateResource-role-fclxzfk6`**:
   - Current: `dynamodb:PutItem` only.
   - Add inline policy `StudyClubCreateResourceS3AndDynamoDB`:
     - Actions: `s3:HeadObject`, `s3:GetObject` on `aistudyclub-karthik-2026/*`
     - Actions: `dynamodb:GetItem` on `AIStudyClub` (to check club membership when sharing).

3. **`StudyClubLambdaBasicRole` (`AIStudyClub-GetResources`)**:
   - Current: `dynamodb:Scan` only.
   - Add inline policy `StudyClubGetResourcesQuery`:
     - Actions: `dynamodb:Query` on `AIStudyClub` table and its indexes.

---

## 6. Migration and Backfill Strategy

1. Existing 5 resource items will be enriched in-place:
   - Calculate and add `GSI1PK`, `GSI1SK`, `GSI2PK`, `GSI2SK`.
   - Set `downloads = 0`, `likes = 0`, `visibility = "PUBLIC"`.
   - Create corresponding `USER#{uploadedBy}` ownership items.
2. GSIs created one by one via `update-table` without interfering with active traffic.
3. Code deployed with resilient fallback handling so APIs function seamlessly while GSIs are populating.
