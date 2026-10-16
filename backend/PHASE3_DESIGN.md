# Phase 3: AI StudyClub Study Groups & Discussions Architecture Design

**Date:** 2026-10-10  
**Phase:** Phase 3 (Study Groups & Discussion Forums)  
**Target Region:** ap-south-1 (Mumbai)  
**Target Table:** `AIStudyClub`  

---

## 1. Overview & Objectives

Phase 3 extends the backend with comprehensive study group (club) management and paginated discussion forums:
1. **Group Listing**: Efficient retrieval of owned groups and joined groups using existing `GSI1` index (`GSI1PK = USER#{userId}`, `GSI1SK begins_with CLUB#`) and primary key partitioning (`PK = USER#{userId}`, `SK begins_with CLUB#`).
2. **Join & Leave Groups**:
   - Unique 6-digit join codes (with backward compatibility for existing 8-character codes like `7A5D5FFA`).
   - Duplicate membership prevention with HTTP 409 Conflict.
   - Safe leave group implementation with owner protection (owners cannot abandon groups without transferring ownership).
   - Atomic `memberCount` synchronization.
3. **Group Resources**:
   - List materials shared in a group (`PK = CLUB#{clubId}`, `SK begins_with RESOURCE#`).
   - Strict membership checks before exposing shared resources.
   - Share existing resources with study clubs without file duplication.
4. **Discussion Pagination**:
   - Paginated message retrieval on `PK = CLUB#{clubId}`, `SK begins_with MESSAGE#`.
   - Support `limit` (default 20, max 100) and base64 encoded continuation token (`nextToken`).
   - Membership validation on every read and write request.

---

## 2. Schema and Access Patterns (Zero Schema Changes / No New GSIs)

All Phase 3 access patterns leverage the existing table schema and existing active `GSI1` index:

| Access Pattern | Key Condition / Query | Index | Performance |
|---|---|---|---|
| **Get Joined Groups** | `GSI1PK = USER#{userId} AND GSI1SK begins_with CLUB#` | `GSI1` | O(1) sub-10ms query |
| **Get Owned Groups** | `GSI1PK = USER#{userId} AND GSI1SK begins_with CLUB#` (filter `role = OWNER`) | `GSI1` | O(1) sub-10ms query |
| **Lookup Group by 6-digit Code** | `PK = CODE#{code} AND SK = METADATA` or `PK = CLUB#{code} AND SK = METADATA` | Primary Key | O(1) direct GetItem |
| **Check Membership** | `PK = CLUB#{clubId} AND SK = MEMBER#{userId}` | Primary Key | O(1) direct GetItem |
| **List Group Resources** | `PK = CLUB#{clubId} AND SK begins_with RESOURCE#` | Primary Key | O(1) partition query |
| **List Group Messages (Paginated)** | `PK = CLUB#{clubId} AND SK begins_with MESSAGE#` (`Limit`, `ExclusiveStartKey`) | Primary Key | O(1) paginated query |

---

## 3. API Gateway Routes & IAM Permissions

### Existing Routes to Preserve:
- `POST /clubs`
- `GET /clubs/{clubId}`
- `POST /clubs/join`
- `POST /clubs/{clubId}/messages`
- `GET /clubs/{clubId}/messages`

### New Routes Added:
- `GET /clubs` (Listing: `?joined=true`, `?owned=true`, `?code=123456`)
- `POST /clubs/leave` (Safe group departure)
- `GET /clubs/{clubId}/resources` (Group shared resources)
- `POST /clubs/{clubId}/resources` (Share resource with group)

### IAM Updates (Least Privilege):
- `AIStudyClub-Clubs-Role`:
  - Add `dynamodb:DeleteItem` (for leaving clubs).
  - Add `dynamodb:Query` on `arn:aws:dynamodb:ap-south-1:537246502724:table/AIStudyClub/index/GSI1`.
