import { Packet, createServer } from "dns2";

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { gunzip } from "zlib";

/**
 * query: 0.domain.ltd - new session request
 * response: 1.0.0.x - session number
 * */

/**
 * query: 1.x.domain.ltd - finish session x
 * response: 1.0.0.1 - session finished
 * */

/**
 * query: <data>.y.x.domain.ltd - chunk y of data for session x
 * response: 1.0.0.1 - data received
 * */

type transferredStrings = string[];
const sessions = new Map<number, transferredStrings>();

const downloadsDir = join(__dirname, "remoteFiles");
if (!existsSync(downloadsDir)) {
  mkdirSync(downloadsDir, { recursive: true });
}

const server = createServer({
  udp: true,
  handle: (request, send, rinfo) => {
    console.log(`Received DNS request from ${rinfo.address}`);

    const response = Packet.createResponseFromRequest(request);
    const [question] = request.questions;
    const { name } = question;

    console.log(`Querying for name: ${name}`);

    const labels = name.split(".");

    let responseIp = "1.1.1.1";
    if (labels.length === 3 && labels[0] === "0") {
      console.log("New session request");
      const existingSessions = Array.from(sessions.keys());
      const sessionNumber = Math.max(...existingSessions, 0) + 1;
      responseIp = `1.0.0.${sessionNumber}`;
      sessions.set(sessionNumber, []);
    }

    if (labels.length === 4 && labels[0] === "1") {
      console.log("Finish session request");
      const sessionNumber = Number(labels[1]);
      if (sessions.has(sessionNumber)) {
        const session = sessions.get(sessionNumber);
        const hexData = session.join("");

        const buffer = Buffer.from(hexData, "hex");

        gunzip(buffer, (err, decompressed) => {
          if (err) {
            console.error("Error decompressing data", err);
            return;
          }

          const date = new Date();

          // Construct the file path within the downloads directory
          const filePath = join(
            downloadsDir,
            `session-${sessionNumber}-${date.toISOString()}.txt`,
          );

          // Write the decompressed data to file
          writeFileSync(filePath, decompressed);
          console.log(
            `Session ${sessionNumber} data written to file: ${filePath}`,
          );
        });

        sessions.delete(sessionNumber);
        responseIp = "1.0.0.1";
      } else {
        // handle incorrect session number, probably do nothing
      }
    }

    if (labels.length === 5 && labels[0] !== "") {
      console.log("Data chunk received");

      const sessionNumber = Number(labels[2]);
      const chunkNumber = Number(labels[1]);

      if (sessions.has(sessionNumber)) {
        const session = sessions.get(sessionNumber);
        session[chunkNumber] = labels[0];
      }
    }

    response.answers.push({
      name,
      type: Packet.TYPE.A,
      class: Packet.CLASS.IN,
      ttl: 1,
      address: responseIp,
    });

    send(response);
  },
});

server.on("listening", () => console.log("DNS server listening on port 1053"));

server.listen({
  udp: 1053,
});
