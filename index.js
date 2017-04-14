const config = require("./config.json");

const express = require("express");
const Docker = require("dockerode");

const app = express();
const expressWs = require("express-ws")(app);

const docker = new Docker({ socketPath: config.dockerSock });

app.use("/", express.static(__dirname + "/static"));
app.use("/xterm", express.static(__dirname + "/node_modules/xterm/dist"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

function send(socket, type, data) {
	if (socket.readyState === 1) {
		socket.send(JSON.stringify({"type": type, "data": data}));
	}
}

function ping(socket) {
	setTimeout(() => {
		send(socket, "ping", new Date());

		ping(socket);
	}, 3000);
}

app.ws("/repl", (socket, req) => {
	send(socket, "stdout", "loading...\r\n");

	ping(socket);

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
		send(socket, "ready");

		return container.attach({
			stream: true,
			stdin: true,
			stdout: true,
			stderr: true
		});
	}).then(stream => {
		stream.on("data", stdout => {
			if (!socket.containerConnected) {
				socket.containerConnected = true;

				send(socket, "stdout", "\033[2J\033[1;1H");
			}

			send(socket, "stdout", stdout.toString());
		});
		stream.on("error", stderr => send(socket, "stderr", stderr.toString()));

		socket.on("message", data => {
			try {
				let message = JSON.parse(data);

				switch (message.type) {
					case "stdin":
						stream.write(message.data);
						break;
					case "resize":
						socket.container.resize({
							w: message.data.w,
							h: message.data.h
						}).catch(err => {
							console.error(err);

							send(socket, "err", "There was an error resizing the container.");
							socket.disconnect(0);
						});
						break;
				}
			} catch(whatever) {}
		});

		socket.on("close", () => {
			console.log(`Closing container ${socket.container.id}`);

			socket.container.stop()
				.then(() => socket.container.remove())
				.catch(err => {
					if (err.statusCode === 304) return; // 'container already stopped' error - who cares

					console.error(err);

					send(socket, "err", "There was an error closing the container.");
					socket.disconnect(0);
				});
		});
	}).catch(err => {
		console.error(err);

		send(socket, "err", "There was an error creating the container.");
		socket.disconnect(0);
	});
});

app.listen(config.listen);
