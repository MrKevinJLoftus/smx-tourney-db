const http = require('http');
const debug = require('debug')('smx-tdb');
const app = require('./app');

const normalizePort = val => {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
};

const onError = error => {
  if (error.svscall !== "listen") {
    throw error;
  }
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " required elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  debug("Listening on " + bind);
  console.log("Listening on " + bind);
};

const port = normalizePort(process.env.PORT || 3000);
app.set('port', port);
const server = http.createServer(app);
server.on("error", onError);
server.on("listening", onListening);
server.listen(port);
