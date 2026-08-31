FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx mikro-orm cache:generate --combined
RUN mkdir -p docker && npx mikro-orm schema:create --dump > docker/schema.sql 2>/dev/null; test -s docker/schema.sql || echo "-- no entities" > docker/schema.sql

RUN npm ci --omit=dev && cp -r /app/node_modules /app/node_modules_prod

FROM node:22-alpine
WORKDIR /
RUN apk add --no-cache postgresql postgresql-client redis bash

COPY --from=build /app/dist /dist
COPY --from=build /app/temp /temp
COPY --from=build /app/node_modules_prod /node_modules
COPY --from=build /app/package.json /package.json
COPY --from=build /app/docker/schema.sql /docker/schema.sql

COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
