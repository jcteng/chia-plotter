let chia = require("./lib/chia");
const colors = require("colors");
const readline = require("readline");
const moment = require("moment");
async function preStartCli() {
  console.log("chia cert path is", chia.getChiaStoragePath(""));

  if (!chia.checkExisted()) {
    console.error("can't find .chia installation");
    process.exit(1);
  }
  console.log("perpare connection to daemon");
  let daemonRPC = new chia.ChiaDaemonRPC();

  console.log("perpare connection to fullNode");
  process.chia.daemonRPC = daemonRPC;

  process.chia.fullNodeRPC = new chia.FullNodeRPC();

  {
    console.log("connect to daemon...");
    let err = await daemonRPC.connect();
    if (err != null) {
      console.error("error on connect to daemon".red, err);
      process.exit(2);
    }
    console.log("connected");
  }

  let { err, frame } = await daemonRPC.startPlotListener();
  if (err != null) {
    console.error("error on listening task queue".red, err);
    process.exit(3);
  }
}

async function remove_by_state(state){
  let queue = process.chia.daemonRPC.remoteQueue() || [];
  console.log("remove_finished task");
  let promies = []
  queue
    .filter((task) => task.state == state)
    .forEach(task =>
      promies.push(process.chia.daemonRPC.cmdStopPlotting(task.id)));

  await Promise.all(promies);
}

/**
 * 组织规则
 * 首部包含 `cmd help`
 * 计划 `cmd para` 参数列表数组形式组织
 * 后部为 函数，函数名天然为key,当value is function时，该函数名自动作为命令
 *
 */
const commands = {
  "$m": "\t some feature like m",
  async m(line, a1, a2, a3) {
    console.log("m", { line, a1, a2, a3 });
  },

  "$q": "\t exit chia plotter",
  async q() {
    process.exit(0);
  },

  "$show_tasks": "\t show chia managed tasks",
  async show_tasks() {
    let queue = process.chia.daemonRPC.remoteQueue() || [];
    console.table(
      queue
        .map((task) => {
          let final = { ...task, manager: "chia" };
          final.log = final.log ? final.log.length : 0;
          return final;
        })
        .sort((a, b) => a.state.localeCompare(b.state))
    );
    let updateAt = process.chia.daemonRPC.remoteQueueUpdatedTime;
    console.log(
      "update at",
      moment(updateAt).format("YYYY-MM-DD HH:mm:ss").green,
      "in",
      moment.duration(Date.now() - updateAt).humanize().bgBlue
    );
  },

  "$stop_tasks":
    "id\t Stop then remove task by id: Eg stop_tasks 816a21c8-b158-446d-9b25-ed4379dd5c34",
  async stop_tasks(line, id) {
    let res = await process.chia.daemonRPC.cmdStopPlotting(id);
    console.log("stopTasks task", res);
  },

  "$remove_finished":
    "interval(in seconed)\t remove all finished tasks in queue.Eg: remove_finished 1",
  async remove_finished() {
    await remove_by_state("FINISHED")
  },

  "$remove_run":
    "interval(in seconed)\t stop&remove all running tasks in queue.Eg: remove_finished 1",
  async remove_run() {
    await remove_by_state("RUNNING")
  },
  "$remove_":
    "interval(in seconed)\t remove all SUBMITTED tasks in queue.Eg: remove_finished 1",
  async remove_submitted() {
    await remove_by_state("SUBMITTED")
  },

  "$help": "\tshow commands list",
  async help() {
    console.log("show support commands");
    for (let cmdstr in commands) {
      if (commands[cmdstr] instanceof Function)
        console.log(cmdstr.yellow, "", commands["$"+cmdstr]);
    }
  },
};

function completer(line) {
  let completions = [];
  if (line.startsWith("stop_tasks ")) {
    let queue = process.chia.daemonRPC.remoteQueue() || [];
    completions = queue.map(v => ("stop_tasks " + v.id + " ["+ v.state + "]"));
  }else{
    for (let cmdstr in commands) {
      if (commands[cmdstr] instanceof Function) {
        completions.push(cmdstr);
      }
    }
  }

  // console.table(completions)
  const hits = completions.filter((c) => c.startsWith(line));

  return [hits.length ? hits : completions, line];
}

async function cli_main() {
  process.title = "chia-plotter";
  process.chia = {};

  console.time("Start in ->");
  await preStartCli();
  console.timeEnd("Start in ->");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "chia plotter>".inverse.green,
    completer,
  });

  rl.prompt();
  for await (const line of rl) {
    let cmdArgs = line.trim().replace(/\s+/g, " ").split(" ");
    let cmdFn = commands[line.split(" ")[0]];
    if (cmdFn instanceof Function) {
      await cmdFn(line, ...cmdArgs.slice(1));
    } else {
      commands.help();
    }
    rl.prompt();
  }
}

cli_main();
