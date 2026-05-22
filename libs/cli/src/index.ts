import { defineCommand, runMain } from "citty";

declare const __VERSION__: string;

const main = defineCommand({
  meta: {
    name: "create-resumable",
    version: __VERSION__,
    description: "Create Resumable apps"
  },
  run() {
    console.log("create-resumable is not implemented yet.");
  }
});

void runMain(main);
