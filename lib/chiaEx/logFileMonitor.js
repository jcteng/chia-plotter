const { match } = require("assert");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
class LogFileWatcher {
  #fileReadPos = { log: 0, error: 0 };
  #context = {};
  #bufferSize = 4*1024;
  constructor(jobPath) {
    this.watchList = [
      {
        fname: path.join(jobPath, "plot.log"),
        type: "log",
      },
      {
        fname: path.join(jobPath, "plot.error.log"),
        type: "error",
      },
    ];

    this.watchList.forEach((watch) => {
      this.#context[watch.fname] = {
        rlock: false,
        pos: 0,
        buf: Buffer.alloc(this.#bufferSize),
        ...watch,
      };
      fs.watchFile(watch.fname, (per, cur) => {
        this.onFileChanged(this.#context[watch.fname], per, cur);
      });
    });
  }
  async onLineReady(watch, lineBuffer) {
    // /Creating 1 plots of size 32, pool public key: /
    console.log("line:", lineBuffer.toString());
  }
  async tryReadLine(watch) {
    let [err, fd] = await new Promise((r) =>
      fs.open(watch.fname, "r", (...args) => r(args))
    );
    let bytesReaded =0
    for (;;) {
      let len, buffer;
      [err, len, buffer] = await new Promise((r) =>
        fs.read(fd, watch.buf, 0, this.#bufferSize, watch.pos, (...args) =>
          r(args)
        )
      );
      console.log("r res",err,len,watch.pos)
      if (len == 0) break;

      let cur = 0;
      let cost = 0;

      for (; cur < len; cur++) {
        if (buffer[cur] == 10) {
          await this.onLineReady(watch, buffer.slice(cost, cur));
          cost = cur + 1;
        }
      }
      watch.pos = watch.pos + cost;
      bytesReaded+=cost

      //EOF case
      if(this.#bufferSize>len) break


    }
    await new Promise((r) => fs.close(fd, r));
    return { err, bytesReaded };
  }
  async onFileChanged(watch, curfsStat, prevfsStat) {
    if (curfsStat.size > 0) {
      if (watch.rlock) return;
      watch.rlock = true;
      await this.tryReadLine(watch);
      watch.rlock = false;
    }
  }
  stopWatch() {
    this.watchList.forEach((watch) => fs.unwatchFile(watch.fname));
  }
}

const watchFile = "C:\\tempfile\\";

//new LogFileWatcher(watchFile);

// const str = "chia.plotting.create_plots       : [32mINFO    [0m Creating 1 plots of size 32, pool public key:  910ee552f83d9019ddc4a12d795b1065c1c523a5bd7a618211c2ae024f9f41c00785b0f062656ae740781c866920efd5 farmer public key: 81d59fba1cc0d4c29a84a4f3d44f3eca3c746af627b9942cfe30af79c5d26eca49deaa19e5ed48d83cb2ef866113e670[0m"

// let res = str.match(/Creating ([0-9]+) plots of size ([0-9]+), pool public key: ([a-zA-Z0-9]+) farmer public key: ([a-zA-Z0-9]+)/g)
// console.log(res)