const config = require("./config.json");

const express = require("express");
const http = require("http");
const SocketIO = require("socket.io");
const Docker = require("dockerode");

const app = express();
const server = http.Server(app);
const io = SocketIO(server);
const docker = new Docker({ socketPath: config.dockerSock });

server.listen(config.listen);

app.use("/", express.static(__dirname + "/static"));
app.use("/xterm", express.static(__dirname + "/node_modules/xterm/dist"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
	docker.createContainer({
		Image: config.image,
		AttachStdin: true,
		AttachStdout: true,
		AttachStderr: true,
		OpenStdin: true,
		Tty: true,
		StdinOnce: false
	}).then(container => {
		socket.container = container;
		return container.start();
	}).then(container => container.update({
		Memory: config.memory,
		CpuPeriod: config.cpuPeriod,
		CpuQuota: config.cpuQuota
	})).then(container => {
		socket.emit("ready", "ok");

		return container.attach({
			stream: true,
			stdin: true,
			stdout: true,
			stderr: true
		});
	}).then(stream => {
		stream.on("data", stdout => socket.emit("stdout", stdout.toString()));
		stream.on("error", stderr => socket.emit("stderr", stderr.toString()));

		socket.on("stdin", stdin => stream.write(stdin));
		socket.on("resize", dimensions => {
			socket.container.resize({
				w: dimensions.w,
				h: dimensions.h
			}).catch(err => {
				console.error(err);

				socket.emit("err", "There was an error resizing the container.");
				socket.disconnect(0);
			});
		});

		socket.on("disconnect", () => {
			console.log(`Closing container ${socket.container.id}`);
			
			socket.container.stop()
				.then(() => socket.container.remove())
				.catch(err => {
					if (err.statusCode === 304) return; // 'container already stopped' error - who cares

					console.error(err);

					socket.emit("err", "There was an error closing the container.");
					socket.disconnect(0);
				});
		});
	}).catch(err => {
		console.error(err);

		socket.emit("err", "There was an error creating the container.");
		socket.disconnect(0);
	});
});
