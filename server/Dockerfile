FROM node:22-alpine
WORKDIR /app
COPY collector.mjs analyze.mjs ./
RUN mkdir -p /data && chown node:node /data
ENV PORT=8080 DATA_DIR=/data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "collector.mjs"]
