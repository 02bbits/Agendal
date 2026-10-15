# Maintainability

| ID | Name | Description |
|---|---|---|
| NFR-25 | Code quality & testing | The backend follows PSR-12 (Laravel Pint) with business logic in Services/Actions; the frontend uses TypeScript strict mode, ESLint, Prettier, and shadcn/ui-based components. Backend test coverage ≥ 70% (PHPUnit/Pest), with assistant actions tested against a mocked AI provider; frontend components are tested with Vitest + React Testing Library. Lint, type-check, and tests run on every pull request with GitHub Actions. Prompts are versioned in the repository and the AI model is set in .env. |
| NFR-26 | API documentation & versioning | All API endpoints are versioned (/api/v1) and documented automatically with Scramble, so the documentation stays in sync with the code. |
