const express = require("express");
const app = express(); // Use express directly, no need to call it again
const http = require("http").createServer(app);
const io = require("socket.io")(http);
let currentTypers = [];

// add feature that enables adding additional rooms
let currentRooms = [
  { name: "General", currentUsers: [], chatHistory: [], currentTypers: [] },
  { name: "Other", currentUsers: [], chatHistory: [], currentTypers: [] },
];

app.use(express.static(__dirname));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
  return;
});

io.on("connection", function (socket) {
  let roomName = "General"; // default room to join
  let socketID = socket.id;
  let newUser = { id: socketID, name: "" };
  let foundRoom = currentRooms.find(({ name }) => name === roomName);

  socket.join(roomName);

  socket.on("room select", (newRoomName) => {
    if (roomName !== newRoomName) {
      // Remove the user from the current room's list
      const index = foundRoom.currentUsers.findIndex((user) => user.id === socket.id);
      if (index !== -1) {
        foundRoom.currentUsers.splice(index, 1);
      }

      roomName = newRoomName;
      socket.join(roomName);

      // Add the user to the new room list
      foundRoom = currentRooms.find(({ name }) => name === roomName);
      foundRoom.currentUsers.push(newUser);

      io.emit("update room user counts", currentRooms);
      io.in(roomName).emit("room join", newUser, roomName);
      io.in(roomName).emit("update users list", foundRoom.currentUsers);
      socket.emit("update room name", roomName);
    }
  });

  foundRoom.currentUsers.push(newUser);
  foundRoom.chatHistory.push({
    event: "user join",
    newUser: newUser,
    time: new Date().toLocaleTimeString(),
  });

  io.emit("update room user counts", currentRooms);
  io.in(roomName).emit("update users list", foundRoom.currentUsers);
  io.in(roomName).emit("user join", newUser);
  io.in(roomName).emit("send chat history", foundRoom.chatHistory);
  socket.emit("motd", "INFO: type /help for a list of commands.");
  socket.emit("update room name", roomName);

  socket.on("disconnect", () => {
    let socketID = socket.id;
    console.log("socket has disconnected");

    const index = foundRoom.currentUsers.findIndex((user) => user.id === socketID);
    if (index !== -1) {
      foundRoom.currentUsers.splice(index, 1);
    }

    if (currentTypers.findIndex((typer) => typer.id === socketID) !== -1) {
      const typerIndex = foundRoom.currentTypers.findIndex((typer) => typer.id === socketID);
      if (typerIndex !== -1) {
        foundRoom.currentTypers.splice(typerIndex, 1);
        console.log(foundRoom.currentTypers.length);
      }
    }

    foundRoom.chatHistory.push({
      event: "user leave",
      newUser: newUser,
      time: new Date().toLocaleTimeString(),
    });

    io.emit("update room user counts", currentRooms);
    io.in(roomName).emit("not typing", newUser, foundRoom.currentTypers);
    io.in(roomName).emit("update users list", foundRoom.currentUsers);
    io.in(roomName).emit("user leave", newUser);
  });

  socket.on("chat message", function (msg) {
    let socketID = socket.id;
    console.log("message from " + socketID + ": " + msg);

    // Check if the message contains specific words and format it accordingly
    let formattedMsg = msg;
    if (formattedMsg.includes("hello")) {
      formattedMsg = `<span style="color: red">${formattedMsg}</span>`;
    }
    if (formattedMsg.includes("world")) {
      formattedMsg = `<span style="color: blue">${formattedMsg}</span>`;
    }

    foundRoom.chatHistory.push({
      event: "chat message",
      msg: formattedMsg,
      newUser: newUser,
      time: new Date().toLocaleTimeString(),
    });

    io.in(roomName).emit("chat message", formattedMsg, newUser);
  });

  socket.on("typing", () => {
    let socketID = socket.id;
    if (foundRoom.currentTypers.findIndex((typer) => typer.id === socketID) === -1) {
      foundRoom.currentTypers.push(newUser); // Temp workaround for the listener spam
    }

    console.log("test");
    io.in(roomName).emit("typing", newUser, foundRoom.currentTypers);
  });

  socket.on("not typing", () => {
    let socketID = socket.id;

    const typerIndex = foundRoom.currentTypers.findIndex((typer) => typer.id === socketID);
    if (typerIndex !== -1) {
      foundRoom.currentTypers.splice(typerIndex, 1);
      console.log("stopped typing");
      io.in(roomName).emit("not typing", newUser, foundRoom.currentTypers);
    }
  });

  socket.on("change username", (uname) => {
    let socketID = socket.id;
    foundRoom = currentRooms.find(({ name }) => name === roomName);
    let socketIndex = foundRoom.currentUsers.findIndex((user) => user.id === socketID);

    if (socketIndex !== -1) {
      foundRoom.currentUsers[socketIndex].name = uname;
      foundRoom.chatHistory.push({
        event: "user changed name",
        newUser: foundRoom.currentUsers[socketIndex],
        time: new Date().toLocaleTimeString(),
      });
      io.in(roomName).emit("user changed name", foundRoom.currentUsers[socketIndex]);
    }
  });
});

http.listen(3000, function () {
  console.log("listening on *:3000");
});
