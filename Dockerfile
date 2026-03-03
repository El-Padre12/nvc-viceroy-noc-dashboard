# Stage 1 - Build
# Uses Node to install dependencies and compile the React app into static files

FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (better layer caching)
# If package.json hasn't changed, Docker skips the npm install step on rebuild
COPY package.json package-lock.json* ./

RUN npm install

# Copy the rest of the source code and build
COPY . .
RUN npm run build
# Output is now in /app/dist

# Stage 2 - Serve
# Copies only the built dist/ folder into a tiny nginx image
# No Node, no npm, no source code ends up in the final image

FROM nginx:alpine

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (handles React client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
