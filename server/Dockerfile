FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "src/index.ts"]
