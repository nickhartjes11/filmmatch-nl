import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL('/?auth=not-configured', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?auth=confirmation-failed', request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const destination = error ? '/?auth=confirmation-failed' : '/?auth=confirmed';
  return NextResponse.redirect(new URL(destination, request.url));
}
