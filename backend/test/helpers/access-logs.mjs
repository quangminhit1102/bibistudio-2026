export function accessLogLine(options = {}) {
  const value = {
    ip: "203.0.113.42",
    time: "05/Nov/2026:14:00:01 +0700",
    request: "GET /products/a?token=secret#fragment HTTP/1.1",
    status: "200",
    bytes: "123",
    referrer: "https://example.com/story?token=secret",
    agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0",
    ...options,
  };
  return Buffer.from(
    `${value.ip} - - [${value.time}] ${JSON.stringify(value.request)} ${value.status} ${value.bytes} ${JSON.stringify(value.referrer)} ${JSON.stringify(value.agent)}`,
  );
}
