
// Native fetch in Node v18+

async function debugEmotes() {
    try {
        console.log("Searching 7TV emotes via GQL...");
        const query = `
            query SearchEmotes($query: String!) {
                emotes(query: $query, limit: 10) {
                    items {
                        id
                        name
                    }
                }
            }
        `;

        const response = await fetch('https://7tv.io/v3/gql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { query: "kekw" }
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);

        if (data.errors) {
            console.error("GQL Errors:", JSON.stringify(data.errors, null, 2));
        } else {
            const items = data.data?.emotes?.items || [];
            console.log("Found Emotes:", items.length);
            items.forEach(e => console.log(`- ${e.name} (${e.id})`));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

debugEmotes();
