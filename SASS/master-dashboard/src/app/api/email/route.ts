import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const { tenantId } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is missing from environment variables' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch tenant and license details
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*, licenses(*)')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) throw new Error('Tenant not found');

    const license = tenant.licenses?.[0];
    const expiryDate = new Date(license?.valid_until).toLocaleDateString();

    const result = await resend.emails.send({
      from: 'SaaS Master <billing@yourdomain.com>',
      to: tenant.contact_email,
      subject: `License Expiry Alert: ${tenant.company_name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">License Renewal Required</h2>
          <p>Dear <strong>${tenant.ceo_name || 'CEO'}</strong>,</p>
          <p>This is an automated notification from Shree Bihani Investment Pvt Ltd regarding your SaaS subscription for <strong>${tenant.company_name}</strong>.</p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>License Key:</strong> <code>${license.license_key}</code></p>
            <p><strong>Plan:</strong> ${license.plan_tier}</p>
            <p><strong>Expiry Date:</strong> <span style="color: #ef4444; font-weight: bold;">${expiryDate}</span></p>
          </div>
          <p>Please contact our support team or login to your billing portal to extend your access and avoid any service disruption.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280;">This email was sent from the TIFL Master Controller Dashboard.</p>
        </div>
      `
    });

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
