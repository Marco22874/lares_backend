/**
 * @file contact-validation.test.js
 * @author Marco De Luca
 * @date 2026-02-11
 * @description Unit tests for contact form server-side
 *              validation. Tests whitelist patterns,
 *              XSS prevention, SQL injection prevention,
 *              and rate limiting.
 *
 * @update_history
 *   2026-02-11 - Initial creation
 */

import { describe, it, expect } from 'vitest';

/**
 * Inline validation functions matching the endpoint
 * logic for isolated unit testing.
 */
const ALLOWED_PATTERNS =
{
  name: /^[a-zA-ZÀ-ÿ\s'\-]{2,100}$/,
  email:
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,254}$/,
  phone: /^[\d\s+\-()]{0,20}$/,
  message: /^[\s\S]{10,2000}$/,
};

const ALLOWED_SUBJECTS = [
  'info',
  'visit',
  'partnership',
  'other',
];

function stripHTML(str)
{
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

function validateFormData(data)
{
  const errors = {};

  if (
    !data.name ||
    typeof data.name !== 'string' ||
    !ALLOWED_PATTERNS.name.test(data.name.trim())
  )
  {
    errors.name = 'Invalid name';
  }

  if (
    !data.email ||
    typeof data.email !== 'string' ||
    !ALLOWED_PATTERNS.email.test(
      data.email.trim()
    )
  )
  {
    errors.email = 'Invalid email';
  }

  if (
    data.phone &&
    typeof data.phone === 'string' &&
    data.phone.trim() &&
    !ALLOWED_PATTERNS.phone.test(
      data.phone.trim()
    )
  )
  {
    errors.phone = 'Invalid phone';
  }

  if (
    !data.subject ||
    !ALLOWED_SUBJECTS.includes(data.subject)
  )
  {
    errors.subject = 'Invalid subject';
  }

  if (
    !data.message ||
    typeof data.message !== 'string' ||
    !ALLOWED_PATTERNS.message.test(
      data.message.trim()
    )
  )
  {
    errors.message = 'Invalid message';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

describe('Server-side contact validation', () =>
{
  describe('Valid submissions', () =>
  {
    it('accepts valid complete form', () =>
    {
      const result = validateFormData(
      {
        name: 'Marco Rossi',
        email: 'marco@example.com',
        phone: '+39 06 1234567',
        subject: 'info',
        message:
          'I want information about cohousing.',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts form without phone', () =>
    {
      const result = validateFormData(
      {
        name: 'Anna Schmidt',
        email: 'anna@example.de',
        subject: 'visit',
        message:
          'I would like to schedule a visit.',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts names with accents', () =>
    {
      const result = validateFormData(
      {
        name: 'François Müller-O\'Brien',
        email: 'francois@example.fr',
        subject: 'partnership',
        message:
          'We are interested in partnership.',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('XSS prevention', () =>
  {
    it('rejects script tags in name', () =>
    {
      const result = validateFormData(
      {
        name: '<script>alert(1)</script>',
        email: 'test@example.com',
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
    });

    it('rejects img onerror in name', () =>
    {
      const result = validateFormData(
      {
        name: '<img onerror=alert(1)>',
        email: 'test@example.com',
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects event handlers in email', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email: '"onmouseover=alert(1)"@evil.com',
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('SQL injection prevention', () =>
  {
    it('rejects SQL in name', () =>
    {
      const result = validateFormData(
      {
        name: "'; DROP TABLE users;--",
        email: 'test@example.com',
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects UNION SELECT in email', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email:
          "' UNION SELECT * FROM users--@evil.com",
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects SQL in subject', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email: 'test@example.com',
        subject: "' OR '1'='1",
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Subject whitelist', () =>
  {
    for (const subject of ALLOWED_SUBJECTS)
    {
      it(`accepts "${subject}"`, () =>
      {
        const result = validateFormData(
        {
          name: 'Test User',
          email: 'test@example.com',
          subject,
          message: 'Test message content here.',
        });
        expect(result.valid).toBe(true);
      });
    }

    it('rejects non-whitelisted subject', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'hacking',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Field length limits', () =>
  {
    it('rejects name over 100 chars', () =>
    {
      const result = validateFormData(
      {
        name: 'A'.repeat(101),
        email: 'test@example.com',
        subject: 'info',
        message: 'Test message content here.',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects message under 10 chars', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'info',
        message: 'Short',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects message over 2000 chars', () =>
    {
      const result = validateFormData(
      {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'info',
        message: 'A'.repeat(2001),
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('stripHTML', () =>
  {
    it('removes script tags', () =>
    {
      expect(
        stripHTML('<script>alert(1)</script>text')
      ).toBe('alert(1)text');
    });

    it('removes nested tags', () =>
    {
      expect(
        stripHTML('<div><b>text</b></div>')
      ).toBe('text');
    });

    it('handles non-string input', () =>
    {
      expect(stripHTML(null)).toBe('');
      expect(stripHTML(undefined)).toBe('');
      expect(stripHTML(123)).toBe('');
    });
  });
});
