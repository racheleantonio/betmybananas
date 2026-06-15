const PREFIX = '[BetMyBananas]';

export function clientLog(message: string, data?: unknown) {
  const time = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    console.log(`${PREFIX} ${time} ${message}`, data);
    return;
  }
  console.log(`${PREFIX} ${time} ${message}`);
}

export function clientWarn(message: string, data?: unknown) {
  const time = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    console.warn(`${PREFIX} ${time} ${message}`, data);
    return;
  }
  console.warn(`${PREFIX} ${time} ${message}`);
}

export function clientError(message: string, data?: unknown) {
  const time = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    console.error(`${PREFIX} ${time} ${message}`, data);
    return;
  }
  console.error(`${PREFIX} ${time} ${message}`);
}
