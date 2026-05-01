#!/usr/bin/env node
/**
 * One-time geocoding script to resolve museum addresses into lat/lng coordinates.
 * Uses OpenStreetMap Nominatim API (free, no API key).
 * Rate-limited to 1 request per second per Nominatim usage policy.
 *
 * Usage: node scripts/geocode.js
 * Output: data/museums.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'museums.json');
const FRYSK_PATH = path.join(__dirname, '..', 'input_data', 'frysk_kaarten.txt');
const GRUNN_PATH = path.join(__dirname, '..', 'input_data', 'grunn_kaarten.txt');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function geocode(query) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const options = {
            headers: { 'User-Agent': 'BoardgameMuseumMap/1.0 (geocoding script)' }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const results = JSON.parse(data);
                    if (results.length > 0) {
                        resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function parseFrysk() {
    const content = fs.readFileSync(FRYSK_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const museums = [];

    for (let i = 1; i < lines.length; i++) { // skip header
        const parts = lines[i].split('\t');
        const id = parseInt(parts[0], 10);
        if (id === 1) continue; // skip "generiek scenario"
        const name = parts[1]?.trim();
        const address = parts[2]?.trim();
        const website = parts[3]?.trim();
        const postcode = parts[4]?.trim();
        if (!name || !address) continue;

        museums.push({
            id: `frysk_${id}`,
            num: id,
            name,
            address,
            website: website || '',
            postcode: postcode || '',
            game: 'frysk',
            geocodeQuery: address
        });
    }
    return museums;
}

function parseGrunn() {
    const content = fs.readFileSync(GRUNN_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const museums = [];

    for (let i = 2; i < lines.length; i++) { // skip header and separator
        const line = lines[i].trim();
        if (!line || line.startsWith('|--')) continue;

        const parts = line.split('|').map(s => s.trim()).filter(s => s);
        if (parts.length < 4) continue;

        const id = parseInt(parts[0], 10);
        const name = parts[1]?.trim();
        const place = parts[2]?.trim();
        const website = parts[3]?.trim();
        if (!name || !place) continue;

        museums.push({
            id: `grunn_${id}`,
            num: id,
            name,
            address: place,
            website: website.startsWith('http') ? website : `https://${website}`,
            game: 'grunn',
            geocodeQuery: `${name}, ${place}, Groningen, Netherlands`
        });
    }
    return museums;
}

async function main() {
    const fryskMuseums = parseFrysk();
    const grunnMuseums = parseGrunn();
    const allMuseums = [...fryskMuseums, ...grunnMuseums];

    console.log(`Geocoding ${fryskMuseums.length} Frysk museums and ${grunnMuseums.length} Grunn museums...`);

    const results = [];
    const failed = [];

    for (const museum of allMuseums) {
        process.stdout.write(`  Geocoding: ${museum.name}... `);
        const coords = await geocode(museum.geocodeQuery);

        if (coords) {
            results.push({
                id: museum.id,
                num: museum.num,
                name: museum.name,
                address: museum.address,
                website: museum.website,
                lat: coords.lat,
                lng: coords.lng,
                game: museum.game
            });
            console.log(`OK (${coords.lat}, ${coords.lng})`);
        } else {
            // Try fallback query with just place name
            const fallbackQuery = museum.game === 'grunn'
                ? `${museum.address}, Groningen, Netherlands`
                : museum.address.replace(/,.*$/, ', Friesland, Netherlands');

            process.stdout.write(`RETRY with "${fallbackQuery}"... `);
            await sleep(1100);
            const fallbackCoords = await geocode(fallbackQuery);

            if (fallbackCoords) {
                results.push({
                    id: museum.id,
                    num: museum.num,
                    name: museum.name,
                    address: museum.address,
                    website: museum.website,
                    lat: fallbackCoords.lat,
                    lng: fallbackCoords.lng,
                    game: museum.game
                });
                console.log(`OK (${fallbackCoords.lat}, ${fallbackCoords.lng})`);
            } else {
                failed.push(museum);
                console.log('FAILED');
            }
        }

        await sleep(1100); // Rate limit: 1 request per second
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    console.log(`\nDone! Wrote ${results.length} museums to ${OUTPUT_PATH}`);

    if (failed.length > 0) {
        console.log(`\nFailed to geocode ${failed.length} museums:`);
        failed.forEach(m => console.log(`  - ${m.name} (${m.geocodeQuery})`));
        console.log('\nPlease manually add coordinates for these in data/museums.json');
    }
}

main().catch(console.error);
