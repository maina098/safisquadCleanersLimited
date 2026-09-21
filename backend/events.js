const { EventEmitter } = require('events');
const crypto = require('crypto');
const { createClient } = require('redis');

const bus = new EventEmitter();
const history = [];
const MAX_HISTORY = 10000;
let publisher;
let redisReady = false;

async function initializeRedis() {
  if (!process.env.REDIS_URL || publisher) return;
  publisher = createClient({ url: process.env.REDIS_URL });
  publisher.on('error', (error) => console.error('Redis event transport error:', error.message));
  try {
    await publisher.connect();
    redisReady = true;
    console.log('Redis event transport connected');
  } catch (error) {
    redisReady = false;
    console.error('Redis event transport unavailable; using local event bus:', error.message);
    publisher = undefined;
  }
}

function matches(pattern, event) {
  return pattern === '*' || pattern === event || (pattern.endsWith('.*') && event.startsWith(pattern.slice(0, -1)));
}

function emit(event, payload = {}, options = {}) {
  const envelope = { id: crypto.randomUUID(), event, payload, at: new Date().toISOString() };
  if (options.persist !== false) {
    history.push(envelope);
    if (history.length > MAX_HISTORY) history.shift();
  }
  bus.emit('event', envelope);
  if (redisReady) {
    publisher.publish(`events:${event}`, JSON.stringify(envelope)).catch(() => {});
    publisher.publish('events:*', JSON.stringify(envelope)).catch(() => {});
    if (options.persist !== false) publisher.xAdd('events:stream', '*', { event, data: JSON.stringify(envelope) }).catch(() => {});
  }
  return envelope;
}

function subscribe(pattern, handler) {
  const listener = (envelope) => {
    if (matches(pattern, envelope.event)) handler(envelope);
  };
  bus.on('event', listener);
  let redisSubscriber;
  if (redisReady) {
    redisSubscriber = publisher.duplicate();
    redisSubscriber.on('error', () => {});
    redisSubscriber.connect().then(() => redisSubscriber.pSubscribe(`events:${pattern}`, (message) => {
      const envelope = JSON.parse(message);
      if (!history.some((item) => item.id === envelope.id)) {
        history.push(envelope);
        if (history.length > MAX_HISTORY) history.shift();
        handler(envelope);
      }
    })).catch(() => {});
  }
  return () => {
    bus.off('event', listener);
    if (redisSubscriber) redisSubscriber.quit().catch(() => {});
  };
}

function recentEvents(pattern = '*') {
  return history.filter((envelope) => matches(pattern, envelope.event));
}

module.exports = { emit, subscribe, recentEvents, initializeRedis };