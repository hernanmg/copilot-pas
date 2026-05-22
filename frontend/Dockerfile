FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json next.config.mjs ./
RUN npm install

COPY public ./public
COPY app ./app

EXPOSE 3000

CMD ["npm", "run", "dev"]

