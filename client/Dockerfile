# Build the Angular app, then serve it with nginx (which also proxies /api and /socket.io).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The "docker" configuration keeps apiUrl=/api, since nginx proxies it on the same origin.
RUN npx ng build --configuration production,docker \
  && cp -r dist/client/browser /site

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
EXPOSE 80
