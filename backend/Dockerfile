FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev 2>/dev/null || npm install
COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma 2>/dev/null || true
RUN npm run build
RUN cp src/openapi.yaml dist/openapi.yaml
CMD ["node", "dist/index.js"]
