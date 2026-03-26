# Sport Activities Dashboard

Static HTML dashboard bundle for exploring exported sport activity data.

## Included files

- `sport_activities_dashboard.html`: main launcher page
- `swim_dashboard.html`
- `walk_run_dashboard.html`
- `ride_dashboard.html`
- `rowing_dashboard.html`
- `workout_dashboard.html`
- `hike_dashboard.html`
- `other_dashboard.html`
- `activity_dashboard_data.js`: generated shared dataset for the CSV-backed dashboards
- `sport_activities_data_runtime.js`: browser-side upload/runtime layer for replacing the active CSV snapshot

## Run locally

Open `sport_activities_dashboard.html` in a browser.

If your browser blocks local file access for some features, serve the folder with a simple static server, for example:

```bash
python3 -m http.server 8000
```

Then open:

`http://localhost:8000/sport_activities_dashboard.html`

## Notes

- Chart.js and Leaflet are loaded from CDNs.
- The GitHub bundle does not include an `activities.csv` export. Upload your own file from the launcher page.
- Download `activities.csv` directly from your activity export and upload it to the dashboard exactly as provided, without renaming columns, reformatting values, or making manual edits.
- `ride`, `rowing`, `workout`, `hike`, and `other` use the uploaded CSV when present. The bundled fallback file is intentionally empty in the GitHub folder.
