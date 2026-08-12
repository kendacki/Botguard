FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY services ./services
COPY monitoring/rules.py ./monitoring/rules.py
ENV NODE_ENV=production
CMD ["node", "services/monitor/agent.js"]
