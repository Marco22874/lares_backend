/**
 * @file index.js
 * @author Lares Cohousing Dev Team
 * @date 2026-02-11
 * @description Custom Directus endpoint for contact
 *              form submissions. Implements server-side
 *              whitelist validation, rate limiting per
 *              IP, honeypot detection, and email
 *              notification. Defense in depth against
 *              XSS and SQL injection.
 *
 * @update_history
 *   2026-02-11 - Initial creation
 */

/**
 * Whitelist patterns for allowed input values.
 * Only values matching these patterns are accepted.
 */
const ALLOWED_PATTERNS =
{
  name: /^[a-zA-ZÀ-ÿ\s'\-]{2,100}$/,
  email:
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,254}$/,
  phone: /^[\d\s+\-()]{0,20}$/,
  message: /^[\s\S]{10,2000}$/,
};

/**
 * Whitelist of allowed subject values.
 */
const ALLOWED_SUBJECTS = [
  'info',
  'visit',
  'partnership',
  'other',
];

/**
 * Rate limit: max submissions per IP within window.
 */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * In-memory rate limit store.
 * Key: IP address, Value: { count, firstRequest }
 */
const rateLimitStore = new Map();

/**
 * @description Strips all HTML tags from a string
 *              to prevent stored XSS.
 * @param {string} str - Input string
 * @returns {string} Sanitized string without HTML
 * @update 2026-02-11
 */
function stripHTML(str)
{
  if (typeof str !== 'string')
  {
    return '';
  }
  return str.replace(/<[^>]*>/g, '');
}

/**
 * @description Checks if the given IP has exceeded
 *              the rate limit for form submissions.
 * @param {string} ip - Client IP address
 * @returns {boolean} True if rate limited
 * @update 2026-02-11
 */
function isRateLimited(ip)
{
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry)
  {
    rateLimitStore.set(ip,
    {
      count: 1,
      firstRequest: now,
    });
    return false;
  }

  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS)
  {
    rateLimitStore.set(ip,
    {
      count: 1,
      firstRequest: now,
    });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX)
  {
    return true;
  }

  entry.count += 1;
  return false;
}

/**
 * @description Validates form data against whitelist
 *              patterns. Returns object with errors
 *              for any field that fails validation.
 * @param {object} data - Form data to validate
 * @returns {object} { valid: boolean, errors: object }
 * @update 2026-02-11
 */
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
    !ALLOWED_PATTERNS.email.test(data.email.trim())
  )
  {
    errors.email = 'Invalid email';
  }

  if (
    data.phone &&
    typeof data.phone === 'string' &&
    data.phone.trim() &&
    !ALLOWED_PATTERNS.phone.test(data.phone.trim())
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

/**
 * @description Registers the /contact-form endpoint
 *              with Directus. Handles POST requests
 *              with full validation pipeline.
 * @param {object} router - Express router instance
 * @param {object} context - Directus extension context
 * @returns {void}
 * @update 2026-02-11
 */
export default (router, context) =>
{
  const { services, getSchema } = context;

  router.post('/', async (req, res) =>
  {
    try
    {
      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.ip ||
        'unknown';

      if (isRateLimited(clientIp))
      {
        return res.status(429).json(
        {
          message: 'Too many requests. Try again later.',
        });
      }

      const body = req.body || {};

      if (body.honeypot)
      {
        return res.status(200).json(
        {
          message: 'Thank you for your message.',
        });
      }

      const validation = validateFormData(body);

      if (!validation.valid)
      {
        return res.status(400).json(
        {
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const sanitizedData =
      {
        name: stripHTML(body.name.trim()),
        email: body.email.trim().toLowerCase(),
        phone: body.phone
          ? stripHTML(body.phone.trim())
          : '',
        subject: body.subject,
        message: stripHTML(body.message.trim()),
        ip_address: clientIp,
        status: 'new',
      };

      const schema = await getSchema();
      const itemsService = new services.ItemsService(
        'contact_submissions',
        {
          schema,
          accountability: { admin: true },
        }
      );

      await itemsService.createOne(sanitizedData);

      try
      {
        const mailService = new services.MailService(
        {
          schema,
          accountability: { admin: true },
        });

        await mailService.send(
        {
          to: process.env.ADMIN_EMAIL,
          subject:
            `[Lares] New contact: ${sanitizedData.subject}`,
          template:
          {
            name: 'contact-notification',
            data:
            {
              name: sanitizedData.name,
              email: sanitizedData.email,
              phone: sanitizedData.phone,
              subject: sanitizedData.subject,
              message: sanitizedData.message,
            },
          },
        });
      }
      catch (mailErr)
      {
        console.error(
          'Email notification failed:',
          mailErr.message
        );
      }

      return res.status(200).json(
      {
        message: 'Message received successfully.',
      });
    }
    catch (err)
    {
      console.error(
        'Contact form error:',
        err.message
      );
      return res.status(500).json(
      {
        message: 'Internal server error.',
      });
    }
  });
};
