# Research: User Authentication Module

**Decision**: Use Server-side Sessions with HTTP-only Cookies.
**Rationale**:

- **Security**: Prevents XSS attacks (client JavaScript cannot access the cookie).
- **Revocation**: Server can instantly invalidate sessions (logout, ban) by deleting them from the database/store.
- **Simplicity**: Standard pattern supported by Express and most libraries.

**Alternatives Considered**:

- **JWT (Stateless)**: Rejected because immediate revocation is harder (requires blocklists) and storing sensitive data in localStorage is less secure (XSS risk).

**Password Hashing**:

- **Decision**: Use `bcrypt` (or `argon2` if available).
- **Rationale**: Industry standard for password hashing, resistant to rainbow table attacks.

**Public Registration**:

- **Decision**: Allow public sign-up.
- **Rationale**: User explicitly requested a registration module for a general use case.
