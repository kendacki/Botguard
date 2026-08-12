FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY services ./services
COPY deployments ./deployments
ENV NODE_ENV=production
ENV API_PORT=8080
EXPOSE 8080
CMD ["node", "services/api/server.js"]
