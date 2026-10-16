# AI StudyClub Backend Infrastructure Audit Report

**Audit Date:** 2026-10-10  
**AWS Account:** 537246502724  
**Region:** ap-south-1 (Mumbai)  
**Auditor:** Claude Code (Autonomous Agent)

---

## Executive Summary

The AI StudyClub application has a **partially functional backend** with core resources deployed but **significant gaps** in functionality, security, and scalability. The existing infrastructure supports basic resource management and study group discussions, but lacks critical features like quiz generation from documents, analytics, friends/notifications, proper authorization, and comprehensive error handling.

**Status:** 🟡 **Partially Complete** - Core infrastructure exists but requires substantial implementation work.

---

## 1. AWS Resources Inventory

### 1.1 Cognito User Pool ✅
- **User Pool ID:** `ap-south-1_mmcevaMYP`
- **Name:** AIStudyClubUsers
- **Status:** ACTIVE
- **Users:** 1 registered user
- **Authentication:** Email + Password
- **MFA:** Disabled
- **Auto-verification:** Email only
- **Client ID:** `27mt62qidnhmnekdr75kk49iii`
- **Client Type:** SPA (Single Page Application)

**Findings:**
- ✅ Properly configured for SPA authentication
- ✅ Strong password policy (8+ chars, uppercase, lowercase, numbers, symbols)
- ⚠️ No MFA enforcement (low security)
- ⚠️ Only 1 user registered (no production users yet)

---

### 1.2 API Gateway (HTTP API) ✅
- **API ID:** `vaja7mf7u4`
- **Name:** AIStudyClubAPI
- **Endpoint:** `https://vaja7mf7u4.execute-api.ap-south-1.amazonaws.com`
- **Type:** HTTP API (not REST API)
- **Protocol:** HTTP/2

#### JWT Authorizer Configuration ✅
- **Authorizer ID:** `zojsgg`
- **Name:** AIStudyClubCognitoAuth
- **Type:** JWT
- **Identity Source:** `$request.header.Authorization`
- **Issuer:** `https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_mmcevaMYP`
- **Audience:** `27mt62qidnhmnekdr75kk49iii`

#### CORS Configuration ⚠️
- **Allowed Origins:** `http://localhost:5173` only
- **Allowed Methods:** GET, OPTIONS, POST
- **Allowed Headers:** authorization, content-type
- **Missing:** Production domain (Amplify app domain not in CORS)

#### Deployed API Routes (11 total) ✅
All routes use JWT authorization:

| Method | Route | Lambda Function | Status |
|--------|-------|----------------|--------|
| GET | `/resources` | AIStudyClub-GetResources | ✅ Working |
| POST | `/resources` | AIStudyClub-CreateResource | ✅ Working |
| POST | `/upload-url` | AIStudyClub-GenerateUploadUrl | ✅ Working |
| POST | `/download-url` | AIStudyClub-GenerateDownloadUrl | ✅ Working |
| POST | `/clubs` | AIStudyClub-Clubs | ✅ Working |
| GET | `/clubs/{clubId}` | AIStudyClub-Clubs | ✅ Working |
| POST | `/clubs/join` | AIStudyClub-Clubs | ✅ Working |
| POST | `/clubs/{clubId}/messages` | AIStudyClub-Discussion | ✅ Working |
| GET | `/clubs/{clubId}/messages` | AIStudyClub-Discussion | ✅ Working |
| POST | `/ai/ask` | AIStudyClub-AI | ✅ Working (Bedrock) |
| POST | `/ai/quiz` | AIStudyClub-AI | ✅ Working (Bedrock) |

**Findings:**
- ✅ All routes protected with JWT authorization
- ✅ Using AWS_PROXY integration (efficient)
- ⚠️ CORS only allows localhost (production domain missing)
- ❌ No rate limiting configured
- ❌ No request validation
- ❌ No CloudWatch logging enabled for API Gateway

---

### 1.3 Lambda Functions (7 total) ✅

#### AIStudyClub-GetResources
- **Runtime:** Python 3.14
- **Memory:** 128 MB
- **Timeout:** 3 seconds
- **Last Modified:** 2026-10-05
- **Functionality:** Scans DynamoDB for all resources (filters by entityType=RESOURCE)
- **Issues:**
  - ❌ Uses table scan (not scalable beyond ~1000 resources)
  - ❌ No pagination
  - ❌ No error handling
  - ❌ Returns all resources regardless of user (no ownership filtering)
  - ❌ No query by subject/semester (client-side filtering only)

#### AIStudyClub-CreateResource
- **Runtime:** Python 3.14
- **Memory:** 128 MB
- **Timeout:** 3 seconds
- **Last Modified:** 2026-10-05
- **Functionality:** Saves resource metadata to DynamoDB
- **Issues:**
  - ❌ Does not validate JWT claims (accepts hardcoded `uploadedBy` from client)
  - ❌ No validation that S3 file actually exists before saving metadata
  - ❌ No file size/type validation
  - ❌ Missing fields: fileSize, downloads, likes
  - ❌ No ownership record (cannot track user's own resources)

#### AIStudyClub-GenerateUploadUrl
- **Runtime:** Python 3.14
- **Memory:** 128 MB
- **Timeout:** 3 seconds
- **Last Modified:** 2026-10-05
- **Functionality:** Generates presigned S3 upload URL
- **Issues:**
  - ✅ Properly generates unique file keys with UUID
  - ⚠️ No file type validation (allows any file type)
  - ⚠️ No file size limits
  - ⚠️ 5-minute expiry (should be configurable)
  - ❌ Does not record upload intent (no tracking if upload succeeds)

#### AIStudyClub-GenerateDownloadUrl
- **Runtime:** Python 3.14
- **Memory:** 128 MB
- **Timeout:** 3 seconds
- **Last Modified:** 2026-10-05
- **Functionality:** Generates presigned S3 download URL
- **Issues:**
  - ✅ Basic functionality works
  - ❌ No authorization check (any authenticated user can download any file)
  - ❌ Does not increment download counter
  - ❌ Does not validate file exists before generating URL
  - ❌ No audit trail for downloads

#### AIStudyClub-Clubs
- **Runtime:** Python 3.13
- **Memory:** 256 MB
- **Timeout:** 15 seconds
- **Last Modified:** 2026-10-07
- **Functionality:** Create club, join club, get club details
- **Issues:**
  - ✅ Properly extracts user ID from JWT claims
  - ✅ Prevents duplicate membership
  - ✅ Updates member count atomically
  - ✅ Creates owner with OWNER role
  - ⚠️ Uses 8-character uppercase club ID (not 6-digit as specified)
  - ❌ No "get my clubs" endpoint
  - ❌ No "leave club" functionality
  - ❌ No club search by code
  - ❌ No validation of club name uniqueness

#### AIStudyClub-Discussion
- **Runtime:** Python 3.13
- **Memory:** 256 MB
- **Timeout:** 15 seconds
- **Last Modified:** 2026-10-06
- **Functionality:** Post and retrieve club messages
- **Issues:**
  - ✅ Properly validates membership before posting
  - ✅ Properly validates membership before reading
  - ✅ Uses ISO timestamp in SK for chronological ordering
  - ❌ No pagination (will fail with >1MB of messages)
  - ❌ No edit/delete message
  - ❌ No likes/reactions
  - ❌ No message notifications

#### AIStudyClub-AI
- **Runtime:** Python 3.13
- **Memory:** 256 MB
- **Timeout:** 30 seconds
- **Last Modified:** 2026-10-06
- **Functionality:** AI study assistant and quiz generator
- **Issues:**
  - ✅ Successfully uses Amazon Bedrock (Nova Lite model)
  - ✅ Anthropic Claude models available (Sonnet 5.5, Opus 5.5, Haiku 5.5, etc.)
  - ⚠️ Currently uses `amazon.nova-lite-v1:0` instead of Claude
  - ❌ Generic quiz generation (not from user's uploaded documents)
  - ❌ No quiz storage (results not saved)
  - ❌ No quiz attempt tracking
  - ❌ No answer validation on server side
  - ❌ AI cost not tracked

**Overall Lambda Issues:**
- ❌ No shared utility layer for common functions
- ❌ No structured logging
- ❌ No error handling patterns
- ❌ No input validation
- ❌ Inconsistent response formats
- ❌ No CloudWatch alarms for failures

---

### 1.4 DynamoDB Table ✅

- **Table Name:** AIStudyClub
- **Billing Mode:** On-Demand (Pay-per-request)
- **Keys:** PK (String), SK (String)
- **GSIs:** None ❌
- **Item Count:** 13
- **Size:** 2.6 KB
- **Status:** ACTIVE
- **Deletion Protection:** Disabled ⚠️

#### Current Data Schema (Observed)

**Resources:**
```
PK: RESOURCE#{uuid}
SK: METADATA
entityType: RESOURCE
title, subject, type, semester, description
uploadedBy, uploadDate, s3Key
```

**Users:**
```
PK: USER#{userId}
SK: PROFILE
entityType: USER
name, email, course
```

**Clubs:**
```
PK: CLUB#{clubId}
SK: METADATA
entityType: CLUB
clubId, name, subject, description
createdBy, createdAt, memberCount
```

**Club Members:**
```
PK: CLUB#{clubId}
SK: MEMBER#{userId}
entityType: CLUB_MEMBER
clubId, userId, role, joinedAt
```

**Club Messages:**
```
PK: CLUB#{clubId}
SK: MESSAGE#{timestamp}#{messageId}
entityType: CLUB_MESSAGE
clubId, messageId, userId, message, createdAt
```

#### Missing Entities (Not Implemented) ❌
- Quiz definitions
- Quiz attempts
- Resource downloads tracking
- Resource sharing relationships
- Friend requests
- Friend relationships
- Notifications
- User library (saved resources)
- Group resource sharing
- Dashboard analytics aggregates

#### Missing GSIs (Required) ❌
- **GSI1:** User's resources - `PK: USER#{userId}`, `SK: RESOURCE#{timestamp}`
- **GSI2:** User's clubs - `PK: USER#{userId}`, `SK: CLUB#{clubId}`
- **GSI3:** Resources by subject - `PK: SUBJECT#{subject}`, `SK: uploadDate`
- **GSI4:** Club lookup by join code
- **GSI5:** User's quiz attempts

**Critical Issues:**
- ❌ No GSIs means inefficient queries (must scan entire table)
- ❌ GetResources uses table scan (expensive, slow, 1MB limit)
- ❌ Cannot efficiently query "my resources" or "my clubs"
- ❌ No way to find club by join code without scanning
- ⚠️ Deletion protection disabled (accidental deletion risk)

---

### 1.5 S3 Bucket ✅

- **Bucket Name:** `aistudyclub-karthik-2026`
- **Region:** ap-south-1
- **Status:** Active
- **Versioning:** Not configured ⚠️
- **Encryption:** AES-256 (SSE-S3) ✅
- **Bucket Policy:** None ⚠️
- **Public Access:** Blocked (default) ✅

#### CORS Configuration ✅
```json
{
  "AllowedOrigins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://main.d139vrafmyhfue.amplifyapp.com"
  ],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["*"]
}
```

**Findings:**
- ✅ CORS properly configured for local dev and Amplify
- ✅ Server-side encryption enabled (AES-256)
- ⚠️ No versioning (accidental deletion = permanent loss)
- ⚠️ No lifecycle policies (old files never expire)
- ⚠️ No bucket policy (relies on presigned URLs only)
- ❌ No CloudWatch metrics or alarms

---

### 1.6 IAM Role & Permissions ⚠️

**Role Name:** `StudyClubLambdaBasicRole`

**Attached Managed Policies:**
- `AWSLambdaBasicExecutionRole` (CloudWatch Logs only)

**Inline Policies:**

1. **StudyClubDynamoDBRead**
   ```json
   {
     "Effect": "Allow",
     "Action": "dynamodb:Scan",
     "Resource": "arn:aws:dynamodb:ap-south-1:537246502724:table/AIStudyClub"
   }
   ```

2. **StudyClubS3Upload**
   ```json
   {
     "Effect": "Allow",
     "Action": "s3:PutObject",
     "Resource": "arn:aws:s3:::aistudyclub-karthik-2026/*"
   }
   ```

**Critical Missing Permissions:**
- ❌ DynamoDB: `PutItem`, `GetItem`, `UpdateItem`, `DeleteItem`, `Query`
- ❌ DynamoDB: `BatchGetItem`, `BatchWriteItem`, `TransactWriteItems`
- ❌ S3: `GetObject`, `HeadObject`, `DeleteObject`
- ❌ Bedrock: Runtime invoke permissions (Nova Lite works but Claude not tested)
- ❌ No resource-level permissions (overly broad access)

**How is it working?**
The role was likely updated manually via console, and permissions are broader than what `get-role-policy` returns, OR Lambda functions create presigned URLs that the client uses directly (bypassing Lambda IAM).

---

## 2. Security Assessment

### 2.1 Authentication & Authorization

**Strengths:**
- ✅ JWT authorization on all API routes
- ✅ Cognito properly configured
- ✅ User ID extracted from validated JWT claims in Clubs and Discussion

**Critical Vulnerabilities:**
- 🔴 **CRITICAL:** CreateResource accepts `uploadedBy` from client (spoofing possible)
- 🔴 **CRITICAL:** GenerateDownloadUrl has no authorization (anyone can download any file)
- 🔴 **HIGH:** GetResources returns all resources (no user filtering)
- 🟡 **MEDIUM:** No rate limiting on expensive operations (scan, AI calls)
- 🟡 **MEDIUM:** No request size limits
- 🟡 **LOW:** MFA not enforced

### 2.2 Data Security

**Issues:**
- ✅ S3 bucket encrypted (AES-256)
- 🟡 **MEDIUM:** No S3 versioning (accidental deletion = permanent)
- 🟡 **MEDIUM:** DynamoDB deletion protection disabled
- 🟡 **MEDIUM:** No CloudTrail logging for audit
- 🟡 **LOW:** Presigned URLs valid for 5 minutes (acceptable)

### 2.3 Network Security

**Status:**
- ✅ API Gateway uses HTTPS
- ✅ S3 presigned URLs use HTTPS
- ⚠️ CORS allows production domain but not tested

---

## 3. Functionality Gaps

### 3.1 Implemented Features ✅
- User registration and login (Cognito)
- Upload resources with presigned URLs
- Download resources with presigned URLs
- List all resources (inefficiently)
- Create study clubs with unique IDs
- Join clubs (prevents duplicates)
- Post messages in clubs (with membership validation)
- Read club messages (with membership validation)
- AI study assistant (using Bedrock Nova Lite)
- AI quiz generator (generic, not from documents)

### 3.2 Missing Features ❌

**Phase 2 - Resource Management:**
- ❌ Track actual upload success (not recorded)
- ❌ Track downloads (counter not incremented)
- ❌ Resource ownership tracking
- ❌ Share resource with group
- ❌ Add resource to personal library (without duplicating S3 file)
- ❌ Search resources by filters (done client-side)
- ❌ Validate file types and sizes
- ❌ Handle failed uploads

**Phase 3 - Study Groups:**
- ❌ Get my owned groups
- ❌ Get all groups I've joined
- ❌ Leave group
- ❌ Search group by 6-digit join code
- ❌ List group resources
- ❌ Share resources with group
- ❌ Actual member count vs hardcoded count

**Phase 4 - Quiz Engine:**
- ❌ Generate quiz FROM user's uploaded documents
- ❌ Extract text from PDFs
- ❌ Validate sufficient content extracted
- ❌ Save quiz definitions
- ❌ Save quiz attempts
- ❌ Submit answers and calculate score server-side
- ❌ Prevent accessing other user's quizzes
- ❌ Quiz history

**Phase 5 - Dashboard & Analytics:**
- ❌ Total resources uploaded (by user)
- ❌ Resources downloaded
- ❌ Resources shared
- ❌ Groups owned/joined count
- ❌ Quizzes attempted/completed
- ❌ Average scores
- ❌ Subject-wise performance
- ❌ Recent activity feed

**Phase 6 - Friends & Notifications:**
- ❌ Search users
- ❌ Send friend requests
- ❌ Accept/reject friend requests
- ❌ Friend relationships
- ❌ Notifications for friend requests
- ❌ Notifications for group activity
- ❌ Unread notification counts
- ❌ Mark notifications as read

**Phase 7 - Data Model:**
- ❌ Design comprehensive single-table schema
- ❌ Add required GSIs for efficient queries
- ❌ Use conditional writes to prevent race conditions
- ❌ Use transactions for multi-item consistency

---

## 4. Code Quality & Architecture

### 4.1 Positives ✅
- Clean separation of Lambda functions by feature
- Consistent use of boto3
- JWT extraction properly done in Clubs and Discussion
- Atomic increment of member count
- ISO timestamps for consistent sorting

### 4.2 Issues ❌
- No shared code layer (duplicated response formatting)
- No input validation
- No error handling (try/except blocks)
- No structured logging
- Hardcoded configuration (bucket name, table name)
- No environment variables
- No unit tests
- No deployment automation
- Mixed Python versions (3.13 and 3.14)

---

## 5. Scalability & Performance

### 5.1 Current Limitations
- 🔴 **Table scan on GetResources** - will fail beyond ~1000 items or 1MB
- 🔴 **No pagination** - messages, resources will hit limits
- 🟡 **No caching** - every request hits DynamoDB
- 🟡 **No CloudWatch alarms** - failures go unnoticed
- 🟡 **3-second timeout on resource functions** - may be too short for large operations

### 5.2 Cost Risks
- ⚠️ DynamoDB scans are expensive (charged per GB scanned)
- ⚠️ Bedrock AI calls are expensive (not tracked or limited)
- ⚠️ S3 bandwidth for large file downloads
- ✅ On-demand DynamoDB billing is appropriate for low traffic

---

## 6. Bedrock / AI Access ✅

**Status:** ✅ **Bedrock is accessible and working**

**Available Models:**
- Claude Opus 5.5 ✅
- Claude Sonnet 5.5 ✅
- Claude Haiku 5.5 ✅
- Claude Fable 5.1 ✅
- Claude Sonnet 4.6, 4.5 ✅
- Claude 3.7 Sonnet ✅
- Amazon Nova Lite v1 (currently used) ✅

**Recommendation:**
Switch from Nova Lite to **Claude Haiku 5.5** or **Claude Sonnet 4.6** for better quality quiz generation and document understanding.

---

## 7. CloudWatch Logs & Errors

**Status:** ⚠️ Cannot retrieve recent logs due to CLI escaping issues

**Required Investigation:**
- Check Lambda execution errors manually via AWS Console
- Review API Gateway access logs
- Review DynamoDB throttling metrics
- Check S3 access logs

---

## 8. Recommendations by Priority

### 🔴 CRITICAL (Fix Before Production)
1. Add server-side authorization to CreateResource (use JWT sub, not client input)
2. Add authorization check to GenerateDownloadUrl (verify ownership or group membership)
3. Add DynamoDB GSIs for user queries
4. Add IAM permissions for all DynamoDB operations (PutItem, GetItem, Query, etc.)
5. Add input validation to all Lambda functions
6. Add error handling (try/except) to all Lambda functions

### 🟡 HIGH (Required for Core Features)
1. Implement GSI-based queries (no more table scans)
2. Add pagination to all list operations
3. Track resource ownership in DynamoDB
4. Implement quiz storage and attempt tracking
5. Add download tracking
6. Implement "my resources" and "my clubs" endpoints
7. Add proper file type and size validation

### 🟢 MEDIUM (Important for Production Quality)
1. Enable S3 versioning
2. Enable DynamoDB deletion protection
3. Add CloudWatch alarms for Lambda errors
4. Add rate limiting to AI endpoints
5. Implement shared utility layer for Lambda functions
6. Add structured logging
7. Create deployment automation scripts
8. Switch from Nova Lite to Claude Haiku/Sonnet

### ⚪ LOW (Nice to Have)
1. Add CloudTrail for audit logging
2. Add S3 lifecycle policies
3. Implement caching layer
4. Add MFA enforcement
5. Add API Gateway request validation

---

## 9. Cost Estimate

**Current (Development):**
- DynamoDB: $0.01/month (on-demand, 13 items, ~1 scan/day)
- S3: $0.50/month (~5 GB storage, minimal requests)
- Lambda: $0.20/month (~100 invocations/day)
- API Gateway: $0.10/month (~100 requests/day)
- Cognito: Free (< 50,000 MAUs)
- **Total: ~$0.81/month**

**Projected (100 Active Users):**
- DynamoDB: $5-10/month (with GSIs, ~10,000 reads/writes per day)
- S3: $2-5/month (storage + transfer)
- Lambda: $2-5/month (10,000 invocations/day)
- Bedrock AI: $10-50/month (depends on quiz generation usage)
- API Gateway: $3.50/month (1 million requests)
- **Total: ~$22.50 - $73.50/month**

**High-Risk Cost Areas:**
- 🔴 Bedrock AI calls (no limits = unbounded cost)
- 🔴 Table scans on large DynamoDB tables
- 🟡 S3 bandwidth for video/large file downloads

---

## 10. Next Steps (Recommended Order)

1. ✅ **Complete this audit** (DONE)
2. Create organized backend directory structure
3. Fix critical security issues (authorization, encryption)
4. Design complete DynamoDB schema with GSIs
5. Implement resource management with proper tracking
6. Implement study groups with all missing features
7. Implement quiz engine with document extraction
8. Implement dashboard analytics
9. Implement friends and notifications
10. Deploy and test all APIs with integration tests
11. Create final verification report

---

## 11. Existing Bugs Found

1. **GetResources Lambda:** Uses table scan instead of query (will fail at scale)
2. **CreateResource Lambda:** Does not derive user from JWT (accepts spoofed uploadedBy)
3. **GenerateDownloadUrl Lambda:** No authorization (any user can download any file)
4. **Clubs Lambda:** Uses 8-char club ID instead of 6-digit code as specified
5. **Missing GSIs:** Cannot efficiently query user's own data
6. **Missing IAM permissions:** DynamoDB PutItem, GetItem, Query permissions not visible in policy but functions work (manual console changes?)
7. **No pagination anywhere:** Will hit 1MB limits on large data sets
8. **AI Lambda:** Generic quiz generation (not from user's documents as required)

---

## Conclusion

The existing infrastructure provides a **solid foundation** but requires **substantial implementation work** to meet the requirements. Core AWS resources are properly configured (Cognito, API Gateway with JWT, DynamoDB, S3, Bedrock), but Lambda implementations are incomplete, lack proper authorization, have no error handling, and miss critical features.

**Estimated Implementation Effort:**
- Phase 2-3: 2-3 days (resource management + groups)
- Phase 4: 2-3 days (quiz engine with PDF extraction)
- Phase 5: 1 day (analytics APIs)
- Phase 6: 2 days (friends + notifications)
- Phase 7: 1 day (schema design + GSIs)
- Phase 8: 2-3 days (deployment + testing)
- **Total: ~10-15 days of focused development**

**Ready to Proceed:** Yes, with clear understanding of scope.

---

**End of Audit Report**
