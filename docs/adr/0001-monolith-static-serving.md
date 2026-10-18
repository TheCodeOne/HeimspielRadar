# Monolithic Static Serving via Backend

For production deployment on Cloudflare and local development, the compiled lightweight React frontend (`apps/frontend/dist`) will be served directly by the NestJS backend under the root `/`, while API endpoints remain under `/api/*`. This eliminates CORS issues, simplifies DNS configuration for custom domains like `heimspielfinder.de`, and allows running the entire application as a single deployable unit.
