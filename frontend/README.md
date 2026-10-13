# 🗒️ QuickNotes

A modern full-stack note-taking application built with React, Express.js, Node.js, and MongoDB. QuickNotes provides secure JWT authentication, instant search, note organization, pinning, dark mode, responsive design, **production-grade file attachments**, and **secure note sharing via registered users and cryptographic shareable links**.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🔐 | **Authentication** | JWT-based registration and login with bcrypt password hashing |
| 📝 | **Full CRUD** | Create, view, edit, and delete personal notes |
| 📎 | **File Attachments** | Attach PDFs, images, docs, and spreadsheets with drag-and-drop & in-browser previews |
| 👥 | **Collaborative Sharing** | Share notes with registered users via email with granular `view` or `edit` permissions |
| 🔗 | **Secure Share Links** | Generate revocable, expiring links backed by cryptographically random tokens & SHA-256 hashing |
| 🔍 | **Instant Search** | Search note titles and content in real-time |
| 📌 | **Pin Notes** | Pin important notes and automatically prioritize them |
| 🏷️ | **Categories** | Organize and filter notes by category |
| 🌙 | **Dark Mode** | Persistent light/dark theme preference stored in localStorage |
| ⏱️ | **Timestamps** | Relative timestamps for note creation and updates |
| 📱 | **Responsive Design** | Optimized for desktop, tablet, and mobile screens |
| 👤 | **Strict Access Control**| Multi-tier authorization preventing IDOR and unauthorized file access |

---

## 📎 File Attachments

Authenticated users can attach files during note creation or while editing existing notes.

### Supported Formats
- **PDF**: `.pdf` (`application/pdf`)
- **Images**: `.png`, `.jpg`, `.jpeg`, `.webp` (`image/png`, `image/jpeg`, `image/webp`)
- **Documents**: `.doc`, `.docx`, `.txt` (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`)
- **Spreadsheets**: `.xls`, `.xlsx`, `.csv` (`application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`)

### Upload Limits & Security
- **File Size Limit**: Maximum 10 MB per file.
- **Attachment Limit**: Maximum 10 attachments per note; up to 5 files per single upload request.
- **Magic Bytes Validation**: Validates actual file binary signatures (magic bytes) alongside file extensions and MIME types to prevent extension-spoofing attacks.
- **Safe Storage Keys**: Files are assigned cryptographically random UUID storage keys (`Date.now() + UUID + ext`) instead of client filenames, preventing directory traversal and file overwrites.
- **Automatic Cleanup**: Stored files are immediately purged from storage when an attachment is removed or when a note is deleted.
- **Secure Streaming**: Files are served via authenticated streaming endpoints with safe `Content-Disposition` headers and `X-Content-Type-Options: nosniff`.

---

## 👥 Secure Note Sharing

QuickNotes provides two distinct sharing models without compromising the privacy of personal notes:

### A. Sharing with Registered Users
- **Email Resolution**: Note owners can share notes with other registered users by typing their email.
- **Permission Levels**:
  - `Can view`: Recipient can read note content, preview attachments, and download files. Cannot edit or delete.
  - `Can edit`: Recipient can modify note title/content, upload new attachments, and delete attachments. Cannot delete the note or manage sharing settings (reserved for note owner).
- **Access Management**: Owners can view all active collaborators, modify permissions in real-time, or revoke access at any time. Collaborators can also remove themselves from shared notes.
- **Dashboard Integration**: Recipients access notes shared with them directly through the **"👥 Shared with me"** filter tab on the dashboard.

### B. Cryptographically Secure Shareable Links
- **Unguessable Secret Tokens**: Generates 32-byte (256-bit, 64-character hexadecimal) cryptographically random tokens (`crypto.randomBytes`).
- **Hashed Token Storage**: The server stores only the **SHA-256 hash** of the token in MongoDB. Even in the event of a database compromise, raw tokens cannot be recovered.
- **Configurable Permissions**: Links can be configured with `view` or `edit` permissions.
- **Configurable Expiration**: Links can be set to expire after 1 hour, 24 hours, 7 days, 30 days, or never. Expired links automatically return HTTP 410 (Gone).
- **Instant Revocation**: Owners can revoke a link at any time, immediately preventing further access.
- **Rate-Limiting**: Public token endpoints are protected by sliding-window rate limiting to prevent brute-force attacks.

---

## 🔌 API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT |
| `GET` | `/api/auth/me` | Get profile for currently authenticated user |

### Notes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notes` | JWT | Get user's owned notes (supports `?category=X`) |
| `GET` | `/api/notes/shared-with-me` | JWT | Get notes shared with the authenticated user |
| `GET` | `/api/notes/:id` | JWT | Get single note (owner or collaborator) |
| `POST` | `/api/notes` | JWT | Create a new note |
| `PUT` | `/api/notes/:id` | JWT | Update note (owner or editor collaborator) |
| `DELETE` | `/api/notes/:id` | JWT | Delete note and purge all attachments (owner only) |
| `PUT` | `/api/notes/:id/pin` | JWT | Toggle pin status (owner only) |

### File Attachments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/notes/:id/attachments` | JWT (Multipart) | Upload attachments (owner or editor collaborator) |
| `GET` | `/api/notes/:id/attachments/:attachmentId/preview` | JWT | In-browser preview (inline disposition) |
| `GET` | `/api/notes/:id/attachments/:attachmentId/download` | JWT | Download attachment (attachment disposition) |
| `DELETE` | `/api/notes/:id/attachments/:attachmentId` | JWT | Delete attachment & remove from storage |

### Collaborator Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/notes/:id/share` | JWT | Share note with registered user by email |
| `GET` | `/api/notes/:id/collaborators` | JWT | List note collaborators |
| `PUT` | `/api/notes/:id/collaborators/:userId` | JWT | Update collaborator permission (`view` or `edit`) |
| `DELETE` | `/api/notes/:id/collaborators/:userId` | JWT | Revoke collaborator access |

### Shareable Links

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/notes/:id/share-link` | JWT | Generate or update share link with expiration & permissions |
| `GET` | `/api/notes/:id/share-link` | JWT | Get share link configuration & status (owner only) |
| `DELETE` | `/api/notes/:id/share-link` | JWT | Revoke active share link (owner only) |
| `GET` | `/api/shared/notes/:token` | None | Public view of note via unexpired share token |
| `PUT` | `/api/shared/notes/:token` | None | Public update of note (if link grants `edit` permission) |
| `GET` | `/api/shared/notes/:token/attachments/:attachmentId/preview` | None | Public inline preview of attachment via share token |
| `GET` | `/api/shared/notes/:token/attachments/:attachmentId/download` | None | Public download of attachment via share token |

---

## 🗄️ Database Schema

### User Model
```json
{
  "_id": "ObjectId",
  "email": "String (unique, lowercase)",
  "password": "String (hashed with bcrypt)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Note Model
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: User)",
  "title": "String",
  "content": "String",
  "category": "String",
  "pinned": "Boolean",
  "attachments": [
    {
      "_id": "ObjectId",
      "originalName": "String",
      "storageKey": "String (safe UUID key)",
      "mimeType": "String",
      "size": "Number",
      "uploadedBy": "ObjectId (ref: User)",
      "uploadedAt": "Date"
    }
  ],
  "collaborators": [
    {
      "userId": "ObjectId (ref: User)",
      "email": "String",
      "permission": "String ('view' | 'edit')",
      "addedAt": "Date"
    }
  ],
  "shareLink": {
    "enabled": "Boolean",
    "tokenHash": "String (SHA-256 hex)",
    "permission": "String ('view' | 'edit')",
    "expiresAt": "Date (nullable)",
    "createdAt": "Date"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## 🛠️ Storage Provider Configuration

QuickNotes includes a modular storage service supporting both **Persistent Volume / Local Disk Storage** and **Cloud Object Storage (AWS S3, Cloudflare R2, MinIO, Supabase Storage, Backblaze B2)**.

### 1. Persistent Disk Storage (Default / Local Development)
When S3 credentials are not configured, files are stored on disk inside `uploads/` (or the path defined by `UPLOAD_DIR`).
```env
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads
```

### 2. Managed Object Storage (AWS S3 / S3-Compatible Providers)
To use AWS S3, Cloudflare R2, MinIO, or Supabase Storage in production, set:
```env
STORAGE_PROVIDER=s3
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
# Optional: Custom endpoint for Cloudflare R2, MinIO, or Supabase
# S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
# S3_FORCE_PATH_STYLE=true
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- npm
- MongoDB Atlas or local MongoDB instance

### 2. Backend Setup
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/quicknotes?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000

# Storage configuration (optional - defaults to local persistent uploads directory)
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads

# For S3 / Cloudflare R2 object storage:
# S3_BUCKET=your-bucket-name
# S3_REGION=us-east-1
# S3_ACCESS_KEY_ID=your-key-id
# S3_SECRET_ACCESS_KEY=your-secret-key
```

Start the backend:
```bash
npm start
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm start
```
The app will be available at `http://localhost:3000`.

---

## 🧪 Testing and Verification

Run the full automated test suite covering unit tests and API integration tests:

```bash
# Run all backend & integration tests from the root or backend directory:
npm test
```

### Verified Test Scenarios
- ✅ Authenticated PDF upload validation & magic bytes verification.
- ✅ Image upload (.png, .jpg, .webp) and document upload (.docx, .xlsx, .txt, .csv).
- ✅ Rejection of unsupported extensions (.exe, .sh) and oversized files (>10MB).
- ✅ Rejection of spoofed files with mismatching binary signatures.
- ✅ Unauthorized user access prevention (strangers cannot read or write private notes or files).
- ✅ Note owner sharing with registered users with default `view` permission.
- ✅ Collaborators viewing shared notes via `/api/notes/shared-with-me`.
- ✅ Enforcement of `view` vs `edit` collaborator permissions.
- ✅ Upgrading permissions and collaborative editing & attachment uploads.
- ✅ Generation of unpredictable 64-char shareable link tokens.
- ✅ Verification that database stores only SHA-256 token hash.
- ✅ Unauthenticated access to note and attachments via valid share link.
- ✅ Rejection of expired links (HTTP 410) and revoked links (HTTP 404).
- ✅ Automatic file deletion from storage when attachments or notes are removed.
- ✅ Existing note CRUD, search, categories, dark mode, and pin toggle stability.

---

## 🔒 Security Summary

- **Authentication**: JWT signed with secret and 7-day expiration.
- **Passwords**: Salted hashing with `bcryptjs`.
- **Authorization**: Backend-enforced ownership and collaborator permission checks on every route.
- **Object Storage Security**: Raw storage keys are unguessable UUIDs; paths are sanitized against directory traversal.
- **Public Link Security**: Secrets hashed with SHA-256 before storage; raw secrets never logged or exposed.
- **Rate Limiting**: Sliding-window rate limiter prevents token brute-forcing.
- **No Credentials Exposed**: Frontend never receives storage keys or cloud credentials.

---

## 👤 Author

**Techsavy-Maahir**
- GitHub: [@Techsavy-Maahir](https://github.com/Techsavy-Maahir)
- Repository: [QuickNotes](https://github.com/Techsavy-Maahir/QuickNotes)
