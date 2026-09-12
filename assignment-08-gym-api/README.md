# Gym & Fitness Club Management REST API

> A session-authenticated REST API for running a gym / fitness club — tiered memberships with automatic expiry tracking, capacity-limited class booking, and membership renewal, built on Express and MongoDB/Mongoose.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20Local-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Mongoose](https://img.shields.io/badge/Mongoose-8.5-880000?logo=mongoose&logoColor=white)](https://mongoosejs.com/)
[![Passport](https://img.shields.io/badge/Passport-local-34E27A?logo=passport&logoColor=white)](https://www.passportjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Authentication Model](#authentication-model)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Membership Expiry Rule](#membership-expiry-rule)
- [Postman Collection](#postman-collection)
- [Example Workflow](#example-workflow)
- [Testing](#testing)
- [Design Choices & Notes](#design-choices--notes)
- [Author](#author)
- [License](#license)

---

## Overview

This service manages the core operations of a gym or fitness club:

- **Members** register with a chosen membership tier and duration. Their expiry date and status (`active` / `expired` / `frozen`) are computed and kept in sync by the data layer itself.
- **Authentication** is session-based using Passport's local strategy — a signed, `httpOnly` cookie carries the session, and passwords are hashed with bcrypt and never leave the server.
- **Fitness classes** are scheduled with a trainer, a start time, a duration, and a hard maximum capacity. Members with an active membership can book a seat until the class is full, and cancel at any time.
- **Renewal** extends a membership without ever shortening one that is still active.

Every response follows a single, predictable envelope:

```json
{ "success": true, "message": "human readable", "data": { } }
```

---

## Features

- Member registration with tiered memberships (`Bronze`, `Silver`, `Gold`, `Platinum`).
- Session-based authentication with Passport local strategy + `express-session`.
- Bcrypt-hashed passwords, stripped from every serialized response.
- Automatic membership **expiry** computed by real Mongoose middleware (`1 month = 30 days`).
- Membership **status auto-sync** — past-due members are flipped to `expired` on read/save; `frozen` is an explicit, protected admin state.
- Membership **renewal** that extends from `max(now, current expiry)` so an active membership is never shrunk.
- Fitness class scheduling with **capacity-limited booking** — full classes and double-bookings are rejected.
- Idempotent booking cancellation.
- Public class discovery with optional `?trainer=` filtering, upcoming-only listing.
- Consistent `{ success, message, data }` envelope + centralized error handling.
- Graceful startup — the server boots even when no database is reachable (see [Database Setup](#database-setup)).
- Ready-to-run Postman collection, including a dedicated capacity-reached scenario.

---

## Tech Stack

| Layer            | Technology        | Purpose                                                     |
| ---------------- | ----------------- | ---------------------------------------------------------- |
| Runtime          | Node.js (>= 18)   | JavaScript runtime (uses the built-in `node --test` runner) |
| Web framework    | Express `4.19`    | HTTP routing & middleware                                  |
| Database         | MongoDB           | Document data store (Atlas free tier or local)            |
| ODM              | Mongoose `8.5`    | Schemas, middleware, validation, virtuals                 |
| Authentication   | Passport `0.7` + `passport-local` `1.0` | Username/password auth strategy           |
| Sessions         | express-session `1.18` | Server-side session + signed cookie                  |
| Password hashing | bcryptjs `2.4`    | One-way password hashing (cost 10)                        |
| Config           | dotenv `16.4`     | Environment variable loading                              |
| CORS             | cors `2.8`        | Cross-origin requests with credentials                    |
| Dev tooling      | nodemon `3.1`     | Auto-restart in development                                |

---

## Project Structure

```
assignment-08-gym-api/
├── config/
│   ├── db.js                 # Mongoose connection (graceful — never crashes the process)
│   └── passport.js           # Passport local strategy + (de)serialize by Mongo _id
├── controllers/
│   ├── authController.js     # register / login / logout / me
│   ├── classController.js    # list / get / create / book / cancel
│   └── memberController.js   # renew / expired
├── middleware/
│   ├── authMiddleware.js     # 401 guard when not authenticated
│   └── checkActiveMember.js  # 400 "Membership expired" guard for booking
├── models/
│   ├── User.js               # pre-save hook computes expiry = months * 30 days
│   └── FitnessClass.js       # enrolledMembers + maxCapacity, availableSlots/isFull virtuals
├── routes/
│   ├── authRoutes.js
│   ├── classRoutes.js
│   └── memberRoutes.js
├── postman/
│   └── gym-api.postman_collection.json
├── test/
│   └── logic.test.js         # pure-logic unit tests (no DB required)
├── .env.example
├── .gitignore
├── package.json
├── server.js                 # app bootstrap, middleware wiring, health check
└── README.md
```

---

## Prerequisites

- **Node.js 18+** and npm.
- A **MongoDB** database — either a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (recommended) or a local `mongod` instance. See [Database Setup](#database-setup).

---

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Adityac17/Assignment_8.git
cd Assignment_8

# 2. Check out the assignment branch and enter the project
git checkout assignment-08
cd assignment-08-gym-api

# 3. Install dependencies
npm install

# 4. Create your environment file
cp .env.example .env          # then edit MONGODB_URI + SESSION_SECRET

# 5. Run in development (auto-restart)
npm run dev
```

The server starts on `http://localhost:5000` (or the `PORT` you configure).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable         | Required | Default  | Description                                                                 |
| ---------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `PORT`           | No       | `5000`   | HTTP port the server listens on.                                            |
| `MONGODB_URI`    | Yes\*    | —        | MongoDB connection string. \*The app still boots without it, logging a warning; DB-backed routes then fail until it is set. |
| `SESSION_SECRET` | Yes      | insecure dev fallback | Secret used to sign the `express-session` cookie. Use a long, random string in production. |

Example `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/gym_fitness_club
SESSION_SECRET=change_this_to_a_long_random_secret
```

---

## Database Setup

No database is bundled — **you supply your own `MONGODB_URI`.** The API is written against real Mongoose models and queries (no mocks), so once it points at a live database everything works end to end. Simply set `MONGODB_URI` in `.env`.

### Option A — MongoDB Atlas (free tier, recommended)

The Atlas **M0** shared cluster is free and works perfectly for this project.

1. Create a free account at <https://www.mongodb.com/atlas> and spin up an **M0** cluster.
2. Under **Database Access**, create a database user (username + password).
3. Under **Network Access**, allow your IP (or `0.0.0.0/0` for testing).
4. Click **Connect → Drivers** and copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gym_fitness_club?retryWrites=true&w=majority
   ```
5. Paste it into `.env` as `MONGODB_URI` (substitute `<user>` / `<password>`, and keep or change the `/gym_fitness_club` database name).

### Option B — Local MongoDB

Install MongoDB Community Server, start `mongod`, and use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/gym_fitness_club
```

### Graceful behaviour without a database

`config/db.js` connects with an 8-second server-selection timeout and **never throws or calls `process.exit`**. If `MONGODB_URI` is missing or unreachable, it logs a clear warning and returns `false`, and `server.js` **still starts Express**. The health check at `GET /` reports the live connection state via `data.dbConnected`.

---

## Running the App

```bash
npm run dev     # nodemon — auto-restart on file changes (development)
npm start       # plain node (production-style)
```

Health check:

```bash
curl http://localhost:5000/
# { "success": true, "message": "Gym & Fitness Club Management API is running",
#   "data": { "dbConnected": true } }
```

---

## Authentication Model

Authentication is **session-based**, not token-based:

- `POST /api/auth/login` runs the **Passport local strategy** (`username` + `password`). On success, `req.logIn` establishes a session and the server sends back a signed, `httpOnly` session cookie.
- Passport serializes only the Mongo `_id` into the session and rehydrates the full user on each request (`serializeUser` / `deserializeUser`).
- **Subsequent requests must send that cookie.** In browsers this is automatic (CORS is configured with `credentials: true`); in Postman the cookie jar handles it; with `curl`, save and reuse the cookie (see [Example Workflow](#example-workflow)).
- The session cookie has a **1-day** max age and is `httpOnly`.
- Passwords are hashed with **bcrypt** (cost 10) and removed from every JSON response by a `toJSON` transform on the `User` schema.

---

## API Reference

All responses use the envelope `{ success: boolean, message: string, data?: any }`.
The **Auth** column: `No` = public, `Session` = requires a logged-in session, `Session + Active` = requires a logged-in session **and** an active membership.

### Auth — `/api/auth`

| Method | Endpoint    | Auth    | Description                                                                                                                        |
| ------ | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/register` | No      | Register a member. Body: `username, email, password, membershipTier?, durationMonths?`. Hashes password, computes expiry `= durationMonths × 30` days. `201` / `400`. |
| POST   | `/login`    | No      | Passport local login; establishes a session. `200` / `401`.                                                                       |
| POST   | `/logout`   | Session | Destroys the current session. `200`.                                                                                              |
| GET    | `/me`       | Session | Current profile + computed `remainingDays`; syncs `membershipStatus`. Password never returned. `401` if not logged in.           |

### Classes — `/api/classes`

| Method | Endpoint       | Auth             | Description                                                                                                             |
| ------ | -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`            | No               | List **upcoming** classes (`scheduleDate >= now`), sorted by date. Optional `?trainer=Name` filter (case-insensitive). |
| GET    | `/:id`         | No               | Class details; `enrolledMembers` populated with `username` / `email` only. `404` if not found.                         |
| POST   | `/`            | No\*             | Create a class. Body: `title, trainerName, scheduleDate, durationMinutes?, maxCapacity`. `201` / `400` (e.g. `maxCapacity < 1`). \*Left open for this assignment; see [Design Choices](#design-choices--notes). |
| POST   | `/:id/book`    | Session + Active | Book a seat for the logged-in member. `200` on success; `400 "Membership expired"`, `400 "Class capacity reached"`, or `400` if already enrolled; `404` if class not found. |
| DELETE | `/:id/cancel`  | Session          | Remove the logged-in member from `enrolledMembers`. Idempotent — `200` even when not enrolled (message distinguishes). |

### Members — `/api/members`

| Method | Endpoint      | Auth    | Description                                                                                                                                       |
| ------ | ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/:id/renew`  | Session | Renew a membership. Body: `additionalMonths, tier?`. Extends expiry by `additionalMonths × 30` days from **max(now, current expiry)**; optionally updates tier; sets status `active`. `200` / `400` / `404`. |
| GET    | `/expired`    | Session | List all members whose `membershipExpiryDate < now`, sorted by expiry; syncs their status to `expired` (leaving `frozen` untouched). `200`.       |

---

## Data Models

### User (`models/User.js`)

| Field                 | Type       | Notes                                                                        |
| --------------------- | ---------- | --------------------------------------------------------------------------- |
| `username`            | String     | Required, unique, trimmed.                                                  |
| `email`               | String     | Required, unique, lowercased, trimmed.                                      |
| `password`            | String     | Required; stored **bcrypt-hashed**; stripped from all JSON output.          |
| `membershipTier`      | String enum | `Bronze` \| `Silver` \| `Gold` \| `Platinum`. Default `Bronze`.            |
| `membershipStatus`    | String enum | `active` \| `expired` \| `frozen`. Default `active`; auto-synced to the clock. |
| `membershipExpiryDate`| Date       | Required; computed by the pre-save hook from `durationMonths`.               |
| `emergencyContact`    | String     | Optional, defaults to `''`.                                                 |
| `createdAt` / `updatedAt` | Date   | Added by `timestamps: true`.                                               |

**Virtuals & helpers:** `durationMonths` (write-only setter that stages the month count for the pre-save hook), `remainingDays` (days until expiry, floored at 0), `renew(additionalMonths, tier)` instance method, and a static `computeExpiry(months, from)` helper.

### FitnessClass (`models/FitnessClass.js`)

| Field             | Type            | Notes                                                    |
| ----------------- | --------------- | ------------------------------------------------------- |
| `title`           | String          | Required, trimmed.                                       |
| `trainerName`     | String          | Required, trimmed.                                       |
| `scheduleDate`    | Date            | Required.                                                |
| `durationMinutes` | Number          | Default `60`, minimum `1`.                               |
| `maxCapacity`     | Number          | Required, minimum `1` — the hard seat limit.            |
| `enrolledMembers` | [ObjectId → User] | Array of enrolled member references.                  |
| `createdAt` / `updatedAt` | Date    | Added by `timestamps: true`.                            |

**Virtuals:** `availableSlots` (`max(0, maxCapacity − enrolledMembers.length)`) and `isFull` (`enrolledMembers.length >= maxCapacity`).

---

## Membership Expiry Rule

Membership duration math lives entirely in the **model**, not the controllers:

- **1 month = exactly 30 days.** A `durationMonths` virtual stages the month count, and a real Mongoose `pre('save')` hook on `User` computes `membershipExpiryDate = now + durationMonths × 30 days`. Registering for `1` month therefore expires exactly 30 days out; `3`, `6`, `12` months scale linearly.
- **Renewal never shrinks an active membership.** `user.renew(additionalMonths, tier)` extends from `max(now, currentExpiry)` — so renewing early adds time on top of the remaining balance rather than resetting it — then flips the status back to `active`.
- **Status stays in sync with the clock.** The pre-save hook, `GET /api/auth/me`, the `checkActiveMember` guard, and `GET /api/members/expired` all mark a past-due, non-`frozen` member as `expired`. `frozen` is treated as a deliberate admin state and is left untouched by auto-sync.

---

## Postman Collection

Import `postman/gym-api.postman_collection.json` into Postman.

- Set the `baseUrl` collection variable (default `http://localhost:5000`).
- Postman's **cookie jar** carries the session cookie across requests, so run **Register → Login → …** in order.
- **Covered flows:** register, login, get me, logout, create class (plus an invalid-input `maxCapacity: 0 → 400`), list & filter classes by trainer, get class by id (populated members), book, cancel, renew membership, and list expired members.
- The **"Booking — Capacity Reached"** folder explicitly demonstrates the capacity rule: it creates a class with `maxCapacity: 2`, registers and logs in **three** distinct members, books with members A and B (`200` each), then attempts a **3rd booking** with member C — which returns **`400 "Class capacity reached"`**, asserted by a built-in test script.

---

## Example Workflow

A full member journey — **register (with `durationMonths`) → login → book a class → renew** — using `curl`. The `-c`/`-b` flags persist the session cookie between calls.

### 1. Register (30-day membership)

```bash
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"jane","email":"jane@example.com","password":"secret123","membershipTier":"Gold","durationMonths":1}'
```

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "_id": "665f0a1c9b1e4a0012ab34cd",
    "username": "jane",
    "email": "jane@example.com",
    "membershipTier": "Gold",
    "membershipStatus": "active",
    "membershipExpiryDate": "2026-10-12T09:00:00.000Z",
    "remainingDays": 30,
    "id": "665f0a1c9b1e4a0012ab34cd"
  }
}
```

### 2. Login (start a session, save the cookie)

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"jane","password":"secret123"}'
```

```json
{ "success": true, "message": "Login successful", "data": { "username": "jane", "membershipStatus": "active" } }
```

### 3. Book a class (send the session cookie)

```bash
curl -s -X POST http://localhost:5000/api/classes/665f0b2d9b1e4a0012ab34ff/book \
  -b cookies.txt
```

```json
{
  "success": true,
  "message": "Class booked successfully",
  "data": {
    "_id": "665f0b2d9b1e4a0012ab34ff",
    "title": "Morning Yoga",
    "trainerName": "Alice",
    "maxCapacity": 20,
    "enrolledMembers": ["665f0a1c9b1e4a0012ab34cd"],
    "availableSlots": 19,
    "isFull": false
  }
}
```

### 4. Renew the membership (never shortens an active one)

```bash
curl -s -X PATCH http://localhost:5000/api/members/665f0a1c9b1e4a0012ab34cd/renew \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"additionalMonths":3,"tier":"Platinum"}'
```

```json
{
  "success": true,
  "message": "Membership renewed",
  "data": {
    "username": "jane",
    "membershipTier": "Platinum",
    "membershipStatus": "active",
    "membershipExpiryDate": "2027-01-10T09:00:00.000Z",
    "remainingDays": 120
  }
}
```

---

## Testing

```bash
npm test
```

Runs pure-logic unit tests via the built-in Node test runner (`node --test`) — **no database required**. They cover the core invariants:

- A **1-month membership equals exactly 30 days** (`durationMonths × 30`), verified for 1 / 3 / 6 / 12 months.
- The **capacity check rejects the 3rd booking** when `maxCapacity === 2`.
- **Renewal extends from `max(now, current expiry)`**, so an active membership is never shortened.

---

## Design Choices & Notes

1. **Expiry math lives in the model.** A `durationMonths` virtual plus a `pre('save')` hook on `User` own the date arithmetic (`now + months × 30 days`). Controllers only stage the month count — real Mongoose middleware does the work.
2. **`membershipStatus` is kept in sync with the clock** across the pre-save hook, `/me`, `checkActiveMember`, and `/members/expired`. `frozen` is an explicit admin state, exempt from auto-sync.
3. **Class reads are public; class creation is left open** for this assignment (no role system was specified). In production, `POST /api/classes` would sit behind an admin role — a deliberate, documented scope choice.
4. **Booking requires an active membership** via `checkActiveMember`, which runs after `authMiddleware`. Full classes, expired members, and double-bookings are each rejected with a `400`.
5. **Cancellation is idempotent** — `DELETE /:id/cancel` returns `200` whether or not the user was enrolled, with a message distinguishing the two cases, so clients need no pre-check.
6. **Passwords** are bcrypt-hashed (cost 10) and stripped from every JSON response via a `toJSON` transform.
7. **Sessions** use `express-session` + Passport `serializeUser` / `deserializeUser` by Mongo `_id`; cookies are `httpOnly`, and CORS runs with `credentials: true` so a browser client on another origin can hold the session.
8. **Consistent envelope + centralized error handling.** Every response is `{ success, message, data? }`; a final Express error middleware converts thrown/`next(err)` errors to `{ success: false, message }`, mapping Mongo duplicate-key (`11000`) and `ValidationError` to `400`.
9. **Sensible defaults:** `durationMonths` defaults to `1` and `membershipTier` to `Bronze` at registration.
10. **The server always starts**, even with a missing or failing database, per the assignment constraint — see [Database Setup](#database-setup).

---

## Author

**Aditya S Chouksey**

---

## License

Released under the **MIT License**.
