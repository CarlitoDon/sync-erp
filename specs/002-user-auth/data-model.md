# Data Model: User Authentication

## Entities

### User

Represents a registered account.

| Field        | Type          | Required | Description                   |
| ------------ | ------------- | -------- | ----------------------------- |
| id           | String (UUID) | Yes      | Primary Key                   |
| email        | String        | Yes      | Unique identifier (lowercase) |
| name         | String        | Yes      | User's full name              |
| passwordHash | String        | Yes      | Hashed password (bcrypt)      |
| createdAt    | DateTime      | Yes      | Timestamp of registration     |
| sessions     | Session[]     | No       | One-to-many relationship      |

### Session

Tracks active user sessions.

| Field     | Type          | Required | Description                 |
| --------- | ------------- | -------- | --------------------------- |
| id        | String (UUID) | Yes      | Primary Key & Session Token |
| userId    | String (UUID) | Yes      | Foreign Key to User         |
| expiresAt | DateTime      | Yes      | Expiration timestamp        |
| createdAt | DateTime      | Yes      | Creation timestamp          |

## Prisma Schema Changes

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  passwordHash String
  createdAt    DateTime  @default(now())
  sessions     Session[]

  // Existing relationships (if any)
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```
