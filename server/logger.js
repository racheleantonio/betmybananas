function timestamp() {
  return new Date().toISOString();
}

function log(message, data) {
  if (data !== undefined) {
    console.log(`[${timestamp()}] ${message}`, data);
    return;
  }
  console.log(`[${timestamp()}] ${message}`);
}

function warn(message, data) {
  if (data !== undefined) {
    console.warn(`[${timestamp()}] ${message}`, data);
    return;
  }
  console.warn(`[${timestamp()}] ${message}`);
}

function error(message, data) {
  if (data !== undefined) {
    console.error(`[${timestamp()}] ${message}`, data);
    return;
  }
  console.error(`[${timestamp()}] ${message}`);
}

module.exports = { log, warn, error };
