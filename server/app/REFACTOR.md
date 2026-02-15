# **Refactoring Manifesto: The Readspace Standard**

**Goal:** A high-performance, highly testable, maintainable FastAPI backend.
**Core Philosophy:** Radical Simplicity & Functional Purity.

## **1. Architectural Style**

- **Functional > OOP:** Eliminate stateless classes (`Service` classes that just hold `self.db`). Use standalone `async def` functions. Modules are the namespace.
- **Flatten the Stack:** Avoid over-abstraction (e.g., `Manager` calling `Processor` calling `Client`). A Router should call a Service, which calls CRUD or External APIs directly.
- **Explicit Dependencies:** Functions should receive exactly what they need as arguments. Avoid global state or hidden context.

## **2. Database & I/O Discipline**

- **The "Surgical Session" Pattern:**
  - **Never** hold an open database transaction while performing CPU-bound work (parsing XML/JSON) or Network I/O (calling OpenAI, external APIs).
  - Use `SessionFactory` instead of direct `AsyncSession` dependency for endpoints involving mixed workloads (CPU + I/O).
  - _Pattern:_ `Parse Data (CPU)` → `Open DB & Persist (IO)` → `Close DB` → `Dispatch Background Task`.
- **Pure CRUD:** CRUD functions must be **dumb**. No business logic, no validation, no HTTP exceptions. They strictly translate Pydantic/Python types to SQL queries.
- **Batch Operations:** Always prefer `upsert_batch` or `insert_many` over iterating and inserting one by one.

## **3. Logic Isolation & Testability**

- **Humble Objects:** Isolate pure business logic (parsing, sanitization, calculation) into pure functions that take data and return data. These should have **zero** dependencies on the Database, Redis, or HTTP requests.
- **Sanitization:** Security is not optional.
  - **HTML:** Resolve relative links first (BeautifulSoup), _then_ sanitize (nh3).
  - **XML:** Always use `defusedxml`.
- **Validation:** Validate inputs at the Service layer (business rules) or Pydantic layer (schema rules), not deep in the CRUD layer.

## **4. Performance & Ecosystem**

- **Leverage Libraries:** Do not reinvent the wheel.
  - HTML Sanitization: `nh3` (Rust-based, fast).
  - Extraction: `trafilatura`.
  - Serialization: `orjson`
- **Middleware:** Keep it lightweight. Avoid database calls in middleware (e.g., don't check user profiles on every health check request). Use `BaseHTTPMiddleware` with pure functions.
- **Caching:**
  - **Browser:** Use `Cache-Control` headers for read-heavy endpoints.
  - **Server:** Use Redis for expensive computations (AI summaries), but keep keys simple and consistent.

## **5. Code Style & Hygiene**

- **Imports:** Keep 3rd party imports at the top, local imports below. Remove unused imports immediately.
- **Typing:** Strict type hints everywhere. Use `Pydantic` models for data interchange, not raw dicts.
- **Return Data:** Don't return the entire ORM object if the caller only needs an ID. Use Pydantic `.model_dump()` or specific schemas to strip internal state before returning to the frontend.
