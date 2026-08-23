#!/usr/bin/with-contenv bashio
# Reads the add-on options Home Assistant collected in its UI and hands them
# to the server as plain environment variables.

export SYNC_SHOPPING_LIST="$(bashio::config 'sync_shopping_list')"
export SYNC_CALENDAR="$(bashio::config 'sync_calendar')"
export CALENDAR_ENTITY="$(bashio::config 'calendar_entity')"
export TODAY_CALENDARS="$(bashio::config 'today_calendars' '')"
export LOG_LEVEL="$(bashio::config 'log_level')"
export DATA_DIR=/data
export WEB_ROOT=/app/www
export PORT=8099

bashio::log.info "Starting MyHiroList..."
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  bashio::log.info "Node ${NODE_MAJOR}: enabling the WebSocket client used for calendar edits."
  exec node --experimental-websocket /app/server/index.js
fi

exec node /app/server/index.js
