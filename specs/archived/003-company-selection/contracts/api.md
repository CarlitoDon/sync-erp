# API Contract: Company Selection

## Endpoints

### 1. List User Companies

- **GET** `/api/companies`
- **Auth**: Required
- **Response**: `200 OK`
  ```json
  [
    { "id": "uuid", "name": "Acme Corp" },
    { "id": "uuid2", "name": "Globex" }
  ]
  ```

### 2. Create Company

- **POST** `/api/companies`
- **Auth**: Required
- **Body**:
  ```json
  { "name": "New Company Inc" }
  ```
- **Response**: `201 Created`
  ```json
  { "id": "uuid", "name": "New Company Inc", "inviteCode": "ABC123" }
  ```

### 3. Join Company

- **POST** `/api/companies/join`
- **Auth**: Required
- **Body**:
  ```json
  { "inviteCode": "ABC123" }
  ```
- **Response**: `200 OK`
  ```json
  { "id": "uuid", "name": "New Company Inc" }
  ```
- **Error**: `404 Not Found` (Invalid code), `400 Bad Request` (Already member)

### 4. Get Company Details (Context Validation)

- **GET** `/api/companies/:id`
- **Auth**: Required
- **Response**: `200 OK`
  ```json
  { "id": "uuid", "name": "Acme Corp", "inviteCode": "SECRET" }
  ```
