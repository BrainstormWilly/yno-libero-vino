# Contributing to Yno Libero Vino

Thank you for your interest in contributing to Yno Libero Vino! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to support@ynosoftware.com.

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/yno-libero-vino.git
   cd yno-libero-vino
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Development Process

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Update documentation if needed
   - Add tests for new features
   - Follow the PR template

2. **PR Guidelines:**
   - Keep PRs focused and atomic
   - Reference related issues
   - Provide clear description
   - Include screenshots for UI changes

3. **Review Process:**
   - At least one approval required
   - CI checks must pass
   - Address review feedback promptly

4. **After approval:**
   - Squash commits if requested
   - Merge using "Squash and merge"

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Properly type all functions and variables
- Avoid `any` types when possible
- Use interfaces for object shapes

### React/React Router

- Use functional components
- Use React hooks appropriately
- Follow React Router v7 conventions
- Keep components small and focused

### File Organization

```
app/
├── components/     # Reusable UI components
├── lib/           # Business logic and CRM providers
├── routes/        # Route components
├── types/         # TypeScript type definitions
├── util/          # Utility functions
└── styles/        # Global styles
```

### Naming Conventions

- **Files**: Use kebab-case for file names (`webhook-handler.ts`)
- **Components**: Use PascalCase (`WebhookManager.tsx`)
- **Functions**: Use camelCase (`processWebhook()`)
- **Constants**: Use UPPER_SNAKE_CASE (`API_URL`)
- **Types/Interfaces**: Use PascalCase (`CrmProvider`)

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in objects/arrays
- Use semicolons
- Run ESLint before committing

## Testing Guidelines

### Writing Tests

- Write tests for all new features
- Maintain or improve test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Organization

```typescript
describe('WebhookHandler', () => {
  describe('processWebhook', () => {
    it('should process Shopify webhook successfully', async () => {
      // Arrange
      const payload = { ... };
      
      // Act
      const result = await processWebhook(payload);
      
      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Test additions or changes
- **build**: Build system changes
- **ci**: CI configuration changes
- **chore**: Other changes (dependencies, etc.)

### Examples

```bash
feat(webhooks): add Commerce7 webhook support

Add webhook handling for Commerce7 CRM including validation
and processing logic for all supported webhook topics.

Closes #123

---

fix(auth): correct Shopify OAuth redirect

Fix redirect URL construction for Shopify authentication
to properly handle subdomain prefixes.

---

docs(readme): update Ngrok setup instructions

Add detailed instructions for setting up Ngrok tunnels
for webhook testing with subdomain support.
```

## Adding New CRM Providers

To add a new CRM provider:

1. **Create provider class**
   - Implement `CrmProvider` interface
   - Add to `app/lib/crm/`

2. **Add types**
   - Update `app/types/crm.ts`
   - Add CRM-specific types

3. **Create routes**
   - Add authentication routes
   - Add webhook routes

4. **Update documentation**
   - Update README.md
   - Add setup guide

5. **Add tests**
   - Unit tests for provider
   - Integration tests for routes

## Questions?

- 📧 Email: support@ynosoftware.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/yno-libero-vino/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/yno-libero-vino/discussions)

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

