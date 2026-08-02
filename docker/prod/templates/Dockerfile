FROM caddy:2-alpine
COPY ./ /templates
CMD ["caddy", "file-server", "-r", "/templates", "--listen", ":80"]
