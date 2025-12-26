import { NextResponse } from 'next/server';

// Tenor API (free tier, no key required for basic usage)
// Using Tenor's web search which doesn't require authentication
const TENOR_API = 'https://tenor.googleapis.com/v2/search';
const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public anonymous key (limited but works)

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const limit = searchParams.get('limit') || '20';

        if (!query) {
            return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        // Use Tenor API
        const response = await fetch(
            `${TENOR_API}?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=${limit}&media_filter=gif,tinygif`,
            { next: { revalidate: 60 } } // Cache for 60 seconds
        );

        if (!response.ok) {
            // Fallback to a simpler approach - use Giphy's public API
            const giphyResponse = await fetch(
                `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
            );

            if (!giphyResponse.ok) {
                throw new Error('GIF API failed');
            }

            const giphyData = await giphyResponse.json();
            const gifs = giphyData.data.map(gif => ({
                id: gif.id,
                title: gif.title,
                url: gif.images.original.url,
                preview: gif.images.fixed_width_small.url,
                width: parseInt(gif.images.fixed_width.width),
                height: parseInt(gif.images.fixed_width.height),
            }));

            return NextResponse.json({ gifs, source: 'giphy' });
        }

        const data = await response.json();
        const gifs = data.results?.map(gif => ({
            id: gif.id,
            title: gif.content_description || gif.title || 'GIF',
            url: gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url,
            preview: gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url,
            width: gif.media_formats?.gif?.dims?.[0] || 200,
            height: gif.media_formats?.gif?.dims?.[1] || 200,
        })) || [];

        return NextResponse.json({ gifs, source: 'tenor' });
    } catch (error) {
        console.error('GIF search error:', error);
        return NextResponse.json({ error: 'Failed to search GIFs' }, { status: 500 });
    }
}
