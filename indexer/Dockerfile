FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY services ./services
COPY deployments ./deployments
ENV NODE_ENV=production
CMD ["node", "services/indexer/indexer.js"]
