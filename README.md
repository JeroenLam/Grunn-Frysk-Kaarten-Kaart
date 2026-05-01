# Bordspel Musea Kaart

An interactive map showing museums that offer expansion cards for the board games **Frysk** (Friesland) and **Grunn** (Groningen).

## Features

- Interactive Leaflet map with color-coded pins (blue = Frysk, orange = Grunn)
- Sidebar with checkable museum lists and progress counters
- Visited museums are saved in localStorage and encoded in URL query params for sharing
- Share button copies a link that preserves your visited state
- Click a museum name in the sidebar to pan the map to its location
- Toggle to hide visited museums from the map
- Responsive layout for mobile devices

## Usage

Visit the live site and tick off museums as you visit them. Use the **Share** button to copy a link you can send to others — they'll see the same museums checked off.

URL format: `?frysk=2,5,8&grunn=3,7` (comma-separated museum numbers)

## Development

No build step required. Serve the root directory with any static file server:

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080.

### Re-geocoding museums

If museum data changes, update the files in `input_data/` and run:

```sh
node scripts/geocode.js
```

This queries OpenStreetMap Nominatim to resolve addresses into coordinates and writes `data/museums.json`.

## Deployment

Hosted via GitHub Pages. Configure the repo to deploy from the `main` branch root.

## Tech Stack

- Plain HTML/CSS/JS (no build step)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles
- Nominatim for one-time geocoding
