FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Use Vite preview for a lightweight static server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]

EXPOSE 4173