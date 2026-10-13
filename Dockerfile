# RelaxDev: Next.js static export + nginx, rewrite /api/* из rewrites.json
# https://relaxdev.ru/deploy/docker

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Creates nginx.conf.generated.template; next.config.ts switches to output: 'export' when it exists
RUN node scripts/bake-rewrites.mjs
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/nginx.conf.generated.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/out /usr/share/nginx/html

ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT

EXPOSE 8080
