# 🗒️ QuickNotes

A modern full-stack note-taking application built with React, Express.js, and MongoDB. QuickNotes provides secure authentication, instant search, note organization, pinning, dark mode, and a responsive user experience.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🔐 | **Authentication** | JWT-based registration and login with bcrypt password hashing |
| 📝 | **Full CRUD** | Create, view, edit, and delete personal notes |
| 🔍 | **Instant Search** | Search note titles and content as you type |
| 📌 | **Pin Notes** | Pin important notes and automatically prioritize them |
| 🏷️ | **Categories** | Organize and filter notes by category |
| 🌙 | **Dark Mode** | Persistent light/dark theme preference |
| ⏱️ | **Timestamps** | Relative timestamps for note creation and updates |
| 📱 | **Responsive Design** | Optimized for desktop, tablet, and mobile |
| 🎨 | **Modern UI** | Clean interface built with Tailwind CSS |
| 👤 | **User Isolation** | Users can only access their own notes |

---

## 🤖 AI Note Organizer *(Planned)*

Transform unstructured notes into useful structured information using AI.

```
Write a note
     ↓
✨ Organize with AI
     ↓
Title · Summary · Category · Tags · Tasks
     ↓
Review suggestions
     ↓
Apply to note
```

**Example output:**
```
Category:    Study
Tags:        React · JavaScript · Hooks
Summary:     A concise summary of the note.
Action Items:
  ☐ Study useEffect
  ☐ Review useMemo
  ☐ Complete portfolio project
```

> AI-generated changes will be presented as suggestions so users can review them before applying.

---

## 🛠️ Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express.js
- MongoDB
- JWT
- bcrypt

### Deployment
- Vercel *(frontend)*
- Railway *(backend)*
- MongoDB Atlas *(database)*

---

## 🏗️ Architecture

```
┌─────────────────┐
│  React + Vite   │
│  Tailwind CSS   │
└────────┬────────┘
         │
         │  REST API
         ▼
┌─────────────────┐
│ Express + Node  │
│ Authentication  │
│ Business Logic  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │
│  Users + Notes  │
└─────────────────┘
```

Protected API requests use JWT authentication:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## 🔌 API

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Authenticate a user |

### Notes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notes` | Get a user's notes |
| `GET` | `/api/notes?category=X` | Filter notes by category |
| `POST` | `/api/notes` | Create a note |
| `PUT` | `/api/notes/:id` | Update a note |
| `DELETE` | `/api/notes/:id` | Delete a note |
| `PUT` | `/api/notes/:id/pin` | Toggle pin status |

> All note endpoints require authentication.

---

## 🗄️ Database Schema

### User
```json
{
  "_id": "ObjectId",
  "email": "String",
  "password": "String (hashed)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Note
```json
{
  "_id": "ObjectId",
  "title": "String",
  "content": "String",
  "category": "String",
  "userId": "ObjectId",
  "pinned": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

> Notes are associated with their owners through `userId`. Backend authorization ensures users cannot access notes that do not belong to them.

---

## 📁 Project Structure

```
my-notes-app/
│
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Note.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx
│   │   │   └── NotesPage.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── public/
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm
- MongoDB Atlas or a local MongoDB installation
- Git

### Clone the repository
```bash
git clone https://github.com/yourusername/my-notes-app.git
cd my-notes-app
```

### Configure the backend
```bash
cd backend
npm install
```

Create a `.env` file:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

Start the backend:
```bash
node server.js
```

### Configure the frontend
```bash
cd ../frontend
npm install
```

Start the frontend:
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security

- Password hashing with **bcrypt**
- **JWT**-based authentication with 7-day expiry
- All note routes protected by auth middleware
- User-specific authorization — users can only access their own notes
- Sensitive config stored in environment variables
- CORS configuration

---

## 🗺️ Roadmap

### ✅ Completed
- [x] User authentication (register / login)
- [x] Full CRUD operations
- [x] Real-time search
- [x] Pin / unpin notes
- [x] Category filtering
- [x] Dark mode with persistence
- [x] Relative timestamps
- [x] Responsive UI
- [x] User-specific authorization

### 🔜 Planned
- [ ] AI Note Organizer
- [ ] Rich-text / Markdown editing
- [ ] Tags
- [ ] Trash and restore
- [ ] Note export
- [ ] Reminders
- [ ] Version history
- [ ] Offline / PWA support

---

## 👤 Author

**Your Name**
- GitHub: [https://github.com/yourusername](https://github.com/yourusername)

---

*Built with ❤️ using React, Express.js, and MongoDB.*
