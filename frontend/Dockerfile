# Build stage
FROM --platform=linux/amd64 node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime substitution of the PocketBase URL placeholder (see the script header).
# nginx runs executable *.sh files in /docker-entrypoint.d/ on container startup.
COPY docker-entrypoint.d/40-pb-url.sh /docker-entrypoint.d/40-pb-url.sh
RUN chmod +x /docker-entrypoint.d/40-pb-url.sh

EXPOSE 80
