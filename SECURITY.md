# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Commitment

Security is a top priority for sfparty. We follow industry best practices and conduct regular security assessments to ensure the safety and integrity of the tool.

### Security Practices

- **Regular Security Reviews**: We perform quarterly security assessments using STRIDE threat modeling
- **Dependency Scanning**: Automated vulnerability scanning of all dependencies
- **Secure Coding Practices**: Path traversal protection, command injection prevention, input validation
- **File Permissions**: All generated files use restricted permissions (0o644)
- **Error Handling**: Sanitized error messages to prevent information disclosure

### Security Controls

The following security controls are implemented:

- ✅ Path traversal prevention
- ✅ Command injection prevention  
- ✅ XML/JSON/YAML parsing protections
- ✅ File size limits to prevent DoS
- ✅ Secure file permissions
- ✅ Error message sanitization

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via one of the following methods:

1. **Email**: [Your security email - if you have one]
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature
3. **Private Issue**: Create a private security issue (if you have GitHub private repos enabled)

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

## Security Updates

Security updates are released as patch versions (e.g., 2.0.1 → 2.0.2). Critical security fixes may be released outside the normal release cycle.

## Security History

All critical security issues identified in our security assessments have been resolved. We maintain detailed security analysis documentation internally and review it quarterly.

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities. Security researchers who report valid vulnerabilities will be acknowledged (with permission) in our release notes.

---

**Last Security Review**: January 2025  
**Next Review**: April 2025

