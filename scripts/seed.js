/**
 * @file seed.js
 * @author Marco De Luca
 * @date 2026-02-11
 * @description Seeds initial data into Directus:
 *              languages, roles, and sample content.
 *              Run after setup-schema.js.
 *
 * Usage: node scripts/seed.js
 *
 * Requires DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN
 * environment variables.
 *
 * @update_history
 *   2026-02-11 - Initial creation
 *   2026-02-20 - Updated for Directus 11 policies,
 *                added sample content seeding
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

const sleep = (ms) =>
  new Promise((r) => setTimeout(r, ms));

/**
 * @description Makes an authenticated request to
 *              the Directus API.
 */
async function directusRequest(
  endpoint,
  method = 'GET',
  body = null
)
{
  await sleep(80);

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
    if (
      text.includes('already exists') ||
      text.includes('already has') ||
      text.includes('Duplicate')
    )
    {
      console.log('    (already exists, skipping)');
      return {};
    }
    throw new Error(
      `API ${method} ${endpoint}: ` +
      `${response.status} - ${text}`
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * @description Seeds the languages collection.
 */
async function seedLanguages()
{
  console.log('Seeding languages...');

  const languages =
  [
    {
      code: 'it', name: 'Italiano',
      direction: 'ltr', sort: 1,
    },
    {
      code: 'en', name: 'English',
      direction: 'ltr', sort: 2,
    },
    {
      code: 'de', name: 'Deutsch',
      direction: 'ltr', sort: 3,
    },
    {
      code: 'fr', name: 'Français',
      direction: 'ltr', sort: 4,
    },
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
        `  Language ${lang.name} may already exist`
      );
    }
  }
}

/**
 * @description Creates the Content Manager role with
 *              a policy in Directus 11.
 */
async function seedRoles()
{
  console.log('\nSeeding Content Manager role...');

  try
  {
    // Create role
    const role = await directusRequest(
      '/roles',
      'POST',
      {
        name: 'Content Manager',
        description:
          'Can manage content. No access to ' +
          'system settings or user management.',
        icon: 'supervised_user_circle',
      }
    );

    const roleId = role.data?.id;
    if (!roleId)
    {
      console.log('  Role already exists, skipping');
      return;
    }

    console.log(
      `  Created role: Content Manager (${roleId})`
    );

    // Create a policy for this role
    const policy = await directusRequest(
      '/policies',
      'POST',
      {
        name: 'Content Manager Policy',
        admin_access: false,
        app_access: true,
        roles: [roleId],
      }
    );

    const policyId = policy.data?.id;
    if (!policyId)
    {
      console.log('  Policy creation failed');
      return;
    }

    console.log(
      `  Created policy: ${policyId}`
    );

    // Set permissions
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
      'seo_metadata',
      'seo_metadata_translations',
      'languages',
    ];

    for (const collection of collections)
    {
      const actions =
        ['create', 'read', 'update', 'delete'];

      for (const action of actions)
      {
        try
        {
          await directusRequest(
            '/permissions',
            'POST',
            {
              policy: policyId,
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

    // Contact submissions: read only
    await directusRequest(
      '/permissions',
      'POST',
      {
        policy: policyId,
        collection: 'contact_submissions',
        action: 'read',
        fields: ['*'],
      }
    );

    // File access
    for (const action of
      ['create', 'read', 'update', 'delete']
    )
    {
      await directusRequest(
        '/permissions',
        'POST',
        {
          policy: policyId,
          collection: 'directus_files',
          action,
          fields: ['*'],
        }
      );
    }

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
 * @description Seeds sample page content.
 */
async function seedPages()
{
  console.log('\nSeeding sample pages...');

  const pages =
  [
    {
      slug: 'home',
      status: 'published',
      sort: 1,
      translations: [
        {
          languages_code: 'it',
          title: 'Benvenuti a Lares Cohousing',
          content: '<p>Scopri il nostro progetto di '
            + 'cohousing sostenibile nel cuore '
            + 'del Trentino Alto Adige.</p>',
          excerpt: 'Cohousing sostenibile in '
            + 'Trentino Alto Adige',
        },
        {
          languages_code: 'en',
          title: 'Welcome to Lares Cohousing',
          content: '<p>Discover our sustainable '
            + 'cohousing project in the heart '
            + 'of Trentino Alto Adige.</p>',
          excerpt: 'Sustainable cohousing in '
            + 'Trentino Alto Adige',
        },
        {
          languages_code: 'de',
          title: 'Willkommen bei Lares Cohousing',
          content: '<p>Entdecken Sie unser '
            + 'nachhaltiges Cohousing-Projekt '
            + 'im Herzen von Trentino '
            + 'Südtirol.</p>',
          excerpt: 'Nachhaltiges Cohousing in '
            + 'Trentino Südtirol',
        },
        {
          languages_code: 'fr',
          title: 'Bienvenue chez Lares Cohousing',
          content: '<p>Découvrez notre projet de '
            + 'cohabitation durable au coeur '
            + 'du Trentin-Haut-Adige.</p>',
          excerpt: 'Cohabitation durable au '
            + 'Trentin-Haut-Adige',
        },
      ],
    },
    {
      slug: 'chi-siamo',
      status: 'published',
      sort: 2,
      translations: [
        {
          languages_code: 'it',
          title: 'Chi Siamo',
          content: '<p>Siamo un gruppo di famiglie '
            + 'unite dalla visione di una vita '
            + 'comunitaria sostenibile.</p>',
          excerpt: 'La nostra storia e missione',
        },
        {
          languages_code: 'en',
          title: 'About Us',
          content: '<p>We are a group of families '
            + 'united by the vision of '
            + 'sustainable community living.</p>',
          excerpt: 'Our story and mission',
        },
        {
          languages_code: 'de',
          title: 'Über Uns',
          content: '<p>Wir sind eine Gruppe von '
            + 'Familien, vereint durch die '
            + 'Vision eines nachhaltigen '
            + 'Gemeinschaftslebens.</p>',
          excerpt: 'Unsere Geschichte und Mission',
        },
        {
          languages_code: 'fr',
          title: 'Qui Sommes-Nous',
          content: '<p>Nous sommes un groupe de '
            + 'familles unies par la vision '
            + 'de la vie communautaire '
            + 'durable.</p>',
          excerpt: 'Notre histoire et mission',
        },
      ],
    },
    {
      slug: 'contatti',
      status: 'published',
      sort: 3,
      translations: [
        {
          languages_code: 'it',
          title: 'Contatti',
          content: '<p>Contattaci per saperne di '
            + 'più sul nostro progetto.</p>',
          excerpt: 'Informazioni di contatto',
        },
        {
          languages_code: 'en',
          title: 'Contact',
          content: '<p>Contact us to learn more '
            + 'about our project.</p>',
          excerpt: 'Contact information',
        },
        {
          languages_code: 'de',
          title: 'Kontakt',
          content: '<p>Kontaktieren Sie uns, um '
            + 'mehr über unser Projekt '
            + 'zu erfahren.</p>',
          excerpt: 'Kontaktinformationen',
        },
        {
          languages_code: 'fr',
          title: 'Contact',
          content: '<p>Contactez-nous pour en '
            + 'savoir plus sur notre projet.</p>',
          excerpt: 'Informations de contact',
        },
      ],
    },
  ];

  for (const page of pages)
  {
    try
    {
      await directusRequest(
        '/items/pages',
        'POST',
        page
      );
      console.log(`  Created page: ${page.slug}`);
    }
    catch (err)
    {
      console.log(
        `  Page ${page.slug}: ${err.message.substring(0, 60)}`
      );
    }
  }
}

/**
 * @description Seeds site settings singleton.
 */
async function seedSiteSettings()
{
  console.log('\nSeeding site settings...');

  try
  {
    await directusRequest(
      '/items/site_settings',
      'POST',
      {
        site_name: 'Lares Cohousing',
        email: 'info@larescohousing.it',
        phone: '+39 0471 000000',
        address: 'Via Example 1\n39100 Bolzano\n'
          + 'Trentino Alto Adige, Italia',
        translations: [
          {
            languages_code: 'it',
            tagline: 'Vivere insieme, vivere meglio',
            footer_text: '© 2026 Lares Cohousing. '
              + 'Tutti i diritti riservati.',
          },
          {
            languages_code: 'en',
            tagline: 'Living together, living better',
            footer_text: '© 2026 Lares Cohousing. '
              + 'All rights reserved.',
          },
          {
            languages_code: 'de',
            tagline: 'Zusammen leben, besser leben',
            footer_text: '© 2026 Lares Cohousing. '
              + 'Alle Rechte vorbehalten.',
          },
          {
            languages_code: 'fr',
            tagline: 'Vivre ensemble, vivre mieux',
            footer_text: '© 2026 Lares Cohousing. '
              + 'Tous droits réservés.',
          },
        ],
      }
    );
    console.log('  Site settings created.');
  }
  catch (err)
  {
    console.log(
      `  Site settings: ${err.message.substring(0, 60)}`
    );
  }
}

/**
 * @description Seeds SEO metadata for pages.
 */
async function seedSeoMetadata()
{
  console.log('\nSeeding SEO metadata...');

  const seoEntries =
  [
    {
      page_slug: 'home',
      twitter_card: 'summary_large_image',
      noindex: false,
      json_ld_type: 'Organization',
      translations: [
        {
          languages_code: 'it',
          meta_title: 'Lares Cohousing - Cohousing '
            + 'Sostenibile in Trentino',
          meta_description: 'Progetto di cohousing '
            + 'sostenibile nel Trentino Alto '
            + 'Adige. Comunità, natura, futuro.',
        },
        {
          languages_code: 'en',
          meta_title: 'Lares Cohousing - Sustainable '
            + 'Cohousing in Trentino',
          meta_description: 'Sustainable cohousing '
            + 'project in Trentino Alto Adige. '
            + 'Community, nature, future.',
        },
        {
          languages_code: 'de',
          meta_title: 'Lares Cohousing - Nachhaltiges '
            + 'Cohousing in Trentino',
          meta_description: 'Nachhaltiges Cohousing-'
            + 'Projekt in Trentino Südtirol. '
            + 'Gemeinschaft, Natur, Zukunft.',
        },
        {
          languages_code: 'fr',
          meta_title: 'Lares Cohousing - Cohabitation '
            + 'Durable au Trentin',
          meta_description: 'Projet de cohabitation '
            + 'durable au Trentin-Haut-Adige. '
            + 'Communauté, nature, avenir.',
        },
      ],
    },
    {
      page_slug: 'chi-siamo',
      twitter_card: 'summary_large_image',
      noindex: false,
      json_ld_type: 'AboutPage',
      translations: [
        {
          languages_code: 'it',
          meta_title: 'Chi Siamo - Lares Cohousing',
          meta_description: 'Scopri la nostra storia, '
            + 'la missione e le persone dietro '
            + 'il progetto Lares Cohousing.',
        },
        {
          languages_code: 'en',
          meta_title: 'About Us - Lares Cohousing',
          meta_description: 'Discover our story, '
            + 'mission and the people behind '
            + 'the Lares Cohousing project.',
        },
        {
          languages_code: 'de',
          meta_title: 'Über Uns - Lares Cohousing',
          meta_description: 'Erfahren Sie mehr über '
            + 'unsere Geschichte, Mission und '
            + 'die Menschen hinter Lares.',
        },
        {
          languages_code: 'fr',
          meta_title: 'Qui Sommes-Nous - Lares',
          meta_description: 'Découvrez notre histoire, '
            + 'notre mission et les personnes '
            + 'derrière le projet Lares.',
        },
      ],
    },
    {
      page_slug: 'contatti',
      twitter_card: 'summary',
      noindex: false,
      json_ld_type: 'ContactPage',
      translations: [
        {
          languages_code: 'it',
          meta_title: 'Contatti - Lares Cohousing',
          meta_description: 'Contattaci per '
            + 'informazioni sul progetto di '
            + 'cohousing Lares.',
        },
        {
          languages_code: 'en',
          meta_title: 'Contact - Lares Cohousing',
          meta_description: 'Contact us for '
            + 'information about the Lares '
            + 'cohousing project.',
        },
        {
          languages_code: 'de',
          meta_title: 'Kontakt - Lares Cohousing',
          meta_description: 'Kontaktieren Sie uns '
            + 'für Informationen über das '
            + 'Lares Cohousing-Projekt.',
        },
        {
          languages_code: 'fr',
          meta_title: 'Contact - Lares Cohousing',
          meta_description: 'Contactez-nous pour '
            + 'des informations sur le projet '
            + 'Lares.',
        },
      ],
    },
  ];

  for (const entry of seoEntries)
  {
    try
    {
      await directusRequest(
        '/items/seo_metadata',
        'POST',
        entry
      );
      console.log(
        `  Created SEO: ${entry.page_slug}`
      );
    }
    catch (err)
    {
      console.log(
        `  SEO ${entry.page_slug}: ` +
        `${err.message.substring(0, 60)}`
      );
    }
  }
}

/**
 * @description Main seed function.
 */
async function main()
{
  console.log('=== Lares Cohousing - Seed ===\n');

  try
  {
    await seedLanguages();
    await seedRoles();
    await seedPages();
    await seedSiteSettings();
    await seedSeoMetadata();
    console.log('\nSeed completed successfully.');
  }
  catch (err)
  {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  }
}

main();
