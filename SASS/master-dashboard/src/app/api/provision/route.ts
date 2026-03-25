import { NextResponse } from 'next/server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { companyName, contactEmail, ceoName, website, databaseUrl, planTier } = await req.json();

    if (!companyName || !databaseUrl) {
      return NextResponse.json({ error: 'Company Name and Database URL are required' }, { status: 400 });
    }

    // 1. Read the init_schema.sql blueprint
    // We are expecting it to be available 2 levels above SASS/master-dashboard/src/app/api/provision
    // Let's resolve it safely from process.cwd() assuming we run the app in master-dashboard/
    const schemaPath = path.join(process.cwd(), '..', 'init_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      return NextResponse.json({ error: `init_schema.sql not found at ${schemaPath}` }, { status: 500 });
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8').replace(/^\uFEFF/, '');

    // 2. Connect to the Tenant's Blank Postgres Database
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    await client.connect();

    // 3. Execute the massive blueprint
    try {
      await client.query(schemaSql);
      
      // 4. Inject specific tenant data (update the company_settings logo/name)
      await client.query(`
        UPDATE public.company_settings 
        SET company_name = $1, email = $2 
        WHERE id = (SELECT id FROM public.company_settings LIMIT 1)
      `, [companyName, contactEmail]);

    } catch (dbError: any) {
      await client.end();
      return NextResponse.json({ error: `Schema Execution Error: ${dbError.message}` }, { status: 500 });
    }

    await client.end();

    // 5. Generate a new License Key
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const licenseKey = `LIC-${companyName.substring(0, 4).toUpperCase()}-${randomHex}`;
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year license

    // 6. Insert into Master Controller DB
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Master database credentials (.env) are missing.");
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Insert the tenant info into the Master DB
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ 
        company_name: companyName, 
        contact_email: contactEmail, 
        ceo_name: ceoName,
        website: website,
        database_url: databaseUrl 
      })
      .select()
      .single();

    if (tenantError) throw new Error(`Failed to save tenant: ${tenantError.message}`);

    // Insert the license info linked to the tenant
    const { error: licenseError } = await supabase
      .from('licenses')
      .insert({ 
        tenant_id: tenant.id, 
        license_key: licenseKey, 
        plan_tier: planTier, 
        valid_until: validUntil 
      });

    if (licenseError) throw new Error(`Failed to save license: ${licenseError.message}`);

    // For the UI demo, we simulate success
    return NextResponse.json({
      success: true,
      tenant: { company_name: companyName, email: contactEmail },
      license: { license_key: licenseKey, plan_tier: planTier, valid_until: validUntil }
    });

  } catch (error: any) {
    console.error('Provision Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
