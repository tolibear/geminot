import { NextResponse } from 'next/server';
import { INPAINTING_CONFIG } from '@/lib/constants';

/**
 * Proxy endpoint to download AI model from GitHub releases
 * GitHub releases don't support CORS, so we proxy through our API
 */
export async function GET() {
  try {
    const response = await fetch(INPAINTING_CONFIG.MODEL_URL, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'Geminot-Model-Proxy',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': data.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Model proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to download model' },
      { status: 500 }
    );
  }
}
