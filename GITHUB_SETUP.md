# GitHub Integration Setup Guide

This guide will help you set up the GitHub integration for Yno Libero Vino, including CI/CD, security scanning, and automated workflows.

## Table of Contents

- [GitHub Repository Setup](#github-repository-setup)
- [GitHub Actions Configuration](#github-actions-configuration)
- [Branch Protection Rules](#branch-protection-rules)
- [GitHub Secrets](#github-secrets)
- [Dependabot Configuration](#dependabot-configuration)
- [Issue Templates](#issue-templates)
- [Additional Features](#additional-features)

## GitHub Repository Setup

### 1. Create GitHub Repository

```bash
# If not already created
gh repo create yno-libero-vino --public --description "A wine club and loyalty platform for Commerce7 and Shopify"

# Or initialize existing repository
cd /path/to/yno-libero-vino
git init
git add .
git commit -m "feat: initial commit with Ngrok webhook support"
git branch -M main
git remote add origin https://github.com/your-username/yno-libero-vino.git
git push -u origin main
```

### 2. Repository Settings

Navigate to your repository settings and configure:

#### General Settings
- **Description**: A wine club and loyalty platform for Commerce7 and Shopify
- **Website**: https://yno-libero-vino.herokuapp.com
- **Topics**: `wine-club`, `loyalty-platform`, `shopify`, `commerce7`, `webhooks`, `react-router`, `typescript`, `supabase`, `wine`, `winery`
- **Features**:
  - ✅ Issues
  - ✅ Discussions
  - ✅ Projects
  - ✅ Wiki

#### Collaborators
- Add team members with appropriate permissions
- Configure branch protection rules

## GitHub Actions Configuration

### Workflows Included

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - Runs on push and PR to main/develop
   - Lint, type check, test, and build
   - Upload coverage reports

2. **Deploy Workflow** (`.github/workflows/deploy.yml`)
   - Deploys to Heroku on push to main
   - Runs health checks after deployment
   - Sends notifications

3. **PR Checks** (`.github/workflows/pr-checks.yml`)
   - Validates PR titles
   - Labels PRs by size
   - Runs Lighthouse CI

4. **Security Scan** (`.github/workflows/security-scan.yml`)
   - Daily security scans
   - Dependency review
   - CodeQL analysis
   - Secret scanning

### Enable GitHub Actions

1. Go to **Settings → Actions → General**
2. Set **Actions permissions** to "Allow all actions and reusable workflows"
3. Set **Workflow permissions** to "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"

## Branch Protection Rules

### Main Branch Protection

Navigate to **Settings → Branches → Add rule** for `main`:

```yaml
Branch name pattern: main

Protect matching branches:
  ✅ Require a pull request before merging
    ✅ Require approvals: 1
    ✅ Dismiss stale pull request approvals when new commits are pushed
  ✅ Require status checks to pass before merging
    ✅ Require branches to be up to date before merging
    Status checks: 
      - lint
      - test
      - build
  ✅ Require conversation resolution before merging
  ✅ Require linear history
  ✅ Do not allow bypassing the above settings
```

### Develop Branch Protection (Optional)

```yaml
Branch name pattern: develop

Protect matching branches:
  ✅ Require a pull request before merging
  ✅ Require status checks to pass before merging
```

## GitHub Secrets

### Required Secrets

Navigate to **Settings → Secrets and variables → Actions → New repository secret**:

#### Heroku Deployment
```bash
HEROKU_API_KEY          # Your Heroku API key
HEROKU_APP_NAME         # yno-libero-vino
HEROKU_STAGING_APP_NAME # yno-libero-vino-staging
HEROKU_EMAIL            # your-email@example.com
```

#### Optional Secrets
```bash
CODECOV_TOKEN           # For code coverage reports
SNYK_TOKEN              # For security scanning
SLACK_WEBHOOK           # For deployment notifications
```

### How to Get Secrets

#### Heroku API Key
```bash
heroku auth:token
```

#### Codecov Token
1. Sign up at https://codecov.io
2. Add your repository
3. Copy the upload token

#### Snyk Token
1. Sign up at https://snyk.io
2. Go to Settings → API Token
3. Copy your token

#### Slack Webhook
1. Create a Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook to your workspace
4. Copy the webhook URL

## Dependabot Configuration

Dependabot is configured to:
- Check for npm dependency updates weekly
- Group related updates (React Router, Shopify, testing)
- Auto-assign PRs to you
- Label PRs as "dependencies"

### Enable Dependabot Alerts

1. Go to **Settings → Code security and analysis**
2. Enable:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates

## Issue Templates

Three issue templates are configured:

1. **Bug Report** - For reporting bugs
2. **Feature Request** - For requesting new features
3. **Webhook Issue** - Specific template for webhook-related issues

### Customizing Templates

Edit files in `.github/ISSUE_TEMPLATE/` to customize.

## Code Owners

Configure automatic reviewer assignment in `.github/CODEOWNERS`:

```
# Default owner
* @willysair

# CRM providers
/app/lib/crm/ @willysair

# Webhooks
/app/routes/webhooks.*.tsx @willysair
```

## Additional Features

### 1. GitHub Projects

Set up a project board:

```bash
gh project create --owner willysair --title "Yno Libero Vino Roadmap"
```

Configure columns:
- 📋 Backlog
- 🔜 Todo
- 🏗️ In Progress
- 👀 In Review
- ✅ Done

### 2. GitHub Discussions

Enable discussions for:
- Q&A about wine club and loyalty features
- Feature proposals for winery needs
- Webhook troubleshooting
- Platform integration support

### 3. GitHub Wiki

Create documentation pages:
- Platform Integration Guides (Commerce7, Shopify)
- Wine Club Setup Tutorials
- Loyalty Program Configuration
- Webhook Setup Tutorials
- API Documentation
- Troubleshooting Guide

### 4. GitHub Pages (Optional)

Deploy documentation to GitHub Pages:

```bash
# Enable GitHub Pages in repository settings
# Source: Deploy from a branch
# Branch: gh-pages / root
```

### 5. Labels

Sync labels from `.github/labels.yml`:

```bash
# Install gh-label-sync
npm install -g gh-label-sync

# Sync labels
gh-label-sync --access-token <YOUR_TOKEN> willysair/yno-libero-vino
```

Or use the GitHub Actions marketplace action.

### 6. Releases

Configure automatic release notes in `.github/release.yml`.

To create a release:

```bash
# Tag a release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Or use GitHub CLI
gh release create v1.0.0 --generate-notes
```

### 7. GitHub Badges

Add badges to your README (already included):

```markdown
[![CI](https://github.com/willysair/yno-libero-vino/workflows/CI/badge.svg)](...)
[![Deploy](https://github.com/willysair/yno-libero-vino/workflows/Deploy%20to%20Heroku/badge.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](...)
```

## Monitoring Workflows

### View Workflow Runs

```bash
# List recent workflow runs
gh run list

# View specific workflow
gh run view <run-id>

# Watch a workflow
gh run watch
```

### Workflow Status

Check workflow status at:
- https://github.com/willysair/yno-libero-vino/actions

## Troubleshooting

### Workflow Failures

**Problem**: CI workflow failing

**Solution**:
1. Check workflow logs in Actions tab
2. Verify all secrets are configured
3. Ensure branch protection rules don't conflict
4. Run tests locally: `npm test`

### Deployment Issues

**Problem**: Heroku deployment failing

**Solution**:
1. Verify HEROKU_API_KEY is valid
2. Check Heroku app exists: `heroku apps:info -a yno-libero-vino`
3. Review Heroku logs: `heroku logs --tail -a yno-libero-vino`

### Dependabot Issues

**Problem**: Dependabot PRs not being created

**Solution**:
1. Verify Dependabot is enabled in settings
2. Check `.github/dependabot.yml` syntax
3. Manually trigger: Settings → Code security → Dependabot → Check for updates

## Best Practices

1. **Always use Pull Requests**: Never push directly to main
2. **Review Security Alerts**: Check weekly for security vulnerabilities
3. **Keep Dependencies Updated**: Review Dependabot PRs promptly
4. **Write Good Commit Messages**: Follow Conventional Commits
5. **Test Before Pushing**: Run `npm test` and `npm run lint` locally
6. **Use Draft PRs**: For work in progress
7. **Link Issues**: Reference issues in PR descriptions

## Next Steps

After setting up GitHub integration:

1. ✅ Configure all required secrets
2. ✅ Set up branch protection rules
3. ✅ Enable Dependabot
4. ✅ Create initial issues
5. ✅ Set up project board
6. ✅ Enable discussions
7. ✅ Invite collaborators
8. ✅ Create first release

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Analysis](https://codeql.github.com/docs/)

## Support

For help with GitHub integration:
- 📧 Email: support@ynosoftware.com
- 💬 GitHub Discussions: [Link to discussions]
- 🐛 Issues: [Link to issues]

