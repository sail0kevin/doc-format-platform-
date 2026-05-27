const path = require("path");
const projectRoot = path.dirname(__dirname);
process.chdir(projectRoot);
require(path.join(projectRoot, "node_modules/next/dist/bin/next"));
