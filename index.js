const express = require("express")
const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
let currentTypers = [];

// add feature that enables adding additional rooms
let currentRooms = [
  {name: "General", currentUsers: [], chatHistory: [], currentTypers: []},
  {name: "Other", currentUsers: [], chatHistory: [], currentTypers: []}
];

app.use(express.static(__dirname));

//app.get("/", function(req, res, next){
  //res.send("test");
  //next();
//})

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
  return;
});

io.on("connection", function(socket) {
  
  //console.log("a user connected");
  // on connect, add the user to the current users list
  // also create a new user, and add them to the currentUsers array
  
  let roomName = "General"; //default room to join
  let socketID = socket.id;
  let newUser = {id: socketID, name: ""};
  // looking for a specific room with matching name to the current room the user is currently in
  // there probably is a problem with this declaration, may be the source of some other issues
  let foundRoom = currentRooms.find(({name})=>{return name===roomName}); 
  //currentUsers.push(socketID);
  
  socket.join(roomName);
  // if user wants to change rooms later on
  socket.on("room select", (newRoomName)=>{
    //console.log("test");
    if(roomName!==newRoomName){
      // splice the user from the current room's list first
      currentRooms.find(({name})=>{return name===roomName}).currentUsers.splice(currentRooms.find(({name})=>{return name===roomName}).currentUsers.map((e)=>{return e.id}).indexOf(socket.id));
      //io.in(roomName).emit("update users list", foundRoom.currentUsers);
      
      roomName = newRoomName;
      socket.join(roomName);
      
      // need to keep a currentUsers list for each room
      // add the user to the new room list
      currentRooms.find(({name})=>{return name===roomName}).currentUsers.push(newUser)
      //console.log(currentRooms.find(({name})=>{return name===roomName}).currentUsers);
      //currentUsers.splice(currentUsers.map(function(e){return e.id}).indexOf(socket.id));
      io.emit("update room user counts", currentRooms);
      io.in(roomName).emit("room join", newUser, roomName);
      io.in(roomName).emit("update users list", currentRooms.find(({name})=>{return name===roomName}).currentUsers);
      socket.emit("update room name", roomName);
    }
  })

  // this breaks every reference to the currentUsers array, use currentUsers.map(function(e){e.id}).indexOf("text") to fix
  foundRoom.currentUsers.push(newUser);

  foundRoom.chatHistory.push({event:"user join", newUser: newUser, time: new Date().toLocaleTimeString()});

  io.emit("update room user counts", currentRooms);
  io.in(roomName).emit("update users list", foundRoom.currentUsers);
  io.in(roomName).emit("user join", newUser);
  io.in(roomName).emit("send chat history", foundRoom.chatHistory);
  socket.emit("motd", "INFO: type /help for a list of commands.");
  socket.emit("update room name", roomName);

  socket.on("disconnect", () => {
    // if user leaves while typing, gets rid of their name in typing div
    // also clears the users name from the user list
    let socketID = socket.id;
    console.log("socket has disconnected");

    //currentUsers.splice(currentUsers.indexOf(socketID), 1);
    foundRoom.currentUsers.splice(foundRoom.currentUsers.map((e)=>{return e.id}).indexOf(socketID));

    //if(currentTypers.indexOf(socketID) !== -1){
      if(currentTypers.map(function(e){return e.id}).indexOf(socketID) !== -1){

        foundRoom.currentTypers.splice(foundRoom.currentTypers.map((e)=>{return e.id}).indexOf(socketID));
      console.log(foundRoom.currentTypers.length)
    }

    foundRoom.chatHistory.push({event:"user leave", newUser:newUser, time:new Date().toLocaleTimeString()});

    io.emit("update room user counts", currentRooms);
    io.in(roomName).emit("not typing", newUser, foundRoom.currentTypers);
    io.in(roomName).emit("update users list", foundRoom.currentUsers);
    io.in(roomName).emit("user leave", newUser);
  });

  socket.on("chat message", function(msg) {
    let socketID = socket.id
    console.log("message from " + socketID + ": " + msg);

    foundRoom.chatHistory.push({event: "chat message", msg:msg, newUser:newUser, time: new Date().toLocaleTimeString()})
    io.in(roomName).emit("chat message", msg, newUser);
  });

  // checks if user is typing
  socket.on("typing", () => {
    let socketID = socket.id;
    if(foundRoom.currentTypers.map(function(e){return e.id}).indexOf(socketID) === -1){
      
      foundRoom.currentTypers.push(newUser) //temp workaround for the listener spam
    }
    
    console.log("test");
    io.in(roomName).emit("typing", newUser, foundRoom.currentTypers);
  })

  // checks if user has stopped typing
  socket.on("not typing", ()=>{
    let socketID = socket.id;

    if(foundRoom.currentTypers.map(function(e){return e.id}).indexOf(socketID) !== -1){
      console.log("here")

      foundRoom.currentTypers.splice(foundRoom.currentTypers.map((e)=>{return e.id}).indexOf(socketID), 1)
    }
    
    console.log("stopped typing");
    io.in(roomName).emit("not typing", newUser, foundRoom.currentTypers);
  })

  socket.on("change username", (uname)=>{
    let socketID = socket.id;
    foundRoom = currentRooms.find(({name})=>{return name===roomName}); 
    let socketIndex = foundRoom.currentUsers.map((e)=>{return e.id}).indexOf(socketID)
    // currentUsers is currently empty, fill it up with users
    if(socketIndex !== -1){
      // will find the user with the correct socketID, and swap its name to "uname"
      foundRoom.currentUsers[socketIndex].name = uname;

      foundRoom.chatHistory.push({event:"user changed name", newUser: foundRoom.currentUsers[socketIndex], time: new Date().toLocaleTimeString()});
      io.in(roomName).emit("user changed name", foundRoom.currentUsers[socketIndex]);
    }
  })
});

http.listen(3000, function() {
  console.log("listening on *:3000");
});
