# Gym & Fitness Club Management REST API

A REST API for managing a gym / fitness club: member registration with tiered
memberships, session-based authentication (Passport local strategy), fitness
class scheduling and booking with capacity control, and membership renewal /
expiry tracking.

**Tech stack:** Node.js, Express.js, MongoDB + Mongoose, Passport.js
(`passport-local`), express-session, bcryptjs, dotenv, cors. Dev: nodemon.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Running Tests](#running-tests)
- [API Endpoints](#api-endpoints)
- [Postman Collection](#postman-collection)
- [Design Choices](#design-choices)

---

## Project Structure

```
assignment-08-gym-api/
├── config/
│   ├── db.js                 # Mongoose connection (graceful, never crashes)
│   └── passport.js           # Passport local strategy + (de)serialize by _id
├── controllers/
│   ├── authController.js     # register / login / logout / me
│   ├── classController.js    # list / get / create / book / cancel
│   └── memberController.js   # renew / expired
├── middleware/
│   ├── authMiddleware.js     # 401 if not authenticated
│   └── checkActiveMember.js  # 400 "Membership expired" guard for booking
├── models/
│   ├── FitnessClass.js
│   └── User.js               # pre-save hook computes expiry = months * 30 days
├── routes/
│   ├── authRoutes.js
│   ├── classRoutes.js
│   └── memberRoutes.js
├── postman/
│   └── gym-api.postman_collection.json
├── test/
│   └── logic.test.js         # pure-logic unit tests (no DB needed)
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

---

## Quick Start

```bash
cd assignment-08-gym-api
npm install
cp .env.example .env      # then edit MONGODB_URI + SESSION_SECRET
npm run dev
```

The server starts on `http://localhost:5000` (or `PORT`). It will start **even
without a working database** — see [Database Setup](#database-setup).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable         | Required | Description                                                        |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `PORT`           | no       | HTTP port. Defaults to `5000`.                                     |
| `MONGODB_URI`    | yes\*    | MongoDB connection string. \*App still boots without it (warning). |
| `SESSION_SECRET` | yes      | Secret used to sign the express-session cookie. Use a long random string. |

---

## Database Setup

No live MongoDB is bundled with this project — **you supply your own
`MONGODB_URI`.** The app is written against real Mongoose models and queries (no
mocks), so once you point it at a real database everything works end to end.

You have two easy options:

### Option A — MongoDB Atlas (free tier, recommended)

1. Create a free account at <https://www.mongodb.com/atlas> and spin up a free
   **M0** shared cluster.
2. Create a database user (username + password) under **Database Access**.
3. Under **Network Access**, allow your IP (or `0.0.0.0/0` for testing).
4. Click **Connect → Drivers** and copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gym_fitness_club?retryWrites=true&w=majority
   ```
5. Paste it into `.env` as `MONGODB_URI` (replace `<user>` / `<password>`, and
   keep the `/gym_fitness_club` database name or choose your own).

### Option B — Local MongoDB

Install MongoDB Community Server, start `mongod`, and use:

```
MONGODB_URI=mongodb://127.0.0.1:27017/gym_fitness_club
```

### Graceful behaviour without a DB

`config/db.js` calls `mongoose.connect(process.env.MONGODB_URI)` and **never
throws or calls `process.exit`**. If the URI is missing or the connection fails,
it logs a clear warning and returns, and `server.js` **still starts Express**.
DB-backed routes then respond with a clean JSON error (a Mongoose buffering
timeout) instead of crashing the process. This satisfies the requirement that
the server boot cleanly in an environment with no live database.

---

## Running the App

```bash
npm run dev     # nodemon, auto-restart on change
npm start       # plain node
```

Health check: `GET http://localhost:5000/` returns
`{ success, message, data: { dbConnected } }`.

---

## Running Tests

```bash
npm test
```

Runs pure-logic unit tests via the built-in Node test runner (`node --test`), no
database required. They verify the two learning-outcome invariants:

- **1-month membership = exactly 30 days** (`durationMonths * 30`), for 1/3/6/12
  months.
- **Capacity check rejects the 3rd booking** when `maxCapacity === 2`.
- Renewal extends from **whichever is later** (now vs. current expiry) so an
  active membership is never shortened.

---

## API Endpoints

All responses use a consistent envelope: `{ success: boolean, message: string, data?: any }`.

### Auth (`/api/auth`)

| Method | Path             | Auth | Description                                                                 |
| ------ | ---------------- | ---- | --------------------------------------------------------------------------- |
| POST   | `/register`      | no   | Register. Body: `username, email, password, membershipTier?, durationMonths?`. Hashes password, computes expiry `= durationMonths*30` days. `201` / `400`. |
| POST   | `/login`         | no   | Passport local login, creates session. `200` / `401`.                       |
| POST   | `/logout`        | yes  | Destroys the session.                                                       |
| GET    | `/me`            | yes  | Current profile + computed `remainingDays`; syncs `membershipStatus`. Never returns password. `401` if not logged in. |

### Classes (`/api/classes`)

| Method | Path            | Auth              | Description                                                                                     |
| ------ | --------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/`             | public            | Upcoming classes (`scheduleDate >= now`). Optional `?trainer=Name` filter (case-insensitive).  |
| GET    | `/:id`          | public            | Class details; `enrolledMembers` populated with `username`/`email` only. `404` if not found.   |
| POST   | `/`             | public\*          | Create a class. `400` on invalid input (e.g. `maxCapacity < 1`).                               |
| POST   | `/:id/book`     | yes + active mbr. | Book a seat. `400 "Membership expired"`, `400 "Class capacity reached"`, `400` if double-book. |
| DELETE | `/:id/cancel`   | yes               | Remove logged-in user from `enrolledMembers`. Idempotent — `200` even if not enrolled.         |

### Members (`/api/members`)

| Method | Path            | Auth | Description                                                                                          |
| ------ | --------------- | ---- | -------------------------------------------------------------------------------------------------- |
| PATCH  | `/:id/renew`    | yes  | Body: `additionalMonths, tier?`. Extends expiry by `additionalMonths*30` days from **later** of now / current expiry; updates tier; sets status `active`. `404` if member not found. |
| GET    | `/expired`      | yes  | All users with `membershipExpiryDate < now`; syncs their status to `expired`.                       |

---

## Postman Collection

Import `postman/gym-api.postman_collection.json` into Postman.

- Set the `baseUrl` collection variable (default `http://localhost:5000`).
- Postman's cookie jar carries the session cookie across requests, so run
  **Register → Login → …** in order.
- Covered flows: register, login, get me, create class (and an invalid-input
  `400`), list/filter classes, get class by id, book, cancel, renew membership,
  get expired members.
- The **"Booking — Capacity Reached"** folder explicitly demonstrates the
  capacity rule: it creates a class with `maxCapacity: 2`, registers/logs in
  three distinct members, books with members A and B (`200`), then attempts a
  **3rd booking** with member C which returns **`400 "Class capacity reached"`**
  (asserted by a built-in test script).

---

## Design Choices

Decisions made autonomously (no live DB / no clarifying questions), documented here:

1. **Expiry math lives in the model, not the controller.** A `durationMonths`
   virtual + a `pre('save')` hook on `User` compute
   `membershipExpiryDate = now + durationMonths * 30 days`. This is real
   Mongoose middleware (learning outcome). A `1`-month registration therefore
   expires **exactly 30 days** out. Renewal uses a `user.renew()` instance
   method that extends from `max(now, currentExpiry)` so active memberships are
   never shortened.
2. **`membershipStatus` is kept in sync with the clock.** The `pre('save')` hook,
   the `/me` handler, `checkActiveMember`, and `/members/expired` all flip a
   past-due (non-frozen) member to `expired`. `frozen` is treated as an explicit
   admin state and is left untouched by auto-sync.
3. **`GET /api/classes` and `GET /api/classes/:id` are public**; `POST /api/classes`
   is also left open for this assignment (no admin/role system was specified).
   In a production system class creation would sit behind an admin role — noted
   as a deliberate scope choice.
4. **Booking requires an active membership** via `checkActiveMember`, which runs
   after `authMiddleware`. Double-booking the same class by the same user is
   rejected with `400`.
5. **Cancel is idempotent.** `DELETE /:id/cancel` returns `200` whether or not
   the user was enrolled; the message distinguishes the two cases. This keeps
   the client simple (no need to pre-check enrollment).
6. **Passwords** are hashed with `bcryptjs` (cost 10) and are stripped from every
   JSON response via a `toJSON` transform on the `User` schema.
7. **Sessions** use `express-session` with `passport.serializeUser` /
   `deserializeUser` by Mongo `_id`. Cookies are `httpOnly`; CORS is enabled with
   `credentials: true` so a browser client on another origin can hold the session.
8. **Consistent envelope + centralized error handler.** Every response is
   `{ success, message, data? }`; a final Express error middleware converts
   thrown/`next(err)` errors into `{ success: false, message }` with an
   appropriate status. Mongo duplicate-key (`11000`) and `ValidationError` map to
   `400`.
9. **`durationMonths` defaults to 1** at registration if omitted, and
   `membershipTier` defaults to `Bronze` (schema default).
10. **The server always starts**, even with a missing/failing DB, per the
    assignment constraint — see [Database Setup](#database-setup).
