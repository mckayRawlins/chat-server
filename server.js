const net = require("net");
const fs = require("fs");

const clients = new Map();
let clientIdCounter = 1;

const logStream = fs.createWriteStream("server.log");

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + "\n");
}

const server = net.createServer((client) => {
  const clientId = clientIdCounter++;
  const clientName = `Client${clientId}`;

  clients.set(client, clientName);

  client.write(`Welcome to the chat room, ${clientName}!\n`);

  broadcastMessage(client, `${clientName} has joined the chat.`);

  log(`${clientName} connected`);

  client.on("data", (data) => {
    const message = data.toString().trim();
    log(`${clientName}: ${message}`);
    broadcastMessage(client, `${clientName}: ${message}`);
  });

  client.on("end", () => {
    handleDisconnect(client);
  });

  client.on("error", (err) => {
    log(`${clientName} error: ${err.message}`);
    handleDisconnect(client);
  });
});

function broadcastMessage(sender, message) {
  for (const [client, name] of clients.entries()) {
    if (client !== sender && !client.destroyed) {
      client.write(`${message}\n`);
    }
  }
}

function handleDisconnect(client) {
  const clientName = clients.get(client);
  if (clientName) {
    log(`${clientName} disconnected`);
    broadcastMessage(client, `${clientName} has left the chat.`);
    clients.delete(client);
  }
}

const PORT = 5000;
server.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});

server.on("error", (err) => {
  log(`Server error: ${err.message}`);
});

// Clean up on exit
process.on("SIGINT", () => {
  log("Server shutting down");
  logStream.end();
  server.close();
  process.exit();
});
