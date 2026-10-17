FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && npm start"]