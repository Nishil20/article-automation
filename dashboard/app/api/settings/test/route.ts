import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const wpUrl = process.env.WP_URL;
    const wpUsername = process.env.WP_USERNAME;
    const wpAppPassword = process.env.WP_APP_PASSWORD;

    if (!wpUrl || !wpUsername || !wpAppPassword) {
      return NextResponse.json({
        success: false,
        message: 'WordPress credentials not configured',
      });
    }

    // Test connection by fetching posts (public endpoint first)
    const publicResponse = await fetch(`${wpUrl}/wp-json/wp/v2/posts?per_page=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!publicResponse.ok) {
      return NextResponse.json({
        success: false,
        message: `WordPress REST API not accessible (${publicResponse.status})`,
      });
    }

    // Test authentication
    const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');
    const authResponse = await fetch(`${wpUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (authResponse.ok) {
      const user = await authResponse.json();
      return NextResponse.json({
        success: true,
        message: `Connected as ${user.name || wpUsername}`,
        user: {
          id: user.id,
          name: user.name,
          slug: user.slug,
        },
      });
    } else {
      const errorText = await authResponse.text();
      return NextResponse.json({
        success: false,
        message: `Authentication failed (${authResponse.status}): ${errorText.slice(0, 100)}`,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
