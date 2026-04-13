// Wrapper para garantir que o Electron rode em modo app (não como Node)
// Alguns ambientes exportam ELECTRON_RUN_AS_NODE, o que quebra `require("electron")` no main.js.

const { spawn } = require("child_process");

const electronBin = require("electron"); // em Node, isso retorna o path do executável

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, ["."], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

