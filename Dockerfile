# syntax = docker/dockerfile:1.2
FROM node:16 as BUILD_IMAGE

WORKDIR /usr/app

COPY ./package*.json .
# Only included due to dependency issue
RUN npm ci --omit=dev

FROM node:16-slim

WORKDIR /usr/app

COPY ./src ./src
COPY ./package.json .
COPY --from=BUILD_IMAGE /usr/app/node_modules ./node_modules

RUN --mount=type=secret,id=_env,dst=/etc/secrets/.env cat /etc/secrets/.env

EXPOSE 8000

ENTRYPOINT npm start
