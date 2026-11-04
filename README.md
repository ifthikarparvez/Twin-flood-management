# Digital Twin Flood Management Dashboard

A static, browser-based flood monitoring and simulation dashboard. There is no build step or package installation: the dashboard's JavaScript and CSS libraries are included under `assets/vendor/`.

## Run locally

Open `index.html` in a modern browser. For GPS access, browsers require a secure context; when Python is installed, you can serve the folder locally:

```powershell
py -m http.server 8000
```

Then open <http://localhost:8000>. A local server is recommended because browsers require a secure context (such as `localhost` or HTTPS) for location access.

## Publish with GitHub Pages

Upload the contents of this folder to a GitHub repository, then in **Settings → Pages**, choose the branch and `/ (root)` as the publishing source. The site entry point is `index.html`.

## Network and data notes

- The interface libraries and Leaflet images are local. Map backgrounds still load from OpenStreetMap or Esri, so the map requires an internet connection.
- GPS, Google Maps directions, SMS, and WhatsApp actions rely on browser/device permissions or those external services.
- Station readings, alerts, shelters, and simulation outputs are sample/demo data; this page is not connected to live flood sensors or an emergency dispatch system.

## Included third-party libraries

The pinned library files and their license texts are in `assets/vendor/`:

- Tailwind CSS 3.4.17
- Alpine.js 3.14.9
- Leaflet 1.9.4
- Chart.js 4.4.7
- Lucide 0.468.0
