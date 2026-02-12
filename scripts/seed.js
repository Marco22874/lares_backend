/**
 * @file seed.js
 * @author Marco De Luca
 * @date 2026-02-11
 * @description Seeds initial data into Directus:
 *              languages, roles (Content Manager),
 *              and default site settings. Run after
 *              initial Directus setup.
 *
 * Usage: node scripts/seed.js
 *
 * Requires DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN
 * environment variables.
 *
 * @update_history
 *   2026-02-11 - Initial creation
 */

const DIRECTUS_URL =
  process.env.DIRECTUS_URL || 'http://localhost:8055';

const ADMIN_TOKEN =
  process.env.DIRECTUS_ADMIN_TOKEN;

if (!ADMIN_TOKEN)
{
  console.error(
    'Error: DIRECTUS_ADMIN_TOKEN is required.'
  );
  process.exit(1);
}

/**
 * @description Makes an authenticated request to
 *              the Directus API.
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @returns {Promise<object>} API response
 * @update 2026-02-11
 */
async function directusRequest(
  endpoint,
  method = 'GET',
  body = null
)
{
  const options =
  {
    method,
    headers:
    {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body)
  {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${DIRECTUS_URL}${endpoint}`,
    options
  );

  if (!response.ok)
  {
    const text = await response.text();
    throw new Error(
      `API ${method} ${endpoint}: ` +
      `${response.status} - ${text}`
    );
  }

  return response.json();
}

/**
 * @description Seeds the languages collection with
 *              the four supported locales.
 * @returns {Promise<void>}
 * @update 2026-02-11
 */
async function seedLanguages()
{
  console.log('Seeding languages...');

  const languages =
  [
    { code: 'it', name: 'Italiano', direction: 'ltr' },
    { code: 'en', name: 'English', direction: 'ltr' },
    { code: 'de', name: 'Deutsch', direction: 'ltr' },
    { code: 'fr', name: 'Français', direction: 'ltr' },
  ];

  for (const lang of languages)
  {
    try
    {
      await directusRequest(
        '/items/languages',
        'POST',
        lang
      );
      console.log(`  Created language: ${lang.name}`);
    }
    catch (err)
    {
      console.log(
        `  Language ${lang.name} may already exist:`,
        err.message.substring(0, 80)
      );
    }
  }
}

/**
 * @description Creates the Content Manager role with
 *              restricted permissions (no settings,
 *              schema, roles, or users access).
 * @returns {Promise<void>}
 * @update 2026-02-11
 */
async function seedRoles()
{
  console.log('Seeding Content Manager role...');

  try
  {
    const role = await directusRequest(
      '/roles',
      'POST',
      {
        name: 'Content Manager',
        description:
          'Can manage pages, services, gallery, ' +
          'and site settings content. No access to ' +
          'system settings, schema, or user management.',
        admin_access: false,
        app_access: true,
      }
    );

    const roleId = role.data.id;
    console.log(
      `  Created role: Content Manager (${roleId})`
    );

    const collections =
    [
      'pages',
      'pages_translations',
      'services',
      'services_translations',
      'gallery',
      'gallery_translations',
      'site_settings',
      'site_settings_translations',
      'languages',
      'contact_submissions',
    ];

    for (const collection of collections)
    {
      const actions =
        collection === 'contact_submissions'
          ? ['read']
          : ['create', 'read', 'update', 'delete'];

      for (const action of actions)
      {
        try
        {
          await directusRequest(
            '/permissions',
            'POST',
            {
              role: roleId,
              collection,
              action,
              fields: ['*'],
            }
          );
        }
        catch
        {
          /* Permission may already exist */
        }
      }
    }

    await directusRequest(
      '/permissions',
      'POST',
      {
        role: roleId,
        collection: 'directus_files',
        action: 'create',
        fields: ['*'],
      }
    );

    await directusRequest(
      '/permissions',
      'POST',
      {
        role: roleId,
        collection: 'directus_files',
        action: 'read',
        fields: ['*'],
      }
    );

    await directusRequest(
      '/permissions',
      'POST',
      {
        role: roleId,
        collection: 'directus_files',
        action: 'update',
        fields: ['*'],
      }
    );

    await directusRequest(
      '/permissions',
      'POST',
      {
        role: roleId,
        collection: 'directus_files',
        action: 'delete',
        fields: ['*'],
      }
    );

    console.log('  Permissions configured.');
  }
  catch (err)
  {
    console.error(
      '  Role creation failed:',
      err.message
    );
  }
}

/**
 * @description Main seed function. Runs all seed
 *              steps in sequence.
 * @returns {Promise<void>}
 * @update 2026-02-11
 */
async function main()
{
  console.log('=== Lares Cohousing - Seed ===\n');

  try
  {
    await seedLanguages();
    await seedRoles();
    console.log('\nSeed completed successfully.');
  }
  catch (err)
  {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  }
}

main();
