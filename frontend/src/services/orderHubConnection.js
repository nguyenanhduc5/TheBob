import * as signalR from '@microsoft/signalr';
import { ORDER_HUB_URL } from '../api/app';

let connection = null;
let startingPromise = null;
let subscriberCount = 0;
let currentToken = null;
let stopTimer = null;

function createConnection(token) {
  currentToken = token;
  return new signalR.HubConnectionBuilder()
    .withUrl(ORDER_HUB_URL, {
      accessTokenFactory: () => currentToken || token,
    })
    .withAutomaticReconnect()
    .build();
}

export async function acquireOrderHubConnection(token) {
  if (!token) return null;

  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }

  subscriberCount += 1;
  currentToken = token;

  if (!connection) {
    connection = createConnection(token);
  }

  if (connection.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  if (connection.state === signalR.HubConnectionState.Connecting && startingPromise) {
    try {
      await startingPromise;
    } catch {
      // logged below on first start attempt
    }
    return connection;
  }

  if (connection.state !== signalR.HubConnectionState.Disconnected) {
    return connection;
  }

  if (!startingPromise) {
    startingPromise = connection
      .start()
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('OrderHub connection failed:', err);
        }
        throw err;
      })
      .finally(() => {
        startingPromise = null;
      });
  }

  try {
    await startingPromise;
  } catch {
    // AbortError during React StrictMode cleanup is expected.
  }

  return connection;
}

export function releaseOrderHubConnection() {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0) return;

  if (stopTimer) clearTimeout(stopTimer);

  // Delay stop so React StrictMode remount can reuse the same connection.
  stopTimer = setTimeout(async () => {
    if (subscriberCount > 0) return;

    if (!connection) return;

    try {
      await connection.stop();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('OrderHub stop failed:', err);
      }
    } finally {
      connection = null;
      startingPromise = null;
      stopTimer = null;
    }
  }, 150);
}
