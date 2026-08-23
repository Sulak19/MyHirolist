# BUILD_FROM must be declared before any FROM. An ARG declared after the
# first FROM belongs to that stage only, and is empty by the time the second
# stage tries to use it as its base image.
ARG BUILD_FROM

# BUILDPLATFORM pins stage 1 to the machine doing the building, so the app
# is compiled natively even when the target is aarch64. Emulating a vite
# build under QEMU is what made these runs take twenty minutes. The default
# keeps this working if the builder is not using buildx.
ARG BUILDPLATFORM=linux/amd64

# Stage 1: build the app. If this fails, no image is produced and Home
# Assistant carries on running the previous version.
FROM --platform=${BUILDPLATFORM} node:20-alpine AS build
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Stage 2: the add-on itself, on Home Assistant's base image.
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs

COPY --from=build /build/dist /app/www
COPY server/ /app/server/
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
