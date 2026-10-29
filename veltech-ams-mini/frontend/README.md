# veltech-ams-mini React frontend

From the project root run `npm run setup`, then `npm run dev`. Vite opens its development server on port 5173. The `/api/campus` proxy forwards to the Docker API on port 4100. Run `Setup.ps1` once to configure MongoDB Atlas and start the API, or `npm run dev:api` after setup.

For a different API port set `CAMPUS_PORT` in the terminal before starting Vite. `npm run build` builds the frontend. React Router uses hash URLs so static previews can navigate, but connected data still requires the backend. See the root README for Windows setup, data limitations and privacy.
