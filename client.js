const net = require("net");
const fs = require("fs");

const client = net.createConnection({ port: 5000 }, () => {
  console.log("Connected to the server");
});

client.setEncoding("utf8");
client.on("data", (data) => {
  console.log(data.trim());
});

client.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit();
});

client.on("end", () => {
  console.log("Disconnected from server");
  process.exit();
});

process.stdin.setEncoding("utf8");

process.stdin.on("data", (data) => {
  const message = data.trim();

  if (message.toLowerCase() === "exit") {
    console.log("Disconnecting from server...");
    client.end();
    process.exit();
  }

  client.write(message);
});

process.on("SIGINT", () => {
  console.log("\nDisconnecting from server...");
  client.end();
  process.exit();
});
