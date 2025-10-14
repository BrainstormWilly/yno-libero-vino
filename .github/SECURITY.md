# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Yno Libero Vino seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT:

- Open a public GitHub issue
- Discuss the vulnerability publicly before it has been addressed
- Exploit the vulnerability beyond what is necessary to demonstrate it

### Please DO:

**Report security vulnerabilities by emailing security@ynosoftware.com**

Include the following information:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass, etc.)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect:

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
2. **Assessment**: We will investigate and assess the vulnerability
3. **Communication**: We will keep you informed of our progress
4. **Resolution**: We will work to address the vulnerability promptly
5. **Disclosure**: We will coordinate with you on public disclosure

### Security Response Timeline:

- **Critical**: Addressed within 7 days
- **High**: Addressed within 14 days
- **Medium**: Addressed within 30 days
- **Low**: Addressed within 60 days

## Security Best Practices

### For Developers:

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong secrets for API keys and webhooks
   - Rotate credentials regularly

2. **Webhook Security**
   - Always validate webhook signatures
   - Use HTTPS for all webhook endpoints
   - Implement rate limiting

3. **Authentication**
   - Use OAuth 2.0 for CRM integrations
   - Implement proper session management
   - Store tokens securely

4. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement proper access controls

### For Users:

1. **API Keys**
   - Keep API keys confidential
   - Rotate keys regularly
   - Use environment-specific keys

2. **Webhooks**
   - Use webhook secrets for validation
   - Monitor webhook logs for anomalies
   - Implement retry logic with backoff

3. **Access Control**
   - Use principle of least privilege
   - Review access logs regularly
   - Revoke unused credentials

## Known Security Considerations

### CRM Integration Security

#### Shopify
- Webhook validation using HMAC SHA-256
- OAuth 2.0 for authentication
- API rate limiting compliance

#### Commerce7
- Basic authentication for API access
- Optional webhook signature validation
- Tenant isolation

### Infrastructure Security

- HTTPS required for all endpoints
- Environment variable management
- Secure session storage
- CORS configuration

## Security Updates

Security updates will be released as patch versions and announced via:

- GitHub Security Advisories
- Email notifications to registered users
- Release notes and changelog

## Compliance

This project aims to comply with:

- OWASP Top 10 security standards
- SOC 2 Type II principles
- GDPR data protection requirements
- PCI DSS for payment data (if applicable)

## Bug Bounty Program

We currently do not have a formal bug bounty program. However, we greatly appreciate security researchers who responsibly disclose vulnerabilities and will acknowledge your contribution in our release notes (with your permission).

## Contact

For security-related inquiries:

- **Email**: security@ynosoftware.com
- **PGP Key**: Available upon request

For general support:

- **Email**: support@ynosoftware.com
- **GitHub Issues**: For non-security bugs and features

---

**Thank you for helping keep Yno Libero Vino and our users safe!**

