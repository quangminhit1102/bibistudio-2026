import { parseEnv } from "node:util";
/** Node's dotenv parser does not understand JSON quote escaping. Verify every encoded value. */
export function localEnvironmentText(values) {
  return (
    Object.entries(values)
      .map(([key, value]) => {
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof value !== "string" || /[\0\r\n]/.test(value))
          throw Error("Invalid local environment value");
        for (const quote of ["'", '"', "`"]) {
          if (value.includes(quote)) continue;
          const line = key + "=" + quote + value + quote;
          if (parseEnv(line)[key] === value) return line;
        }
        throw Error("Local environment value cannot be represented safely");
      })
      .join("\n") + "\n"
  );
}
