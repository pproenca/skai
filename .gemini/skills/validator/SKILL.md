# API Validator

Example skill demonstrating dependency usage with zod for API validation.

## When to Apply

- Creating API endpoints that accept JSON payloads
- Validating request/response schemas
- Building type-safe API contracts

## Instructions

### Define Schemas with Zod

Use zod to define validation schemas for your API:

```typescript
import { z } from 'zod';

// Define request schema
const CreateUserRequest = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// Infer TypeScript type from schema
type CreateUserRequest = z.infer<typeof CreateUserRequest>;
```

### Validate Incoming Requests

Parse and validate request bodies:

```typescript
function handleCreateUser(body: unknown) {
  const result = CreateUserRequest.safeParse(body);

  if (!result.success) {
    return {
      status: 400,
      body: { errors: result.error.flatten() },
    };
  }

  // result.data is fully typed
  const user = createUser(result.data);
  return { status: 201, body: user };
}
```

### Define Response Schemas

Document and validate API responses:

```typescript
const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

// Validate before sending
function sendUser(user: unknown) {
  return UserResponse.parse(user);
}
```
