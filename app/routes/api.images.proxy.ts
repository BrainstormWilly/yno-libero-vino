/**
 * Image Proxy Route
 * Proxies images from Supabase storage to avoid CORS issues when app is accessed via ngrok
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Require session for security
  const session = await getAppSession(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  let imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // If imageUrl is a localhost URL, replace it with the actual Supabase URL from env
    // This ensures the server can fetch it even when accessed via ngrok
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && (imageUrl.includes('127.0.0.1') || imageUrl.includes('localhost'))) {
      // Extract the path from the localhost URL and prepend the actual Supabase URL
      try {
        const localhostUrl = new URL(imageUrl);
        let path = localhostUrl.pathname + localhostUrl.search;
        // Only remove /_defaults/ for powered-by-dark.png which is at the bucket root
        // Other default images (header.png, footer.png) are actually in the _defaults folder
        if (path.includes('/_defaults/powered-by-dark.png')) {
          path = path.replace('/_defaults/powered-by-dark.png', '/powered-by-dark.png');
        }
        imageUrl = `${supabaseUrl}${path}`;
      } catch (e) {
        // If URL parsing fails, try simple string replacement
        const pathMatch = imageUrl.match(/\/storage\/.*$/);
        if (pathMatch) {
          let path = pathMatch[0];
          // Only remove /_defaults/ for powered-by-dark.png
          if (path.includes('/_defaults/powered-by-dark.png')) {
            path = path.replace('/_defaults/powered-by-dark.png', '/powered-by-dark.png');
          }
          imageUrl = `${supabaseUrl}${path}`;
        }
      }
    }

    // Fetch the image from Supabase
    console.log('Proxying image URL:', imageUrl);
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      console.error('Failed to fetch image:', imageResponse.status, imageResponse.statusText);
      const errorText = await imageResponse.text().catch(() => 'Unknown error');
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch image', 
        status: imageResponse.status,
        details: errorText 
      }), { 
        status: imageResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageData = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Return the image with proper headers and CORS
    return new Response(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to proxy image',
      message: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

