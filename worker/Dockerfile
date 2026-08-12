FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY services ./services
ENV NODE_ENV=production
CMD ["node", "services/worker/worker.js"]
