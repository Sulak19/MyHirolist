#!/usr/bin/with-contenv bashio
# Reads the add-on options Home Assistant collected in its UI and hands them
# to the server as plain environment variables.

export SYNC_SHOPPING_LIST="$(bashio::config 'sync_shopping_list')"
export LOG_LEVEL="$(bashio::config 'log_level')"
export DATA_DIR=/data
export WEB_ROOT=/app/www
export PORT=8099

bashio::log.info "Starting MyHiroList..."
exec node /app/server/index.js
