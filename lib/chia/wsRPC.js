const WebSocket = require("ws");
const fs = require("fs");
const crypto = require("crypto");
const { config, send } = require("process");
const chiaPath = require("./path.js");
const events = require("events");

const service_wallet = "chia_wallet";
const service_full_node = "chia_full_node";
const service_farmer = "chia_farmer";
const service_harvester = "chia_harvester";
const service_simulator = "chia_full_node_simulator";
const service_daemon = "daemon";
const service_plotter = "chia plots create";
const service_wallet_ui ="wallet_ui"
class ChiaDaemonRPC extends events.EventEmitter {
  #wss;
  #connected = false;
  #plotDeamonListnerEnabled = false;
  #messageFilters = [];
  #idGeneratorInitial = process.hrtime.bigint().toString();
  #idGenerator = 0;
  #options = {
    reconnect: {
      enable: true,
      delay: 1000,
    },
  };
  #remoteTaskQueue = null;
  #remoteTaskQueueUpdateAt = 0;
  #senderCallbacks = new Map();

  constructor(url, cert, key, options) {
    super();
    this.cert = fs.readFileSync(
      cert ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/daemon/private_daemon.crt"
        )
    );
    this.key = fs.readFileSync(
      key ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/daemon/private_daemon.key"
        )
    );
    this.url = url || "wss://127.0.0.1:55400";
  }

  clearUp() {
    if (this.#wss != null) {
      this.#wss.terminate();
      this.#wss.removeAllListeners();
      this.#wss = null;
      this.#connected = false;
    }
    this.#senderCallbacks.forEach((value, key, map) => {
      map.delete(key);
      value(new Error("ClearUp"), null);
    });
  }

  //wait for connected or connected failed
  setupPhase1(callback) {
    this.#wss = new WebSocket(this.url, {
      cert: this.cert,
      key: this.key,
      rejectUnauthorized: false,
    });
    this.#wss.once("error", (e) => {
      this.clearUp();
      callback(e);
      console.error("ws phase 1 error", e);
    });

    this.#wss.once("open", () => {
      //remove start up error handler
      //on start up phase ,error equal to "connect failed"

      this.#wss.removeAllListeners("error");
      this.#senderCallbacks = new Map();
      this.#connected = true;
      callback(null);
    });
  }

  onP2Message(message) {
    //don't let next message coming before this message have been processed
    let frame = JSON.parse(message);
    // console.log("got frame",frame)
    for (let i = 0; i < this.#messageFilters.length; i++) {
      if (this.#messageFilters[i](frame)) return;
    }

    let callbackFn = this.#senderCallbacks.get(frame.request_id);
    this.#senderCallbacks.delete(frame.request_id);
    if (callbackFn != null) {
      callbackFn({ err: null, frame });
    } else {
      console.log("not expected message", message);
    }
  }
  onP2Error(err) {
    console.error("phase 2 error", err);
    this.emit("error", err);
  }
  async autoReconnect(){
    if (!this.#options.reconnect.enable) {
        this.emit("final"); //放弃重连
      }
      //后续增加重试次数
      for (;;) {
        await new Promise((r) => setTimeout(r, this.#options.reconnect.delay));
        let err = await this.connect();
        if (err == null) break;
      }
  }
  onP2Close(closeCode, closeMsg) {
    console.error("onP2Close", closeCode, closeMsg);
    this.clearUp();
    this.emit(
      "close",
      closeCode != null
        ? new Error("ws code " + closeCode + " " + closeMsg)
        : null
    );

  }
  setupPhase2() {
    this.#wss.on("message", this.onP2Message.bind(this));
    this.#wss.on("error", this.onP2Error.bind(this));
    this.#wss.on("close", this.onP2Close.bind(this));
  }
  async connect(force = false) {
    if (force) {
      if (this.#wss != null) {
        this.#wss.terminate();
      }
    } else if (this.#wss != null) {
      return null
    }
    //在于简化ws的编程模型
    let err = await new Promise((r) => this.setupPhase1(r));


    if (err == null) {
      this.setupPhase2();
      this.emit("ready")
    }
    return err;
  }

  putWaiter(request_id, resolver) {
    this.#senderCallbacks.set(request_id, resolver);
  }
  removeWaiter(request_id) {
    let has = this.#senderCallbacks.delete(request_id);
    if (!has) console.warn("No such key to remove request_id->", request_id);
    return has;
  }
  getRequestId() {
    return this.#idGeneratorInitial + this.#idGenerator++;
  }
  registerFrameFilter(filterFn) {
    this.#messageFilters.push(filterFn);
  }
  async rpcCommand(
    destination,
    command,
    data,
    ack = false,
    origin = "chaiplotter"
  ) {
    if (!this.#connected) {
      await this.connect();
    }
    let request_id = this.getRequestId();
    let outDataFrame = JSON.stringify({
      destination,
      command,
      data,
      request_id,
      ack,
      origin,
    });

    let awaitLock = new Promise((callbackFn) =>
      this.putWaiter(request_id, callbackFn)
    );
    try {
      await new Promise((r) => this.#wss.send(outDataFrame, r));
    } catch (e) {
      this.emit("error", e);
      this.removeWaiter(request_id);
      return { err: e, frame: null };
    }
    return await awaitLock;
  }

  plottingFrameFilter(frame) {
    if (frame.command == "state_changed" && frame.origin == service_plotter) {
      this.emit("plotstatus", frame.data.queue);
      this.#remoteTaskQueue = frame.data.queue;
      this.#remoteTaskQueueUpdateAt = Date.now()
      return true;
    }
    return false;
  }
  remoteQueue(id) {
    if (id == null) {
      return this.#remoteTaskQueue;
    }
    return this.#remoteTaskQueue.filter((task) => task.id == id);
  }
  get remoteQueueUpdatedTime() {
    return this.#remoteTaskQueueUpdateAt
  }
  async startPlotListener() {

    if (!this.plotDeamonListnerEnabled) {

      this.registerFrameFilter(this.plottingFrameFilter.bind(this));
      this.plotDeamonListnerEnabled = true;
      this.on("ready",this.enablePlotQueueWatcherInConnectionLifeCycle.bind(this))
    }
    return await this.enablePlotQueueWatcherInConnectionLifeCycle();
  }

  async enablePlotQueueWatcherInConnectionLifeCycle() {
    return await this.rpcCommand(service_daemon, "register_service", {
      service: service_plotter,
    });
  }
  async cmdStopPlotting(id) {
    return await this.rpcCommand(service_daemon, "stop_plotting", { id });
  }
  /*
  -k [size]: Define the size of the plot(s). For a list of k-sizes and creation times on various systems check out: k-Sizes

-n [number of plots]: The number of plots that will be made, in sequence. Once a plot is finished, it will be moved to the final location -d, before starting the next plot in the sequence.

-b [memory buffer size MiB]: Define memory/RAM usage. Default is 4608 (4.6 GiB). More RAM will marginally increase speed of plot creation. Please bear in mind that this is what is allocated to the plotting algorithm alone. Code, container, libraries etc. will require additional RAM from your system.

-f [farmer pk]: This is your "Farmer Public Key". Utilise this when you want to create plots on other machines for which you do not want to give full chia account access. To find your Chia Farmer Public Key use the following command: chia keys show

-p [pool pk]: This is your "Pool Public Key". Utilise this when you want to create plots on other machines for which you do not want to give full chia account access. To find your Chia Pool Public Key use the following command: chia keys show

-a [fingerprint]: This is the key Fingerprint used to select both the Farmer and Pool Public Keys to use. Utilize this when you want to select one key out of several in your keychain. To find your Chia Key Fingerprint use the following command: chia keys show

-t [tmp dir]: Define the temporary directory for plot creation. This is where Plotting Phase 1 (Forward Propagation) and Phase 2 (Backpropagation) both occur. The -t dir requires the largest working space: normally about 4 times the size of the final plot.

-2 [tmp dir 2]: Define a secondary temporary directory for plot creation. This is where Plotting Phase 3 (Compression) and Phase 4 (Checkpoints) occur. Depending on your OS, -2 might default to either -t or -d. Therefore, if either -t or -d are running low on space, it's recommended to set -2 manually. The -2 dir requires an equal amount of working space as the final size of the plot.

-d [final dir]: Define the final location for plot(s). Of course, -d should have enough free space as the final size of the plot. This directory is automatically added to your ~/.chia/VERSION/config/config.yaml file. You can use chia plots remove -d to remove a final directory from the configuration.

-r [number of threads]: 2 is usually optimal. Multithreading is only in phase 1 currently.

-u [number of buckets]: More buckets require less RAM but more random seeks to disk. With spinning disks you want less buckets and with NVMe more buckets. There is no significant benefit from using smaller buckets - just use 128.

-e [bitfield plotting]: Using the -e flag will disable the bitfield plotting algorithm, and revert back to the older b17 plotting style. Using the -e flag (bitfield disabled) lowers memory requirement, but also writes about 12% more data during creation of the plot. For now, SSD temp space will likely plot faster with -e (bitfield back propagation disabled) and for slower spinning disks, i.e SATA 5400/7200 rpm, not using -e (bitfield enabled) is a better option.
*/
  async cmdStartPlotting(
    service,
    t,
    d,
    b,
    u,
    r,
    a,
    e,
    x,
    overrideK,
    t2 = null,
    n = 1,
    k = 32,
    delay = 0,
    parallel = false,
    queue = "default"
  ) {
    return await this.rpcCommand(service_daemon, "start_plotting", {
      t,
      d,
      b,
      u,
      r,
      a,
      e,
      x,
      overrideK,
      t2,
      service,
      delay,
      parallel,
      k,
      n,
      queue,
    });
  }
  async cmdIsRunning(service) {
    return await this.rpcCommand(service_daemon, "is_running", { service });
  }
  async cmdStartService(service) {
    return await this.rpcCommand(service_daemon, "start_service", { service });
  }
  async cmdStopService(service) {
    return await this.rpcCommand(service_daemon, "stop_service", { service });
  }
  async cmdExit() {
    return await this.rpcCommand(service_daemon, "stop_service", {  });
  }
  async cmdGetStatus() {
    return await this.rpcCommand(service_daemon, "get_status", {  });
  }
}

async function main() {
  let cdRPC = new ChiaDaemonRPC();
  let res = await cdRPC.connect();
  console.log("connected", res);
  res = await cdRPC.startPlotListener();
  console.log("rpc result", res);
  res = await cdRPC.cmdIsRunning(service_wallet_ui);
  console.log("rpc result", res);
  res = await cdRPC.cmdGetStatus();
  console.log("rpc result", res);
  for (;;) {
    console.log(cdRPC.remoteQueue());
    await new Promise((r) => setTimeout(r, 2e3));
  }
}
//main();

module.exports = {ChiaDaemonRPC}
