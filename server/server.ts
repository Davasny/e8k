import { Packet, createServer } from "dns2";

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { gunzip } from "zlib";

/**
 * query: <filename>.s.domain.ltd - start session request
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
interface TransferSession {
  strings: transferredStrings;
  fileName: string;
  timeStarted: Date;
}
const sessions = new Map<number, TransferSession>();

const downloadsDir = join(__dirname, "remoteFiles");
if (!existsSync(downloadsDir)) {
  mkdirSync(downloadsDir, { recursive: true });
}

const server = createServer({
  udp: true,
  handle: (request, send) => {
    const response = Packet.createResponseFromRequest(request);
    const [question] = request.questions;
    const { name } = question;

    const labels = name.split(".");

    let responseIp = "1.1.1.1";
    if (labels.length === 4 && labels[1] === "s") {
      const existingSessions = Array.from(sessions.keys());
      const sessionNumber = Math.max(...existingSessions, 0) + 1;

      const filename = labels[0].replace(/(_)(?!.*\1)/, ".");

      sessions.set(sessionNumber, {
        strings: [],
        fileName: filename,
        timeStarted: new Date(),
      });
      console.log(`[${sessionNumber}] New session request, file: ${filename}`);

      responseIp = `1.0.0.${sessionNumber}`;
    }

    if (labels.length === 5 && labels[0] !== "") {
      const sessionNumber = Number(labels[2]);

      const chunkNumber = Number(labels[1]);

      console.log(`[${sessionNumber}] Data chunk received: ${chunkNumber}`);
      if (sessions.has(sessionNumber)) {
        const session = sessions.get(sessionNumber);
        session.strings[chunkNumber] = labels[0];
      }
    }

    if (labels.length === 4 && labels[0] === "1") {
      const sessionNumber = Number(labels[1]);
      console.log(`[${sessionNumber}] Finish session request`);

      if (sessions.has(sessionNumber)) {
        const session = sessions.get(sessionNumber);
        const hexData = session.strings.join("");

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
            `session-${sessionNumber}-${date.toISOString()}-${
              session.fileName
            }`,
          );

          // Write the decompressed data to file
          writeFileSync(filePath, decompressed);

          const timeTaken = date.getTime() - session.timeStarted.getTime();

          console.log(
            `Session ${sessionNumber} data written to file: ${filePath},`,
            `time taken: ${timeTaken}ms,`,
            `file size: ${decompressed.length} bytes,`,
            `speed (kb/s): ${((decompressed.length / timeTaken) * 1000 / 1024).toFixed(2)}`,
          );
        });

        sessions.delete(sessionNumber);
        responseIp = "1.0.0.1";
      } else {
        // handle incorrect session number, probably do nothing
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

server.on("listening", () => {
  console.log("DNS server listening on port 1053")
  console.log(`Saving files to: ${downloadsDir}`)
});

server.listen({
  udp: 1053,
});
