FROM node:18-slim
WORKDIR /app

# Setup pnpm package manager
RUN npm install -g pnpm@8.1.1

# Setup proxy to API used in saleor-platform
#RUN apt-get update && apt-get install -y nginx jq
#COPY apps/storefront/nginx/dev.conf /etc/nginx/conf.d/default.conf

RUN apt-get update && apt-get install -y jq

COPY . .

# Remove Cypress from dependencies
RUN jq 'del(.devDependencies.cypress)' package.json > _.json && mv _.json package.json
RUN pnpm install

# Env variables
RUN rm .env

ARG SALEOR_API_URL
ENV SALEOR_API_URL ${SALEOR_API_URL:-http://localhost:8000/graphql/}

ARG STOREFRONT_URL
ENV STOREFRONT_URL ${STOREFRONT_URL:-http://localhost:3000}

ARG CHECKOUT_APP_URL
ENV CHECKOUT_APP_URL ${CHECKOUT_APP_URL:-http://localhost:3001}

ARG CHECKOUT_STOREFRONT_URL
ENV CHECKOUT_STOREFRONT_URL ${CHECKOUT_STOREFRONT_URL:-http://localhost:3001/checkout-spa/}

# ARG CLOUD_DEPLOYMENT_URL https://prod.demo.saleor.cloud
# ENV CLOUD_DEPLOYMENT_URL ${CLOUD_DEPLOYMENT_URL:-https://prod.demo.saleor.cloud}

ARG SENTRY_DSN
ENV SENTRY_DSN ${SENTRY_DSN}

ARG SENTRY_ENVIRONMENT
ENV SENTRY_ENVIRONMENT ${SENTRY_ENVIRONMENT}

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE ${SENTRY_RELEASE}

ENV ENABLE_EXPERIMENTAL_COREPACK 1

ENV NEXT_TELEMETRY_DISABLED 1

ARG BUILD_OPTIONS
RUN echo BUILD_OPTIONS is "${BUILD_OPTIONS}"
#RUN test -n "$APP" || (echo "APP  not set" && false)
RUN [ -z "${BUILD_OPTIONS}" ] && echo "BUILD_OPTIONS is required" && exit 1 || true

RUN pnpm turbo run build ${BUILD_OPTIONS}

# EXPOSE ${PORT}

# CMD pnpm run start ${filter}