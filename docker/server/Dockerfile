# Interim server stub until https://github.com/corvin-chess/server publishes an image.
# Serves GET /health only so Compose healthchecks and wiring can land now (CV-120).
FROM nginx:1.27-alpine

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
