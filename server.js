const net = require("net");
const fs = require("fs");

const clients = new Map();
let clientIdCounter = 1;
const usernames = new Set();
const adminPassword = "EdwardHyde";

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
  usernames.add(clientName);

  client.write(`Welcome to the chat room, ${clientName}!\n`);
  client.write(
    `Available commands:\n  /w [username] [message] - Send private message\n  /username [new_name] - Change your username\n  /kick [username] [admin_password] - Kick a user (admin only)\n /clientlist - View connected clients\n`
  );

  broadcastMessage(client, `${clientName} has joined the chat.`);

  log(`${clientName} connected`);

  client.on("data", (data) => {
    const message = data.toString().trim();
    if (message.startsWith("/")) {
      handleCommand(client, message);
    } else {
      const currentName = clients.get(client);
      log(`${currentName}: ${message}`);
      broadcastMessage(client, `${currentName}: ${message}`);
    }
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

function handleCommand(client, message) {
  const parts = message.split(" ");
  const command = parts[0].toLowerCase();
  const currentName = clients.get(client);

  switch (command) {
    case "/w":
      handleWhisper(client, parts);
      break;
    case "/username":
      handleUsernameChange(client, parts);
      break;
    case "/kick":
      handleKick(client, parts);
      break;
    case "/clientlist":
      handleClientList(client);
      break;
    default:
      client.write(`Unknown command: ${command}\n`);
      log(`${currentName} attmpted unknown command: ${command}`);
  }
}

function handleWhisper(client, parts) {
  const senderName = clients.get(client);

  if (parts.length < 3) {
    client.write("Error: Whisport format is '/w [username] [messsage]'\n");
    log(`${senderName} attempted invalid whisper: insufficient arguments`);
    return;
  }

  const targetName = parts[1];
  const message = parts.slice(2).join(" ");

  if (targetName === senderName) {
    client.write("Error: You cannot whisper to yourself\n");
    log(`${senderName} attempted to whisper to self`);
    return;
  }

  let targetClient = null;
  for (const [c, name] of clients.entries()) {
    if (name === targetName) {
      targetClient = c;
      break;
    }
  }
  if (!targetClient) {
    client.write(`Error: User '${targetName}' not found\n`);
    log(
      `${senderName} attempted to whisper to non-existent user: ${targetName}`
    );
    return;
  }

  targetClient.write(`[Whisper from ${senderName}]: ${message}\n`);
  client.write(`[Whisper to ${targetName}]: ${message}\n`);
  log(`${senderName} whispered to ${targetName}: ${message}`);
}

function handleUsernameChange(client, parts) {
  const currentName = clients.get(client);

  if (parts.length !== 2) {
    client.write("Error: Username format is `/username [new_name'\n");
    log(`${currentName} attempted invalid username change: incorrect format`);
    return;
  }

  const newName = parts[1];

  if (newName === currentName) {
    client.write(
      `Error: Your username is already '${newName}' is already taken\n`
    );
    log(`${currentName} attempted to change to same name: ${newName}`);
    return;
  }

  if (usernames.has(newName)) {
    client.write(`Error: Username ${newName} is already taken\n`);
    log(`${currentName} attempted to change to taken username: ${newName}`);
    return;
  }

  usernames.delete(currentName);
  usernames.add(newName);
  clients.set(client, newName);

  client.write(
    `Success! Your username has been changed from '${currentName}' to '${newName}'\n`
  );

  broadcastMessage(client, `${currentName} is now konwn as ${newName}`);

  log(`${currentName} changed username to ${newName}`);
}

function handleClientList(client) {
  const requestingUser = clients.get(client);

  const clientNames = Array.from(clients.values()).sort();
  const totalClients = clientNames.length;

  let response = `\n=== Connected Clients (${totalClients}) ===\n`;

  clientNames.forEach((name) => {
    if (name === requestingUser) {
      response += `${name} (you)\n`;
    } else {
      response += `${name}\n`;
    }
  });

  response += `=====================\n`;

  client.write(response);

  log(`${requestingUser} requested client list`);
}

function handleKick(client, parts) {
  const senderName = clients.get(client);

  if (parts.length !== 3) {
    client.write("Error: Kick format is '/kick [username] [admin_password]'\n");
    log(`${senderName} attampted invalid kick: incorrect format`);
    return;
  }

  const targetName = parts[1];
  const password = parts[2];

  if (password !== adminPassword) {
    client.write("Error: Incorrect admin password\n");
    log(`${senderName} attempted kick with incorrect password`);
    return;
  }

  if (targetName === senderName) {
    client.write("Error: You cannot kick yourself\n");
    log(`${senderName} attempted to kick self`);
    return;
  }

  let targetClient = null;
  for (const [c, name] of clients.entries()) {
    if (name === targetName) {
      targetClient = c;
      break;
    }
  }

  if (!targetClient) {
    client.write(`Error: User '${targetName}' not found\n`);
    log(`${senderName} attempted to kick non-existent user: ${targetName}`);
    return;
  }

  targetClient.write(`You have been kicked from the chat by an admin\n`);
  log(`${targetName} was kicked by ${senderName}`);

  usernames.delete(targetName);
  clients.delete(targetClient);

  targetClient.end();

  client.write(`Successfully kicked ${targetName}\n`);

  broadcastMessage(null, `${targetName} has left the chat`);
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
