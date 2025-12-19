# Data Model: Company Selection

## Entities

### Company (Existing, Updated)

- **id** (UUID): PK
- **name** (String): Company name
- **inviteCode** (String): [NEW] Unique 6-character code for joining. Indexed.
- **users** (Relation): Many-to-Many with User.

### User (Existing)

- **id** (UUID): PK
- **companies** (Relation): Many-to-Many with Company.

## Relationships

- **User** <-> **Company**: Many-to-Many (Managed via explicit join table `UserCompany` or implicit Prisma relation if simple).
- _Assumption_: We stick to implicit Many-to-Many for MVP simplicity unless RBAC requires explicit role per company (which it usually does, but let's stick to MVP as defined in research).

## Schema Changes (Prisma)

```prisma
model Company {
  id          String   @id @default(uuid())
  name        String
  inviteCode  String?  @unique // NEW field
  users       User[]
  // ... other fields
}
```

## State Transitions

- **No Company** -> Login -> **Company Selection**
- **Company Selection** -> Select -> **Active Context**
- **Active Context** -> Switch -> **Company Selection**
