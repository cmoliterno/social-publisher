FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache bash coreutils python3 \
  && npm install -g openclaw@2026.6.11
COPY package.json ./
RUN npm install --production
COPY src/ ./src/
EXPOSE 3500
CMD ["node", "src/index.js"]
