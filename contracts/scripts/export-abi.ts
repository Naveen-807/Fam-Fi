import * as fs from "fs";
import * as path from "path";

// Writes the ABIs that the relayer, indexer and app share into /abi.
const out = path.join(__dirname, "..", "..", "abi");
fs.mkdirSync(out, { recursive: true });
for (const [name, file] of [
  ["FamFi", "FamFi.sol/FamFi.json"],
  ["FamFiForwarder", "FamFiForwarder.sol/FamFiForwarder.json"],
  ["MockUSDC", "mocks/MockUSDC.sol/MockUSDC.json"],
]) {
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "src", file), "utf8"));
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(art.abi, null, 2) + "\n");
  console.log(`wrote abi/${name}.json (${art.abi.length} entries)`);
}
