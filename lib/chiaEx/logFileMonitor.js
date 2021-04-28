const { match } = require("assert");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {ChiaLogParser}=require("./chiaLogParse")
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
        parser:new ChiaLogParser()

      };
      this.#context[watch.fname].parser.on("phase",console.log)
      this.#context[watch.fname].parser.on("para",console.log)
      this.#context[watch.fname].parser.on("taskPara",console.log)
      // this.#context[watch.fname].parser.on("noHandle",console.log)
      fs.watchFile(watch.fname, (per, cur) => {
        this.onFileChanged(this.#context[watch.fname], per, cur);
      });
      this.onFileChanged(this.#context[watch.fname], fs.statSync(watch.fname), 0);
    });
  }
  async onLineReady(watch, lineBuffer) {
    // /Creating 1 plots of size 32, pool public key: /
    // console.log("line:", lineBuffer.toString());
    // console.log(watch)
    watch.parser.parseLine(lineBuffer.toString().replace(/\r/g,""))

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
      // console.log("r res",err,len,watch.pos)
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

const watchFile = "C:\\Users\\jcteng\\.chia\\chiaplotter\\job\\261857900499100-0\\";

new LogFileWatcher(watchFile);

