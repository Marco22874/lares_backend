/**
 * @file setup-schema.js
 * @author Marco De Luca
 * @date 2026-02-20
 * @description Creates Directus collections and fields
 *              for the Lares Cohousing project.
 *              Collections: pages, services, gallery,
 *              site_settings, seo_metadata,
 *              contact_submissions (+ translations).
 *
 * Usage: node scripts/setup-schema.js
 *
 * Requires DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN
 * environment variables.
 *
 * @update_history
 *   2026-02-20 - Initial creation
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

async function api(endpoint, method = 'GET', body = null)
{
  // Throttle to stay under rate limit
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

    // Skip if already exists
    if (
      response.status === 409 ||
      text.includes('already exists') ||
      text.includes('already has')
    )
    {
      console.log('    (already exists, skipping)');
      return {};
    }

    throw new Error(
      `${method} ${endpoint}: ` +
      `${response.status} - ${text}`
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// ============================================
// Collection creation helpers
// ============================================

async function createCollection(collection, meta = {})
{
  console.log(`  Creating collection: ${collection}`);
  await api('/collections', 'POST', {
    collection,
    meta: {
      icon: 'box',
      note: '',
      ...meta,
    },
    schema: {},
  });
}

async function createField(collection, field)
{
  console.log(
    `    Field: ${collection}.${field.field}`
  );
  await api(
    `/fields/${collection}`,
    'POST',
    field
  );
}

async function createRelation(relation)
{
  console.log(
    `    Relation: ${relation.collection} -> ` +
    `${relation.related_collection}`
  );
  await api('/relations', 'POST', relation);
}

// ============================================
// Schema definitions
// ============================================

async function createLanguages()
{
  console.log('\n--- Languages ---');

  // Create with 'code' as primary key field
  console.log('  Creating collection: languages');
  await api('/collections', 'POST', {
    collection: 'languages',
    meta: {
      icon: 'translate',
      note: 'Supported languages',
      singleton: false,
    },
    schema: {},
    fields: [
      {
        field: 'code',
        type: 'string',
        meta: {
          interface: 'input',
          note: 'Language code (it, en, de, fr)',
          width: 'half',
        },
        schema: {
          is_primary_key: true,
          max_length: 5,
          has_auto_increment: false,
        },
      },
    ],
  });

  await createField('languages', {
    field: 'name',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Language display name',
      width: 'half',
    },
    schema: {
      max_length: 50,
    },
  });

  await createField('languages', {
    field: 'direction',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'LTR', value: 'ltr' },
          { text: 'RTL', value: 'rtl' },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'ltr',
      max_length: 3,
    },
  });

  await createField('languages', {
    field: 'sort',
    type: 'integer',
    meta: {
      interface: 'input',
      hidden: true,
    },
    schema: {},
  });

  // Set sort_field on collection meta
  await api('/collections/languages', 'PATCH', {
    meta: { sort_field: 'sort' },
  });
}

async function createPages()
{
  console.log('\n--- Pages ---');

  await createCollection('pages', {
    icon: 'article',
    note: 'Website pages with translations',
    singleton: false,
  });

  await createField('pages', {
    field: 'slug',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'URL slug (e.g. chi-siamo)',
      required: true,
      width: 'half',
    },
    schema: {
      is_unique: true,
      max_length: 100,
    },
  });

  await createField('pages', {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Published', value: 'published' },
          { text: 'Draft', value: 'draft' },
          { text: 'Archived', value: 'archived' },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'draft',
      max_length: 20,
    },
  });

  await createField('pages', {
    field: 'sort',
    type: 'integer',
    meta: {
      interface: 'input',
      note: 'Sort order',
      width: 'half',
      hidden: true,
    },
    schema: {},
  });

  // Translations collection
  await createCollection('pages_translations', {
    icon: 'translate',
    hidden: true,
  });

  await createField('pages_translations', {
    field: 'pages_id',
    type: 'integer',
    meta: { hidden: true },
    schema: {},
  });

  await createField('pages_translations', {
    field: 'languages_code',
    type: 'string',
    meta: { hidden: true },
    schema: { max_length: 5 },
  });

  await createField('pages_translations', {
    field: 'title',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Page title',
      required: true,
    },
    schema: { max_length: 200 },
  });

  await createField('pages_translations', {
    field: 'content',
    type: 'text',
    meta: {
      interface: 'input-rich-text-html',
      note: 'Page content (HTML)',
    },
    schema: {},
  });

  await createField('pages_translations', {
    field: 'excerpt',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Short excerpt for previews',
    },
    schema: {},
  });

  // Relations
  await createRelation({
    collection: 'pages_translations',
    field: 'pages_id',
    related_collection: 'pages',
    meta: {
      one_field: 'translations',
      junction_field: 'languages_code',
    },
    schema: {
      on_delete: 'CASCADE',
    },
  });

  await createRelation({
    collection: 'pages_translations',
    field: 'languages_code',
    related_collection: 'languages',
    meta: {
      one_field: null,
      junction_field: 'pages_id',
    },
    schema: {
      on_delete: 'SET NULL',
    },
  });

  // Add translations field to pages
  await createField('pages', {
    field: 'translations',
    type: 'alias',
    meta: {
      interface: 'translations',
      special: ['translations'],
      options: {
        languageField: 'name',
      },
    },
  });
}

async function createServices()
{
  console.log('\n--- Services ---');

  await createCollection('services', {
    icon: 'handyman',
    note: 'Services offered',
    singleton: false,
  });

  await createField('services', {
    field: 'slug',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'URL slug',
      required: true,
      width: 'half',
    },
    schema: {
      is_unique: true,
      max_length: 100,
    },
  });

  await createField('services', {
    field: 'icon',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Material icon name',
      width: 'half',
    },
    schema: { max_length: 50 },
  });

  await createField('services', {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Published', value: 'published' },
          { text: 'Draft', value: 'draft' },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'draft',
      max_length: 20,
    },
  });

  await createField('services', {
    field: 'sort',
    type: 'integer',
    meta: {
      interface: 'input',
      hidden: true,
    },
    schema: {},
  });

  await createField('services', {
    field: 'image',
    type: 'uuid',
    meta: {
      interface: 'file-image',
      note: 'Service image',
      special: ['file'],
    },
    schema: {},
  });

  // Services translations
  await createCollection('services_translations', {
    icon: 'translate',
    hidden: true,
  });

  await createField('services_translations', {
    field: 'services_id',
    type: 'integer',
    meta: { hidden: true },
    schema: {},
  });

  await createField('services_translations', {
    field: 'languages_code',
    type: 'string',
    meta: { hidden: true },
    schema: { max_length: 5 },
  });

  await createField('services_translations', {
    field: 'title',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Service title',
      required: true,
    },
    schema: { max_length: 200 },
  });

  await createField('services_translations', {
    field: 'description',
    type: 'text',
    meta: {
      interface: 'input-rich-text-html',
      note: 'Service description (HTML)',
    },
    schema: {},
  });

  await createRelation({
    collection: 'services_translations',
    field: 'services_id',
    related_collection: 'services',
    meta: {
      one_field: 'translations',
      junction_field: 'languages_code',
    },
    schema: { on_delete: 'CASCADE' },
  });

  await createRelation({
    collection: 'services_translations',
    field: 'languages_code',
    related_collection: 'languages',
    meta: {
      one_field: null,
      junction_field: 'services_id',
    },
    schema: { on_delete: 'SET NULL' },
  });

  await createField('services', {
    field: 'translations',
    type: 'alias',
    meta: {
      interface: 'translations',
      special: ['translations'],
      options: { languageField: 'name' },
    },
  });
}

async function createGallery()
{
  console.log('\n--- Gallery ---');

  await createCollection('gallery', {
    icon: 'photo_library',
    note: 'Photo gallery',
    singleton: false,
  });

  await createField('gallery', {
    field: 'image',
    type: 'uuid',
    meta: {
      interface: 'file-image',
      note: 'Gallery image',
      special: ['file'],
      required: true,
    },
    schema: {},
  });

  await createField('gallery', {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Published', value: 'published' },
          { text: 'Draft', value: 'draft' },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'draft',
      max_length: 20,
    },
  });

  await createField('gallery', {
    field: 'sort',
    type: 'integer',
    meta: {
      interface: 'input',
      hidden: true,
    },
    schema: {},
  });

  // Gallery translations
  await createCollection('gallery_translations', {
    icon: 'translate',
    hidden: true,
  });

  await createField('gallery_translations', {
    field: 'gallery_id',
    type: 'integer',
    meta: { hidden: true },
    schema: {},
  });

  await createField('gallery_translations', {
    field: 'languages_code',
    type: 'string',
    meta: { hidden: true },
    schema: { max_length: 5 },
  });

  await createField('gallery_translations', {
    field: 'title',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Image title',
    },
    schema: { max_length: 200 },
  });

  await createField('gallery_translations', {
    field: 'alt_text',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Alt text for accessibility',
    },
    schema: { max_length: 300 },
  });

  await createField('gallery_translations', {
    field: 'caption',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Image caption',
    },
    schema: {},
  });

  await createRelation({
    collection: 'gallery_translations',
    field: 'gallery_id',
    related_collection: 'gallery',
    meta: {
      one_field: 'translations',
      junction_field: 'languages_code',
    },
    schema: { on_delete: 'CASCADE' },
  });

  await createRelation({
    collection: 'gallery_translations',
    field: 'languages_code',
    related_collection: 'languages',
    meta: {
      one_field: null,
      junction_field: 'gallery_id',
    },
    schema: { on_delete: 'SET NULL' },
  });

  await createField('gallery', {
    field: 'translations',
    type: 'alias',
    meta: {
      interface: 'translations',
      special: ['translations'],
      options: { languageField: 'name' },
    },
  });
}

async function createSiteSettings()
{
  console.log('\n--- Site Settings ---');

  await createCollection('site_settings', {
    icon: 'settings',
    note: 'Global site settings (singleton)',
    singleton: true,
  });

  await createField('site_settings', {
    field: 'site_name',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Site name',
      width: 'half',
    },
    schema: {
      default_value: 'Lares Cohousing',
      max_length: 100,
    },
  });

  await createField('site_settings', {
    field: 'logo',
    type: 'uuid',
    meta: {
      interface: 'file-image',
      note: 'Site logo',
      special: ['file'],
    },
    schema: {},
  });

  await createField('site_settings', {
    field: 'email',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Contact email',
      width: 'half',
    },
    schema: { max_length: 200 },
  });

  await createField('site_settings', {
    field: 'phone',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Contact phone',
      width: 'half',
    },
    schema: { max_length: 50 },
  });

  await createField('site_settings', {
    field: 'address',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Physical address',
    },
    schema: {},
  });

  // Site settings translations
  await createCollection(
    'site_settings_translations',
    { icon: 'translate', hidden: true }
  );

  await createField('site_settings_translations', {
    field: 'site_settings_id',
    type: 'integer',
    meta: { hidden: true },
    schema: {},
  });

  await createField('site_settings_translations', {
    field: 'languages_code',
    type: 'string',
    meta: { hidden: true },
    schema: { max_length: 5 },
  });

  await createField('site_settings_translations', {
    field: 'tagline',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Site tagline / motto',
    },
    schema: { max_length: 300 },
  });

  await createField('site_settings_translations', {
    field: 'footer_text',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Footer text',
    },
    schema: {},
  });

  await createRelation({
    collection: 'site_settings_translations',
    field: 'site_settings_id',
    related_collection: 'site_settings',
    meta: {
      one_field: 'translations',
      junction_field: 'languages_code',
    },
    schema: { on_delete: 'CASCADE' },
  });

  await createRelation({
    collection: 'site_settings_translations',
    field: 'languages_code',
    related_collection: 'languages',
    meta: {
      one_field: null,
      junction_field: 'site_settings_id',
    },
    schema: { on_delete: 'SET NULL' },
  });

  await createField('site_settings', {
    field: 'translations',
    type: 'alias',
    meta: {
      interface: 'translations',
      special: ['translations'],
      options: { languageField: 'name' },
    },
  });
}

async function createSeoMetadata()
{
  console.log('\n--- SEO Metadata ---');

  await createCollection('seo_metadata', {
    icon: 'search',
    note: 'Per-page SEO metadata with translations',
    singleton: false,
  });

  await createField('seo_metadata', {
    field: 'page_slug',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Page identifier (e.g. chi-siamo)',
      required: true,
      width: 'half',
    },
    schema: {
      is_unique: true,
      max_length: 100,
    },
  });

  await createField('seo_metadata', {
    field: 'og_image',
    type: 'uuid',
    meta: {
      interface: 'file-image',
      note: 'Social sharing image',
      special: ['file'],
    },
    schema: {},
  });

  await createField('seo_metadata', {
    field: 'twitter_card',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          {
            text: 'Summary',
            value: 'summary',
          },
          {
            text: 'Summary Large Image',
            value: 'summary_large_image',
          },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'summary_large_image',
      max_length: 30,
    },
  });

  await createField('seo_metadata', {
    field: 'canonical_url',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Override canonical URL (optional)',
      width: 'half',
    },
    schema: {
      max_length: 500,
      is_nullable: true,
    },
  });

  await createField('seo_metadata', {
    field: 'noindex',
    type: 'boolean',
    meta: {
      interface: 'boolean',
      note: 'Prevent search engine indexing',
      width: 'half',
    },
    schema: {
      default_value: false,
    },
  });

  await createField('seo_metadata', {
    field: 'json_ld_type',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Organization', value: 'Organization' },
          { text: 'WebPage', value: 'WebPage' },
          { text: 'AboutPage', value: 'AboutPage' },
          { text: 'ContactPage', value: 'ContactPage' },
        ],
      },
      width: 'half',
    },
    schema: {
      default_value: 'WebPage',
      max_length: 30,
    },
  });

  // SEO translations
  await createCollection('seo_metadata_translations', {
    icon: 'translate',
    hidden: true,
  });

  await createField('seo_metadata_translations', {
    field: 'seo_metadata_id',
    type: 'integer',
    meta: { hidden: true },
    schema: {},
  });

  await createField('seo_metadata_translations', {
    field: 'languages_code',
    type: 'string',
    meta: { hidden: true },
    schema: { max_length: 5 },
  });

  await createField('seo_metadata_translations', {
    field: 'meta_title',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Page title for SEO',
      required: true,
    },
    schema: { max_length: 200 },
  });

  await createField('seo_metadata_translations', {
    field: 'meta_description',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Meta description for search engines',
      required: true,
    },
    schema: {},
  });

  await createField('seo_metadata_translations', {
    field: 'og_title',
    type: 'string',
    meta: {
      interface: 'input',
      note: 'Override Open Graph title (optional)',
    },
    schema: {
      max_length: 200,
      is_nullable: true,
    },
  });

  await createField('seo_metadata_translations', {
    field: 'og_description',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      note: 'Override Open Graph description (optional)',
    },
    schema: { is_nullable: true },
  });

  await createRelation({
    collection: 'seo_metadata_translations',
    field: 'seo_metadata_id',
    related_collection: 'seo_metadata',
    meta: {
      one_field: 'translations',
      junction_field: 'languages_code',
    },
    schema: { on_delete: 'CASCADE' },
  });

  await createRelation({
    collection: 'seo_metadata_translations',
    field: 'languages_code',
    related_collection: 'languages',
    meta: {
      one_field: null,
      junction_field: 'seo_metadata_id',
    },
    schema: { on_delete: 'SET NULL' },
  });

  await createField('seo_metadata', {
    field: 'translations',
    type: 'alias',
    meta: {
      interface: 'translations',
      special: ['translations'],
      options: { languageField: 'name' },
    },
  });
}

async function createContactSubmissions()
{
  console.log('\n--- Contact Submissions ---');

  await createCollection('contact_submissions', {
    icon: 'mail',
    note: 'Contact form submissions (read-only)',
    singleton: false,
  });

  await createField('contact_submissions', {
    field: 'name',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      readonly: true,
    },
    schema: { max_length: 100 },
  });

  await createField('contact_submissions', {
    field: 'email',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      readonly: true,
    },
    schema: { max_length: 200 },
  });

  await createField('contact_submissions', {
    field: 'phone',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      readonly: true,
    },
    schema: {
      max_length: 30,
      is_nullable: true,
    },
  });

  await createField('contact_submissions', {
    field: 'subject',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      readonly: true,
    },
    schema: { max_length: 50 },
  });

  await createField('contact_submissions', {
    field: 'message',
    type: 'text',
    meta: {
      interface: 'input-multiline',
      readonly: true,
    },
    schema: {},
  });

  await createField('contact_submissions', {
    field: 'ip_address',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      readonly: true,
      hidden: true,
    },
    schema: {
      max_length: 45,
      is_nullable: true,
    },
  });
}

// ============================================
// Public read permissions
// ============================================

async function setPublicPermissions()
{
  console.log('\n--- Public Read Permissions ---');

  // In Directus 11, permissions use policies
  // Find the public policy
  const policiesRes = await api('/policies');
  const publicPolicy = policiesRes.data.find(
    (p) => p.name === '$t:public_label'
  );

  if (!publicPolicy)
  {
    throw new Error('Public policy not found');
  }

  const policyId = publicPolicy.id;
  console.log(`  Public policy ID: ${policyId}`);

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
    console.log(
      `  Public read: ${collection}`
    );
    await api('/permissions', 'POST', {
      policy: policyId,
      collection,
      action: 'read',
      fields: ['*'],
    });
  }

  // Public read for directus_files (assets)
  console.log('  Public read: directus_files');
  await api('/permissions', 'POST', {
    policy: policyId,
    collection: 'directus_files',
    action: 'read',
    fields: ['*'],
  });
}

// ============================================
// Main
// ============================================

async function main()
{
  console.log('=== Lares Cohousing - Schema Setup ===');
  console.log(`Directus: ${DIRECTUS_URL}\n`);

  try
  {
    await createLanguages();
    await createPages();
    await createServices();
    await createGallery();
    await createSiteSettings();
    await createSeoMetadata();
    await createContactSubmissions();
    await setPublicPermissions();

    console.log(
      '\n=== Schema setup completed! ==='
    );
  }
  catch (err)
  {
    console.error('\nSchema setup failed:', err.message);
    process.exit(1);
  }
}

main();
