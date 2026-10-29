# Technology chart

| Technology | Use in this project |
|---|---|
| HTML5, CSS3, JavaScript | Accessible page structure, responsive styles and interaction |
| React.js 19 | Student, event, community and management views |
| Vite 8 | React development server and production build |
| Tailwind CSS 4 | Utility classes; no global preflight reset |
| Bootstrap 5 | Grid and utility modules; component design stays project-owned |
| React Router 7 | Hash-based application navigation |
| Axios | Frontend requests and private campus-to-academic HTTP client |
| Node.js 24 / Express 5 | Campus REST API, session/CSRF controls, social/event workflows |
| Python 3.12 / FastAPI | Private academic REST API |
| HTTPX / Requests | Academic requests and compatible portal adapters with TLS verification |
| APScheduler | Academic scheduled/background tasks |
| PyMongo / Mongoose | Separate academic and campus database access in MongoDB Atlas |
| JWT | Academic service authentication; campus browser sessions use HttpOnly cookies |
| REST API | Explicit campus and academic service endpoints |
| Docker / Compose | Windows-friendly isolated services, persistent media and private API network |
| PWA / service worker | Installable web shell; private API responses are not offline-cached |
| Mailpit (optional) | Local development inbox, not Internet email delivery |

Exact frontend additions in V1.3: React Router 7.18.4, Axios 1.20.0, Bootstrap 5.3.8, Tailwind CSS and its Vite plugin 4.3.3. These were resolved from the package registry and locked. Python requirements and both npm lockfiles retain exact resolved installations. A technology being available in dependencies does not imply an external provider was configured or exercised.
